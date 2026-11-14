import { describe, expect, it } from 'vitest';
import { cumulativeDistances, sampleRoute, type TrackPoint } from '../src/lib/geo';
import { etaAt, planRide } from '../src/lib/ride';
import type { HourlySeries, LocationForecast } from '../src/lib/weather';

const T0 = 1_800_000_000;
const HOURS = 6;
function forecast(dirFrom: number, speed = 20): LocationForecast {
  const time = Array.from({ length: HOURS }, (_, i) => T0 + i * 3600);
  const fill = (v: number) => time.map(() => v);
  const series: HourlySeries = {
    time,
    temperature: fill(10),
    precipitation: fill(0),
    precipitationProbability: fill(5),
    windSpeed: fill(speed),
    windDirection: fill(dirFrom),
    windGusts: fill(speed * 1.5),
  };
  return { key: 'k', gridLat: 0, gridLon: 0, series, sun: { sunrise: [], sunset: [] } };
}

// 20 km due east along the equator, then 20 km due north.
const east: TrackPoint[] = Array.from({ length: 21 }, (_, i) => ({ lat: 0, lon: (i * 0.18) / 20, ele: null }));
const north: TrackPoint[] = Array.from({ length: 20 }, (_, i) => ({ lat: ((i + 1) * 0.18) / 20, lon: 0.18, ele: null }));
const points = [...east, ...north];
const cum = cumulativeDistances(points);
const samples = sampleRoute(points, cum);

function plan(dirFrom: number, departureOffsetS = 0, speedKmh = 20) {
  return planRide({
    points,
    cum,
    samples,
    forecasts: samples.map(() => forecast(dirFrom)),
    departureMs: (T0 + departureOffsetS) * 1000,
    speedKmh,
  });
}

describe('planRide', () => {
  it('estimates arrival times from a constant average speed', () => {
    expect(etaAt(0, 25_000, 25)).toBe(3600_000);
    const p = plan(90);
    expect(p.durationMs).toBeCloseTo((cum[cum.length - 1]! / 1000 / 20) * 3600_000, 0);
    expect(p.samples[0]!.etaMs).toBe(T0 * 1000);
  });

  it('an east wind is a headwind on the eastbound leg and a crosswind on the northbound leg', () => {
    const p = plan(90); // wind from the east
    const d = p.summary.distanceByClass;
    const half = cum[cum.length - 1]! / 2;
    expect(d.headwind).toBeGreaterThan(half * 0.9);
    expect(d.crosswind).toBeGreaterThan(half * 0.9);
    expect(d.tailwind).toBe(0);
    expect(p.segments.map((s) => s.windClass)).toEqual(['headwind', 'crosswind']);
  });

  it('a west wind becomes a tailwind on the eastbound leg', () => {
    const p = plan(270);
    expect(p.segments[0]!.windClass).toBe('tailwind');
    expect(p.summary.meanHeadwind!).toBeLessThan(0);
  });

  it('marks sections outside the forecast window as unknown instead of guessing', () => {
    // Depart 4.5 h into a 5 h window: most of the 2 h ride has no forecast.
    const p = plan(90, 4.5 * 3600);
    expect(p.summary.samplesWithoutForecast).toBeGreaterThan(0);
    expect(p.summary.distanceByClass.unknown).toBeGreaterThan(0);
    expect(p.samples[p.samples.length - 1]!.weather).toBeNull();
    expect(p.samples[p.samples.length - 1]!.components).toBeNull();
  });

  it('marks everything unknown when no forecast is available', () => {
    const p = planRide({ points, cum, samples, forecasts: samples.map(() => null), departureMs: T0 * 1000, speedKmh: 20 });
    expect(p.segments).toHaveLength(1);
    expect(p.segments[0]!.windClass).toBe('unknown');
    expect(p.summary.meanHeadwind).toBeNull();
  });

  it('rejects a non-positive speed', () => {
    expect(() => plan(90, 0, 0)).toThrow(RangeError);
  });

  it('summarises forecast extremes', () => {
    const s = plan(90).summary;
    expect(s.windSpeedMax).toBe(20);
    expect(s.gustMax).toBe(30);
    expect(s.tempMin).toBe(10);
    expect(s.precipProbabilityMax).toBe(5);
    expect(s.wetDistanceM).toBe(0);
  });
});
