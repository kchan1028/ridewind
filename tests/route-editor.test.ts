import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/lib/errors';
import { haversineM, reverseRoute, type LatLon, type TrackPoint } from '../src/lib/geo';
import { parseGpx } from '../src/lib/gpx';
import { routeToGpx } from '../src/lib/draw';
import {
  EMPTY_ROUTE,
  RouteSession,
  addPoint,
  closeLoop,
  editorStats,
  editorToRoute,
  fillLegs,
  insertPoint,
  legMidpoint,
  isComplete,
  isLoop,
  joinLegs,
  legKey,
  movePoint,
  pendingRuns,
  removePoint,
  reverseEditorRoute,
  type EditorRoute,
  type SessionView,
} from '../src/lib/route-editor';
import { packRoute, parseImport, unpackRoute } from '../src/lib/storage';

const A = { lat: 37.8716, lon: -122.2727 };
const B = { lat: 37.8716, lon: -122.2614 };
const C = { lat: 37.8806, lon: -122.2614 };
const D = { lat: 37.8806, lon: -122.2727 };

/** A fake "road" through an offset midpoint, so it's clearly not the straight line. */
function road(a: LatLon, b: LatLon, ele = 10): TrackPoint[] {
  const mid = { lat: (a.lat + b.lat) / 2 + 0.002, lon: (a.lon + b.lon) / 2 };
  return [
    { ...a, ele },
    { ...mid, ele: ele + 20 },
    { ...b, ele },
  ];
}

const build = (...pts: LatLon[]): EditorRoute => pts.reduce<EditorRoute>((r, p) => addPoint(r, p, 'routed')!, EMPTY_ROUTE);

describe('editing operations', () => {
  it('adds points with a pending routed leg between each pair', () => {
    const r = build(A, B, C);
    expect(r.controls).toHaveLength(3);
    expect(r.legs).toHaveLength(2);
    expect(r.legs.every((l) => l.mode === 'routed' && l.points === null)).toBe(true);
    expect(addPoint(r, { lat: C.lat + 1e-7, lon: C.lon }, 'routed')).toBeNull(); // double tap
    expect(addPoint(r, { lat: 99, lon: 0 }, 'routed')).toBeNull();
  });

  it('draws straight legs at once, with no elevation', () => {
    const r = fillLegs(addPoint(build(A), B, 'manual')!, new Map());
    expect(isComplete(r)).toBe(true);
    expect(r.legs[0]!.points!.every((p) => p.ele === null)).toBe(true);
    expect(r.legs[0]!.points!.length).toBeGreaterThan(2);
  });

  it('moving a point re-routes only the legs either side', () => {
    const cache = new Map([
      [legKey(A, B, 'routed'), road(A, B)],
      [legKey(B, C, 'routed'), road(B, C)],
      [legKey(C, D, 'routed'), road(C, D)],
    ]);
    const r = fillLegs(build(A, B, C, D), cache);
    expect(isComplete(r)).toBe(true);
    const moved = movePoint(r, 1, { lat: 37.873, lon: -122.262 })!;
    expect(moved.legs.map((l) => l.points === null)).toEqual([true, true, false]);
    expect(moved.legs[2]).toBe(r.legs[2]); // untouched leg kept as is
  });

  it('removing a middle point joins its neighbours; removing an end drops a leg', () => {
    const r = addPoint(build(A, B), C, 'manual')!;
    const mid = removePoint(r, 1)!;
    expect(mid.controls).toEqual([A, C]);
    expect(mid.legs).toEqual([{ mode: 'manual', points: null }]); // straight if either side was straight
    expect(removePoint(build(A, B, C), 1)!.legs[0]!.mode).toBe('routed');
    expect(removePoint(r, 0)!.legs).toHaveLength(1);
    expect(removePoint(r, 2)!.controls).toEqual([A, B]);
    expect(removePoint(build(A, B), 0)).toEqual({ controls: [B], legs: [] });
  });

  it('inserting a point in a section splits it into two legs in the same mode', () => {
    const cache = new Map([
      [legKey(A, B, 'routed'), road(A, B)],
      [legKey(B, C, 'routed'), road(B, C)],
    ]);
    const r = fillLegs(addPoint(build(A, B, C), D, 'manual')!, cache);
    const M = { lat: 37.874, lon: -122.267 };
    const ins = insertPoint(r, 0, M)!;
    expect(ins.controls).toEqual([A, M, B, C, D]);
    expect(ins.legs.map((l) => [l.mode, l.points === null])).toEqual([
      ['routed', true],
      ['routed', true],
      ['routed', false],
      ['manual', false],
    ]);
    expect(ins.legs[2]).toBe(r.legs[1]); // other legs untouched
    expect(insertPoint(r, 2, { lat: 37.88, lon: -122.268 })!.legs.slice(2, 4).map((l) => l.mode)).toEqual(['manual', 'manual']);
    expect(insertPoint(r, 0, A)).toBeNull(); // on top of an end
    expect(insertPoint(r, 9, M)).toBeNull();
  });

  it('finds the middle of a section along its geometry', () => {
    const cache = new Map([[legKey(A, B, 'routed'), road(A, B)]]);
    const r = fillLegs(build(A, B), cache);
    const mid = legMidpoint(r, 0)!;
    expect(mid.lat).toBeCloseTo(road(A, B)[1]!.lat, 3); // the offset road, not the straight line
    expect(legMidpoint(build(A, B), 0)!.lon).toBeCloseTo((A.lon + B.lon) / 2, 6); // straight while pending
    expect(legMidpoint(r, 3)).toBeNull();
  });

  it('reversing keeps exactly the same roads, backwards', () => {
    const cache = new Map([
      [legKey(A, B, 'routed'), road(A, B)],
      [legKey(B, C, 'routed'), road(B, C)],
    ]);
    const r = fillLegs(build(A, B, C), cache);
    const rev = reverseEditorRoute(r);
    expect(rev.controls).toEqual([C, B, A]);
    expect(joinLegs(rev).points).toEqual(joinLegs(r).points.slice().reverse());
    expect(isComplete(rev)).toBe(true); // nothing to route again
  });

  it('closes a loop once', () => {
    const loop = closeLoop(build(A, B, C), 'routed')!;
    expect(loop.controls[3]).toEqual(A);
    expect(isLoop(loop)).toBe(true);
    expect(closeLoop(loop, 'routed')).toBeNull();
    expect(closeLoop(build(A), 'routed')).toBeNull();
  });

  it('splits long pending runs into requests of a limited size', () => {
    const pts = Array.from({ length: 30 }, (_, i) => ({ lat: 37 + i * 0.01, lon: -122 }));
    const runs = pendingRuns(build(...pts), 12);
    expect(runs.map((r) => r.locations.length)).toEqual([12, 12, 8]);
    expect(runs[1]!.locations[0]).toEqual(runs[0]!.locations[11]);
    expect(runs.flatMap((r) => r.keys)).toHaveLength(29);
  });
});

describe('finished route', () => {
  it('joins legs, records straight sections and uses routed elevation', () => {
    const cache = new Map([[legKey(A, B, 'routed'), road(A, B)]]);
    const r = fillLegs(addPoint(build(A, B), C, 'manual')!, cache);
    const route = editorToRoute(r, '  Course  ');
    expect(route.name).toBe('Course');
    expect(route.source).toBe('drawn');
    expect(route.elevationSource).toBe('routing');
    expect(route.points[1]).toEqual(road(A, B)[1]); // the road geometry, not a straight line
    expect(route.manualRanges).toEqual([{ start: 2, end: route.points.length - 1 }]);
    const stats = editorStats(r);
    expect(stats.manualSections).toBe(1);
    expect(stats.routedM).toBeGreaterThan(haversineM(A, B));
    expect(stats.totalM).toBeCloseTo(stats.routedM + stats.manualM, 6);
  });

  it('refuses to finish with fewer than two points or legs still routing', () => {
    expect(() => editorToRoute(build(A), 'x')).toThrow(AppError);
    expect(() => editorToRoute(build(A, B), 'x')).toThrow(AppError);
  });

  it('keeps straight sections through reversing, saving, export, import and GPX', () => {
    const cache = new Map([[legKey(A, B, 'routed'), road(A, B)]]);
    const route = editorToRoute(fillLegs(addPoint(build(A, B), C, 'manual')!, cache), 'Course');
    const last = route.points.length - 1;
    expect(reverseRoute(route).manualRanges).toEqual([{ start: 0, end: last - 2 }]);
    const saved = packRoute(route, 'id', 1);
    expect(unpackRoute(saved).manualRanges).toEqual(route.manualRanges);
    const file = JSON.stringify({ app: 'ridewind', version: 1, exportedAt: '', settings: {}, routes: [saved] });
    const imported = parseImport(file).routes[0]!;
    expect(imported.manualRanges).toEqual(route.manualRanges);
    expect(imported.elevationSource).toBe('routing');
    const bad = JSON.stringify({ app: 'ridewind', version: 1, routes: [{ ...saved, manualRanges: [{ start: 5, end: 999 }] }] });
    expect(parseImport(bad).routes[0]!.manualRanges).toBeUndefined();
    const gpx = routeToGpx(route);
    expect(gpx).toContain('One section is a straight line drawn by hand');
    expect(parseGpx(gpx).points).toEqual(route.points);
  });
});

/* ---------- the session: queue, races, failures, history ---------- */

interface Call {
  locations: LatLon[];
  resolve: (legs: TrackPoint[][]) => void;
  reject: (e: unknown) => void;
}

function harness(opts: { minIntervalMs?: number } = {}) {
  const calls: Call[] = [];
  const views: SessionView[] = [];
  const router = (locations: LatLon[]) =>
    new Promise<TrackPoint[][]>((resolve, reject) => {
      calls.push({ locations, resolve, reject });
    });
  const session = new RouteSession(router, (v) => views.push(v), { minIntervalMs: opts.minIntervalMs ?? 1000 });
  /** Answers a call with fake roads for each of its legs. */
  const answer = async (call: Call) => {
    call.resolve(call.locations.slice(1).map((b, i) => road(call.locations[i]!, b)));
    await vi.advanceTimersByTimeAsync(0);
  };
  const last = () => views[views.length - 1]!;
  return { session, calls, answer, last };
}

describe('RouteSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('routes a new leg and reports one completed edit', async () => {
    const h = harness();
    h.session.edit((r) => addPoint(r, A, 'routed'));
    h.session.edit((r) => addPoint(r, B, 'routed'));
    expect(h.last().routing).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.calls).toHaveLength(1);
    const before = h.last().completedRevision;
    await h.answer(h.calls[0]!);
    expect(h.last().routing).toBe(false);
    expect(h.last().completedRevision).toBe(before + 1);
    expect(h.last().route.legs[0]!.points).toEqual(road(A, B));
  });

  it('spaces requests and batches rapid clicks into one request with the latest points', async () => {
    const h = harness({ minIntervalMs: 1000 });
    h.session.edit((r) => addPoint(r, A, 'routed'));
    h.session.edit((r) => addPoint(r, B, 'routed'));
    await vi.advanceTimersByTimeAsync(0);
    expect(h.calls).toHaveLength(1);
    // Three more clicks while the first request is out.
    h.session.edit((r) => addPoint(r, C, 'routed'));
    h.session.edit((r) => addPoint(r, D, 'routed'));
    h.session.edit((r) => addPoint(r, A, 'routed'));
    await h.answer(h.calls[0]!);
    expect(h.calls).toHaveLength(1); // waits out the interval
    await vi.advanceTimersByTimeAsync(999);
    expect(h.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]!.locations).toEqual([B, C, D, A]); // one request for all three new legs
    await h.answer(h.calls[1]!);
    expect(isComplete(h.last().route)).toBe(true);
    expect(h.last().route.controls).toHaveLength(5);
  });

  it('ignores an answer for a point that moved meanwhile, and routes the new position', async () => {
    const h = harness();
    h.session.edit((r) => addPoint(r, A, 'routed'));
    h.session.edit((r) => addPoint(r, B, 'routed'));
    await vi.advanceTimersByTimeAsync(0);
    const B2 = { lat: 37.875, lon: -122.265 };
    h.session.edit((r) => movePoint(r, 1, B2)); // dragged before the answer came back
    await h.answer(h.calls[0]!); // stale: A→B
    expect(h.last().route.legs[0]!.points).toBeNull(); // not overwritten with the old road
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.calls[1]!.locations).toEqual([A, B2]);
    await h.answer(h.calls[1]!);
    expect(h.last().route.legs[0]!.points).toEqual(road(A, B2));
  });

  it('keeps the last complete route when routing fails, then retries or uses a straight line', async () => {
    const h = harness();
    h.session.edit((r) => addPoint(r, A, 'routed'));
    h.session.edit((r) => addPoint(r, B, 'routed'));
    await vi.advanceTimersByTimeAsync(0);
    await h.answer(h.calls[0]!);
    const good = h.last().route;
    h.session.edit((r) => addPoint(r, C, 'routed'));
    await vi.advanceTimersByTimeAsync(1000);
    h.calls[1]!.reject(new AppError('ROUTING_NO_ROUTE', 'No road was found near that point.'));
    await vi.advanceTimersByTimeAsync(0);
    expect(h.last().route).toEqual(good); // last valid route kept
    expect(h.last().error?.message).toBe('No road was found near that point.');
    expect(h.last().routing).toBe(false);

    h.session.retry();
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.calls).toHaveLength(3);
    h.calls[2]!.reject(new AppError('ROUTING_NETWORK', 'offline'));
    await vi.advanceTimersByTimeAsync(0);
    expect(h.last().route).toEqual(good);

    h.session.useStraightLines();
    const r = h.last().route;
    expect(r.controls).toEqual([A, B, C]);
    expect(r.legs.map((l) => l.mode)).toEqual(['routed', 'manual']);
    expect(isComplete(r)).toBe(true);
    expect(h.last().error).toBeNull();
  });

  it('ignores a failure for an edit that was already undone', async () => {
    const h = harness();
    h.session.edit((r) => addPoint(r, A, 'routed'));
    h.session.edit((r) => addPoint(r, B, 'routed'));
    await vi.advanceTimersByTimeAsync(0);
    h.session.undo();
    h.calls[0]!.reject(new AppError('ROUTING_NETWORK', 'offline'));
    await vi.advanceTimersByTimeAsync(0);
    expect(h.last().error).toBeNull();
    expect(h.last().route.controls).toEqual([A]);
  });

  it('undo and redo step one edit at a time without routing again', async () => {
    const h = harness();
    h.session.edit((r) => addPoint(r, A, 'routed'));
    h.session.edit((r) => addPoint(r, B, 'routed'));
    await vi.advanceTimersByTimeAsync(0);
    await h.answer(h.calls[0]!);
    h.session.edit((r) => addPoint(r, C, 'routed'));
    await vi.advanceTimersByTimeAsync(1000);
    await h.answer(h.calls[1]!);
    h.session.edit(reverseEditorRoute);
    expect(h.last().route.controls).toEqual([C, B, A]);
    expect(h.session.undo()).toBe(true);
    expect(h.last().route.controls).toEqual([A, B, C]);
    expect(h.session.undo()).toBe(true);
    expect(h.last().route.controls).toEqual([A, B]);
    expect(h.session.redo()).toBe(true);
    expect(h.session.redo()).toBe(true);
    expect(h.last().route.controls).toEqual([C, B, A]);
    expect(h.last().canRedo).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(h.calls).toHaveLength(2); // all from the cache
    expect(isComplete(h.last().route)).toBe(true);
  });

  it('makes clear one undoable edit', () => {
    const h = harness();
    h.session.edit((r) => addPoint(r, A, 'manual'));
    h.session.edit((r) => addPoint(r, B, 'manual'));
    h.session.edit(() => EMPTY_ROUTE);
    expect(h.last().route.controls).toHaveLength(0);
    h.session.undo();
    expect(h.last().route.controls).toEqual([A, B]);
    expect(h.calls).toHaveLength(0); // straight lines never call the router
  });

  it('sends nothing after dispose', async () => {
    const h = harness();
    h.session.edit((r) => addPoint(r, A, 'routed'));
    h.session.edit((r) => addPoint(r, B, 'routed'));
    h.session.dispose();
    await vi.advanceTimersByTimeAsync(5000);
    expect(h.calls).toHaveLength(0);
  });
});
