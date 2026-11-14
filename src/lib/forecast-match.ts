import { normalizeDeg } from './geo';
import type { HourlySeries } from './weather';

export interface PointWeather {
  windSpeed: number | null;
  windDirection: number | null;
  windGusts: number | null;
  temperature: number | null;
  precipitation: number | null;
  precipitationProbability: number | null;
  /** Start of the forecast hour used for hourly totals (precipitation, gusts), ms. */
  hourStartMs: number;
}

function lerp(a: number | null, b: number | null, f: number): number | null {
  if (a === null && b === null) return null;
  if (a === null) return f >= 0.5 ? b : null;
  if (b === null) return f < 0.5 ? a : null;
  return a + (b - a) * f;
}

/** Interpolates wind direction through its shortest arc (350° → 10° passes 0°, not 180°). */
function lerpDirection(a: number | null, b: number | null, f: number): number | null {
  if (a === null || b === null) return f < 0.5 ? a : b;
  const diff = ((b - a + 540) % 360) - 180;
  return normalizeDeg(a + diff * f);
}

/**
 * Forecast at a point for an arrival time.
 *
 * - Instantaneous values (temperature, wind speed and direction) are linearly
 *   interpolated between the surrounding hours.
 * - Open-Meteo reports precipitation, its probability and gusts for the
 *   *preceding* hour, so the hour containing the arrival time is the first
 *   timestamp strictly after it.
 *
 * Returns null when the time is outside the forecast window.
 */
export function weatherAt(series: HourlySeries, targetMs: number): PointWeather | null {
  const t = targetMs / 1000;
  const times = series.time;
  const n = times.length;
  if (n === 0 || t < times[0]! || t > times[n - 1]!) return null;

  let i = 0;
  let lo = 0;
  let hi = n - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid]! <= t) {
      i = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  const j = Math.min(i + 1, n - 1);
  const span = times[j]! - times[i]!;
  const f = span > 0 ? (t - times[i]!) / span : 0;

  // Hour-total index: the hour ending after t. At the last timestamp use the last value.
  const k = t < times[n - 1]! ? i + 1 : n - 1;

  return {
    temperature: lerp(series.temperature[i]!, series.temperature[j]!, f),
    windSpeed: lerp(series.windSpeed[i]!, series.windSpeed[j]!, f),
    windDirection: lerpDirection(series.windDirection[i]!, series.windDirection[j]!, f),
    windGusts: series.windGusts[k]!,
    precipitation: series.precipitation[k]!,
    precipitationProbability: series.precipitationProbability[k]!,
    hourStartMs: (times[k]! - 3600) * 1000,
  };
}
