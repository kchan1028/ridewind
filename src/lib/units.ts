export type UnitSystem = 'metric' | 'imperial';

/** Regions that use miles and Fahrenheit day to day. */
const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM']);

/** Units to start with before the rider picks: imperial for US-style locales ("en-US"), otherwise metric. */
export function defaultUnits(lang: string | undefined = globalThis.navigator?.language): UnitSystem {
  const region = lang?.split(/[-_]/)[1]?.toUpperCase();
  return region && IMPERIAL_REGIONS.has(region) ? 'imperial' : 'metric';
}

const KM_PER_MI = 1.609344;
const FT_PER_M = 3.28084;

const fmt = (v: number, digits = 0) =>
  v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function formatDistance(m: number, u: UnitSystem): string {
  return u === 'metric' ? `${fmt(m / 1000, 1)} km` : `${fmt(m / 1000 / KM_PER_MI, 1)} mi`;
}

export function formatElevation(m: number, u: UnitSystem): string {
  return u === 'metric' ? `${fmt(m)} m` : `${fmt(m * FT_PER_M)} ft`;
}

export function speedUnit(u: UnitSystem): string {
  return u === 'metric' ? 'km/h' : 'mph';
}

export function kmhToDisplay(kmh: number, u: UnitSystem): number {
  return u === 'metric' ? kmh : kmh / KM_PER_MI;
}

export function displayToKmh(v: number, u: UnitSystem): number {
  return u === 'metric' ? v : v * KM_PER_MI;
}

export function formatSpeed(kmh: number, u: UnitSystem): string {
  return `${fmt(kmhToDisplay(kmh, u))} ${speedUnit(u)}`;
}

export function formatTemp(c: number, u: UnitSystem): string {
  return u === 'metric' ? `${fmt(c)}°C` : `${fmt((c * 9) / 5 + 32)}°F`;
}

export function formatPrecip(mm: number, u: UnitSystem): string {
  return u === 'metric' ? `${fmt(mm, 1)} mm` : `${fmt(mm / 25.4, 2)} in`;
}

const LB_PER_KG = 2.20462;

export function massUnit(u: UnitSystem): string {
  return u === 'metric' ? 'kg' : 'lb';
}

export function kgToDisplay(kg: number, u: UnitSystem): number {
  return u === 'metric' ? kg : kg * LB_PER_KG;
}

export function displayToKg(v: number, u: UnitSystem): number {
  return u === 'metric' ? v : v / LB_PER_KG;
}
