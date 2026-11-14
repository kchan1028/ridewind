import { describe, expect, it } from 'vitest';
import { weatherAt } from '../src/lib/forecast-match';
import type { HourlySeries } from '../src/lib/weather';

const T0 = 1_800_000_000; // a whole hour, seconds
const series: HourlySeries = {
  time: [T0, T0 + 3600, T0 + 7200],
  temperature: [10, 12, 14],
  precipitation: [0, 0.5, 2],
  precipitationProbability: [0, 40, 80],
  windSpeed: [10, 20, 30],
  windDirection: [350, 10, 90],
  windGusts: [15, 30, 45],
};
const at = (secondsAfterT0: number) => weatherAt(series, (T0 + secondsAfterT0) * 1000);

describe('weatherAt: matching forecasts to arrival times', () => {
  it('returns exact hourly values on the hour for instantaneous fields', () => {
    const w = at(3600)!;
    expect(w.temperature).toBe(12);
    expect(w.windSpeed).toBe(20);
    expect(w.windDirection).toBeCloseTo(10, 9);
  });
  it('interpolates instantaneous fields between hours', () => {
    const w = at(1800)!;
    expect(w.temperature).toBeCloseTo(11, 9);
    expect(w.windSpeed).toBeCloseTo(15, 9);
  });
  it('interpolates wind direction across north via the short arc', () => {
    expect(at(1800)!.windDirection).toBeCloseTo(0, 6); // 350° → 10° midpoint is 0°, not 180°
  });
  it('uses the hour containing the arrival for preceding-hour totals', () => {
    // 00:30 after T0 is inside the hour ending at T0+1h.
    const w = at(1800)!;
    expect(w.precipitation).toBe(0.5);
    expect(w.precipitationProbability).toBe(40);
    expect(w.windGusts).toBe(30);
    expect(w.hourStartMs).toBe(T0 * 1000);
  });
  it('on an exact hour, totals come from the hour that is starting', () => {
    expect(at(3600)!.precipitation).toBe(2);
  });
  it('at the final timestamp uses the last values', () => {
    const w = at(7200)!;
    expect(w.temperature).toBe(14);
    expect(w.precipitation).toBe(2);
  });
  it('returns null outside the forecast window', () => {
    expect(at(-1)).toBeNull();
    expect(at(7201)).toBeNull();
  });
  it('with a missing neighbour, uses the nearest valid hour only within 30 minutes', () => {
    const s = { ...series, windSpeed: [10, null, 30] };
    expect(weatherAt(s, (T0 + 600) * 1000)!.windSpeed).toBe(10);
    expect(weatherAt(s, (T0 + 2400) * 1000)!.windSpeed).toBeNull();
  });
});
