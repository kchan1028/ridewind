import { describe, expect, it } from 'vitest';
import { AppError } from '../src/lib/errors';
import { buildRoutingUrl, decodePolyline6, elevationAlongShape, fetchRoutedLegs, parseRoutingResponse } from '../src/lib/routing';
import { DEFAULT_ROUTING_URL, routingAttribution, routingOrigin } from '../src/lib/routing-config';

/** Encodes points as a polyline with 6 decimals, the inverse of decodePolyline6. */
function encode6(points: Array<[number, number]>): string {
  let out = '';
  let pLat = 0;
  let pLon = 0;
  const enc = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    while (n >= 0x20) {
      out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    out += String.fromCharCode(n + 63);
  };
  for (const [lat, lon] of points) {
    const la = Math.round(lat * 1e6);
    const lo = Math.round(lon * 1e6);
    enc(la - pLat);
    enc(lo - pLon);
    pLat = la;
    pLon = lo;
  }
  return out;
}

const SHAPE: Array<[number, number]> = [
  [37.8716, -122.2727],
  [37.8717, -122.27],
  [37.8806, -122.2614],
];

const okBody = (legs: number) => ({
  trip: { legs: Array.from({ length: legs }, () => ({ shape: encode6(SHAPE), elevation: [50, 52, 54], elevation_interval: 30 })) },
});

function fakeFetch(status: number, body: unknown, headers: Record<string, string> = {}): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status, headers })) as unknown as typeof fetch;
}

describe('routing request', () => {
  it('asks for a road-bike cycling route with elevation and no turn instructions', () => {
    const url = new URL(buildRoutingUrl(DEFAULT_ROUTING_URL, [{ lat: 1, lon: 2 }, { lat: 3, lon: 4 }]));
    expect(url.origin + url.pathname).toBe(DEFAULT_ROUTING_URL);
    const body = JSON.parse(url.searchParams.get('json')!);
    expect(body.costing).toBe('bicycle');
    expect(body.costing_options.bicycle.bicycle_type).toBe('Road');
    expect(body.costing_options.bicycle.avoid_bad_surfaces).toBeGreaterThan(0.5);
    expect(body.directions_type).toBe('none');
    expect(body.elevation_interval).toBe(30);
    expect(body.locations).toEqual([
      { lat: 1, lon: 2, type: 'break' },
      { lat: 3, lon: 4, type: 'break' },
    ]);
  });

  it('decodes polyline6 shapes', () => {
    const pts = decodePolyline6(encode6(SHAPE));
    expect(pts.map((p) => [p.lat, p.lon])).toEqual(SHAPE);
    expect(() => decodePolyline6('_')).toThrow();
  });

  it('puts elevation samples onto shape points and drops no-data values', () => {
    const shape = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 0.0002695 }, // ~30 m
    ];
    expect(elevationAlongShape(shape, [10, 20], 30)).toEqual([10, 20]);
    expect(elevationAlongShape(shape, [-32768, 20], 30)).toEqual([20, 20]);
    expect(elevationAlongShape(shape, [], 30)).toEqual([null, null]);
  });

  it('parses one leg per pair of points and rejects a mismatched answer', () => {
    const legs = parseRoutingResponse(okBody(2), 2);
    expect(legs).toHaveLength(2);
    expect(legs[0]![0]).toEqual({ lat: 37.8716, lon: -122.2727, ele: 50 });
    expect(() => parseRoutingResponse(okBody(1), 2)).toThrow(AppError);
    expect(() => parseRoutingResponse({ trip: { legs: [{ shape: 42 }] } }, 1)).toThrow(AppError);
  });
});

describe('fetchRoutedLegs errors', () => {
  const pts = [
    { lat: 1, lon: 2 },
    { lat: 3, lon: 4 },
  ];
  const code = async (f: typeof fetch) => {
    try {
      await fetchRoutedLegs(DEFAULT_ROUTING_URL, pts, { fetchImpl: f });
    } catch (e) {
      return (e as AppError).code;
    }
    return 'ok';
  };

  it('maps each failure to a rider-facing code', async () => {
    expect(await code(fakeFetch(200, okBody(1)))).toBe('ok');
    expect(await code(fakeFetch(429, {}, { 'retry-after': '5' }))).toBe('ROUTING_RATE_LIMITED');
    expect(await code(fakeFetch(503, {}))).toBe('ROUTING_UNAVAILABLE');
    expect(await code(fakeFetch(400, { error_code: 171 }))).toBe('ROUTING_NO_ROUTE');
    expect(await code(fakeFetch(400, { error_code: 442 }))).toBe('ROUTING_NO_ROUTE');
    expect(await code(fakeFetch(400, { error_code: 154 }))).toBe('ROUTING_TOO_FAR');
    expect(await code(fakeFetch(200, { nope: true }))).toBe('ROUTING_BAD_RESPONSE');
    expect(await code((async () => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch)).toBe('ROUTING_NETWORK');
  });

  it('times out instead of waiting forever', async () => {
    const hang = ((_: string, init: RequestInit) =>
      new Promise((_r, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))) as unknown as typeof fetch;
    await expect(fetchRoutedLegs(DEFAULT_ROUTING_URL, pts, { fetchImpl: hang, timeoutMs: 10 })).rejects.toMatchObject({ code: 'ROUTING_NETWORK' });
  });

  it('passes an abort through untouched', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const f = ((_: string, init: RequestInit) =>
      init.signal!.aborted ? Promise.reject(new DOMException('aborted', 'AbortError')) : Promise.resolve(new Response('{}'))) as unknown as typeof fetch;
    await expect(fetchRoutedLegs(DEFAULT_ROUTING_URL, pts, { fetchImpl: f, signal: ctrl.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('routing config', () => {
  it('only allows https origins (or localhost) in the CSP', () => {
    expect(routingOrigin(DEFAULT_ROUTING_URL)).toBe('https://valhalla1.openstreetmap.de');
    expect(routingOrigin('http://example.com/route')).toBeNull();
    expect(routingOrigin('http://localhost:8002/route')).toBe('http://localhost:8002');
    expect(routingOrigin('not a url')).toBeNull();
  });

  it('credits FOSSGIS with a report-a-map-error link', () => {
    expect(routingAttribution(DEFAULT_ROUTING_URL)).toContain('FOSSGIS');
    expect(routingAttribution(DEFAULT_ROUTING_URL)).toContain('openstreetmap.org/fixthemap');
    expect(routingAttribution('https://api.stadiamaps.com/route/v1')).toContain('Stadia Maps');
  });
});
