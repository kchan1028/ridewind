export interface TrackPoint {
  lat: number;
  lon: number;
  /** Elevation in metres, or null when the file has none for this point. Never defaulted to 0. */
  ele: number | null;
}

export interface Route {
  name: string;
  points: TrackPoint[];
  /** Whether the points came from <trkpt> or <rtept>. */
  source: 'track' | 'route';
}

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Sample extends LatLon {
  /** Distance from the start of the route, metres. */
  distanceM: number;
}

const EARTH_RADIUS_M = 6371008.8;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function normalizeDeg(d: number): number {
  return ((d % 360) + 360) % 360;
}

/** Great-circle distance in metres. */
export function haversineM(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial compass bearing from a to b, degrees clockwise from north (0–360). */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lon - a.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return normalizeDeg(toDeg(Math.atan2(y, x)));
}

/** Cumulative distance (metres) at each point; first entry is 0. */
export function cumulativeDistances(points: LatLon[]): number[] {
  const out = new Array<number>(points.length);
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) total += haversineM(points[i - 1]!, points[i]!);
    out[i] = total;
  }
  return out;
}

/** Index of the last point whose cumulative distance is <= d (binary search). */
function indexAtDistance(cum: number[], d: number): number {
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cum[mid]! <= d) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Position at distance d along the route (linear interpolation between points). */
export function pointAtDistance(points: LatLon[], cum: number[], d: number): LatLon {
  const total = cum[cum.length - 1]!;
  const dd = Math.max(0, Math.min(total, d));
  const i = indexAtDistance(cum, dd);
  if (i >= points.length - 1) return { lat: points[points.length - 1]!.lat, lon: points[points.length - 1]!.lon };
  const seg = cum[i + 1]! - cum[i]!;
  const f = seg > 0 ? (dd - cum[i]!) / seg : 0;
  const a = points[i]!;
  const b = points[i + 1]!;
  return { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f };
}

export const MAX_WEATHER_SAMPLES = 20;
export const TARGET_SAMPLE_SPACING_M = 5000;

/**
 * Evenly spaced forecast locations along the route, including start and finish.
 * Spacing targets ~5 km, capped at MAX_WEATHER_SAMPLES to bound API usage
 * (Open-Meteo counts each location as one call). Positions are symmetric, so a
 * reversed route yields the same locations in reverse order.
 */
export function sampleRoute(points: LatLon[], cum: number[], maxSamples = MAX_WEATHER_SAMPLES): Sample[] {
  const total = cum[cum.length - 1] ?? 0;
  const n = Math.max(2, Math.min(maxSamples, Math.ceil(total / TARGET_SAMPLE_SPACING_M) + 1));
  const out: Sample[] = [];
  for (let k = 0; k < n; k++) {
    const d = (total * k) / (n - 1);
    out.push({ ...pointAtDistance(points, cum, d), distanceM: d });
  }
  return out;
}

/** Travel bearing around distance d, measured over a short window to smooth GPS noise. */
export function bearingAtDistance(points: LatLon[], cum: number[], d: number, halfWindowM = 250): number {
  const total = cum[cum.length - 1]!;
  let a = Math.max(0, d - halfWindowM);
  let b = Math.min(total, d + halfWindowM);
  if (b - a < 1) {
    a = Math.max(0, total - 1);
    b = total;
  }
  return bearingDeg(pointAtDistance(points, cum, a), pointAtDistance(points, cum, b));
}

export interface Chunk {
  startIndex: number;
  endIndex: number;
  midDistanceM: number;
  bearing: number;
}

/** Splits the route into consecutive chunks of at least `minLengthM` for map colouring. */
export function chunkRoute(points: LatLon[], cum: number[], minLengthM = 200): Chunk[] {
  const chunks: Chunk[] = [];
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    const isLast = i === points.length - 1;
    if (cum[i]! - cum[start]! >= minLengthM || isLast) {
      if (cum[i]! - cum[start]! > 0) {
        chunks.push({
          startIndex: start,
          endIndex: i,
          midDistanceM: (cum[start]! + cum[i]!) / 2,
          bearing: bearingDeg(points[start]!, points[i]!),
        });
      }
      start = i;
    }
  }
  return chunks;
}

export interface ElevationStats {
  /** Share of points (0–1) that carry an elevation value. */
  coverage: number;
  gainM: number | null;
  lossM: number | null;
  minM: number | null;
  maxM: number | null;
}

/**
 * Elevation summary using only points that actually have elevation. A small
 * hysteresis threshold filters GPS/barometer noise. With no elevation data every
 * figure is null: the course is reported as unknown, never as flat.
 */
export function elevationStats(points: TrackPoint[], thresholdM = 3): ElevationStats {
  const withEle = points.filter((p) => p.ele !== null) as Array<TrackPoint & { ele: number }>;
  const coverage = points.length ? withEle.length / points.length : 0;
  if (withEle.length === 0) return { coverage: 0, gainM: null, lossM: null, minM: null, maxM: null };
  // Turning-point hysteresis: a climb counts from its base to its summit once the
  // road has dropped at least thresholdM from the summit (and vice versa).
  let gain = 0;
  let loss = 0;
  let anchor = withEle[0]!.ele;
  let ext = anchor;
  let dir: -1 | 0 | 1 = 0;
  let min = anchor;
  let max = anchor;
  for (const { ele: e } of withEle) {
    min = Math.min(min, e);
    max = Math.max(max, e);
    if (dir === 0) {
      if (e - anchor >= thresholdM) [dir, ext] = [1, e];
      else if (anchor - e >= thresholdM) [dir, ext] = [-1, e];
    } else if (dir === 1) {
      if (e > ext) ext = e;
      else if (ext - e >= thresholdM) {
        gain += ext - anchor;
        [anchor, dir, ext] = [ext, -1, e];
      }
    } else if (e < ext) ext = e;
    else if (e - ext >= thresholdM) {
      loss += anchor - ext;
      [anchor, dir, ext] = [ext, 1, e];
    }
  }
  if (dir === 1) gain += ext - anchor;
  if (dir === -1) loss += anchor - ext;
  return { coverage, gainM: gain, lossM: loss, minM: min, maxM: max };
}

export function reverseRoute(route: Route): Route {
  return { ...route, points: route.points.slice().reverse() };
}
