import { rideDaylight, type DaylightKind } from './daylight';
import type { Sample, TrackPoint } from './geo';
import { planRide } from './ride';
import { simulateRide, type PaceModel } from './simulate';
import type { LocationForecast, SunTimes } from './weather';

export type Direction = 'forward' | 'reverse';

export interface RouteVariant {
  direction: Direction;
  points: TrackPoint[];
  cum: number[];
  samples: Sample[];
  forecasts: Array<LocationForecast | null>;
}

export interface CompareRow {
  departureMs: number;
  direction: Direction;
  durationMs: number;
  finishMs: number;
  /** Share (0–1) of forecast-covered distance classed as headwind. */
  headwindShare: number;
  /** Distance-weighted mean 10 m headwind component, km/h (negative = net tailwind). */
  meanHeadwind: number | null;
  gustMax: number | null;
  precipProbabilityMax: number | null;
  /** Metres of route with forecast rain at arrival time. */
  wetDistanceM: number;
  /** True when every sampled point had a forecast at its arrival time. */
  fullyForecast: boolean;
  /** Whether the ride stays in daylight, from the start point's sunrise and sunset. */
  daylight: DaylightKind;
}

/**
 * Departure options from `startMs`, `spacingMs` apart, keeping only those whose
 * estimated finish still falls inside the forecast window.
 */
export function departureOptions(startMs: number, windowEndMs: number, rideMs: number, spacingMs: number, count: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < count; k++) {
    const t = startMs + k * spacingMs;
    if (t + rideMs > windowEndMs) break;
    out.push(t);
  }
  return out;
}

/**
 * Departures in the next daylight period after `afterMs`, on the same
 * `spacingMs` grid: from the first grid time at or after the next sunrise,
 * while the estimated finish is before that day's sunset and inside the
 * forecast window. Empty without sun times. Lets a plan made late in the day
 * still offer tomorrow's daylight rides.
 */
export function nextDayDepartures(
  afterMs: number,
  sun: SunTimes | null | undefined,
  windowEndMs: number,
  rideMs: number,
  spacingMs: number,
  count: number,
): number[] {
  if (!sun || count <= 0 || spacingMs <= 0) return [];
  const sunriseMs = sun.sunrise.map((t) => t * 1000).sort((a, b) => a - b).find((t) => t > afterMs);
  if (sunriseMs === undefined) return [];
  const sunsetMs = sun.sunset.map((t) => t * 1000).sort((a, b) => a - b).find((t) => t > sunriseMs);
  if (sunsetMs === undefined) return [];
  const out: number[] = [];
  for (let t = afterMs + Math.ceil((sunriseMs - afterMs) / spacingMs) * spacingMs; out.length < count; t += spacingMs) {
    if (t + rideMs > sunsetMs || t + rideMs > windowEndMs) break;
    out.push(t);
  }
  return out;
}

/**
 * Runs the full simulation and ride plan for every departure and route
 * direction, one row per pair. Reuses each variant's forecasts, so it makes no
 * network requests. Throws ELEVATION_MISSING for a power model on a route
 * without elevation unless `assumeFlat` is set, the same as simulateRide().
 */
export function compareRides(variants: RouteVariant[], departures: number[], pace: PaceModel, assumeFlat = false): CompareRow[] {
  const rows: CompareRow[] = [];
  for (const departureMs of departures) {
    for (const v of variants) {
      const sim = simulateRide({ ...v, departureMs, pace, assumeFlat });
      const plan = planRide({ ...v, departureMs, elapsedAt: sim.elapsedAt });
      const d = plan.summary.distanceByClass;
      const known = d.headwind + d.tailwind + d.crosswind + d.calm;
      rows.push({
        departureMs,
        direction: v.direction,
        durationMs: sim.durationMs,
        finishMs: departureMs + sim.durationMs,
        headwindShare: known > 0 ? d.headwind / known : 0,
        meanHeadwind: plan.summary.meanHeadwind,
        gustMax: plan.summary.gustMax,
        precipProbabilityMax: plan.summary.precipProbabilityMax,
        wetDistanceM: plan.summary.wetDistanceM,
        fullyForecast: plan.summary.samplesWithoutForecast === 0,
        daylight: rideDaylight(departureMs, departureMs + sim.durationMs, v.forecasts[0]?.sun).kind,
      });
    }
  }
  return rows;
}

/** Smallest gap between options that is worth calling a winner. */
export const BEST_MARGIN = {
  /** Predicted ride time, power model. */
  durationMs: 5 * 60_000,
  /** Distance-weighted mean headwind, km/h, constant-speed model. */
  meanHeadwindKmh: 3,
};

export type BestChoice =
  | { kind: 'best'; row: CompareRow }
  /** No option is fully forecast and in daylight. */
  | { kind: 'none' }
  /** The eligible options are too close to call. */
  | { kind: 'similar' };

/**
 * The most favourable option that is fully forecast and starts and finishes
 * in daylight (or where daylight is unknown): shortest predicted time for a
 * power model; for a constant-speed model (where every time is equal) the
 * lowest mean headwind. When two or more eligible options differ by less
 * than BEST_MARGIN from best to worst, no winner is named.
 */
export function bestChoice(rows: CompareRow[], pace: PaceModel): BestChoice {
  const eligible = rows.filter(
    (r) =>
      r.fullyForecast &&
      (r.daylight === 'daylight' || r.daylight === 'unknown') &&
      (pace.kind === 'power' || r.meanHeadwind !== null),
  );
  if (eligible.length === 0) return { kind: 'none' };
  const score = (r: CompareRow) => (pace.kind === 'power' ? r.durationMs : r.meanHeadwind!);
  const best = eligible.reduce((a, b) => (score(b) < score(a) ? b : a));
  const worst = eligible.reduce((a, b) => (score(b) > score(a) ? b : a));
  const margin = pace.kind === 'power' ? BEST_MARGIN.durationMs : BEST_MARGIN.meanHeadwindKmh;
  return eligible.length > 1 && score(worst) - score(best) < margin ? { kind: 'similar' } : { kind: 'best', row: best };
}

/**
 * How many departures to list before the rest are tucked behind "Show later
 * times": up to and including the last departure where at least one direction
 * finishes in daylight (or daylight is unknown). If none does, all are listed,
 * so a night-time plan still shows its options.
 */
export function daylightCutoff(rows: CompareRow[], departures: number[]): number {
  let last = -1;
  departures.forEach((t, i) => {
    if (rows.some((r) => r.departureMs === t && (r.daylight === 'daylight' || r.daylight === 'unknown'))) last = i;
  });
  return last === -1 ? departures.length : last + 1;
}
