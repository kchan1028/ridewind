import { describe, expect, it } from 'vitest';
import { rideDaylight } from '../src/lib/daylight';

const H = 3600_000;
// Two days: sunrise 07:00 and sunset 17:00 UTC (as Unix seconds).
const day0 = Date.UTC(2026, 10, 14);
const sun = {
  sunrise: [day0 / 1000 + 7 * 3600, day0 / 1000 + 31 * 3600],
  sunset: [day0 / 1000 + 17 * 3600, day0 / 1000 + 41 * 3600],
};

describe('rideDaylight', () => {
  it('a midday ride is in daylight', () => {
    expect(rideDaylight(day0 + 10 * H, day0 + 12 * H, sun)).toMatchObject({ kind: 'daylight', sunsetMs: day0 + 17 * H });
  });
  it('flags a ride that finishes after sunset', () => {
    expect(rideDaylight(day0 + 15 * H, day0 + 18 * H, sun).kind).toBe('ends-after-sunset');
  });
  it('flags a ride that starts before sunrise', () => {
    expect(rideDaylight(day0 + 6 * H, day0 + 9 * H, sun)).toMatchObject({ kind: 'starts-before-sunrise', sunriseMs: day0 + 7 * H });
  });
  it('an evening departure soon after sunset counts as starting after sunset', () => {
    expect(rideDaylight(day0 + 19 * H, day0 + 21 * H, sun)).toMatchObject({ kind: 'starts-after-sunset', sunsetMs: day0 + 17 * H, sunriseMs: day0 + 31 * H });
  });
  it('a late-night departure nearer the next sunrise counts as before sunrise', () => {
    expect(rideDaylight(day0 + 26 * H, day0 + 28 * H, sun)).toMatchObject({ kind: 'starts-before-sunrise', sunriseMs: day0 + 31 * H });
  });
  it('returns unknown without sun data (e.g. polar day/night)', () => {
    expect(rideDaylight(day0, day0 + H, { sunrise: [], sunset: [] }).kind).toBe('unknown');
    expect(rideDaylight(day0, day0 + H, null).kind).toBe('unknown');
    expect(rideDaylight(day0 + 50 * H, day0 + 51 * H, sun).kind).toBe('unknown');
  });
});
