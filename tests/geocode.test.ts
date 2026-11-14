import { describe, expect, it } from 'vitest';
import { DEFAULT_GEOCODE_URL, PlaceSearch, buildSearchUrl, parseSearchResponse, searchPlaces } from '../src/lib/geocode';

const ROW = { lat: '37.8678664', lon: '-122.3130528', display_name: 'Berkeley Marina, Berkeley, CA', boundingbox: ['37.85', '37.88', '-122.33', '-122.30'] };
const json = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('address search', () => {
  it('builds a jsonv2 search biased to the map, with a capped query', () => {
    const u = new URL(buildSearchUrl(DEFAULT_GEOCODE_URL, '  Berkeley Marina ', { language: 'en-US', near: { lat: 37.8, lon: -122.3 } }));
    expect(u.origin + u.pathname).toBe(DEFAULT_GEOCODE_URL);
    expect(u.searchParams.get('q')).toBe('Berkeley Marina');
    expect(u.searchParams.get('format')).toBe('jsonv2');
    expect(u.searchParams.get('limit')).toBe('5');
    expect(u.searchParams.get('accept-language')).toBe('en-US');
    expect(u.searchParams.get('viewbox')).toBe('-122.800,38.300,-121.800,37.300');
    expect(new URL(buildSearchUrl(DEFAULT_GEOCODE_URL, 'x'.repeat(500))).searchParams.get('q')).toHaveLength(200);
  });

  it('parses places and skips bad rows', () => {
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
    const s = new PlaceSearch(DEFAULT_GEOCODE_URL, { fetchImpl: f, now: () => t, minIntervalMs: 1100 });
    await s.search('Berkeley Marina');
    await s.search('  berkeley marina ');
    expect(calls).toBe(1);
    expect(s.waitMs()).toBe(1100);
    t += 600;
    expect(s.waitMs()).toBe(500);
  });
});
