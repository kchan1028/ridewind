import { describe, expect, it, vi } from 'vitest';
import type { AppError } from '../src/lib/errors';
import { buildForecastUrl, coordKey, fetchForecast, openMeteoGet, parseForecastResponse } from '../src/lib/weather';

const coords = [
  { lat: 52.93331, lon: 5.03721 },
  { lat: 53.17451, lon: 5.42049 },
];

function loc(lat: number, lon: number, times = [1_800_000_000, 1_800_003_600]) {
  const n = times.length;
  return {
    latitude: lat,
    longitude: lon,
    utc_offset_seconds: 3600,
    timezone: 'Europe/Amsterdam',
    timezone_abbreviation: 'GMT+1',
    hourly: {
      time: times,
      temperature_2m: Array(n).fill(8),
      precipitation: Array(n).fill(0),
      precipitation_probability: Array(n).fill(10),
      wind_speed_10m: Array(n).fill(20),
      wind_direction_10m: Array(n).fill(225),
      wind_gusts_10m: Array(n).fill(35),
    },
  };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

describe('buildForecastUrl', () => {
  it('requests all sampled points in one call with rounded coordinates', () => {
    const u = new URL(buildForecastUrl(coords));
    expect(u.origin + u.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(u.searchParams.get('latitude')).toBe('52.933,53.175');
    expect(u.searchParams.get('longitude')).toBe('5.037,5.420');
    expect(u.searchParams.get('hourly')!.split(',')).toEqual([
      'temperature_2m',
      'precipitation',
      'precipitation_probability',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
    ]);
    expect(u.searchParams.get('timezone')).toBe('auto');
    expect(u.searchParams.get('timeformat')).toBe('unixtime');
    expect(u.searchParams.get('wind_speed_unit')).toBe('kmh');
    expect(u.searchParams.get('forecast_days')).toBe('16');
    expect(u.searchParams.has('apikey')).toBe(false);
  });
});

describe('parseForecastResponse', () => {
  it('accepts an array for multiple locations and keys them by requested coordinate', () => {
    const b = parseForecastResponse([loc(52.93, 5.04), loc(53.17, 5.42)], coords, 123);
    expect(b.timezone).toBe('Europe/Amsterdam');
    expect(b.locations.map((l) => l.key)).toEqual(coords.map(coordKey));
    expect(b.windowStartMs).toBe(1_800_000_000_000);
    expect(b.windowEndMs).toBe(1_800_003_600_000);
    expect(b.fetchedAt).toBe(123);
  });
  it('accepts a bare object for a single location', () => {
    expect(parseForecastResponse(loc(1, 1), [{ lat: 1, lon: 1 }], 0).locations).toHaveLength(1);
  });
  it('keeps null values as missing data', () => {
    const l = loc(1, 1);
    l.hourly.wind_speed_10m = [null as unknown as number, 12];
    const b = parseForecastResponse(l, [{ lat: 1, lon: 1 }], 0);
    expect(b.locations[0]!.series.windSpeed).toEqual([null, 12]);
  });
  it.each([
    ['wrong location count', () => parseForecastResponse([loc(1, 1)], coords, 0)],
    ['missing variable', () => {
      const l = loc(1, 1) as unknown as { hourly: Record<string, unknown> };
      delete l.hourly.wind_gusts_10m;
      return parseForecastResponse(l, [{ lat: 1, lon: 1 }], 0);
    }],
    ['length mismatch', () => {
      const l = loc(1, 1);
      l.hourly.temperature_2m = [1];
      return parseForecastResponse(l, [{ lat: 1, lon: 1 }], 0);
    }],
  ])('rejects %s', (_l, fn) => {
    expect(() => fn()).toThrow(expect.objectContaining({ code: 'WEATHER_BAD_RESPONSE' }));
  });
});

describe('fetchForecast error handling', () => {
  const run = async (impl: typeof fetch) => {
    try {
      await fetchForecast(coords, { fetchImpl: impl });
    } catch (e) {
      return e as AppError;
    }
    throw new Error('expected failure');
  };

  it('returns parsed data on success', async () => {
    const impl = vi.fn(async () => json([loc(1, 1), loc(2, 2)]));
    const b = await fetchForecast(coords, { fetchImpl: impl as unknown as typeof fetch, now: () => 42 });
    expect(impl).toHaveBeenCalledTimes(1);
    expect(b.locations).toHaveLength(2);
    expect(b.fetchedAt).toBe(42);
  });
  it('maps HTTP 429 to a rate-limit error with retry-after', async () => {
    const e = await run(async () => json({ error: true, reason: 'Minutely API request limit exceeded' }, 429, { 'retry-after': '90' }));
    expect(e.code).toBe('WEATHER_RATE_LIMITED');
    expect(e.retryAfterSeconds).toBe(90);
    expect(e.message).toMatch(/route is still loaded/);
  });
  it('treats a "limit exceeded" reason as rate limiting even without 429', async () => {
    expect((await run(async () => json({ error: true, reason: 'Daily API request limit exceeded' }, 400))).code).toBe('WEATHER_RATE_LIMITED');
  });
  it('maps network failures', async () => {
    const e = await run(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(e.code).toBe('WEATHER_NETWORK');
  });
  it('maps server errors to unavailable', async () => {
    expect((await run(async () => new Response('oops', { status: 503 }))).code).toBe('WEATHER_UNAVAILABLE');
  });
  it('maps 400 with a reason to rejected and keeps the reason as detail', async () => {
    const e = await run(async () => json({ error: true, reason: 'Latitude must be in range of -90 to 90°' }, 400));
    expect(e.code).toBe('WEATHER_REJECTED');
    expect(e.detail).toMatch(/Latitude/);
  });
  it('times out a stalled request with a network error', async () => {
    const hang: typeof fetch = (_u, init) =>
      new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))));
    await expect(openMeteoGet('https://api.open-meteo.com/x', { fetchImpl: hang, timeoutMs: 20 })).rejects.toMatchObject({
      code: 'WEATHER_NETWORK',
      message: expect.stringMatching(/didn't respond/),
    });
  });
  it('also times out when the response body stalls', async () => {
    const stalledBody: typeof fetch = async (_u, init) => {
      const body = new ReadableStream({
        start(c) {
          init?.signal?.addEventListener('abort', () => c.error(new DOMException('aborted', 'AbortError')));
        },
      });
      return new Response(body, { status: 200 });
    };
    await expect(openMeteoGet('https://api.open-meteo.com/x', { fetchImpl: stalledBody, timeoutMs: 20 })).rejects.toMatchObject({
      code: 'WEATHER_NETWORK',
    });
  });
  it('rethrows aborts untouched', async () => {
    const abort = new DOMException('aborted', 'AbortError');
    await expect(fetchForecast(coords, { fetchImpl: async () => Promise.reject(abort) })).rejects.toBe(abort);
  });
});
