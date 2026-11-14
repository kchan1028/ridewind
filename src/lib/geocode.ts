import { AppError } from './errors';
import type { LatLon } from './geo';

/**
 * Address and place search with the OpenStreetMap Foundation's public
 * Nominatim server. Its usage policy
 * (https://operations.osmfoundation.org/policies/nominatim/) allows searches
 * a person starts, at most one request a second across all users, and forbids
 * search-as-you-type. So RideWind searches only when the rider submits the
 * form, spaces searches at least MIN_SEARCH_INTERVAL_MS apart and caches
 * answers for the session. The endpoint is a build setting
 * (VITE_GEOCODE_URL) so it can be switched if OSMF asks.
 *
 * Kept free of `import.meta.env` so the Vite config can import it for the CSP.
 */
export const DEFAULT_GEOCODE_URL = 'https://nominatim.openstreetmap.org/search';
export const MIN_SEARCH_INTERVAL_MS = 1100;
export const MAX_RESULTS = 5;
export const GEOCODE_TIMEOUT_MS = 15_000;
/** Longest query sent; anything longer is cut. */
export const MAX_QUERY_LENGTH = 200;

export interface Place extends LatLon {
  name: string;
  /** South, north, west, east, when the service gives an area. */
  bounds: [number, number, number, number] | null;
}

export function buildSearchUrl(baseUrl: string, query: string, opts: { language?: string; near?: LatLon } = {}): string {
  const u = new URL(baseUrl);
  u.searchParams.set('q', query.trim().slice(0, MAX_QUERY_LENGTH));
  u.searchParams.set('format', 'jsonv2');
  u.searchParams.set('limit', String(MAX_RESULTS));
  if (opts.language) u.searchParams.set('accept-language', opts.language);
  // Prefer places near what's on screen without excluding the rest of the world.
  if (opts.near) {
    const { lat, lon } = opts.near;
    u.searchParams.set('viewbox', [lon - 0.5, lat + 0.5, lon + 0.5, lat - 0.5].map((v) => v.toFixed(3)).join(','));
  }
  return u.toString();
}

const bad = () => new AppError('GEOCODE_BAD_RESPONSE', 'The address search sent an answer RideWind could not read. Try again.');

export function parseSearchResponse(json: unknown): Place[] {
  if (!Array.isArray(json)) throw bad();
  const out: Place[] = [];
  for (const r of json.slice(0, MAX_RESULTS)) {
    const lat = Number(r?.lat);
    const lon = Number(r?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const name = typeof r.display_name === 'string' ? r.display_name : typeof r.name === 'string' ? r.name : `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    const bb = Array.isArray(r.boundingbox) ? r.boundingbox.map(Number) : null;
    const bounds = bb && bb.length === 4 && bb.every(Number.isFinite) ? ([bb[0], bb[1], bb[2], bb[3]] as Place['bounds']) : null;
    out.push({ name, lat, lon, bounds });
  }
  return out;
}

/** One search. Throws AppError on failure, or the AbortError if `signal` aborts first. */
export async function searchPlaces(
  baseUrl: string,
  query: string,
  opts: { language?: string; near?: LatLon; fetchImpl?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<Place[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, opts.timeoutMs ?? GEOCODE_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  if (opts.signal?.aborted) ctrl.abort();
  opts.signal?.addEventListener('abort', onAbort);
  try {
    let res: Response;
    let body: unknown;
    try {
      res = await fetchImpl(buildSearchUrl(baseUrl, query, opts), { signal: ctrl.signal, headers: { Accept: 'application/json' } });
      body = await res.json().catch((e: unknown) => {
        if ((e as Error)?.name === 'AbortError') throw e;
        return null;
      });
    } catch (e) {
      if (!timedOut && (e as Error)?.name === 'AbortError') throw e;
      throw new AppError(
        'GEOCODE_NETWORK',
        timedOut ? "The address search didn't respond in time. Try again." : "Couldn't reach the address search. Check your connection and try again.",
      );
    }
    if (res.status === 429) throw new AppError('GEOCODE_RATE_LIMITED', 'The address search is busy. Wait a moment and try again.');
    if (!res.ok) throw new AppError('GEOCODE_UNAVAILABLE', 'The address search is unavailable right now. Try again later, or move the map by hand.');
    return parseSearchResponse(body);
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Wraps searchPlaces with the policy's rules: at least MIN_SEARCH_INTERVAL_MS
 * between searches, and the same query answered from memory instead of being
 * sent again.
 */
export class PlaceSearch {
  private cache = new Map<string, Place[]>();
  private lastStart = -Infinity;

  constructor(
    private readonly baseUrl: string,
    private readonly opts: { fetchImpl?: typeof fetch; now?: () => number; minIntervalMs?: number } = {},
  ) {}

  /** Milliseconds until another search may be sent. */
  waitMs(): number {
    const now = (this.opts.now ?? Date.now)();
    return Math.max(0, this.lastStart + (this.opts.minIntervalMs ?? MIN_SEARCH_INTERVAL_MS) - now);
  }

  async search(query: string, opts: { language?: string; near?: LatLon; signal?: AbortSignal } = {}): Promise<Place[]> {
    const q = query.trim().toLowerCase();
    // Results are biased to the area on screen, so the same words elsewhere are a different search.
    const key = opts.near ? `${q}|${opts.near.lat.toFixed(1)},${opts.near.lon.toFixed(1)}` : q;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const wait = this.waitMs();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastStart = (this.opts.now ?? Date.now)();
    const places = await searchPlaces(this.baseUrl, q, { ...opts, fetchImpl: this.opts.fetchImpl });
    this.cache.set(key, places);
    return places;
  }
}
