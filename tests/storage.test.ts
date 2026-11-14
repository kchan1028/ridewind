import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildExport,
  clearRoutes,
  DEFAULT_SETTINGS,
  deleteRoute,
  listRoutes,
  loadSettings,
  packRoute,
  parseImport,
  saveRoute,
  saveSettings,
  unpackRoute,
  validRoutePrefs,
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
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    const custom = { ...DEFAULT_SETTINGS, speedKmh: 30, units: 'imperial' as const, paceMode: 'power' as const, exposure: 'open' as const, rider: { ...DEFAULT_SETTINGS.rider, powerW: 240 } };
    expect(saveSettings(custom)).toBe(true);
    expect(loadSettings()).toEqual(custom);
    localStorage.setItem('ridewind:settings:v1', '{"speedKmh":-4,"units":"furlongs","paceMode":"warp","rider":{"cda":9}}');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem('ridewind:settings:v1', 'not json');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
  it('keeps valid planned stops and rejects out-of-range ones', () => {
    expect(saveSettings({ ...DEFAULT_SETTINGS, stopMinutes: 45 })).toBe(true);
    expect(loadSettings().stopMinutes).toBe(45);
    localStorage.setItem('ridewind:settings:v1', '{"stopMinutes":-5}');
    expect(loadSettings().stopMinutes).toBe(0);
    localStorage.setItem('ridewind:settings:v1', '{"stopMinutes":9999}');
    expect(loadSettings().stopMinutes).toBe(0);
  });
  it('reads phase-1 settings (speed and units only) with phase-2 defaults', () => {
    localStorage.setItem('ridewind:settings:v1', '{"speedKmh":28,"units":"metric"}');
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, speedKmh: 28 });
  });
  it('reports failure when storage throws', () => {
    const broken = { setItem: () => { throw new Error('quota'); } } as unknown as Storage;
    expect(saveSettings(DEFAULT_SETTINGS, broken)).toBe(false);
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
  it('packing keeps a looked-up elevation source', () => {
    const dem = { ...route, elevationSource: 'dem' as const };
    expect(unpackRoute(packRoute(dem, 'x', 0))).toEqual(dem);
  });
});

describe('export / import', () => {
  it('round-trips an export', () => {
    const file = buildExport({ ...DEFAULT_SETTINGS, speedKmh: 28 }, [packRoute(route, 'a', 5)], new Date('2026-01-01T00:00:00Z'));
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

describe('route preferences', () => {
  const pts: Array<{ lat: number; lon: number; ele: number | null }> = [
    { lat: 37.8, lon: -122.3, ele: 10 },
    { lat: 37.9, lon: -122.2, ele: 20 },
  ];
  const r = { name: 'Loop', source: 'track' as const, points: pts };

  it('keeps direction and usual time when packing', () => {
    expect(packRoute(r, 'x', 1, { reversed: true, departTime: '08:00' }).prefs).toEqual({ reversed: true, departTime: '08:00' });
  });

  it('stores nothing when there is nothing to remember', () => {
    expect(packRoute(r, 'x', 1, { reversed: false }).prefs).toBeUndefined();
    expect(packRoute(r, 'x', 1).prefs).toBeUndefined();
  });

  it('drops malformed values', () => {
    expect(validRoutePrefs({ reversed: 'yes', departTime: '25:00' })).toBeUndefined();
    expect(validRoutePrefs({ reversed: true, departTime: '8am' })).toEqual({ reversed: true });
    expect(validRoutePrefs(null)).toBeUndefined();
  });

  it('round-trips through export and import', () => {
    const saved = packRoute(r, 'x', 1, { reversed: true, departTime: '07:30' });
    const back = parseImport(JSON.stringify(buildExport(DEFAULT_SETTINGS, [saved])));
    expect(back.routes[0]!.prefs).toEqual({ reversed: true, departTime: '07:30' });
  });
});
