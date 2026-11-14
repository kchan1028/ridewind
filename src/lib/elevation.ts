import { AppError } from './errors';
import { pointAtDistance, type LatLon, type Route, type TrackPoint } from './geo';
import { openMeteoGet } from './weather';

export const OPEN_METEO_ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation';
/** Open-Meteo accepts up to 100 coordinates per elevation request. */
export const ELEVATION_BATCH = 100;
/**
 * Open-Meteo charges one API call per elevation coordinate (measured via the
 * X-RateLimit-Cost header), so lookups are capped at 200 points per route.
 */
export const MAX_ELEVATION_POINTS = 200;
export const MIN_ELEVATION_SPACING_M = 250;

/** Evenly spaced distances (including both ends) at which to look up elevation. */
export function elevationSampleDistances(totalM: number): number[] {
  const n = Math.max(2, Math.min(MAX_ELEVATION_POINTS, Math.ceil(totalM / MIN_ELEVATION_SPACING_M) + 1));
  return Array.from({ length: n }, (_, k) => (totalM * k) / (n - 1));
}

export function elevationLookupCoords(points: LatLon[], cum: number[]): { distances: number[]; coords: LatLon[] } {
  const distances = elevationSampleDistances(cum[cum.length - 1] ?? 0);
  return { distances, coords: distances.map((d) => pointAtDistance(points, cum, d)) };
}

export function buildElevationUrl(coords: LatLon[]): string {
  const params = new URLSearchParams({
    latitude: coords.map((c) => c.lat.toFixed(4)).join(','),
    longitude: coords.map((c) => c.lon.toFixed(4)).join(','),
  });
  return `${OPEN_METEO_ELEVATION_URL}?${params.toString()}`;
}

/** Looks up terrain elevation (Copernicus DEM GLO-90 via Open-Meteo) in batches of 100. */
export async function fetchElevations(
  coords: LatLon[],
  opts: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {},
): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < coords.length; i += ELEVATION_BATCH) {
    const batch = coords.slice(i, i + ELEVATION_BATCH);
    const body = (await openMeteoGet(buildElevationUrl(batch), opts)) as { elevation?: unknown };
    const ele = body?.elevation;
    if (!Array.isArray(ele) || ele.length !== batch.length || !ele.every((e) => typeof e === 'number' && Number.isFinite(e))) {
      throw new AppError('WEATHER_BAD_RESPONSE', 'Open-Meteo sent elevation data RideWind could not read. Try again shortly.', {
        detail: 'elevation array missing or wrong length',
      });
    }
    out.push(...(ele as number[]));
  }
  return out;
}

/**
 * Returns a copy of the route whose every point takes its elevation from the
 * looked-up profile (linear interpolation along distance). The whole profile is
 * replaced, rather than mixed with file values, to avoid steps between sources.
 */
export function applyElevations(route: Route, cum: number[], distances: number[], elevations: number[]): Route {
  let j = 0;
  const points: TrackPoint[] = route.points.map((p, i) => {
    const d = cum[i]!;
    while (j < distances.length - 2 && distances[j + 1]! < d) j++;
    const d0 = distances[j]!;
    const d1 = distances[j + 1] ?? d0;
    const f = d1 > d0 ? Math.min(1, Math.max(0, (d - d0) / (d1 - d0))) : 0;
    const e0 = elevations[j]!;
    const e1 = elevations[j + 1] ?? e0;
    return { lat: p.lat, lon: p.lon, ele: e0 + (e1 - e0) * f };
  });
  return { ...route, points, elevationSource: 'dem' };
}
