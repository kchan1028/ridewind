import { AppError } from './errors';
import { cumulativeDistances, haversineM, type LatLon, type Route, type TrackPoint } from './geo';

/** Name used when the rider finishes a drawn route without typing one. */
export const DRAWN_ROUTE_NAME = 'Drawn route';
/** Most points a rider can place by hand. */
export const MAX_DRAWN_POINTS = 500;
/** A tap closer than this to the last point is treated as a double tap, not a new point. */
export const MIN_DRAWN_GAP_M = 2;
/**
 * Spacing of the points in a finished drawn route. Each straight leg is filled
 * in so the map colouring, wind sampling and elevation lookup follow it like a
 * recorded track rather than jumping corner to corner.
 */
export const DRAWN_SPACING_M = 100;
/** Upper bound on points in a finished route; very long legs get wider spacing instead. */
export const MAX_DENSIFIED_POINTS = 5000;

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

/**
 * Adds a point to the end of a draft. Returns the new list, or null when the
 * point isn't added: the draft is full, the coordinates are invalid, or it is
 * on top of the last point.
 */
export function addDrawnPoint(points: readonly LatLon[], p: LatLon): LatLon[] | null {
  if (points.length >= MAX_DRAWN_POINTS) return null;
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) return null;
  const next = { lat: round6(p.lat), lon: round6(p.lon) };
  const last = points[points.length - 1];
  if (last && haversineM(last, next) < MIN_DRAWN_GAP_M) return null;
  return [...points, next];
}

/** The draft without its last point. */
export function undoDrawnPoint(points: readonly LatLon[]): LatLon[] {
  return points.slice(0, -1);
}

/** Straight-line length of a draft in metres. */
export function drawnDistanceM(points: readonly LatLon[]): number {
  return points.length < 2 ? 0 : cumulativeDistances(points as LatLon[])[points.length - 1]!;
}

/** Fills each straight leg with evenly spaced points no more than `spacingM` apart (wider if that would pass `maxPoints`). */
export function densify(points: readonly LatLon[], spacingM = DRAWN_SPACING_M, maxPoints = MAX_DENSIFIED_POINTS): LatLon[] {
  if (points.length < 2) return points.map((p) => ({ ...p }));
  const total = drawnDistanceM(points);
  const spacing = Math.max(spacingM, total / Math.max(1, maxPoints - points.length));
  const out: LatLon[] = [{ ...points[0]! }];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const n = Math.max(1, Math.ceil(haversineM(a, b) / spacing));
    for (let k = 1; k <= n; k++) {
      const f = k / n;
      out.push(k === n ? { ...b } : { lat: round6(a.lat + (b.lat - a.lat) * f), lon: round6(a.lon + (b.lon - a.lon) * f) });
    }
  }
  return out;
}

/** Turns a finished draft into a Route. Drawn routes have no elevation until the rider looks it up. */
export function buildDrawnRoute(points: readonly LatLon[], name: string): Route {
  if (points.length < 2) {
    throw new AppError('DRAW_TOO_FEW_POINTS', 'Add at least two points on the map to make a route.');
  }
  const trackPoints: TrackPoint[] = densify(points).map((p) => ({ lat: p.lat, lon: p.lon, ele: null }));
  return { name: name.trim().slice(0, 100) || DRAWN_ROUTE_NAME, points: trackPoints, source: 'drawn' };
}

const XML_ENTITIES: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' };
const xmlEscape = (s: string) => s.replace(/[<>&'"]/g, (c) => XML_ENTITIES[c]!);

/** GPX 1.1 text for a route, as a single track. No timestamps are written. */
export function routeToGpx(route: Route): string {
  const pts = route.points
    .map((p) => `<trkpt lat="${p.lat}" lon="${p.lon}">${p.ele === null ? '' : `<ele>${Math.round(p.ele * 10) / 10}</ele>`}</trkpt>`)
    .join('\n      ');
  const name = xmlEscape(route.name);
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RideWind" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${name}</name></metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
      ${pts}
    </trkseg>
  </trk>
</gpx>
`;
}

/** A safe download file name for a route's GPX. */
export function gpxFileName(name: string): string {
  const base = name
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'route'}.gpx`;
}
