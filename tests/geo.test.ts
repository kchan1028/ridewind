import { describe, expect, it } from 'vitest';
import {
  bearingDeg,
  chunkRoute,
  cumulativeDistances,
  elevationStats,
  haversineM,
  pointAtDistance,
  reverseRoute,
  sampleRoute,
  MAX_WEATHER_SAMPLES,
  type TrackPoint,
} from '../src/lib/geo';

const line = (n: number, dLon = 0.01): TrackPoint[] => Array.from({ length: n }, (_, i) => ({ lat: 0, lon: i * dLon, ele: null }));

describe('distance and bearing', () => {
  it('haversine: one degree of longitude at the equator ≈ 111.2 km', () => {
    expect(haversineM({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(111195, -1);
  });
  it.each([
    [{ lat: 0, lon: 0 }, { lat: 1, lon: 0 }, 0],
    [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, 90],
    [{ lat: 1, lon: 0 }, { lat: 0, lon: 0 }, 180],
    [{ lat: 0, lon: 1 }, { lat: 0, lon: 0 }, 270],
  ])('bearing %o → %o is %d°', (a, b, expected) => {
    expect(bearingDeg(a, b)).toBeCloseTo(expected, 6);
  });
  it('cumulative distances start at 0 and increase', () => {
    const cum = cumulativeDistances(line(5));
    expect(cum[0]).toBe(0);
    expect(cum[4]).toBeCloseTo(4 * 1111.95, 0);
  });
  it('interpolates a position along the route', () => {
    const pts = line(3, 1);
    const cum = cumulativeDistances(pts);
    expect(pointAtDistance(pts, cum, cum[2]! / 4).lon).toBeCloseTo(0.5, 6);
    expect(pointAtDistance(pts, cum, 1e12).lon).toBe(2);
  });
});

describe('sampleRoute', () => {
  it('includes start and finish and spaces samples ~5 km apart', () => {
    const pts = line(201, 0.01); // ≈ 222 km
    const cum = cumulativeDistances(pts);
    const s = sampleRoute(pts, cum);
    expect(s).toHaveLength(MAX_WEATHER_SAMPLES); // capped
    expect(s[0]!.distanceM).toBe(0);
    expect(s[s.length - 1]!.distanceM).toBeCloseTo(cum[cum.length - 1]!, 6);
  });
  it('uses at least two samples for short routes', () => {
    const pts = line(2, 0.001);
    expect(sampleRoute(pts, cumulativeDistances(pts))).toHaveLength(2);
  });
  it('is symmetric: a reversed route samples the same places in reverse', () => {
    const pts: TrackPoint[] = [
      { lat: 52, lon: 5, ele: null },
      { lat: 52.1, lon: 5.05, ele: null },
      { lat: 52.15, lon: 5.2, ele: null },
      { lat: 52.3, lon: 5.25, ele: null },
    ];
    const fwd = sampleRoute(pts, cumulativeDistances(pts));
    const revPts = pts.slice().reverse();
    const rev = sampleRoute(revPts, cumulativeDistances(revPts)).reverse();
    fwd.forEach((p, i) => {
      expect(rev[i]!.lat).toBeCloseTo(p.lat, 9);
      expect(rev[i]!.lon).toBeCloseTo(p.lon, 9);
    });
  });
});

describe('chunkRoute', () => {
  it('covers the whole route in order with consistent bearings', () => {
    const pts = line(50, 0.001);
    const cum = cumulativeDistances(pts);
    const chunks = chunkRoute(pts, cum, 500);
    expect(chunks[0]!.startIndex).toBe(0);
    expect(chunks[chunks.length - 1]!.endIndex).toBe(49);
    for (let i = 1; i < chunks.length; i++) expect(chunks[i]!.startIndex).toBe(chunks[i - 1]!.endIndex);
    expect(chunks.every((c) => Math.abs(c.bearing - 90) < 1e-6)).toBe(true);
  });
});

describe('elevationStats', () => {
  const withEle = (eles: Array<number | null>): TrackPoint[] => eles.map((ele, i) => ({ lat: 0, lon: i * 0.001, ele }));

  it('reports unknown (not zero) when no elevation exists', () => {
    expect(elevationStats(withEle([null, null, null]))).toEqual({ coverage: 0, gainM: null, lossM: null, minM: null, maxM: null });
  });
  it('sums climbing and descending, ignoring sub-threshold noise', () => {
    const s = elevationStats(withEle([0, 1, 0, 1, 10, 20, 15, 5]));
    expect(s.gainM).toBe(20);
    expect(s.lossM).toBe(15);
    expect(s.minM).toBe(0);
    expect(s.maxM).toBe(20);
    expect(s.coverage).toBe(1);
  });
  it('counts a full climb even when the final rise is below the noise threshold', () => {
    const s = elevationStats(withEle([2, 3, 4, 5, 6, 7, 6, 5, 4, 3]));
    expect(s.gainM).toBe(5);
    expect(s.lossM).toBe(4);
  });
  it('reports partial coverage', () => {
    expect(elevationStats(withEle([0, null, 10, null])).coverage).toBe(0.5);
  });
});

it('reverseRoute does not mutate the original', () => {
  const r = { name: 'x', source: 'track' as const, points: line(3) };
  const rev = reverseRoute(r);
  expect(rev.points[0]!.lon).toBeCloseTo(0.02);
  expect(r.points[0]!.lon).toBe(0);
});
