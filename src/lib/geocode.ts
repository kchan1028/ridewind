import { AppError } from './errors';
import type { LatLon } from './geo';

/**
 * Address and place search on OpenStreetMap data.
 *
 * The default is komoot's public Photon server, which is built for
 * search-as-you-type and asks only for fair use (heavy use is throttled).
 * RideWind asks for suggestions after a short pause in typing, from three
 * characters, cancels out-of-date requests and caches answers.
 *
 * VITE_GEOCODE_URL can point at another Photon server or at a Nominatim one.
 * Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/)
 * forbids search-as-you-type and allows one request a second, so with a
 * Nominatim URL RideWind only searches when the rider presses Search.
 *
 * Kept free of `import.meta.env` so the Vite config can import it for the CSP.
 */
export const DEFAULT_GEOCODE_URL = 'https://photon.komoot.io/api/';
/** Smallest gap between requests: Nominatim's policy allows one a second; Photon asks for fair use. */
export const MIN_SEARCH_INTERVAL_MS = { nominatim: 1100, photon: 250 } as const;
/** Suggestions start at this many characters. */
export const MIN_SUGGEST_LENGTH = 3;
/** Pause in typing before suggestions are fetched. */
export const SUGGEST_DELAY_MS = 350;
/** Languages Photon can answer in; anything else gets its default (local names). */
const PHOTON_LANGUAGES = new Set(['en', 'de', 'fr', 'it']);

export type GeocodeProvider = 'photon' | 'nominatim';

/** Which API a search URL speaks, from its address. */
export function providerFor(url: string): GeocodeProvider {
  try {
    return new URL(url).hostname.includes('nominatim') ? 'nominatim' : 'photon';
  } catch {
    return 'photon';
  }
}

/** Whether the provider's terms allow asking as the rider types. */
export const allowsSuggestions = (p: GeocodeProvider) => p === 'photon';
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
  if (providerFor(baseUrl) === 'photon') {
    u.searchParams.set('limit', String(MAX_RESULTS));
    const lang = opts.language?.slice(0, 2).toLowerCase();
    if (lang && PHOTON_LANGUAGES.has(lang)) u.searchParams.set('lang', lang);
    // Prefer places near what's on screen without excluding the rest of the world.
    if (opts.near) {
      u.searchParams.set('lat', opts.near.lat.toFixed(3));
      u.searchParams.set('lon', opts.near.lon.toFixed(3));
    }
    return u.toString();
  }
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

/** A readable one-line name from Photon's address parts, without repeats. */
function photonName(p: Record<string, unknown>): string {
  const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : '');
  const street = [str('housenumber'), str('street')].filter(Boolean).join(' ');
  const parts = [str('name'), street, str('city') || str('town') || str('village') || str('district'), str('state'), str('country')];
  return parts.filter((v, i) => v && parts.indexOf(v) === i).join(', ');
}

/** Photon answers in GeoJSON: a FeatureCollection of points. */
function parsePhoton(json: { features?: unknown }): Place[] {
  if (!Array.isArray(json.features)) throw bad();
  const out: Place[] = [];
  for (const f of json.features.slice(0, MAX_RESULTS)) {
    const [lon, lat] = Array.isArray(f?.geometry?.coordinates) ? f.geometry.coordinates.map(Number) : [NaN, NaN];
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const props = (f.properties ?? {}) as Record<string, unknown>;
    // extent is [west, north, east, south].
    const ex = Array.isArray(props.extent) ? (props.extent as unknown[]).map(Number) : null;
    const bounds = ex && ex.length === 4 && ex.every(Number.isFinite) ? ([ex[3], ex[1], ex[0], ex[2]] as Place['bounds']) : null;
    out.push({ name: photonName(props) || `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon, bounds });
  }
  return out;
}

/** Parses a Photon (GeoJSON) or Nominatim (array) answer. */
export function parseSearchResponse(json: unknown): Place[] {
  if (json && typeof json === 'object' && (json as { type?: unknown }).type === 'FeatureCollection') return parsePhoton(json as { features?: unknown });
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
 * Wraps searchPlaces with the provider's rules: a minimum gap between
 * requests, out-of-date requests dropped while they wait, and the same query
 * answered from memory instead of being sent again.
 */
export class PlaceSearch {
  private cache = new Map<string, Place[]>();
  private lastStart = -Infinity;

  constructor(
    private readonly baseUrl: string,
    private readonly opts: { fetchImpl?: typeof fetch; now?: () => number; minIntervalMs?: number } = {},
  ) {
    this.provider = providerFor(baseUrl);
  }

  readonly provider: GeocodeProvider;

  /** Whether this search may run as the rider types. */
  get suggests(): boolean {
    return allowsSuggestions(this.provider);
  }

  /** Milliseconds until another search may be sent. */
  waitMs(): number {
    const now = (this.opts.now ?? Date.now)();
    return Math.max(0, this.lastStart + (this.opts.minIntervalMs ?? MIN_SEARCH_INTERVAL_MS[this.provider]) - now);
  }

  async search(query: string, opts: { language?: string; near?: LatLon; signal?: AbortSignal } = {}): Promise<Place[]> {
    const q = query.trim().toLowerCase();
    // Results are biased to the area on screen, so the same words elsewhere are a different search.
    const key = opts.near ? `${q}|${opts.near.lat.toFixed(1)},${opts.near.lon.toFixed(1)}` : q;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const wait = this.waitMs();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    // Typed past while waiting: don't send it at all.
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    this.lastStart = (this.opts.now ?? Date.now)();
    const places = await searchPlaces(this.baseUrl, q, { ...opts, fetchImpl: this.opts.fetchImpl });
    this.cache.set(key, places);
    return places;
  }
}
