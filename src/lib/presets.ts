import { utcToWallTime, wallTimeToUtc } from './time';

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
  const out: DeparturePreset[] = [
    { label: 'Next hour', ms: Math.ceil(nowMs / HOUR) * HOUR },
    { label: 'Tomorrow 08:00', ms: wallTimeToUtc(`${dateAt(1).iso}T08:00`, tz) },
  ];
  for (let k = 2; k <= 7; k++) {
    const day = dateAt(k);
    if (day.weekday === 6 || day.weekday === 0) {
      const name = day.weekday === 6 ? 'Sat' : 'Sun';
      out.push({ label: `${name} ${Number(day.iso.slice(8, 10))}, 09:00`, ms: wallTimeToUtc(`${day.iso}T09:00`, tz) });
      break;
    }
  }
  return out.filter((p) => p.ms >= bounds.min && p.ms <= bounds.max);
}
