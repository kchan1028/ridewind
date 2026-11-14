import { describe, expect, it } from 'vitest';
import { departurePresets, nextDepartureAt } from '../src/lib/presets';
import { formatDateTime, formatWallClock, utcToWallTime } from '../src/lib/time';

const wide = { min: 0, max: Number.MAX_SAFE_INTEGER };
const tz = 'Europe/Amsterdam';
const wall = (ms: number) => utcToWallTime(ms, tz);
const TOMORROW = `Tomorrow ${formatWallClock('08:00')}`;

describe('departurePresets', () => {
  it('on a Saturday, offers tomorrow (Sunday) 08:00 and next Saturday 09:00', () => {
    const now = Date.UTC(2026, 10, 14, 15, 20); // Sat 14 Nov, 16:20 in Amsterdam
    const p = departurePresets(now, tz, wide);
    expect(p.map((x) => x.label)).toEqual(['Next hour', TOMORROW, formatDateTime(p[2]!.ms, tz)]);
    expect(wall(p[0]!.ms)).toBe('2026-11-14T17:00');
    expect(wall(p[1]!.ms)).toBe('2026-11-15T08:00');
    expect(wall(p[2]!.ms)).toBe('2026-11-21T09:00');
  });
  it('on a Friday, skips Saturday (tomorrow) and offers Sunday', () => {
    const now = Date.UTC(2026, 10, 13, 10, 0);
    const p = departurePresets(now, tz, wide);
    expect(p.map((x) => x.label)).toEqual(['Next hour', TOMORROW, formatDateTime(p[2]!.ms, tz)]);
    expect(wall(p[2]!.ms)).toBe('2026-11-15T09:00');
  });
  it('on a Wednesday, offers the coming Saturday', () => {
    const now = Date.UTC(2026, 10, 11, 10, 0);
    expect(wall(departurePresets(now, tz, wide)[2]!.ms)).toBe('2026-11-14T09:00');
  });
  it('uses the route timezone, not UTC, for "tomorrow"', () => {
    // 23:30 UTC on Fri 13 Nov is already Sat 14 Nov 08:30 in Tokyo.
    const now = Date.UTC(2026, 10, 13, 23, 30);
    const p = departurePresets(now, 'Asia/Tokyo', wide);
    expect(utcToWallTime(p[1]!.ms, 'Asia/Tokyo')).toBe('2026-11-15T08:00');
  });
  it('drops presets outside the forecast window', () => {
    const now = Date.UTC(2026, 10, 14, 15, 20);
    const p = departurePresets(now, tz, { min: now, max: now + 24 * 3600_000 });
    expect(p.map((x) => x.label)).toEqual(['Next hour', TOMORROW]);
  });
});

describe('nextDepartureAt', () => {
  const at = (w: string) => Date.parse(`${w}:00Z`) - 3600_000; // Amsterdam is UTC+1 in November

  it('uses today when the time is still ahead', () => {
    expect(wall(nextDepartureAt('08:00', at('2026-11-14T06:30'), tz))).toBe('2026-11-14T08:00');
  });

  it('rolls to tomorrow once the time has passed', () => {
    expect(wall(nextDepartureAt('08:00', at('2026-11-14T09:15'), tz))).toBe('2026-11-15T08:00');
  });

  it('rolls to tomorrow at exactly that time', () => {
    expect(wall(nextDepartureAt('08:00', at('2026-11-14T08:00'), tz))).toBe('2026-11-15T08:00');
  });
});
