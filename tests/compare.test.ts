import { describe, expect, it } from 'vitest';
import { bestChoice, compareRides, departureOptions, type RouteVariant } from '../src/lib/compare';
import { cumulativeDistances, sampleRoute, type TrackPoint } from '../src/lib/geo';
import { DEFAULT_RIDER } from '../src/lib/physics';
import type { PaceModel } from '../src/lib/simulate';
import type { HourlySeries, LocationForecast, SunTimes } from '../src/lib/weather';

const T0 = 1_800_000_000;
const H = 3600_000;
/** Wind from the east for the first 3 hours, then from the west. */
function forecast(opts: { windKmh?: number; sun?: SunTimes } = {}): LocationForecast {
  const time = Array.from({ length: 12 }, (_, i) => T0 + i * 3600);
  const series: HourlySeries = {
    time,
    temperature: time.map(() => 12),
    precipitation: time.map(() => 0),
    precipitationProbability: time.map(() => 0),
    windSpeed: time.map(() => opts.windKmh ?? 25),
    windDirection: time.map((_, i) => (i < 3 ? 90 : 270)),
    windGusts: time.map(() => 35),
  };
  return { key: 'k', gridLat: 0, gridLon: 0, series, sun: opts.sun ?? { sunrise: [], sunset: [] } };
}

function variant(direction: 'forward' | 'reverse', opts: Parameters<typeof forecast>[0] = {}): RouteVariant {
  let points: TrackPoint[] = Array.from({ length: 101 }, (_, i) => ({ lat: 0, lon: (i * 0.18) / 100, ele: 5 }));
  if (direction === 'reverse') points = points.slice().reverse();
  const cum = cumulativeDistances(points);
  const samples = sampleRoute(points, cum);
  return { direction, points, cum, samples, forecasts: samples.map(() => forecast(opts)) };
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

  it('picks the shortest predicted time for a power model', () => {
    const choice = bestChoice(rows, power);
    if (choice.kind !== 'best') throw new Error(`expected a best row, got ${choice.kind}`);
    expect(choice.row.durationMs).toBe(Math.min(...rows.map((r) => r.durationMs)));
  });

  it('uses the lowest mean headwind for a constant-speed model', () => {
    const constant: PaceModel = { kind: 'constant', speedKmh: 25 };
    const cRows = compareRides([variant('forward'), variant('reverse')], [T0 * 1000], constant);
    expect(cRows[0]!.durationMs).toBeCloseTo(cRows[1]!.durationMs, 6);
    const choice = bestChoice(cRows, constant);
    expect(choice.kind === 'best' && choice.row.direction).toBe('reverse');
  });

  it('ignores options without a complete forecast', () => {
    const late = compareRides([variant('forward')], [(T0 + 11 * 3600) * 1000], power);
    expect(late[0]!.fullyForecast).toBe(false);
    expect(bestChoice(late, power).kind).toBe('none');
  });
});

describe('bestChoice and daylight', () => {
  const constant: PaceModel = { kind: 'constant', speedKmh: 25 };
  // Sunrise one hour before T0; sunset 90 minutes after T0, then the next day's pair.
  const sun: SunTimes = {
    sunrise: [T0 - 3600, T0 + 23 * 3600],
    sunset: [T0 + 5400, T0 + 29 * 3600],
  };
  const both = (o: Parameters<typeof forecast>[0]) => [variant('forward', o), variant('reverse', o)];

  it('labels each row with its daylight', () => {
    const rows = compareRides(both({ sun }), [T0 * 1000, (T0 + 2 * 3600) * 1000], constant);
    const at = (h: number) => rows.find((r) => r.departureMs === (T0 + h * 3600) * 1000)!;
    expect(at(0).daylight).toBe('daylight');
    expect(at(2).daylight).toBe('starts-after-sunset');
  });

  it('never marks a ride that finishes after sunset as best, however favourable', () => {
    // The 1 h departure (48 min ride) finishes after the 90-minute sunset.
    const rows = compareRides(both({ sun }), [T0 * 1000, (T0 + 1 * 3600) * 1000], constant);
    const late = rows.filter((r) => r.departureMs === (T0 + 3600) * 1000);
    expect(late.every((r) => r.daylight === 'ends-after-sunset')).toBe(true);
    const choice = bestChoice(rows, constant);
    expect(choice.kind).toBe('best');
    if (choice.kind === 'best') expect(choice.row.departureMs).toBe(T0 * 1000);
  });

  it('names no option when every ride is in the dark', () => {
    const rows = compareRides(both({ sun }), [(T0 + 2 * 3600) * 1000], constant);
    expect(bestChoice(rows, constant).kind).toBe('none');
  });

  it('marks the only daylight option as best', () => {
    const rows = compareRides([variant('forward', { sun })], [T0 * 1000, (T0 + 2 * 3600) * 1000], constant);
    const choice = bestChoice(rows, constant);
    expect(choice.kind === 'best' && choice.row.departureMs).toBe(T0 * 1000);
  });

  it('names no winner when the options are too close to notice', () => {
    const rows = compareRides(both({ windKmh: 1 }), [T0 * 1000], constant);
    expect(bestChoice(rows, constant).kind).toBe('similar');
  });
});
