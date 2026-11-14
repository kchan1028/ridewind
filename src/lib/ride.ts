import { bearingAtDistance, chunkRoute, type LatLon, type Sample } from './geo';
import { weatherAt, type PointWeather } from './forecast-match';
import type { LocationForecast } from './weather';
import { classifyWind, windComponents, type WindClass, type WindComponents } from './wind';

export interface SampleResult {
  sample: Sample;
  etaMs: number;
  bearing: number;
  /** Forecast data (null when the arrival time is outside the forecast window or data is missing). */
  weather: PointWeather | null;
  /** Calculated from forecast wind and route bearing. */
  components: WindComponents | null;
  windClass: WindClass | null;
}

export type SegmentClass = WindClass | 'unknown';

export interface SegmentResult {
  latlngs: Array<[number, number]>;
  windClass: SegmentClass;
  /** Forecast rain strength when the rider reaches this section. */
  rain: RainLevel;
}

/** Hourly precipitation (mm) at or above which a section counts as wet; matches the "Dry" cutoff used in the summary. */
export const RAIN_MM_PER_H = 0.05;

export type RainLevel = 'none' | 'light' | 'moderate' | 'heavy';

/** Standard hourly rain-rate bands: light under 2.5 mm/h, moderate under 7.6 mm/h, heavy above. */
export function rainLevel(mmPerH: number | null | undefined): RainLevel {
  const mm = mmPerH ?? 0;
  if (mm < RAIN_MM_PER_H) return 'none';
  if (mm < 2.5) return 'light';
  if (mm < 7.6) return 'moderate';
  return 'heavy';
}

export interface RideSummary {
  /** Metres of route in each class. */
  distanceByClass: Record<SegmentClass, number>;
  windSpeedMin: number | null;
  windSpeedMax: number | null;
  gustMax: number | null;
  tempMin: number | null;
  tempMax: number | null;
  precipMax: number | null;
  precipProbabilityMax: number | null;
  /** Distance-weighted mean headwind component (km/h, negative = net tailwind). */
  meanHeadwind: number | null;
  /** Samples whose arrival time fell outside the forecast window. */
  samplesWithoutForecast: number;
}

export interface RidePlan {
  durationMs: number;
  finishMs: number;
  samples: SampleResult[];
  segments: SegmentResult[];
  summary: RideSummary;
}

export interface PlanInput {
  points: LatLon[];
  cum: number[];
  samples: Sample[];
  /** Forecast for each sample (same order), or null where unavailable. */
  forecasts: Array<LocationForecast | null>;
  departureMs: number;
  /** Constant average speed. Ignored when `elapsedAt` is given. */
  speedKmh?: number;
  /** Elapsed ms from departure at a distance, for example from simulateRide(). */
  elapsedAt?: (distanceM: number) => number;
}

/** Arrival time at a distance along the route under a constant average speed. */
export function etaAt(departureMs: number, distanceM: number, speedKmh: number): number {
  return departureMs + (distanceM / 1000 / speedKmh) * 3600_000;
}

function nearestSampleIndex(samples: Sample[], d: number): number {
  let best = 0;
  for (let i = 1; i < samples.length; i++) {
    if (Math.abs(samples[i]!.distanceM - d) < Math.abs(samples[best]!.distanceM - d)) best = i;
  }
  return best;
}

const minMax = (vals: Array<number | null>) => {
  const v = vals.filter((x): x is number => x !== null);
  return v.length ? { min: Math.min(...v), max: Math.max(...v) } : { min: null, max: null };
};

/** Combines route geometry, forecasts and a pace (constant speed or simulated timing) into per-point and per-section estimates. */
export function planRide(input: PlanInput): RidePlan {
  const { points, cum, samples, forecasts, departureMs, speedKmh } = input;
  let elapsed = input.elapsedAt;
  if (!elapsed) {
    if (!(speedKmh !== undefined && speedKmh > 0)) throw new RangeError('speedKmh must be positive');
    elapsed = (d: number) => etaAt(0, d, speedKmh);
  }
  const totalM = cum[cum.length - 1] ?? 0;
  const durationMs = elapsed(totalM);

  const sampleResults: SampleResult[] = samples.map((sample, i) => {
    const etaMs = departureMs + elapsed(sample.distanceM);
    const bearing = bearingAtDistance(points, cum, sample.distanceM);
    const f = forecasts[i];
    const weather = f ? weatherAt(f.series, etaMs) : null;
    const hasWind = weather && weather.windSpeed !== null && weather.windDirection !== null;
    return {
      sample,
      etaMs,
      bearing,
      weather,
      components: hasWind ? windComponents(weather.windSpeed!, weather.windDirection!, bearing) : null,
      windClass: hasWind ? classifyWind(weather.windSpeed!, weather.windDirection!, bearing) : null,
    };
  });

  const distanceByClass: Record<SegmentClass, number> = { headwind: 0, tailwind: 0, crosswind: 0, calm: 0, unknown: 0 };
  const segments: SegmentResult[] = [];
  let headwindWeighted = 0;
  let weightedM = 0;

  for (const chunk of chunkRoute(points, cum)) {
    const lengthM = cum[chunk.endIndex]! - cum[chunk.startIndex]!;
    const f = forecasts[nearestSampleIndex(samples, chunk.midDistanceM)];
    const w = f ? weatherAt(f.series, departureMs + elapsed(chunk.midDistanceM)) : null;
    let cls: SegmentClass = 'unknown';
    if (w && w.windSpeed !== null && w.windDirection !== null) {
      cls = classifyWind(w.windSpeed, w.windDirection, chunk.bearing);
      headwindWeighted += windComponents(w.windSpeed, w.windDirection, chunk.bearing).headwind * lengthM;
      weightedM += lengthM;
    }
    distanceByClass[cls] += lengthM;
    const rain = rainLevel(w?.precipitation);

    const latlngs = points.slice(chunk.startIndex, chunk.endIndex + 1).map((p) => [p.lat, p.lon] as [number, number]);
    const prev = segments[segments.length - 1];
    if (prev && prev.windClass === cls && prev.rain === rain) prev.latlngs.push(...latlngs.slice(1));
    else segments.push({ latlngs, windClass: cls, rain });
  }

  const ws = sampleResults.map((s) => s.weather);
  const wind = minMax(ws.map((w) => w?.windSpeed ?? null));
  const temp = minMax(ws.map((w) => w?.temperature ?? null));

  return {
    durationMs,
    finishMs: departureMs + durationMs,
    samples: sampleResults,
    segments,
    summary: {
      distanceByClass,
      windSpeedMin: wind.min,
      windSpeedMax: wind.max,
      gustMax: minMax(ws.map((w) => w?.windGusts ?? null)).max,
      tempMin: temp.min,
      tempMax: temp.max,
      precipMax: minMax(ws.map((w) => w?.precipitation ?? null)).max,
      precipProbabilityMax: minMax(ws.map((w) => w?.precipitationProbability ?? null)).max,
      meanHeadwind: weightedM > 0 ? headwindWeighted / weightedM : null,
      samplesWithoutForecast: sampleResults.filter((s) => s.weather === null).length,
    },
  };
}
