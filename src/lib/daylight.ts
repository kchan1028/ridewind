import type { SunTimes } from './weather';

export type DaylightKind = 'daylight' | 'starts-before-sunrise' | 'ends-after-sunset' | 'unknown';

export interface Daylight {
  kind: DaylightKind;
  /** Sunrise and sunset (ms) bracketing the ride day, when known. */
  sunriseMs: number | null;
  sunsetMs: number | null;
}

/**
 * Whether a ride from departure to finish stays within daylight, using the
 * sunrise and sunset of the departure day. Rides that start before sunrise
 * are flagged first; rides that end after that day's sunset second.
 */
export function rideDaylight(departureMs: number, finishMs: number, sun: SunTimes | null | undefined): Daylight {
  if (!sun || sun.sunrise.length === 0 || sun.sunset.length === 0) return { kind: 'unknown', sunriseMs: null, sunsetMs: null };
  const sunsets = sun.sunset.map((s) => s * 1000).sort((a, b) => a - b);
  const sunrises = sun.sunrise.map((s) => s * 1000).sort((a, b) => a - b);
  // The ride day's sunset is the first sunset after departure.
  const sunsetMs = sunsets.find((s) => s > departureMs) ?? null;
  // Its sunrise is the last sunrise before that sunset.
  const sunriseMs = sunsetMs === null ? null : ([...sunrises].reverse().find((r) => r < sunsetMs) ?? null);
  if (sunsetMs === null || sunriseMs === null) return { kind: 'unknown', sunriseMs, sunsetMs };
  if (departureMs < sunriseMs) return { kind: 'starts-before-sunrise', sunriseMs, sunsetMs };
  if (finishMs > sunsetMs) return { kind: 'ends-after-sunset', sunriseMs, sunsetMs };
  return { kind: 'daylight', sunriseMs, sunsetMs };
}
