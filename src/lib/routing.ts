import { AppError } from './errors';
import { cumulativeDistances, type LatLon, type TrackPoint } from './geo';

/**
 * Road-following geometry from a Valhalla routing server (see routing-config.ts
 * for which one). One request takes a run of control points and returns one
 * leg per pair, each with its full shape and elevation sampled along it.
 */

/** Cycling costing: a road bike, which keeps to paved surfaces, with a mild preference for quieter roads. */
export const CYCLING_COSTING = {
  bicycle: {
    bicycle_type: 'Road',
    use_roads: 0.4,
    avoid_bad_surfaces: 0.9,
    use_ferry: 0,
  },
} as const;
/** Elevation is returned every this many metres along each leg. */
export const ELEVATION_INTERVAL_M = 30;
/** Most control points sent in one request. Longer runs are split. */
export const MAX_LOCATIONS_PER_REQUEST = 12;
export const ROUTING_TIMEOUT_MS = 20_000;

/** Valhalla's "no data" elevation value and anything else implausible. */
const isUsableElevation = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > -500 && v < 9000;

export function buildRoutingUrl(baseUrl: string, locations: LatLon[]): string {
  const body = {
    locations: locations.map((p) => ({ lat: p.lat, lon: p.lon, type: 'break' })),
    costing: 'bicycle',
    costing_options: CYCLING_COSTING,
    directions_type: 'none',
    elevation_interval: ELEVATION_INTERVAL_M,
    units: 'kilometers',
  };
  const u = new URL(baseUrl);
  u.searchParams.set('json', JSON.stringify(body));
  return u.toString();
}

/** Decodes a Google-style encoded polyline with 6 decimal places (Valhalla's shape format). */
export function decodePolyline6(str: string): LatLon[] {
  const out: LatLon[] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  const next = (): number => {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      if (index >= str.length) throw new Error('truncated polyline');
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < str.length) {
    lat += next();
    lon += next();
    out.push({ lat: lat / 1e6, lon: lon / 1e6 });
  }
  return out;
}

/** Puts elevation samples taken every `intervalM` along a shape onto the shape's own points. */
export function elevationAlongShape(shape: LatLon[], samples: unknown[], intervalM: number): Array<number | null> {
  if (!samples.length) return shape.map(() => null);
  const cum = cumulativeDistances(shape);
  return cum.map((d) => {
    const f = d / intervalM;
    const i = Math.floor(f);
    const a = samples[Math.min(i, samples.length - 1)];
    const b = samples[Math.min(i + 1, samples.length - 1)];
    if (!isUsableElevation(a) && !isUsableElevation(b)) return null;
    if (!isUsableElevation(a)) return b as number;
    if (!isUsableElevation(b)) return a;
    return Math.round((a + (b - a) * (f - i)) * 10) / 10;
  });
}

const bad = (detail: string) =>
  new AppError('ROUTING_BAD_RESPONSE', 'The routing service sent an answer RideWind could not read. Your last complete route is kept.', { detail });

/** Turns a Valhalla /route response into one list of track points per leg. */
export function parseRoutingResponse(json: unknown, expectedLegs: number): TrackPoint[][] {
  const legs = (json as { trip?: { legs?: unknown } })?.trip?.legs;
  if (!Array.isArray(legs) || legs.length !== expectedLegs) throw bad(`expected ${expectedLegs} legs`);
  return legs.map((leg: { shape?: unknown; elevation?: unknown; elevation_interval?: unknown }) => {
    if (typeof leg?.shape !== 'string') throw bad('leg without shape');
    let shape: LatLon[];
    try {
      shape = decodePolyline6(leg.shape);
    } catch {
      throw bad('bad shape');
    }
    if (shape.length < 2) throw bad('short shape');
    const interval = typeof leg.elevation_interval === 'number' && leg.elevation_interval > 0 ? leg.elevation_interval : ELEVATION_INTERVAL_M;
    const ele = elevationAlongShape(shape, Array.isArray(leg.elevation) ? leg.elevation : [], interval);
    return shape.map((p, i) => ({ lat: p.lat, lon: p.lon, ele: ele[i]! }));
  });
}

/** Maps a failed Valhalla response to a message for the rider. */
export function routingError(status: number, body: unknown, retryAfter: string | null): AppError {
  const code = (body as { error_code?: unknown })?.error_code;
  const detail = `HTTP ${status}${typeof code === 'number' ? ` code ${code}` : ''}`;
  if (status === 429) {
    const s = Number(retryAfter);
    return new AppError('ROUTING_RATE_LIMITED', 'The routing service is busy. Wait a moment and retry. Your last complete route is kept.', {
      detail,
      ...(Number.isFinite(s) && s > 0 ? { retryAfterSeconds: s } : {}),
    });
  }
  if (status >= 500) {
    return new AppError('ROUTING_UNAVAILABLE', 'The routing service is unavailable right now. Retry later, or draw this section as a straight line.', { detail });
  }
  if (code === 154 || code === 155) {
    return new AppError('ROUTING_TOO_FAR', 'That section is too long for the routing service. Add a point part way along it.', { detail });
  }
  if (code === 171 || code === 170) {
    return new AppError('ROUTING_NO_ROUTE', 'No road was found near that point. Place it closer to a road, or draw this section as a straight line.', { detail });
  }
  return new AppError('ROUTING_NO_ROUTE', "The routing service couldn't find a cycling route between those points. Move a point, or draw this section as a straight line.", {
    detail,
  });
}

/**
 * Asks the routing server for road-following legs between consecutive
 * `locations`. Throws an AppError on failure, or the AbortError if `signal`
 * aborts first.
 */
export async function fetchRoutedLegs(
  baseUrl: string,
  locations: LatLon[],
  opts: { fetchImpl?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<TrackPoint[][]> {
  if (locations.length < 2) return [];
  const fetchImpl = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, opts.timeoutMs ?? ROUTING_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  if (opts.signal?.aborted) ctrl.abort();
  opts.signal?.addEventListener('abort', onAbort);
  const network = () =>
    new AppError(
      'ROUTING_NETWORK',
      timedOut ? "The routing service didn't respond in time. Retry, or draw this section as a straight line." : "Couldn't reach the routing service. Check your connection and retry.",
    );
  try {
    let res: Response;
    let body: unknown = null;
    try {
      res = await fetchImpl(buildRoutingUrl(baseUrl, locations), { signal: ctrl.signal, headers: { Accept: 'application/json' } });
      try {
        body = await res.json();
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') throw e;
        body = null;
      }
    } catch (e) {
      if (!timedOut && (e as Error)?.name === 'AbortError') throw e;
      throw network();
    }
    if (!res.ok) throw routingError(res.status, body, res.headers.get('retry-after'));
    if (body === null) throw bad('not JSON');
    return parseRoutingResponse(body, locations.length - 1);
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}
