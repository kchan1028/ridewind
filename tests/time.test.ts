import { describe, expect, it } from 'vitest';
import { formatDayClock, tzOffsetMs, utcToWallTime, wallTimeToUtc } from '../src/lib/time';

describe('route timezone conversion', () => {
  it('converts winter and summer wall times in Amsterdam', () => {
    expect(new Date(wallTimeToUtc('2026-01-15T10:00', 'Europe/Amsterdam')).toISOString()).toBe('2026-01-15T09:00:00.000Z');
    expect(new Date(wallTimeToUtc('2026-07-01T10:00', 'Europe/Amsterdam')).toISOString()).toBe('2026-07-01T08:00:00.000Z');
  });
  it('handles negative and half-hour offsets', () => {
    expect(new Date(wallTimeToUtc('2026-07-01T06:30', 'America/Chicago')).toISOString()).toBe('2026-07-01T11:30:00.000Z');
    expect(new Date(wallTimeToUtc('2026-07-01T12:00', 'Asia/Kolkata')).toISOString()).toBe('2026-07-01T06:30:00.000Z');
  });
  it('round-trips through utcToWallTime', () => {
    const utc = Date.UTC(2026, 10, 14, 15, 45);
    for (const tz of ['UTC', 'Europe/Amsterdam', 'Australia/Adelaide', 'America/New_York']) {
      expect(wallTimeToUtc(utcToWallTime(utc, tz), tz)).toBe(utc);
    }
  });
  it('moves a time inside the spring-forward gap to after the gap', () => {
    // 2026-03-29 02:30 does not exist in Amsterdam (clocks jump 02:00 → 03:00).
    expect(utcToWallTime(wallTimeToUtc('2026-03-29T02:30', 'Europe/Amsterdam'), 'Europe/Amsterdam')).toBe('2026-03-29T03:30');
  });
  it('resolves an ambiguous fall-back time to a valid instant', () => {
    const utc = wallTimeToUtc('2026-10-25T02:30', 'Europe/Amsterdam');
    expect(utcToWallTime(utc, 'Europe/Amsterdam')).toBe('2026-10-25T02:30');
  });
  it('reports offsets', () => {
    expect(tzOffsetMs('Europe/Amsterdam', Date.UTC(2026, 0, 1))).toBe(3600_000);
    expect(tzOffsetMs('America/New_York', Date.UTC(2026, 6, 1))).toBe(-4 * 3600_000);
  });
  it('rejects malformed input', () => {
    expect(() => wallTimeToUtc('tomorrow', 'UTC')).toThrow(/departure/);
  });
});

describe('formatDayClock', () => {
  it('gives weekday, day of month and time in the route timezone', () => {
    // 2026-11-14 19:00 UTC is Saturday 14th, 11:00 in Los Angeles.
    const out = formatDayClock(Date.UTC(2026, 10, 14, 19, 0), 'America/Los_Angeles');
    expect(out).toMatch(/^Sat 14, /);
    expect(out).toContain('11:00');
  });
});
