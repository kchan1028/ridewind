import { describe, expect, it } from 'vitest';
import { cumulativeDistances, sampleRoute, type TrackPoint } from '../src/lib/geo';
import { DEFAULT_RIDER } from '../src/lib/physics';
import { planRide } from '../src/lib/ride';
import { simulateRide, type PaceModel } from '../src/lib/simulate';
import type { HourlySeries, LocationForecast } from '../src/lib/weather';

const T0 = 1_800_000_000;
function forecast(dirFrom: number, speed: number): LocationForecast {
  const time = Array.from({ length: 12 }, (_, i) => T0 + i * 3600);
  const fill = (v: number) => time.map(() => v);
  const series: HourlySeries = {
    time,
    temperature: fill(15),
    precipitation: fill(0),
    precipitationProbability: fill(0),
    windSpeed: fill(speed),
    windDirection: fill(dirFrom),
    windGusts: fill(speed),
  };
  return { key: 'k', gridLat: 0, gridLon: 0, series, sun: { sunrise: [], sunset: [] } };
}

/** 20 km due east; elevation from a function of distance fraction, or null. */
function route(ele: ((f: number) => number) | null): TrackPoint[] {
  return Array.from({ length: 201 }, (_, i) => ({ lat: 0, lon: (i * 0.18) / 200, ele: ele ? ele(i / 200) : null }));
}

function sim(points: TrackPoint[], pace: PaceModel, wind = { dir: 0, speed: 0 }, assumeFlat = false, departOffsetS = 0) {
  const cum = cumulativeDistances(points);
  const samples = sampleRoute(points, cum);
  return simulateRide({
    points,
    cum,
    samples,
    forecasts: samples.map(() => forecast(wind.dir, wind.speed)),
    departureMs: (T0 + departOffsetS) * 1000,
    pace,
    assumeFlat,
  });
}

const power: PaceModel = { kind: 'power', rider: { ...DEFAULT_RIDER, powerW: 200 }, exposure: 'open' };

describe('simulateRide', () => {
  it('constant pace: duration = distance / speed', () => {
    const s = sim(route(() => 0), { kind: 'constant', speedKmh: 20 });
    expect(s.durationMs / 3600_000).toBeCloseTo(s.steps[s.steps.length - 1]!.endM / 1000 / 20, 6);
    expect(s.avgSpeedKmh).toBeCloseTo(20, 6);
  });

  it('planned stops add to the total time but not to the moving speed', () => {
    const base = sim(route(() => 0), { kind: 'constant', speedKmh: 20 });
    const stopped = sim(route(() => 0), { kind: 'constant', speedKmh: 20, stopMinutes: 30 });
    expect(stopped.stopMs).toBe(30 * 60_000);
    expect(stopped.durationMs - base.durationMs).toBeCloseTo(30 * 60_000, 3);
    expect(stopped.avgSpeedKmh).toBeCloseTo(20, 6);
  });

  it('spreads stops evenly, so halfway arrives with half the stop time', () => {
    const base = sim(route(() => 0), { kind: 'constant', speedKmh: 20 });
    const stopped = sim(route(() => 0), { kind: 'constant', speedKmh: 20, stopMinutes: 30 });
    const half = base.steps[base.steps.length - 1]!.endM / 2;
    expect(stopped.elapsedAt(half) - base.elapsedAt(half)).toBeCloseTo(15 * 60_000, 3);
  });

  it('ignores negative stop time and caps very long stops', () => {
    const base = sim(route(() => 0), { kind: 'constant', speedKmh: 20 });
    expect(sim(route(() => 0), { kind: 'constant', speedKmh: 20, stopMinutes: -10 }).durationMs).toBeCloseTo(base.durationMs, 3);
    expect(sim(route(() => 0), { kind: 'constant', speedKmh: 20, stopMinutes: 10_000 }).stopMs).toBe(600 * 60_000);
  });

  it('refuses a power prediction without elevation unless flat is explicitly chosen', () => {
    expect(() => sim(route(null), power)).toThrow(expect.objectContaining({ code: 'ELEVATION_MISSING' }));
    const flat = sim(route(null), power, undefined, true);
    expect(flat.assumedFlat).toBe(true);
    expect(flat.steps.every((s) => s.gradient === null && s.eleM === null)).toBe(true);
  });

  it('partial elevation also requires a choice (never filled with zeros)', () => {
    const pts = route(() => 10);
    pts[50]!.ele = null;
    expect(() => sim(pts, power)).toThrow(expect.objectContaining({ code: 'ELEVATION_MISSING' }));
  });

  it('a climb is slower than the flat; reversing it into a descent is faster', () => {
    const flat = sim(route(() => 0), power);
    const up = sim(route((f) => f * 600), power); // 3 % average
    const down = sim(route((f) => (1 - f) * 600), power);
    expect(up.durationMs).toBeGreaterThan(flat.durationMs * 1.3);
    expect(down.durationMs).toBeLessThan(flat.durationMs);
    expect(up.steps[100]!.gradient).toBeCloseTo(0.03, 3);
  });

  it('a headwind slows a power-limited rider; a tailwind speeds them up', () => {
    const calm = sim(route(() => 0), power);
    const head = sim(route(() => 0), power, { dir: 90, speed: 25 }); // riding east into an east wind
    const tail = sim(route(() => 0), power, { dir: 270, speed: 25 });
    expect(head.durationMs).toBeGreaterThan(calm.durationMs);
    expect(tail.durationMs).toBeLessThan(calm.durationMs);
    expect(head.steps[0]!.headwind10Kmh).toBeCloseTo(25, 6);
  });

  it('sheltered exposure feels less of the headwind than open terrain', () => {
    const open = sim(route(() => 0), power, { dir: 90, speed: 25 });
    const sheltered = sim(route(() => 0), { ...power, exposure: 'sheltered' } as PaceModel, { dir: 90, speed: 25 });
    expect(sheltered.durationMs).toBeLessThan(open.durationMs);
  });

  it('assumes still air (and reports it) where the forecast window ends', () => {
    const s = sim(route(() => 0), power, { dir: 90, speed: 25 }, false, 11 * 3600 + 1800);
    expect(s.stepsWithoutWeather).toBeGreaterThan(0);
  });

  it('elapsedAt is monotonic and matches the duration at the end', () => {
    const s = sim(route((f) => Math.sin(f * 6) * 50 + 60), power);
    let prev = -1;
    for (let d = 0; d <= 20_100; d += 500) {
      const t = s.elapsedAt(d);
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
    expect(s.elapsedAt(1e9)).toBe(s.durationMs);
  });

  it('feeds simulated timing into planRide', () => {
    const points = route(() => 0);
    const cum = cumulativeDistances(points);
    const samples = sampleRoute(points, cum);
    const forecasts = samples.map(() => forecast(90, 20));
    const s = simulateRide({ points, cum, samples, forecasts, departureMs: T0 * 1000, pace: power });
    const plan = planRide({ points, cum, samples, forecasts, departureMs: T0 * 1000, elapsedAt: s.elapsedAt });
    expect(plan.durationMs).toBeCloseTo(s.durationMs, 6);
    expect(plan.samples[plan.samples.length - 1]!.etaMs).toBeCloseTo(T0 * 1000 + s.durationMs, 0);
  });
});
