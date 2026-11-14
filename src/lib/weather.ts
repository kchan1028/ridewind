import { AppError } from './errors';
import type { LatLon } from './geo';

export const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
/** Open-Meteo serves up to 16 forecast days; one location costs one call regardless of length. */
export const FORECAST_DAYS = 16;
export const HOURLY_VARIABLES = [
  'temperature_2m',
  'precipitation',
  'precipitation_probability',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
] as const;

type Num = number | null;

export interface HourlySeries {
  /** Hour timestamps, Unix seconds (UTC). */
  time: number[];
  temperature: Num[];
  /** Sum over the preceding hour, mm. */
  precipitation: Num[];
  /** Probability over the preceding hour, %. */
  precipitationProbability: Num[];
  /** km/h at 10 m. */
  windSpeed: Num[];
  /** Degrees the wind blows FROM. */
  windDirection: Num[];
  /** Max gust over the preceding hour, km/h. */
  windGusts: Num[];
}

export interface LocationForecast {
  /** Key of the requested (rounded) coordinate, used to re-match after reversing a route. */
  key: string;
  gridLat: number;
  gridLon: number;
  series: HourlySeries;
}

export interface ForecastBundle {
  /** When this browser received the data (ms). */
  fetchedAt: number;
  timezone: string;
  timezoneAbbreviation: string;
  locations: LocationForecast[];
  /** First and last forecast hour (ms, UTC). */
  windowStartMs: number;
  windowEndMs: number;
}

/** Rounded to ~100 m: enough for a weather grid, and avoids sending precise positions. */
export function coordKey(p: LatLon): string {
  return `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
}

export function buildForecastUrl(coords: LatLon[], forecastDays = FORECAST_DAYS): string {
  const params = new URLSearchParams({
    latitude: coords.map((c) => c.lat.toFixed(3)).join(','),
    longitude: coords.map((c) => c.lon.toFixed(3)).join(','),
    hourly: HOURLY_VARIABLES.join(','),
    wind_speed_unit: 'kmh',
    timezone: 'auto',
    timeformat: 'unixtime',
    forecast_days: String(forecastDays),
  });
  return `${OPEN_METEO_FORECAST_URL}?${params.toString()}`;
}

function numArray(v: unknown, len: number): Num[] | null {
  if (!Array.isArray(v) || v.length !== len) return null;
  return v.map((x) => (typeof x === 'number' && Number.isFinite(x) ? x : null));
}

function bad(detail: string): AppError {
  return new AppError('WEATHER_BAD_RESPONSE', 'The forecast service sent data RideWind could not read. Try again shortly.', { detail });
}

/** Validates and normalises an Open-Meteo JSON response (object for one location, array for several). */
export function parseForecastResponse(json: unknown, requested: LatLon[], fetchedAt: number): ForecastBundle {
  const list = Array.isArray(json) ? json : [json];
  if (list.length !== requested.length) throw bad(`expected ${requested.length} locations, got ${list.length}`);

  const locations: LocationForecast[] = list.map((raw, i) => {
    const r = raw as Record<string, unknown> | null;
    const hourly = r?.hourly as Record<string, unknown> | undefined;
    const time = hourly?.time;
    if (!Array.isArray(time) || time.length === 0 || !time.every((t) => typeof t === 'number')) {
      throw bad(`location ${i}: missing hourly.time`);
    }
    const len = time.length;
    const get = (name: string) => {
      const a = numArray(hourly?.[name], len);
      if (!a) throw bad(`location ${i}: missing ${name}`);
      return a;
    };
    return {
      key: coordKey(requested[i]!),
      gridLat: typeof r?.latitude === 'number' ? r.latitude : requested[i]!.lat,
      gridLon: typeof r?.longitude === 'number' ? r.longitude : requested[i]!.lon,
      series: {
        time: time as number[],
        temperature: get('temperature_2m'),
        precipitation: get('precipitation'),
        precipitationProbability: get('precipitation_probability'),
        windSpeed: get('wind_speed_10m'),
        windDirection: get('wind_direction_10m'),
        windGusts: get('wind_gusts_10m'),
      },
    };
  });

  const first = list[0] as Record<string, unknown>;
  const times = locations[0]!.series.time;
  return {
    fetchedAt,
    timezone: typeof first.timezone === 'string' ? first.timezone : 'UTC',
    timezoneAbbreviation: typeof first.timezone_abbreviation === 'string' ? first.timezone_abbreviation : '',
    locations,
    windowStartMs: times[0]! * 1000,
    windowEndMs: times[times.length - 1]! * 1000,
  };
}

function parseRetryAfter(h: string | null): number | undefined {
  if (!h) return undefined;
  const s = Number(h);
  if (Number.isFinite(s) && s >= 0) return Math.ceil(s);
  const d = Date.parse(h);
  return Number.isFinite(d) ? Math.max(0, Math.ceil((d - Date.now()) / 1000)) : undefined;
}

function rateLimited(retryAfterSeconds?: number, reason?: string): AppError {
  const wait = retryAfterSeconds ? ` Try again in about ${Math.max(1, Math.ceil(retryAfterSeconds / 60))} min.` : ' Try again later.';
  return new AppError(
    'WEATHER_RATE_LIMITED',
    `Open-Meteo's free usage limit has been reached for now.${wait} Your route is still loaded.`,
    { retryAfterSeconds, detail: reason },
  );
}

export interface FetchForecastOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  forecastDays?: number;
  now?: () => number;
}

/** One request for every sample location. Throws AppError with a rider-facing message on failure. */
export async function fetchForecast(coords: LatLon[], opts: FetchForecastOptions = {}): Promise<ForecastBundle> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = buildForecastUrl(coords, opts.forecastDays);
  let res: Response;
  try {
    res = await fetchImpl(url, { signal: opts.signal, headers: { Accept: 'application/json' } });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new AppError('WEATHER_NETWORK', "Couldn't reach the forecast service. Check your connection and retry. Your route is still loaded.");
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const reason = typeof (body as { reason?: unknown })?.reason === 'string' ? (body as { reason: string }).reason : undefined;

  if (res.status === 429 || (reason && /limit exceeded|too many requests/i.test(reason))) {
    throw rateLimited(parseRetryAfter(res.headers.get('retry-after')), reason);
  }
  if (res.status >= 500) {
    throw new AppError('WEATHER_UNAVAILABLE', 'The forecast service is temporarily unavailable. Try again in a few minutes. Your route is still loaded.', {
      detail: `HTTP ${res.status}`,
    });
  }
  if (!res.ok || (body as { error?: unknown })?.error === true) {
    throw new AppError('WEATHER_REJECTED', 'The forecast service could not provide data for this route.', {
      detail: reason ?? `HTTP ${res.status}`,
    });
  }
  if (body === null) throw bad('response was not JSON');
  return parseForecastResponse(body, coords, (opts.now ?? Date.now)());
}
