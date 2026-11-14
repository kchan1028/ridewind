import { AppError } from './errors';
import type { Route, TrackPoint } from './geo';
import { DEFAULT_RIDER, validRiderParams, type Exposure, type RiderParams } from './physics';
import type { UnitSystem } from './units';

export type PaceMode = 'constant' | 'power';

export interface Settings {
  speedKmh: number;
  units: UnitSystem;
  paceMode: PaceMode;
  rider: RiderParams;
  exposure: Exposure;
}

export const DEFAULT_SETTINGS: Settings = {
  speedKmh: 25,
  units: 'metric',
  paceMode: 'constant',
  rider: { ...DEFAULT_RIDER },
  exposure: 'mixed',
};
const SETTINGS_KEY = 'ridewind:settings:v1';

function validSettings(v: unknown): Settings {
  const o = (v ?? {}) as Partial<Settings>;
  const speed = typeof o.speedKmh === 'number' && o.speedKmh >= 5 && o.speedKmh <= 80 ? o.speedKmh : DEFAULT_SETTINGS.speedKmh;
  const units: UnitSystem = o.units === 'imperial' ? 'imperial' : 'metric';
  const paceMode: PaceMode = o.paceMode === 'power' ? 'power' : 'constant';
  const exposure: Exposure = o.exposure === 'open' || o.exposure === 'sheltered' ? o.exposure : 'mixed';
  return { speedKmh: speed, units, paceMode, rider: validRiderParams(o.rider), exposure };
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

export interface SavedRoute {
  id: string;
  name: string;
  savedAt: number;
  source: Route['source'];
  elevationSource?: Route['elevationSource'];
  points: PackedPoint[];
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

export function packRoute(route: Route, id: string = crypto.randomUUID(), savedAt = Date.now()): SavedRoute {
  return {
    id,
    name: route.name,
    savedAt,
    source: route.source,
    ...(route.elevationSource ? { elevationSource: route.elevationSource } : {}),
    points: route.points.map((p) => [p.lat, p.lon, p.ele]),
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
  return { app: 'ridewind', version: 1, exportedAt: now.toISOString(), settings, routes };
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
    return {
      id: r.id,
      name: r.name.slice(0, 100),
      savedAt: typeof r.savedAt === 'number' ? r.savedAt : Date.now(),
      source: r.source === 'route' ? 'route' : 'track',
      ...(r.elevationSource === 'dem' ? { elevationSource: 'dem' as const } : {}),
      points: r.points,
    };
  });
  return { app: 'ridewind', version: 1, exportedAt: String(d.exportedAt ?? ''), settings: validSettings(d.settings), routes };
}
