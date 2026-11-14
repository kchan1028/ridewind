import { normalizeDeg } from './geo';

export type WindClass = 'headwind' | 'tailwind' | 'crosswind' | 'calm';

/** Below this wind speed (km/h) direction matters little and the section is shown as calm. */
export const CALM_BELOW_KMH = 5;

/**
 * Signed angle (-180..180] between where the wind comes FROM and where the rider
 * is heading. 0 means the wind blows straight into the rider's face.
 */
export function relativeWindAngle(windFromDeg: number, travelBearingDeg: number): number {
  const a = normalizeDeg(windFromDeg - travelBearingDeg);
  return a > 180 ? a - 360 : a;
}

export interface WindComponents {
  /** Positive = headwind, negative = tailwind. Same unit as the input speed. */
  headwind: number;
  /** Positive = wind from the rider's right, negative = from the left. */
  crosswind: number;
}

/**
 * Splits a meteorological wind (speed, direction it blows FROM) into components
 * along and across the rider's direction of travel.
 */
export function windComponents(windSpeed: number, windFromDeg: number, travelBearingDeg: number): WindComponents {
  const rel = (relativeWindAngle(windFromDeg, travelBearingDeg) * Math.PI) / 180;
  const clean = (v: number) => (Math.abs(v) < 1e-9 ? 0 : v);
  return { headwind: clean(windSpeed * Math.cos(rel)), crosswind: clean(windSpeed * Math.sin(rel)) };
}

/**
 * Headwind within ±45° of the nose, tailwind within ±45° of the tail, crosswind
 * otherwise; calm below CALM_BELOW_KMH. These sectors are a display convention.
 */
export function classifyWind(windSpeedKmh: number, windFromDeg: number, travelBearingDeg: number): WindClass {
  if (windSpeedKmh < CALM_BELOW_KMH) return 'calm';
  const abs = Math.abs(relativeWindAngle(windFromDeg, travelBearingDeg));
  if (abs <= 45) return 'headwind';
  if (abs >= 135) return 'tailwind';
  return 'crosswind';
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export function compassPoint(deg: number): string {
  return COMPASS[Math.round(normalizeDeg(deg) / 22.5) % 16]!;
}
