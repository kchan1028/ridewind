import { AppError } from './errors';
import { weatherAt, type PointWeather } from './forecast-match';
import { bearingAtDistance, elevationAtDistance, hasCompleteElevation, type Sample, type TrackPoint } from './geo';
import { airDensity, clampGradient, solveSpeed, windHeightFactor, type Exposure, type RiderParams } from './physics';
import type { LocationForecast } from './weather';
import { windComponents } from './wind';

/** Planned stop time (coffee, food, lights) in minutes, spread evenly along the ride. Optional. */
export interface StopPlan {
  stopMinutes?: number;
}

export type PaceModel = (
  | { kind: 'constant'; speedKmh: number }
  | { kind: 'power'; rider: RiderParams; exposure: Exposure }
) &
  StopPlan;

/** Longest planned stop time accepted, in minutes. */
export const MAX_STOP_MINUTES = 600;

/** Air temperature assumed when no forecast covers a step (ISA sea-level standard). */
export const FALLBACK_TEMP_C = 15;
export const DEFAULT_STEP_M = 100;
/** Gradient is measured across this window, centred on each step, to smooth elevation noise. */
export const GRADIENT_WINDOW_M = 200;

export interface SimStep {
  startM: number;
  endM: number;
  /** Elapsed time from departure at the start of the step, ms. */
  startMs: number;
  speedKmh: number;
  /** Elevation at the step midpoint, or null when unknown. */
  eleM: number | null;
  /** Gradient (rise/run), or null when elevation is unknown. */
  gradient: number | null;
  bearing: number;
  weather: PointWeather | null;
  /** Forecast 10 m wind along the direction of travel, km/h (negative = tailwind). Calculated. */
  headwind10Kmh: number | null;
}

export interface Simulation {
  steps: SimStep[];
  /** Total time from departure to finish, including planned stops, ms. */
  durationMs: number;
  /** Planned stop time included in durationMs, ms. */
  stopMs: number;
  /** Average moving speed, not counting stops. */
  avgSpeedKmh: number;
  /** True when a power model ran without elevation because the rider explicitly chose to. */
  assumedFlat: boolean;
  /** Steps where no forecast was available (still air and 15 °C were assumed for power). */
  stepsWithoutWeather: number;
  /** Elapsed ms from departure at distance d (linear within steps). */
  elapsedAt(distanceM: number): number;
}

export interface SimulationInput {
  points: TrackPoint[];
  cum: number[];
  samples: Sample[];
  forecasts: Array<LocationForecast | null>;
  departureMs: number;
  pace: PaceModel;
  /** Required to run a power model on a route without complete elevation. */
  assumeFlat?: boolean;
  stepM?: number;
}

function nearestSampleIndex(samples: Sample[], d: number): number {
  let best = 0;
  for (let i = 1; i < samples.length; i++) {
    if (Math.abs(samples[i]!.distanceM - d) < Math.abs(samples[best]!.distanceM - d)) best = i;
  }
  return best;
}

/**
 * Steps along the route (default 100 m), estimating speed for each step and
 * advancing the clock so every step meets the forecast for the time the rider
 * actually reaches it.
 *
 * A power model needs complete elevation. Without it this throws
 * ELEVATION_MISSING unless `assumeFlat` is set, so a missing profile never
 * quietly becomes a flat course.
 */
export function simulateRide(input: SimulationInput): Simulation {
  const { points, cum, samples, forecasts, departureMs, pace } = input;
  const stepM = input.stepM ?? DEFAULT_STEP_M;
  const total = cum[cum.length - 1] ?? 0;
  const complete = hasCompleteElevation(points);

  if (pace.kind === 'power' && !complete && !input.assumeFlat) {
    throw new AppError(
      'ELEVATION_MISSING',
      'Power-based predictions need elevation for the whole route. Look up elevation, or choose to estimate as if the route were flat.',
    );
  }
  if (pace.kind === 'constant' && !(pace.speedKmh > 0)) throw new RangeError('speedKmh must be positive');

  const windFactor = pace.kind === 'power' ? windHeightFactor(pace.exposure) : 1;
  const ele = (d: number) => elevationAtDistance(points, cum, d);
  const stopMinutes = Math.min(MAX_STOP_MINUTES, Math.max(0, pace.stopMinutes ?? 0));
  const stopMs = stopMinutes * 60_000;
  // Stops are spread evenly by distance, so each step carries its share of the stop time.
  const stopMsPerM = total > 0 ? stopMs / total : 0;
  const steps: SimStep[] = [];
  let t = 0;
  let noWeather = 0;

  for (let s = 0; s < total - 1e-6; s += stepM) {
    const e = Math.min(total, s + stepM);
    const len = e - s;
    const mid = (s + e) / 2;
    const bearing = bearingAtDistance(points, cum, mid, Math.max(len / 2, 50));
    const f = forecasts[nearestSampleIndex(samples, mid)];
    const weather = f ? weatherAt(f.series, departureMs + t) : null;
    const hasWind = !!weather && weather.windSpeed !== null && weather.windDirection !== null;
    const headwind10Kmh = hasWind ? windComponents(weather.windSpeed!, weather.windDirection!, bearing).headwind : null;
    if (!hasWind) noWeather++;

    let eleM: number | null = null;
    let gradient: number | null = null;
    if (complete) {
      eleM = ele(mid);
      const a = Math.max(0, mid - GRADIENT_WINDOW_M / 2);
      const b = Math.min(total, mid + GRADIENT_WINDOW_M / 2);
      gradient = b > a ? clampGradient((ele(b) - ele(a)) / (b - a)) : 0;
    }

    let v: number;
    if (pace.kind === 'constant') v = pace.speedKmh / 3.6;
    else {
      const temp = weather?.temperature ?? FALLBACK_TEMP_C;
      v = solveSpeed(
        { gradient: gradient ?? 0, headwindMs: ((headwind10Kmh ?? 0) / 3.6) * windFactor, rho: airDensity(temp, eleM ?? 0) },
        pace.rider,
      );
    }

    steps.push({ startM: s, endM: e, startMs: t, speedKmh: v * 3.6, eleM, gradient, bearing, weather, headwind10Kmh });
    t += (len / v) * 1000 + len * stopMsPerM;
  }

  const durationMs = t;
  const elapsedAt = (d: number): number => {
    if (steps.length === 0 || d <= 0) return 0;
    if (d >= total) return durationMs;
    let lo = 0;
    let hi = steps.length - 1;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (steps[m]!.startM <= d) lo = m;
      else hi = m - 1;
    }
    const st = steps[lo]!;
    const next = lo + 1 < steps.length ? steps[lo + 1]!.startMs : durationMs;
    return st.startMs + ((d - st.startM) / (st.endM - st.startM)) * (next - st.startMs);
  };

  return {
    steps,
    durationMs,
    stopMs,
    avgSpeedKmh: durationMs - stopMs > 0 ? total / 1000 / ((durationMs - stopMs) / 3600_000) : 0,
    assumedFlat: pace.kind === 'power' && !complete,
    stepsWithoutWeather: noWeather,
    elapsedAt,
  };
}
