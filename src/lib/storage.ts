import { AppError } from './errors';
import type { Route, TrackPoint } from './geo';
import { DEFAULT_RIDER, validRiderParams, type Exposure, type RiderParams } from './physics';
import { MAX_STOP_MINUTES } from './simulate';
import type { UnitSystem } from './units';
import type { ForecastBundle } from './weather';

export type PaceMode = 'constant' | 'power';

export interface Settings {
  speedKmh: number;
  units: UnitSystem;
  paceMode: PaceMode;
  rider: RiderParams;
  exposure: Exposure;
  /** Planned stop time in minutes, spread along the ride. */
  stopMinutes: number;
}

export const DEFAULT_SETTINGS: Settings = {
  speedKmh: 25,
  units: 'metric',
  paceMode: 'constant',
  rider: { ...DEFAULT_RIDER },
  exposure: 'mixed',
  stopMinutes: 0,
};
const SETTINGS_KEY = 'ridewind:settings:v1';

function validSettings(v: unknown): Settings {
  const o = (v ?? {}) as Partial<Settings>;
  const speed = typeof o.speedKmh === 'number' && o.speedKmh >= 5 && o.speedKmh <= 80 ? o.speedKmh : DEFAULT_SETTINGS.speedKmh;
  const units: UnitSystem = o.units === 'imperial' ? 'imperial' : 'metric';
  const paceMode: PaceMode = o.paceMode === 'power' ? 'power' : 'constant';
  const exposure: Exposure = o.exposure === 'open' || o.exposure === 'sheltered' ? o.exposure : 'mixed';
  const stopMinutes =
    typeof o.stopMinutes === 'number' && o.stopMinutes >= 0 && o.stopMinutes <= MAX_STOP_MINUTES ? o.stopMinutes : DEFAULT_SETTINGS.stopMinutes;
  return { speedKmh: speed, units, paceMode, rider: validRiderParams(o.rider), exposure, stopMinutes };
}

export function loadSettings(storage: Storage | undefined = globalThis.localStorage): Settings {
  try {
    const raw = storage?.getItem(SETTINGS_KEY);
    return validSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return validSettings(null);
  }
}

/** Returns false when storage is unavailable (private mode, blocked site data). */
export function saveSettings(s: Settings, storage: Storage | undefined = globalThis.localStorage): boolean {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(validSettings(s)));
    return !!storage;
  } catch {
    return false;
  }
}

export function clearSettings(storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.removeItem(SETTINGS_KEY);
  } catch {
    /* nothing to clear */
  }
}

/* ---------------- Saved routes (IndexedDB) ---------------- */

/** Compact point tuple: [lat, lon, ele|null]. No timestamps are stored. */
type PackedPoint = [number, number, number | null];

/** How the rider usually rides a saved route, restored when it's opened. */
export interface RoutePrefs {
  /** Ride it from the file's finish back to its start. */
  reversed: boolean;
  /** Usual departure time on the route's local clock, "HH:MM". */
  departTime?: string;
}

export interface SavedRoute {
  id: string;
  name: string;
  savedAt: number;
  source: Route['source'];
  elevationSource?: Route['elevationSource'];
  points: PackedPoint[];
  prefs?: RoutePrefs;
  /** The last forecast fetched for this route, kept so it still opens without a connection. Not exported. */
  forecast?: ForecastBundle;
}

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Keeps only well-formed preferences; anything else is dropped. */
export function validRoutePrefs(v: unknown): RoutePrefs | undefined {
  const o = v as Partial<RoutePrefs> | null | undefined;
  if (!o || typeof o !== 'object') return undefined;
  const reversed = o.reversed === true;
  const departTime = typeof o.departTime === 'string' && HHMM_RE.test(o.departTime) ? o.departTime : undefined;
  if (!reversed && !departTime) return undefined;
  return { reversed, ...(departTime ? { departTime } : {}) };
}

const DB_NAME = 'ridewind';
const STORE = 'routes';

function storageError(): AppError {
  return new AppError('STORAGE_UNAVAILABLE', "This browser isn't allowing RideWind to save data (private browsing or blocked site data).");
}

function openDb(idb: IDBFactory | undefined = globalThis.indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!idb) return reject(storageError());
    let req: IDBOpenDBRequest;
    try {
      req = idb.open(DB_NAME, 1);
    } catch {
      return reject(storageError());
    }
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(storageError());
    req.onblocked = () => reject(storageError());
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>, idb?: IDBFactory): Promise<T> {
  const db = await openDb(idb);
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(storageError());
      tx.onabort = () => reject(storageError());
    });
  } finally {
    db.close();
  }
}

export function packRoute(route: Route, id: string = crypto.randomUUID(), savedAt = Date.now(), prefs?: RoutePrefs): SavedRoute {
  const p = validRoutePrefs(prefs);
  return {
    id,
    name: route.name,
    savedAt,
    source: route.source,
    ...(route.elevationSource ? { elevationSource: route.elevationSource } : {}),
    points: route.points.map((pt) => [pt.lat, pt.lon, pt.ele]),
    ...(p ? { prefs: p } : {}),
  };
}

export function unpackRoute(saved: SavedRoute): Route {
  return {
    name: saved.name,
    source: saved.source,
    ...(saved.elevationSource ? { elevationSource: saved.elevationSource } : {}),
    points: saved.points.map(([lat, lon, ele]): TrackPoint => ({ lat, lon, ele })),
  };
}

export async function listRoutes(idb?: IDBFactory): Promise<SavedRoute[]> {
  const all = await withStore<SavedRoute[]>('readonly', (s) => s.getAll() as IDBRequest<SavedRoute[]>, idb);
  return all.sort((a, b) => b.savedAt - a.savedAt);
}

export async function saveRoute(saved: SavedRoute, idb?: IDBFactory): Promise<void> {
  await withStore('readwrite', (s) => s.put(saved), idb);
}

/** Keeps `forecast` with a saved route. Does nothing if the route is no longer saved. */
export async function saveRouteForecast(id: string, forecast: ForecastBundle, idb?: IDBFactory): Promise<void> {
  const saved = await withStore<SavedRoute | undefined>('readonly', (s) => s.get(id) as IDBRequest<SavedRoute | undefined>, idb);
  if (saved) await saveRoute({ ...saved, forecast }, idb);
}

/** A cached forecast read back from storage, or null if it doesn't have the expected shape. */
export function validCachedForecast(v: unknown): ForecastBundle | null {
  const f = v as Partial<ForecastBundle> | null | undefined;
  if (!f || typeof f !== 'object') return null;
  const ok =
    typeof f.fetchedAt === 'number' &&
    typeof f.timezone === 'string' &&
    typeof f.windowStartMs === 'number' &&
    typeof f.windowEndMs === 'number' &&
    Array.isArray(f.locations) &&
    f.locations.every((l) => typeof l?.key === 'string' && Array.isArray(l.series?.time));
  return ok ? (f as ForecastBundle) : null;
}

export async function deleteRoute(id: string, idb?: IDBFactory): Promise<void> {
  await withStore('readwrite', (s) => s.delete(id), idb);
}

export async function clearRoutes(idb?: IDBFactory): Promise<void> {
  await withStore('readwrite', (s) => s.clear(), idb);
}

/* ---------------- Export / import ---------------- */

export interface ExportFile {
  app: 'ridewind';
  version: 1;
  exportedAt: string;
  settings: Settings;
  routes: SavedRoute[];
}

export function buildExport(settings: Settings, routes: SavedRoute[], now = new Date()): ExportFile {
  // Cached forecasts are large and go stale, so exports carry only the routes themselves.
  const stripped = routes.map(({ forecast: _forecast, ...r }) => r);
  return { app: 'ridewind', version: 1, exportedAt: now.toISOString(), settings, routes: stripped };
}

function validPoint(p: unknown): p is PackedPoint {
  return (
    Array.isArray(p) &&
    p.length === 3 &&
    typeof p[0] === 'number' &&
    Math.abs(p[0]) <= 90 &&
    typeof p[1] === 'number' &&
    Math.abs(p[1]) <= 180 &&
    (p[2] === null || typeof p[2] === 'number')
  );
}

/** Validates an export file. Throws IMPORT_INVALID with a readable message. */
export function parseImport(text: string): ExportFile {
  const fail = (why: string) => new AppError('IMPORT_INVALID', `That file can't be imported: ${why}.`);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw fail('it is not a RideWind export (invalid JSON)');
  }
  const d = data as Partial<ExportFile>;
  if (d?.app !== 'ridewind') throw fail('it is not a RideWind export');
  if (d.version !== 1) throw fail(`export version ${String(d.version)} is not supported`);
  if (!Array.isArray(d.routes)) throw fail('the routes list is missing');
  const routes: SavedRoute[] = d.routes.map((r, i) => {
    if (typeof r?.id !== 'string' || typeof r.name !== 'string' || !Array.isArray(r.points) || r.points.length < 2 || !r.points.every(validPoint)) {
      throw fail(`route ${i + 1} is malformed`);
    }
    const prefs = validRoutePrefs(r.prefs);
    return {
      id: r.id,
      name: r.name.slice(0, 100),
      savedAt: typeof r.savedAt === 'number' ? r.savedAt : Date.now(),
      source: r.source === 'route' ? 'route' : 'track',
      ...(r.elevationSource === 'dem' ? { elevationSource: 'dem' as const } : {}),
      points: r.points,
      ...(prefs ? { prefs } : {}),
    };
  });
  return { app: 'ridewind', version: 1, exportedAt: String(d.exportedAt ?? ''), settings: validSettings(d.settings), routes };
}
