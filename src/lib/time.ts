import { AppError } from './errors';

const WALL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(tz, f);
  }
  return f;
}

function wallParts(utcMs: number, tz: string) {
  const parts: Record<string, number> = {};
  for (const p of partsFormatter(tz).formatToParts(new Date(utcMs))) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return parts as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

export function isValidTimeZone(tz: string): boolean {
  try {
    partsFormatter(tz);
    return true;
  } catch {
    return false;
  }
}

/** Offset of `tz` from UTC at the given instant, in milliseconds (e.g. +3600000 for CET). */
export function tzOffsetMs(tz: string, utcMs: number): number {
  const p = wallParts(utcMs, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * Converts a wall-clock time in `tz` ("YYYY-MM-DDTHH:mm", as produced by
 * <input type="datetime-local">) to a UTC instant. Times inside a DST gap move
 * forward by the gap; ambiguous fall-back times resolve to one valid instant.
 */
export function wallTimeToUtc(wall: string, tz: string): number {
  const m = WALL_RE.exec(wall);
  if (!m) throw new AppError('TIME_INVALID', 'Enter a departure date and time.');
  const naive = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!);
  const off1 = tzOffsetMs(tz, naive);
  const g1 = naive - off1;
  const off2 = tzOffsetMs(tz, g1);
  if (off2 === off1) return g1;
  const g2 = naive - off2;
  const valid = [g1, g2].filter((g) => utcToWallTime(g, tz) === wall);
  // No candidate round-trips: the wall time falls in a DST gap, so take the later instant.
  return valid.length ? Math.min(...valid) : Math.max(g1, g2);
}

/** UTC instant → "YYYY-MM-DDTHH:mm" in `tz`. */
export function utcToWallTime(utcMs: number, tz: string): string {
  const p = wallParts(utcMs, tz);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function formatClock(utcMs: number, tz: string): string {
  return new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(utcMs);
}

export function formatDateTime(utcMs: number, tz: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(utcMs);
}

export function formatOffset(tz: string, utcMs: number): string {
  const mins = Math.round(tzOffsetMs(tz, utcMs) / 60000);
  const sign = mins < 0 ? '−' : '+';
  const a = Math.abs(mins);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `UTC${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
}

export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}
