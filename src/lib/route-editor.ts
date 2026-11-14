import { AppError, isAppError } from './errors';
import { cumulativeDistances, elevationStats, haversineM, type LatLon, type Route, type TrackPoint } from './geo';
import { densify, DRAWN_ROUTE_NAME, MAX_DRAWN_POINTS, MIN_DRAWN_GAP_M } from './draw';

/**
 * Click-to-route editing. A drawn route is a list of control points (where the
 * rider clicked) and one leg between each pair. A leg either follows roads
 * (its geometry comes from the routing server) or is a straight line the rider
 * chose on purpose. Every edit returns a new value; nothing is mutated, which
 * is what makes undo, redo and out-of-order responses safe.
 */

export type LegMode = 'routed' | 'manual';

export interface Leg {
  mode: LegMode;
  /** The leg's geometry from its first control point's end to the next. Null while a routed leg waits for the router. */
  points: TrackPoint[] | null;
}

export interface EditorRoute {
  controls: LatLon[];
  /** Always `controls.length - 1` long (or empty). */
  legs: Leg[];
}

/** A stretch of a finished route that was drawn as a straight line, by point index (inclusive). */
export interface ManualRange {
  start: number;
  end: number;
}

export const EMPTY_ROUTE: EditorRoute = { controls: [], legs: [] };

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;
const validPoint = (p: LatLon) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
const clean = (p: LatLon): LatLon => ({ lat: round6(p.lat), lon: round6(p.lon) });

/** Identifies a leg's geometry: the same key always means the same request and the same answer. */
export function legKey(a: LatLon, b: LatLon, mode: LegMode): string {
  return `${mode}|${a.lat},${a.lon}|${b.lat},${b.lon}`;
}

const pendingLeg = (mode: LegMode): Leg => ({ mode, points: null });

/* ---------- edits ---------- */

/** Adds a point at the end, joined by a leg in `mode`. Null when it can't be added. */
export function addPoint(r: EditorRoute, p: LatLon, mode: LegMode): EditorRoute | null {
  if (r.controls.length >= MAX_DRAWN_POINTS || !validPoint(p)) return null;
  const next = clean(p);
  const last = r.controls[r.controls.length - 1];
  if (last && haversineM(last, next) < MIN_DRAWN_GAP_M) return null;
  return { controls: [...r.controls, next], legs: last ? [...r.legs, pendingLeg(mode)] : [] };
}

/** Moves control point `i`; the legs either side are worked out again in their own modes. */
export function movePoint(r: EditorRoute, i: number, p: LatLon): EditorRoute | null {
  if (i < 0 || i >= r.controls.length || !validPoint(p)) return null;
  const next = clean(p);
  if (haversineM(r.controls[i]!, next) < 0.5) return null;
  const controls = r.controls.slice();
  controls[i] = next;
  const legs = r.legs.map((leg, k) => (k === i - 1 || k === i ? pendingLeg(leg.mode) : leg));
  return { controls, legs };
}

/**
 * Removes control point `i`. Removing a middle point joins its neighbours with
 * one leg, which follows roads only if both legs it replaces did.
 */
export function removePoint(r: EditorRoute, i: number): EditorRoute | null {
  const n = r.controls.length;
  if (i < 0 || i >= n) return null;
  const controls = r.controls.filter((_, k) => k !== i);
  if (controls.length < 2) return { controls, legs: [] };
  if (i === 0) return { controls, legs: r.legs.slice(1) };
  if (i === n - 1) return { controls, legs: r.legs.slice(0, -1) };
  const mode: LegMode = r.legs[i - 1]!.mode === 'routed' && r.legs[i]!.mode === 'routed' ? 'routed' : 'manual';
  return { controls, legs: [...r.legs.slice(0, i - 1), pendingLeg(mode), ...r.legs.slice(i + 1)] };
}

/** Rides the route the other way. The roads stay exactly the same: nothing is routed again. */
export function reverseEditorRoute(r: EditorRoute): EditorRoute {
  return {
    controls: r.controls.slice().reverse(),
    legs: r.legs
      .slice()
      .reverse()
      .map((leg) => ({ mode: leg.mode, points: leg.points ? leg.points.slice().reverse() : null })),
  };
}

/** Whether the route already finishes where it starts. */
export function isLoop(r: EditorRoute): boolean {
  const n = r.controls.length;
  return n > 2 && haversineM(r.controls[0]!, r.controls[n - 1]!) < MIN_DRAWN_GAP_M;
}

/** Adds a leg from the last point back to the first. Null if there's nothing to close or it's already a loop. */
export function closeLoop(r: EditorRoute, mode: LegMode): EditorRoute | null {
  if (r.controls.length < 2 || isLoop(r)) return null;
  const first = r.controls[0]!;
  return { controls: [...r.controls, { ...first }], legs: [...r.legs, pendingLeg(mode)] };
}

/** Turns every leg still waiting for the router into a straight line. */
export function pendingToManual(r: EditorRoute): EditorRoute {
  return { controls: r.controls, legs: r.legs.map((leg) => (leg.points ? leg : pendingLeg('manual'))) };
}

/* ---------- geometry ---------- */

export type LegCache = Map<string, TrackPoint[]>;

/** Straight leg geometry: points every 100 m, with no elevation (nothing was looked up for it). */
function straightLeg(a: LatLon, b: LatLon): TrackPoint[] {
  return densify([a, b]).map((p) => ({ lat: p.lat, lon: p.lon, ele: null }));
}

/** Fills waiting legs: straight legs are drawn at once, routed legs come from the cache when it has them. */
export function fillLegs(r: EditorRoute, cache: LegCache): EditorRoute {
  let changed = false;
  const legs = r.legs.map((leg, i) => {
    if (leg.points) return leg;
    const a = r.controls[i]!;
    const b = r.controls[i + 1]!;
    const points = leg.mode === 'manual' ? straightLeg(a, b) : (cache.get(legKey(a, b, 'routed')) ?? null);
    if (!points) return leg;
    changed = true;
    return { mode: leg.mode, points };
  });
  return changed ? { controls: r.controls, legs } : r;
}

export function isComplete(r: EditorRoute): boolean {
  return r.legs.every((leg) => leg.points !== null);
}

/** Runs of consecutive legs waiting for the router, each small enough for one request. */
export function pendingRuns(r: EditorRoute, maxLocations: number): Array<{ firstLeg: number; locations: LatLon[]; keys: string[] }> {
  const runs: Array<{ firstLeg: number; locations: LatLon[]; keys: string[] }> = [];
  let cur: (typeof runs)[number] | null = null;
  r.legs.forEach((leg, i) => {
    const waiting = !leg.points && leg.mode === 'routed';
    if (!waiting) {
      cur = null;
      return;
    }
    if (!cur || cur.locations.length >= maxLocations) {
      cur = { firstLeg: i, locations: [r.controls[i]!], keys: [] };
      runs.push(cur);
    }
    cur.locations.push(r.controls[i + 1]!);
    cur.keys.push(legKey(r.controls[i]!, r.controls[i + 1]!, 'routed'));
  });
  return runs;
}

/** The whole route as one line, plus which point ranges are straight lines drawn by hand. */
export function joinLegs(r: EditorRoute): { points: TrackPoint[]; manual: ManualRange[] } {
  const points: TrackPoint[] = [];
  const manual: ManualRange[] = [];
  if (r.controls.length === 1) return { points: [{ ...r.controls[0]!, ele: null }], manual };
  for (const leg of r.legs) {
    if (!leg.points) continue;
    let pts = leg.points;
    const last = points[points.length - 1];
    if (last && pts[0] && last.lat === pts[0].lat && last.lon === pts[0].lon) pts = pts.slice(1);
    const start = Math.max(0, points.length - 1);
    points.push(...pts);
    if (leg.mode === 'manual') {
      const prev = manual[manual.length - 1];
      if (prev && prev.end >= start) prev.end = points.length - 1;
      else manual.push({ start, end: points.length - 1 });
    }
  }
  return { points, manual };
}

export interface EditorStats {
  points: number;
  totalM: number;
  routedM: number;
  manualM: number;
  manualSections: number;
  gainM: number | null;
}

export function editorStats(r: EditorRoute): EditorStats {
  let routedM = 0;
  let manualM = 0;
  let manualSections = 0;
  let prevManual = false;
  for (const leg of r.legs) {
    if (!leg.points) {
      prevManual = false;
      continue;
    }
    const cum = cumulativeDistances(leg.points);
    const len = cum[cum.length - 1] ?? 0;
    if (leg.mode === 'manual') {
      manualM += len;
      if (!prevManual) manualSections++;
      prevManual = true;
    } else {
      routedM += len;
      prevManual = false;
    }
  }
  const { points } = joinLegs(r);
  const gainM = points.length > 1 ? elevationStats(points).gainM : null;
  return { points: r.controls.length, totalM: routedM + manualM, routedM, manualM, manualSections, gainM };
}

/** A finished editor route as a RideWind Route. Throws if it has fewer than two points or legs still routing. */
export function editorToRoute(r: EditorRoute, name: string): Route {
  if (r.controls.length < 2) throw new AppError('DRAW_TOO_FEW_POINTS', 'Add at least two points on the map to make a route.');
  if (!isComplete(r)) throw new AppError('DRAW_TOO_FEW_POINTS', 'Wait for the route to finish following the roads.');
  const { points, manual } = joinLegs(r);
  const hasEle = points.some((p) => p.ele !== null);
  return {
    name: name.trim().slice(0, 100) || DRAWN_ROUTE_NAME,
    points,
    source: 'drawn',
    ...(hasEle ? { elevationSource: 'routing' as const } : {}),
    ...(manual.length ? { manualRanges: manual } : {}),
  };
}

/* ---------- editing session: history, routing queue, races ---------- */

export type Router = (locations: LatLon[], signal: AbortSignal) => Promise<TrackPoint[][]>;

export interface SessionError {
  message: string;
  /** The edit that couldn't be routed, kept so the rider can retry it or draw its gaps as straight lines. */
  failed: EditorRoute;
  retryAfterSeconds?: number;
}

export interface SessionView {
  route: EditorRoute;
  routing: boolean;
  error: SessionError | null;
  canUndo: boolean;
  canRedo: boolean;
  /** Increases each time the shown route becomes a complete, new route (a completed edit). */
  completedRevision: number;
}

export interface SessionOptions {
  minIntervalMs?: number;
  maxLocations?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
  /** Most legs remembered across edits, so undo and redo don't route again. */
  cacheSize?: number;
}

/**
 * Holds one drawing: the edit history, the cache of routed legs and the queue
 * of routing requests.
 *
 * - Every edit is one history entry, so undo steps back one action at a time.
 * - Requests are spaced at least `minIntervalMs` apart, and each one is built
 *   from the route as it is when the request is sent, so an edit made while a
 *   request is out never sends stale points.
 * - A response only fills legs whose key matches, so an answer for a point
 *   that has since moved or been removed can't overwrite the newer edit.
 * - If routing fails, the route goes back to the last complete version and the
 *   failed edit is kept for Retry or "draw as straight lines".
 */
export class RouteSession {
  private past: EditorRoute[] = [];
  private present: EditorRoute = EMPTY_ROUTE;
  private future: EditorRoute[] = [];
  private cache: LegCache = new Map();
  private error: SessionError | null = null;
  private inFlight = 0;
  private lastStart = -Infinity;
  private timer: unknown = null;
  private completedRevision = 0;
  private lastCompleted: EditorRoute | null = EMPTY_ROUTE;
  private ctrl = new AbortController();
  private readonly minIntervalMs: number;
  private readonly maxLocations: number;
  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (id: unknown) => void;
  private readonly cacheSize: number;

  constructor(
    private readonly router: Router,
    private readonly onChange: (view: SessionView) => void,
    opts: SessionOptions = {},
  ) {
    this.minIntervalMs = opts.minIntervalMs ?? 1100;
    this.maxLocations = opts.maxLocations ?? 12;
    this.now = opts.now ?? (() => Date.now());
    this.setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = opts.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
    this.cacheSize = opts.cacheSize ?? 400;
  }

  get route(): EditorRoute {
    return this.present;
  }

  view(): SessionView {
    return {
      route: this.present,
      routing: !isComplete(this.present),
      error: this.error,
      canUndo: this.past.length > 0,
      canRedo: this.future.length > 0,
      completedRevision: this.completedRevision,
    };
  }

  /** Applies an edit to the current route. Returns false when the edit did nothing. */
  edit(fn: (r: EditorRoute) => EditorRoute | null): boolean {
    const next = fn(this.present);
    if (!next) return false;
    this.past.push(this.present);
    this.future = [];
    this.error = null;
    this.setPresent(next);
    return true;
  }

  undo(): boolean {
    const prev = this.past.pop();
    if (!prev) return false;
    this.future.unshift(this.present);
    this.error = null;
    this.setPresent(prev);
    return true;
  }

  redo(): boolean {
    const next = this.future.shift();
    if (!next) return false;
    this.past.push(this.present);
    this.error = null;
    this.setPresent(next);
    return true;
  }

  /** Tries the failed edit again. */
  retry(): void {
    const failed = this.error?.failed;
    if (!failed) return;
    this.error = null;
    this.edit(() => failed);
  }

  /** Applies the failed edit with its unrouted gaps drawn as straight lines. */
  useStraightLines(): void {
    const failed = this.error?.failed;
    if (!failed) return;
    this.error = null;
    this.edit(() => pendingToManual(failed));
  }

  dismissError(): void {
    if (!this.error) return;
    this.error = null;
    this.emit();
  }

  /** Stops routing; later responses are ignored. */
  dispose(): void {
    this.ctrl.abort();
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
  }

  private setPresent(r: EditorRoute): void {
    this.present = fillLegs(r, this.cache);
    this.noteCompleted();
    this.emit();
    this.schedule();
  }

  private noteCompleted(): void {
    if (isComplete(this.present) && this.present !== this.lastCompleted) {
      this.lastCompleted = this.present;
      this.completedRevision++;
    }
  }

  private emit(): void {
    this.onChange(this.view());
  }

  private schedule(): void {
    if (this.timer !== null || this.inFlight > 0 || this.ctrl.signal.aborted) return;
    if (pendingRuns(this.present, this.maxLocations).length === 0) return;
    const wait = Math.max(0, this.lastStart + this.minIntervalMs - this.now());
    this.timer = this.setTimer(() => {
      this.timer = null;
      void this.fire();
    }, wait);
  }

  private remember(key: string, points: TrackPoint[]): void {
    this.cache.delete(key);
    this.cache.set(key, points);
    while (this.cache.size > this.cacheSize) this.cache.delete(this.cache.keys().next().value!);
  }

  private async fire(): Promise<void> {
    const run = pendingRuns(this.present, this.maxLocations)[0];
    if (!run) return;
    this.inFlight++;
    this.lastStart = this.now();
    try {
      const legs = await this.router(run.locations, this.ctrl.signal);
      if (this.ctrl.signal.aborted) return;
      if (legs.length !== run.keys.length) throw new Error('leg count mismatch');
      run.keys.forEach((k, i) => this.remember(k, legs[i]!));
      const filled = fillLegs(this.present, this.cache);
      if (filled !== this.present) {
        // Undo and redo entries may use the same legs; fill them too so they don't route again.
        this.past = this.past.map((r) => fillLegs(r, this.cache));
        this.future = this.future.map((r) => fillLegs(r, this.cache));
        this.present = filled;
        this.noteCompleted();
        this.emit();
      }
    } catch (e) {
      if (this.ctrl.signal.aborted) return;
      const stillWanted = pendingRuns(this.present, this.maxLocations).some((r) => r.keys.some((k) => run.keys.includes(k)));
      if (stillWanted) this.fail(e);
    } finally {
      this.inFlight--;
      this.schedule();
    }
  }

  /** Goes back to the newest complete route and keeps the failed edit for Retry. */
  private fail(e: unknown): void {
    const failed = this.present;
    let prev = this.past.pop();
    while (prev && !isComplete(fillLegs(prev, this.cache))) prev = this.past.pop();
    this.present = prev ? fillLegs(prev, this.cache) : EMPTY_ROUTE;
    this.future = [];
    this.error = {
      message: isAppError(e) ? e.message : "Couldn't follow the roads for that change. Your last complete route is kept.",
      failed,
      ...(isAppError(e) && e.retryAfterSeconds ? { retryAfterSeconds: e.retryAfterSeconds } : {}),
    };
    this.noteCompleted();
    this.emit();
  }
}
