import { describe, expect, it } from 'vitest';
import { DEFAULT_GEOCODE_URL, PlaceSearch, allowsSuggestions, buildSearchUrl, parseSearchResponse, providerFor, searchPlaces } from '../src/lib/geocode';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

const ROW = { lat: '37.8678664', lon: '-122.3130528', display_name: 'Berkeley Marina, Berkeley, CA', boundingbox: ['37.85', '37.88', '-122.33', '-122.30'] };
const json = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('address search', () => {
  it('defaults to Photon, which allows suggestions; Nominatim does not', () => {
    expect(DEFAULT_GEOCODE_URL).toBe('https://photon.komoot.io/api/');
    expect(providerFor(DEFAULT_GEOCODE_URL)).toBe('photon');
    expect(providerFor(NOMINATIM)).toBe('nominatim');
    expect(allowsSuggestions('photon')).toBe(true);
    expect(allowsSuggestions('nominatim')).toBe(false);
    expect(new PlaceSearch(NOMINATIM).suggests).toBe(false);
  });

  it('builds a Photon search biased to the map, in a supported language', () => {
    const u = new URL(buildSearchUrl(DEFAULT_GEOCODE_URL, ' berkeley mar ', { language: 'en-US', near: { lat: 37.8716, lon: -122.2727 } }));
    expect(u.searchParams.get('q')).toBe('berkeley mar');
    expect(u.searchParams.get('limit')).toBe('5');
    expect(u.searchParams.get('lang')).toBe('en');
    expect(u.searchParams.get('lat')).toBe('37.872');
    expect(u.searchParams.get('lon')).toBe('-122.273');
    expect(u.searchParams.has('format')).toBe(false);
    expect(new URL(buildSearchUrl(DEFAULT_GEOCODE_URL, 'x', { language: 'ja' })).searchParams.has('lang')).toBe(false);
  });

  it('parses Photon GeoJSON into readable names without repeats', () => {
    const places = parseSearchResponse({
      type: 'FeatureCollection',
      features: [
        { geometry: { coordinates: [-122.3130528, 37.8678664] }, properties: { name: 'Berkeley Marina', city: 'Berkeley', state: 'California', country: 'United States' } },
        {
          geometry: { coordinates: [-122.3134, 37.864] },
          properties: { housenumber: '225', street: 'University Avenue', city: 'Berkeley', extent: [-122.32, 37.87, -122.31, 37.86] },
        },
        { geometry: { coordinates: ['x', 1] }, properties: {} },
        { geometry: { coordinates: [2, 1] }, properties: { name: 'Paris', city: 'Paris', country: 'France' } },
      ],
    });
    expect(places).toEqual([
      { name: 'Berkeley Marina, Berkeley, California, United States', lat: 37.8678664, lon: -122.3130528, bounds: null },
      { name: '225 University Avenue, Berkeley', lat: 37.864, lon: -122.3134, bounds: [37.86, 37.87, -122.32, -122.31] },
      { name: 'Paris, France', lat: 1, lon: 2, bounds: null },
    ]);
    expect(() => parseSearchResponse({ type: 'FeatureCollection' })).toThrow();
  });

  it('builds a Nominatim jsonv2 search biased to the map, with a capped query', () => {
    const u = new URL(buildSearchUrl(NOMINATIM, '  Berkeley Marina ', { language: 'en-US', near: { lat: 37.8, lon: -122.3 } }));
    expect(u.origin + u.pathname).toBe(NOMINATIM);
    expect(u.searchParams.get('q')).toBe('Berkeley Marina');
    expect(u.searchParams.get('format')).toBe('jsonv2');
    expect(u.searchParams.get('limit')).toBe('5');
    expect(u.searchParams.get('accept-language')).toBe('en-US');
    expect(u.searchParams.get('viewbox')).toBe('-122.800,38.300,-121.800,37.300');
    expect(new URL(buildSearchUrl(NOMINATIM, 'x'.repeat(500))).searchParams.get('q')).toHaveLength(200);
  });

  it('parses Nominatim places and skips bad rows', () => {
    const places = parseSearchResponse([ROW, { lat: 'nope', lon: 1 }, { lat: 1, lon: 2 }]);
    expect(places).toEqual([
      { name: 'Berkeley Marina, Berkeley, CA', lat: 37.8678664, lon: -122.3130528, bounds: [37.85, 37.88, -122.33, -122.3] },
      { name: '1.0000, 2.0000', lat: 1, lon: 2, bounds: null },
    ]);
    expect(() => parseSearchResponse({ error: 'x' })).toThrow();
  });

  it('maps failures to rider-facing codes', async () => {
    const code = async (f: typeof fetch) => searchPlaces(DEFAULT_GEOCODE_URL, 'x', { fetchImpl: f }).then(() => 'ok', (e) => e.code);
    expect(await code(json(200, [ROW]))).toBe('ok');
    expect(await code(json(429, {}))).toBe('GEOCODE_RATE_LIMITED');
    expect(await code(json(503, {}))).toBe('GEOCODE_UNAVAILABLE');
    expect(await code(json(200, { nope: 1 }))).toBe('GEOCODE_BAD_RESPONSE');
    expect(await code((async () => Promise.reject(new TypeError('offline'))) as unknown as typeof fetch)).toBe('GEOCODE_NETWORK');
  });

  it('times out instead of waiting forever', async () => {
    const hang = ((_: string, init: RequestInit) =>
      new Promise((_r, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))) as unknown as typeof fetch;
    await expect(searchPlaces(DEFAULT_GEOCODE_URL, 'x', { fetchImpl: hang, timeoutMs: 10 })).rejects.toMatchObject({ code: 'GEOCODE_NETWORK' });
  });

  it('answers a repeated query from memory and spaces new searches', async () => {
    let calls = 0;
    let t = 1000;
    const f = (async () => {
      calls++;
      return new Response(JSON.stringify([ROW]));
    }) as unknown as typeof fetch;
    const s = new PlaceSearch(NOMINATIM, { fetchImpl: f, now: () => t });
    await s.search('Berkeley Marina');
    await s.search('  berkeley marina ');
    expect(calls).toBe(1);
    await s.search('Berkeley Marina', { near: { lat: 40, lon: -74 } }); // another area is a new search
    expect(calls).toBe(2);
    expect(s.waitMs()).toBe(1100);
    t += 600;
    expect(s.waitMs()).toBe(500);
  });
});

describe('suggestions while typing', () => {
  it('drops a request that was overtaken while it waited its turn', async () => {
    let calls = 0;
    const f = (async () => {
      calls++;
      return new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }));
    }) as unknown as typeof fetch;
    const s = new PlaceSearch(DEFAULT_GEOCODE_URL, { fetchImpl: f, minIntervalMs: 50 });
    await s.search('ber');
    const ctrl = new AbortController();
    const pending = s.search('berk', { signal: ctrl.signal });
    ctrl.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls).toBe(1);
  });
});
