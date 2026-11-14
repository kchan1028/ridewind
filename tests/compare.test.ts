import { describe, expect, it } from 'vitest';
import { bestRow, compareRides, departureOptions, type RouteVariant } from '../src/lib/compare';
import { cumulativeDistances, sampleRoute, type TrackPoint } from '../src/lib/geo';
import { DEFAULT_RIDER } from '../src/lib/physics';
import type { PaceModel } from '../src/lib/simulate';
import type { HourlySeries, LocationForecast } from '../src/lib/weather';

const T0 = 1_800_000_000;
const H = 3600_000;
/** Wind from the east for the first 3 hours, then from the west. */
function forecast(): LocationForecast {
  const time = Array.from({ length: 12 }, (_, i) => T0 + i * 3600);
  const series: HourlySeries = {
    time,
    temperature: time.map(() => 12),
    precipitation: time.map(() => 0),
    precipitationProbability: time.map(() => 0),
    windSpeed: time.map(() => 25),
    windDirection: time.map((_, i) => (i < 3 ? 90 : 270)),
    windGusts: time.map(() => 35),
  };
  return { key: 'k', gridLat: 0, gridLon: 0, series, sun: { sunrise: [], sunset: [] } };
}

function variant(direction: 'forward' | 'reverse'): RouteVariant {
  let points: TrackPoint[] = Array.from({ length: 101 }, (_, i) => ({ lat: 0, lon: (i * 0.18) / 100, ele: 5 }));
  if (direction === 'reverse') points = points.slice().reverse();
  const cum = cumulativeDistances(points);
  const samples = sampleRoute(points, cum);
  return { direction, points, cum, samples, forecasts: samples.map(() => forecast()) };
}

const power: PaceModel = { kind: 'power', rider: DEFAULT_RIDER, exposure: 'open' };

describe('departureOptions', () => {
  it('stops before the ride would finish outside the forecast window', () => {
    expect(departureOptions(0, 10 * H, 2 * H, 3 * H, 8)).toEqual([0, 3 * H, 6 * H]);
  });
});

describe('compareRides', () => {
  const rows = compareRides([variant('forward'), variant('reverse')], [T0 * 1000, (T0 + 4 * 3600) * 1000], power);

  it('produces one row per departure and direction', () => {
    expect(rows).toHaveLength(4);
  });

  it('early east wind favours riding west (reverse); later west wind favours riding east', () => {
    const at = (h: number, d: string) => rows.find((r) => r.departureMs === (T0 + h * 3600) * 1000 && r.direction === d)!;
    expect(at(0, 'reverse').durationMs).toBeLessThan(at(0, 'forward').durationMs);
    expect(at(4, 'forward').durationMs).toBeLessThan(at(4, 'reverse').durationMs);
    expect(at(0, 'forward').headwindShare).toBeGreaterThan(0.9);
  });

  it('bestRow picks the shortest predicted time for a power model', () => {
    const best = bestRow(rows, power)!;
    expect(best.durationMs).toBe(Math.min(...rows.map((r) => r.durationMs)));
  });

  it('bestRow uses the lowest mean headwind for a constant-speed model', () => {
    const constant: PaceModel = { kind: 'constant', speedKmh: 25 };
    const cRows = compareRides([variant('forward'), variant('reverse')], [T0 * 1000], constant);
    expect(cRows[0]!.durationMs).toBeCloseTo(cRows[1]!.durationMs, 6);
    expect(bestRow(cRows, constant)!.direction).toBe('reverse');
  });

  it('ignores options without a complete forecast', () => {
    const late = compareRides([variant('forward')], [(T0 + 11 * 3600) * 1000], power);
    expect(late[0]!.fullyForecast).toBe(false);
    expect(bestRow(late, power)).toBeNull();
  });
});
