import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildExport,
  clearRoutes,
  deleteRoute,
  listRoutes,
  loadSettings,
  packRoute,
  parseImport,
  saveRoute,
  saveSettings,
  unpackRoute,
} from '../src/lib/storage';

const route = {
  name: 'Test',
  source: 'track' as const,
  points: [
    { lat: 1, lon: 2, ele: 3 },
    { lat: 1.1, lon: 2.1, ele: null },
  ],
};

describe('settings', () => {
  beforeEach(() => localStorage.clear());
  it('round-trips and validates', () => {
    expect(loadSettings()).toEqual({ speedKmh: 25, units: 'metric' });
    expect(saveSettings({ speedKmh: 30, units: 'imperial' })).toBe(true);
    expect(loadSettings()).toEqual({ speedKmh: 30, units: 'imperial' });
    localStorage.setItem('ridewind:settings:v1', '{"speedKmh":-4,"units":"furlongs"}');
    expect(loadSettings()).toEqual({ speedKmh: 25, units: 'metric' });
    localStorage.setItem('ridewind:settings:v1', 'not json');
    expect(loadSettings()).toEqual({ speedKmh: 25, units: 'metric' });
  });
  it('reports failure when storage throws', () => {
    const broken = { setItem: () => { throw new Error('quota'); } } as unknown as Storage;
    expect(saveSettings({ speedKmh: 30, units: 'metric' }, broken)).toBe(false);
  });
});

describe('saved routes (IndexedDB)', () => {
  beforeEach(async () => clearRoutes());
  it('saves, lists, overwrites and deletes', async () => {
    await saveRoute(packRoute(route, 'a', 1));
    await saveRoute(packRoute({ ...route, name: 'Second' }, 'b', 2));
    expect((await listRoutes()).map((r) => r.id)).toEqual(['b', 'a']);
    await saveRoute(packRoute({ ...route, name: 'Renamed' }, 'a', 3));
    expect((await listRoutes())[0]!.name).toBe('Renamed');
    await deleteRoute('a');
    expect((await listRoutes()).map((r) => r.id)).toEqual(['b']);
  });
  it('packing preserves missing elevation and drops nothing else', () => {
    expect(unpackRoute(packRoute(route, 'x', 0))).toEqual(route);
  });
});

describe('export / import', () => {
  it('round-trips an export', () => {
    const file = buildExport({ speedKmh: 28, units: 'metric' }, [packRoute(route, 'a', 5)], new Date('2026-01-01T00:00:00Z'));
    const parsed = parseImport(JSON.stringify(file));
    expect(parsed.routes).toHaveLength(1);
    expect(parsed.settings.speedKmh).toBe(28);
  });
  it.each([
    ['invalid JSON', 'nope'],
    ['another app', '{"app":"other","version":1,"routes":[]}'],
    ['future version', '{"app":"ridewind","version":9,"routes":[]}'],
    ['bad coordinates', '{"app":"ridewind","version":1,"routes":[{"id":"a","name":"x","points":[[100,0,null],[1,1,null]]}]}'],
  ])('rejects %s', (_l, text) => {
    expect(() => parseImport(text)).toThrow(expect.objectContaining({ code: 'IMPORT_INVALID' }));
  });
});
