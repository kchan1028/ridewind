import type { Sample, TrackPoint } from './geo';
import { planRide } from './ride';
import { simulateRide, type PaceModel } from './simulate';
import type { LocationForecast } from './weather';

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
  /** True when every sampled point had a forecast at its arrival time. */
  fullyForecast: boolean;
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
        fullyForecast: plan.summary.samplesWithoutForecast === 0,
      });
    }
  }
  return rows;
}

/**
 * The most favourable fully forecast option: shortest predicted time for a
 * power model; for a constant-speed model (where every time is equal) the
 * lowest mean headwind.
 */
export function bestRow(rows: CompareRow[], pace: PaceModel): CompareRow | null {
  const eligible = rows.filter((r) => r.fullyForecast && (pace.kind === 'power' || r.meanHeadwind !== null));
  if (eligible.length === 0) return null;
  const score = (r: CompareRow) => (pace.kind === 'power' ? r.durationMs : r.meanHeadwind!);
  return eligible.reduce((a, b) => (score(b) < score(a) ? b : a));
}
