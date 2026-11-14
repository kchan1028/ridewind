import { describe, expect, it, vi } from 'vitest';
import {
  applyElevations,
  buildElevationUrl,
  elevationLookupCoords,
  elevationSampleDistances,
  fetchElevations,
  MAX_ELEVATION_POINTS,
} from '../src/lib/elevation';
import { cumulativeDistances, type Route } from '../src/lib/geo';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('elevation lookup planning', () => {
  it('spaces points at least 250 m apart and caps them at 200', () => {
    expect(elevationSampleDistances(1000)).toEqual([0, 250, 500, 750, 1000]);
    const long = elevationSampleDistances(300_000);
    expect(long).toHaveLength(MAX_ELEVATION_POINTS);
    expect(long[long.length - 1]).toBe(300_000);
  });
  it('builds a URL with comma-separated coordinates', () => {
    const u = new URL(buildElevationUrl([{ lat: 1.23456, lon: 2 }, { lat: 3, lon: 4 }]));
    expect(u.pathname).toBe('/v1/elevation');
    expect(u.searchParams.get('latitude')).toBe('1.2346,3.0000');
  });
});

describe('fetchElevations', () => {
  it('batches requests at 100 coordinates', async () => {
    const coords = Array.from({ length: 150 }, (_, i) => ({ lat: 0, lon: i * 0.001 }));
    const impl = vi.fn(async (url: string) => {
      const n = new URL(url).searchParams.get('latitude')!.split(',').length;
      return json({ elevation: Array.from({ length: n }, () => 7) });
    });
    const out = await fetchElevations(coords, { fetchImpl: impl as unknown as typeof fetch });
    expect(impl).toHaveBeenCalledTimes(2);
    expect(out).toHaveLength(150);
  });
  it('rejects a malformed response', async () => {
    await expect(fetchElevations([{ lat: 0, lon: 0 }], { fetchImpl: async () => json({ elevation: [] }) })).rejects.toMatchObject({
      code: 'WEATHER_BAD_RESPONSE',
    });
  });
  it('maps rate limiting', async () => {
    await expect(
      fetchElevations([{ lat: 0, lon: 0 }], { fetchImpl: async () => json({ error: true, reason: 'Hourly API request limit exceeded' }, 429) }),
    ).rejects.toMatchObject({ code: 'WEATHER_RATE_LIMITED' });
  });
});

it('applyElevations interpolates a full profile and marks its source', () => {
  const route: Route = {
    name: 'r',
    source: 'track',
    points: Array.from({ length: 11 }, (_, i) => ({ lat: 0, lon: i * 0.001, ele: null })),
  };
  const cum = cumulativeDistances(route.points);
  const { distances } = elevationLookupCoords(route.points, cum);
  const elevations = distances.map((d) => d / 10); // 10 % slope
  const out = applyElevations(route, cum, distances, elevations);
  expect(out.elevationSource).toBe('dem');
  out.points.forEach((p, i) => expect(p.ele).toBeCloseTo(cum[i]! / 10, 6));
  expect(route.points[0]!.ele).toBeNull(); // original untouched
});
