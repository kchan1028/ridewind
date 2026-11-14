import { AppError } from './errors';
import type { Route, TrackPoint } from './geo';

export const MAX_GPX_BYTES = 25 * 1024 * 1024;

function childText(el: Element, localName: string): string | null {
  for (const c of Array.from(el.children)) {
    if (c.localName === localName) return c.textContent?.trim() || null;
  }
  return null;
}

function routeName(doc: Document, fallback: string): string {
  const containers = ['metadata', 'trk', 'rte'];
  for (const name of containers) {
    for (const el of Array.from(doc.getElementsByTagNameNS('*', name))) {
      const n = childText(el, 'name');
      if (n) return n.slice(0, 100);
    }
  }
  return fallback;
}

/**
 * Parses GPX 1.0/1.1 text into a route. Uses track points when present,
 * otherwise route points. Timestamps and other extensions are discarded so
 * saved routes do not keep ride history.
 */
export function parseGpx(text: string, fallbackName = 'Imported route'): Route {
  if (!text || !text.trim()) {
    throw new AppError('GPX_EMPTY_FILE', 'That file is empty. Choose a GPX file exported from your route planner or bike computer.');
  }

  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new AppError('GPX_INVALID_XML', "That file isn't valid GPX (the XML couldn't be read). Try exporting it again.");
  }
  if (doc.documentElement.localName !== 'gpx') {
    throw new AppError('GPX_NOT_GPX', "That file isn't a GPX file. RideWind accepts .gpx routes and tracks.");
  }

  let source: Route['source'] = 'track';
  let els = Array.from(doc.getElementsByTagNameNS('*', 'trkpt'));
  if (els.length === 0) {
    source = 'route';
    els = Array.from(doc.getElementsByTagNameNS('*', 'rtept'));
  }
  if (els.length === 0) {
    const hasWpt = doc.getElementsByTagNameNS('*', 'wpt').length > 0;
    throw new AppError(
      'GPX_NO_POINTS',
      hasWpt
        ? 'This GPX file only has waypoints. RideWind needs a track or a route, which most route planners and bike computers export.'
        : 'No track or route points were found in this GPX file.',
    );
  }

  const points: TrackPoint[] = [];
  let invalid = 0;
  for (const el of els) {
    const lat = Number.parseFloat(el.getAttribute('lat') ?? '');
    const lon = Number.parseFloat(el.getAttribute('lon') ?? '');
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      invalid++;
      continue;
    }
    const eleText = childText(el, 'ele');
    const eleNum = eleText === null ? Number.NaN : Number.parseFloat(eleText);
    const ele = Number.isFinite(eleNum) ? eleNum : null;
    const prev = points[points.length - 1];
    if (prev && prev.lat === lat && prev.lon === lon) {
      if (prev.ele === null && ele !== null) prev.ele = ele;
      continue;
    }
    points.push({ lat, lon, ele });
  }

  if (points.length === 0 && invalid > 0) {
    throw new AppError('GPX_BAD_COORDS', 'Every point in this GPX has missing or out-of-range coordinates.');
  }
  if (points.length < 2) {
    throw new AppError('GPX_TOO_FEW_POINTS', 'This GPX has fewer than two distinct points, so there is no route to ride.');
  }

  return { name: routeName(doc, fallbackName), points, source };
}
