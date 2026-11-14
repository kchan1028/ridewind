import { formatClock, formatDayClock, utcToWallTime, wallTimeToUtc } from './time';

const HOUR = 3600_000;

export interface DeparturePreset {
  label: string;
  ms: number;
}

/**
 * Quick departure choices in the route's timezone: the next full hour,
 * tomorrow at 08:00, and the coming weekend morning that isn't tomorrow
 * (Saturday, else Sunday) at 09:00. Only presets inside [min, max] are returned.
 */
/**
 * The next time the wall clock in `tz` shows `hhmm` ("08:00"): today if that
 * is still ahead of `nowMs`, otherwise tomorrow.
 */
export function nextDepartureAt(hhmm: string, nowMs: number, tz: string): number {
  const today = utcToWallTime(nowMs, tz).slice(0, 10);
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const at = wallTimeToUtc(`${today}T${hhmm}`, tz);
  if (at > nowMs) return at;
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return wallTimeToUtc(`${tomorrow}T${hhmm}`, tz);
}

export function departurePresets(nowMs: number, tz: string, bounds: { min: number; max: number }): DeparturePreset[] {
  const today = utcToWallTime(nowMs, tz).slice(0, 10);
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const dateAt = (addDays: number) => {
    const dt = new Date(Date.UTC(y, m - 1, d + addDays));
    return { iso: dt.toISOString().slice(0, 10), weekday: dt.getUTCDay() };
  };
  const tomorrow8 = wallTimeToUtc(`${dateAt(1).iso}T08:00`, tz);
  // Labels use the same clock and date style as the rest of the page.
  const out: DeparturePreset[] = [
    { label: 'Next hour', ms: Math.ceil(nowMs / HOUR) * HOUR },
    { label: `Tomorrow ${formatClock(tomorrow8, tz)}`, ms: tomorrow8 },
  ];
  for (let k = 2; k <= 7; k++) {
    const day = dateAt(k);
    if (day.weekday === 6 || day.weekday === 0) {
      const ms = wallTimeToUtc(`${day.iso}T09:00`, tz);
      out.push({ label: formatDayClock(ms, tz), ms });
      break;
    }
  }
  return out.filter((p) => p.ms >= bounds.min && p.ms <= bounds.max);
}
