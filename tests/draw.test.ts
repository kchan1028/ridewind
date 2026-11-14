import { describe, expect, it } from 'vitest';
import {
  DRAWN_ROUTE_NAME,
  MAX_DRAWN_POINTS,
  addDrawnPoint,
  buildDrawnRoute,
  densify,
  drawnDistanceM,
  gpxFileName,
  routeToGpx,
  undoDrawnPoint,
} from '../src/lib/draw';
import { AppError } from '../src/lib/errors';
import { haversineM, type LatLon } from '../src/lib/geo';
import { parseGpx } from '../src/lib/gpx';
import { packRoute, parseImport, unpackRoute } from '../src/lib/storage';

const A = { lat: 37.8716, lon: -122.2727 };
const B = { lat: 37.8716, lon: -122.2614 }; // ~1 km east of A
const C = { lat: 37.8806, lon: -122.2614 }; // ~1 km north of B

describe('drawing a route', () => {
  it('adds points in order, rounded to 6 decimals', () => {
    const one = addDrawnPoint([], { lat: 37.12345678, lon: -122.98765432 })!;
    expect(one).toEqual([{ lat: 37.123457, lon: -122.987654 }]);
    const two = addDrawnPoint(one, B)!;
    expect(two).toHaveLength(2);
    expect(one).toHaveLength(1); // not mutated
  });

  it('ignores a tap on top of the last point, invalid coordinates and a full draft', () => {
    expect(addDrawnPoint([A], { lat: A.lat + 0.000001, lon: A.lon })).toBeNull();
    expect(addDrawnPoint([], { lat: 91, lon: 0 })).toBeNull();
    expect(addDrawnPoint([], { lat: Number.NaN, lon: 0 })).toBeNull();
    const full: LatLon[] = Array.from({ length: MAX_DRAWN_POINTS }, (_, i) => ({ lat: 37 + i * 0.001, lon: -122 }));
    expect(addDrawnPoint(full, B)).toBeNull();
  });

  it('undoes the last point and measures the straight-line distance', () => {
    const pts = [A, B, C];
    expect(undoDrawnPoint(pts)).toEqual([A, B]);
    expect(undoDrawnPoint([])).toEqual([]);
    expect(drawnDistanceM([A])).toBe(0);
    expect(drawnDistanceM(pts)).toBeCloseTo(haversineM(A, B) + haversineM(B, C), 6);
  });
});

describe('densify', () => {
  it('fills each leg so no gap exceeds the spacing, keeping every corner', () => {
    const out = densify([A, B, C], 100);
    for (let i = 1; i < out.length; i++) expect(haversineM(out[i - 1]!, out[i]!)).toBeLessThanOrEqual(100.5);
    expect(out[0]).toEqual(A);
    expect(out[out.length - 1]).toEqual(C);
    expect(out).toContainEqual(B);
  });

  it('widens the spacing rather than exceed the point cap', () => {
    const far = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 10 },
    ];
    expect(densify(far, 100, 500).length).toBeLessThanOrEqual(500);
  });
});

describe('buildDrawnRoute', () => {
  it('builds a drawn route with no elevation and the given name', () => {
    const r = buildDrawnRoute([A, B], '  Hill loop  ');
    expect(r.name).toBe('Hill loop');
    expect(r.source).toBe('drawn');
    expect(r.elevationSource).toBeUndefined();
    expect(r.points.length).toBeGreaterThan(2);
    expect(r.points.every((p) => p.ele === null)).toBe(true);
  });

  it('falls back to a default name and caps long names', () => {
    expect(buildDrawnRoute([A, B], '   ').name).toBe(DRAWN_ROUTE_NAME);
    expect(buildDrawnRoute([A, B], 'x'.repeat(200)).name).toHaveLength(100);
  });

  it('needs at least two points', () => {
    expect(() => buildDrawnRoute([A], 'x')).toThrow(AppError);
  });

  it('survives saving, export and import as a drawn route', () => {
    const r = buildDrawnRoute([A, B, C], 'Loop');
    const saved = packRoute(r, 'id1', 1);
    expect(unpackRoute(saved).source).toBe('drawn');
    const file = JSON.stringify({ app: 'ridewind', version: 1, exportedAt: '', settings: {}, routes: [saved] });
    expect(parseImport(file).routes[0]!.source).toBe('drawn');
  });
});

describe('GPX export', () => {
  it('round-trips through the GPX parser with an escaped name', () => {
    const r = buildDrawnRoute([A, B, C], 'Tom & Jerry <loop>');
    const back = parseGpx(routeToGpx(r));
    expect(back.name).toBe('Tom & Jerry <loop>');
    expect(back.points).toEqual(r.points);
  });

  it('writes elevation when the route has it', () => {
    const r = { ...buildDrawnRoute([A, B], 'x'), elevationSource: 'dem' as const };
    r.points = r.points.map((p, i) => ({ ...p, ele: 10 + i }));
    expect(parseGpx(routeToGpx(r)).points[1]!.ele).toBe(11);
  });

  it('makes a safe file name', () => {
    expect(gpxFileName('Tom & Jerry / loop')).toBe('Tom-Jerry-loop.gpx');
    expect(gpxFileName('***')).toBe('route.gpx');
  });
});
