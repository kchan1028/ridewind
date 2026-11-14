import { AppError, isAppError } from '../lib/errors';
import { BEST_MARGIN, bestChoice, compareRides, daylightCutoff, departureOptions, nextDayDepartures, type CompareRow, type RouteVariant } from '../lib/compare';
import { MAX_DRAWN_POINTS, addDrawnPoint, buildDrawnRoute, drawnDistanceM, gpxFileName, routeToGpx, undoDrawnPoint } from '../lib/draw';
import { applyElevations, elevationLookupCoords, fetchElevations } from '../lib/elevation';
import { cumulativeDistances, elevationStats, hasCompleteElevation, reverseRoute, sampleRoute, type LatLon, type Route, type Sample } from '../lib/geo';
import { MAX_GPX_BYTES, parseGpx } from '../lib/gpx';
import { RIDER_LIMITS, type Exposure, type RiderParams } from '../lib/physics';
import { planRide, type RidePlan, type SegmentClass } from '../lib/ride';
import { MAX_STOP_MINUTES, simulateRide, type PaceModel, type Simulation } from '../lib/simulate';
import { rideDaylight } from '../lib/daylight';
import { departurePresets, nextDepartureAt } from '../lib/presets';
import { LOW_RAIN_CHANCE, rainSummary, windVerdict } from '../lib/verdict';
import * as store from '../lib/storage';
import {
  deviceTimeZone,
  formatClock,
  formatDate,
  formatDateTime,
  formatDayClock,
  formatWallClock,
  formatDuration,
  formatOffset,
  isValidTimeZone,
  utcToWallTime,
  wallTimeToUtc,
} from '../lib/time';
import {
  defaultUnits,
  displayToKg,
  displayToKmh,
  formatDistance,
  formatElevation,
  formatPrecip,
  formatSpeed,
  formatTemp,
  kgToDisplay,
  kmhToDisplay,
  massUnit,
  speedUnit,
  type UnitSystem,
} from '../lib/units';
import { coordKey, fetchForecast, forecastCovers, type ForecastBundle, type LocationForecast } from '../lib/weather';
import { compassPoint } from '../lib/wind';
import { renderCharts } from './charts';
import { fieldErrorFor, setFieldError } from './field-error';
import { CLASS_STYLE, RouteMap } from './map';
import { initPanelResize } from './panel-resize';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
};
const HOUR = 3600_000;
const sampleUrl = (file: string) => `${import.meta.env.BASE_URL}samples/${file}`;

/**
 * Everything the page knows about the current ride. There is one instance,
 * `state`, and every handler reads and updates it before calling recompute().
 * See docs/architecture.md for how a route moves through these fields.
 */
interface State {
  /** The route as imported, in its original direction. */
  original: Route | null;
  /** `original`, or its reverse when `reversed` is true. All calculations use this. */
  route: Route | null;
  reversed: boolean;
  isSample: boolean;
  savedId: string | null;
  cum: number[];
  samples: Sample[];
  forecast: ForecastBundle | null;
  tz: string;
  tzFromForecast: boolean;
  departureMs: number | null;
  plan: RidePlan | null;
  sim: Simulation | null;
  /** The rider explicitly chose a flat-route power estimate for this route. */
  assumeFlat: boolean;
  /** First departure of the comparison list. Use keeps it, so earlier options stay listed; other departure changes clear it. */
  compareFromMs: number | null;
  /** Whether the comparison lists departures that would finish after dark. */
  showLateDepartures: boolean;
  elevationBusy: boolean;
  settings: store.Settings;
  abort: AbortController | null;
  /** Usual departure time ("HH:MM", route-local) from a saved route, applied once its forecast loads. */
  pendingDepartTime: string | null;
  /** The last forecast kept with this saved route, used when a new one can't be fetched. */
  cachedForecast: ForecastBundle | null;
  /** True while the shown forecast is that saved copy rather than a fresh one. */
  forecastFromCache: boolean;
}

const state: State = {
  original: null,
  route: null,
  reversed: false,
  isSample: false,
  savedId: null,
  cum: [],
  samples: [],
  forecast: null,
  tz: deviceTimeZone(),
  tzFromForecast: false,
  departureMs: null,
  plan: null,
  sim: null,
  assumeFlat: false,
  compareFromMs: null,
  showLateDepartures: false,
  elevationBusy: false,
  settings: store.loadSettings(),
  abort: null,
  pendingDepartTime: null,
  cachedForecast: null,
  forecastFromCache: false,
};

let map: RouteMap;

/* ---------- helpers ---------- */

function setStatus(message: string, kind: 'info' | 'error' | 'ok' | 'loading' = 'info'): void {
  const el = $('status');
  el.textContent = message;
  el.dataset.kind = kind;
}

/* ---------- verdict (answer-first summary) ---------- */

type VerdictMode = 'loading' | 'error' | 'notice' | 'ready';

/** Whether the rider has opened the verdict's details. Collapsed by default so the bar stays small. */
let verdictExpanded = false;
/** A forecast older than this is flagged in the verdict's summary line. */
const STALE_FORECAST_MS = HOUR;

/** `message` fills the summary line; a ready verdict sets its own summary and details afterwards. */
function setVerdictMode(mode: VerdictMode, head: string, message: string): void {
  const v = $('verdict');
  v.hidden = false;
  v.dataset.mode = mode;
  if (mode !== 'ready') delete v.dataset.tone;
  document.body.classList.add('has-verdict');
  $('verdict-head').textContent = head;
  $('verdict-key').textContent = message;
  show('wind-bar', mode === 'ready');
  show('verdict-toggle', mode === 'ready');
  applyVerdictExpanded(mode === 'ready' && verdictExpanded);
  show('depart-stepper', mode === 'ready');
  show('verdict-retry', mode === 'error');
  show('verdict-elevation', false);
  const r = state.route;
  $('verdict-route').textContent = r
    ? `${r.name} · ${formatDistance(state.cum[state.cum.length - 1] ?? 0, units())}${state.reversed ? ' · reversed' : ''}`
    : '';
}

/** Shows the details (all facts, wind key, forecast time) instead of the one-line summary. */
/**
 * On phones, shrink the bottom bar to one row (hour buttons around the
 * headline and the finish line) once the rider has scrolled past the summary
 * figures into the detail, and give the full bar back near the top. It stays
 * full while Details is open or keyboard focus is inside the bar (a tap on the
 * hour buttons doesn't count, so the bar doesn't jump under the rider's finger).
 */
function bindCompactVerdict(): void {
  const v = $('verdict');
  const kpis = document.querySelector<HTMLElement>('.kpis');
  const phone = window.matchMedia('(max-width: 899px)');
  let queued = false;
  const update = (): void => {
    queued = false;
    const compact =
      phone.matches &&
      !!kpis &&
      kpis.offsetParent !== null &&
      v.dataset.mode === 'ready' &&
      v.dataset.expanded !== 'true' &&
      $('verdict-elevation').hidden &&
      !v.querySelector(':focus-visible') &&
      kpis.getBoundingClientRect().bottom < 0;
    if (compact) v.dataset.compact = 'true';
    else delete v.dataset.compact;
  };
  const queue = (): void => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  v.addEventListener('focusin', queue);
  v.addEventListener('focusout', queue);
  new MutationObserver(queue).observe(v, { attributes: true, subtree: true, attributeFilter: ['data-mode', 'data-expanded', 'hidden'] });
}

function applyVerdictExpanded(expanded: boolean): void {
  const toggle = $('verdict-toggle');
  toggle.setAttribute('aria-expanded', String(expanded));
  toggle.textContent = expanded ? 'Less' : 'Details';
  $('verdict').dataset.expanded = String(expanded);
  show('verdict-more', expanded);
  show('verdict-key', !expanded);
}

function announce(text: string): void {
  const live = $('verdict-live');
  if (live.textContent !== text) live.textContent = text;
}

function renderVerdict(plan: RidePlan, sim: Simulation): void {
  const u = units();
  const tz = state.tz;
  const s = plan.summary;
  const { headline, tone } = windVerdict(s.distanceByClass);
  const facts: string[] = [];
  const mh = s.meanHeadwind;
  if (mh !== null && Math.abs(mh) >= 1) facts.push(`net ${formatSpeed(Math.abs(mh), u)} ${mh > 0 ? 'headwind' : 'tailwind'}`);
  if (s.gustMax !== null) facts.push(`gusts ${formatSpeed(s.gustMax, u)}`);
  const rain = rainSummary(s.precipMax, s.precipProbabilityMax, (mm) => `${formatPrecip(mm, u)}/h`);
  if (rain) facts.push(rain.fact);
  const finish = `finish ${formatClock(plan.finishMs, tz)}${sim.assumedFlat ? ' (flat estimate)' : ''}`;
  facts.push(`${formatDuration(plan.durationMs)}, ${finish}`);
  const light = rideDaylight(state.departureMs!, plan.finishMs, forecastsForSamples()[0]?.sun);
  let daylight = '';
  if (light.kind === 'starts-after-sunset') daylight = `starts after sunset (${formatClock(light.sunsetMs!, tz)})`;
  else if (light.kind === 'starts-before-sunrise') daylight = `starts in the dark (sunrise ${formatClock(light.sunriseMs!, tz)})`;
  else if (light.kind === 'ends-after-sunset') daylight = `finishes after sunset (${formatClock(light.sunsetMs!, tz)})`;
  else if (light.kind === 'daylight') daylight = `sunset ${formatClock(light.sunsetMs!, tz)}`;
  if (daylight) facts.push(daylight);

  // The collapsed summary: when you'll finish, daylight, and rain only when it's worth a glance.
  const key = [finish];
  if (daylight) key.push(daylight);
  const chance = s.precipProbabilityMax;
  if (rain && rain.fact !== 'dry' && (chance === null || chance >= LOW_RAIN_CHANCE)) key.push(rain.fact);
  const fc = state.forecast!;
  const ageMs = Date.now() - fc.fetchedAt;
  if (state.forecastFromCache) key.push(`saved forecast from ${formatDayClock(fc.fetchedAt, deviceTimeZone())}`);
  else if (ageMs >= STALE_FORECAST_MS) key.push(`forecast ${Math.floor(ageMs / HOUR)} h old`);

  if (elevationChoicePending()) key.push(`timed at ${formatSpeed(state.settings.speedKmh, u)} average`);

  setVerdictMode('ready', headline, key.join(' · '));
  show('verdict-elevation', elevationChoicePending());
  $('verdict-facts').textContent = facts.join(' · ');
  $('verdict-age').textContent = `Forecast updated ${formatDateTime(fc.fetchedAt, deviceTimeZone())} (your device time).`;
  $('verdict').dataset.tone = tone;
  // "Leave" is hidden on phones (still read by screen readers) so the date fits the bottom bar.
  const leave = document.createElement('span');
  leave.className = 'depart-word';
  leave.textContent = 'Leave ';
  $('depart-label').replaceChildren(leave, formatDayClock(state.departureMs!, tz));
  const b = departureBounds();
  ($('dep-earlier') as HTMLButtonElement).disabled = !b || state.departureMs! - HOUR < b.min;
  ($('dep-later') as HTMLButtonElement).disabled = !b || state.departureMs! + HOUR > b.max;
  // The facts are fragments ("net 1 mph tailwind, …"); read as a sentence, the first word needs a capital.
  const sentence = facts.join(', ');
  announce(`${headline}. ${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`);
}

function shiftDeparture(deltaMs: number): void {
  const b = departureBounds();
  if (!b || state.departureMs === null) return;
  const next = state.departureMs + deltaMs;
  if (next < b.min || next > b.max) return;
  setDeparture(next);
}

/**
 * Sets a departure chosen any way other than the comparison's Use button: the
 * stepper, a preset or the date field. The comparison list restarts from it, and
 * a "Using …" status from an earlier Use is cleared so it can't contradict the verdict.
 */
function setDeparture(ms: number): void {
  state.departureMs = ms;
  state.compareFromMs = null;
  if ($('status').textContent?.startsWith('Using ')) setStatus('');
  updateDepartureInput();
  recompute();
}

/** Retries the forecast, then puts focus back where the rider can carry on. */
async function retryForecast(button: HTMLElement): Promise<void> {
  await loadForecast();
  if (!button.hidden && button.offsetParent !== null) button.focus();
  else $('verdict-head').focus();
}

function messageFor(e: unknown): string {
  if (isAppError(e)) return e.message;
  console.error(e);
  return 'Something went wrong. Please try again.';
}

const units = () => state.settings.units;
const dash = '—';

function show(id: string, visible: boolean): void {
  $(id).hidden = !visible;
}

/* ---------- route ---------- */

/** Starts over with a new route: resets per-route state, draws it and fetches its forecast. */
function loadRoute(
  route: Route,
  opts: { isSample?: boolean; savedId?: string | null; prefs?: store.RoutePrefs; cachedForecast?: ForecastBundle | null } = {},
): void {
  if (drawing) stopDrawing();
  state.original = route;
  // First route: leave the compact first-run layout so the map gets its full height.
  document.body.classList.remove('no-route');
  state.reversed = opts.prefs?.reversed ?? false;
  state.pendingDepartTime = opts.prefs?.departTime ?? null;
  state.cachedForecast = opts.cachedForecast ?? null;
  state.forecastFromCache = false;
  state.isSample = !!opts.isSample;
  state.savedId = opts.savedId ?? null;
  state.forecast = null;
  state.departureMs = null;
  state.compareFromMs = null;
  state.showLateDepartures = false;
  state.assumeFlat = false;
  state.sim = null;
  // The sample menu shows the sample that's loaded; anything else resets it.
  if (!opts.isSample) $<HTMLSelectElement>('sample-select').value = '';
  // A pending "Saved ✓" reset must not relabel the newly loaded route.
  window.clearTimeout(flashTimer);
  delete $('save-btn').dataset.flash;
  $('save-btn').textContent = state.savedId ? 'Update saved copy' : 'Save on this device';
  applyRoute();
  map.invalidateSize();
  map.fit();
  void loadForecast();
}

/** Rebuilds distances and forecast sample points after the route or its direction changes. */
function applyRoute(): void {
  if (!state.original) return;
  state.route = state.reversed ? reverseRoute(state.original) : state.original;
  state.cum = cumulativeDistances(state.route.points);
  state.samples = sampleRoute(state.route.points, state.cum);
  map.showRoute(state.route.points);
  renderRouteCard();
  recompute();
}

function renderRouteCard(): void {
  const r = state.route;
  show('route-card', !!r);
  if (!r) return;
  const u = units();
  $('route-name').textContent = r.name;
  show('sample-badge', state.isSample);
  $('fact-distance').textContent = formatDistance(state.cum[state.cum.length - 1] ?? 0, u);

  const ele = elevationStats(r.points);
  const note = $('elevation-note');
  const drawn = r.source === 'drawn';
  if (ele.gainM === null) {
    $('fact-gain').textContent = 'Unknown';
    $('fact-loss').textContent = 'Unknown';
    $('fact-range').textContent = 'Unknown';
    note.textContent = drawn
      ? 'A drawn route has no elevation data, so climbing is unknown until you look it up. RideWind does not assume the route is flat.'
      : 'This file has no elevation data, so climbing is unknown. RideWind does not assume the route is flat.';
    note.hidden = false;
  } else {
    $('fact-gain').textContent = `↗ ${formatElevation(ele.gainM, u)}`;
    $('fact-loss').textContent = `↘ ${formatElevation(ele.lossM!, u)}`;
    $('fact-range').textContent = `${formatElevation(ele.minM!, u)} – ${formatElevation(ele.maxM!, u)}`;
    if (ele.coverage < 0.999) {
      const missing = Math.round((1 - ele.coverage) * 100);
      note.textContent = `Elevation is missing for ${Math.max(1, missing)}% of points. Climbing figures use only the points that have it and may be understated.`;
      note.hidden = false;
    } else note.hidden = true;
  }
  const complete = hasCompleteElevation(r.points);
  show('card-lookup-ele', !complete);
  show('elevation-source', r.elevationSource === 'dem');
  show('dem-credit', r.elevationSource === 'dem');
  show('export-gpx-btn', drawn);
  show('legend', true);
  $('reverse-btn').setAttribute('aria-pressed', String(state.reversed));
  $('direction-note').textContent = drawn
    ? state.reversed
      ? 'Riding in reverse: from your last point back to your first.'
      : 'Riding in the order you drew it.'
    : state.reversed
      ? 'Riding in reverse: from the file’s finish back to its start.'
      : 'Riding in the file’s direction.';
}

async function importGpxFile(file: File): Promise<void> {
  try {
    if (file.size > MAX_GPX_BYTES) {
      throw new AppError('GPX_TOO_LARGE', `That file is ${(file.size / 1048576).toFixed(0)} MB. RideWind accepts GPX files up to 25 MB.`);
    }
    const route = parseGpx(await file.text(), file.name.replace(/\.[^.]+$/, '') || 'Imported route');
    setStatus(`Loaded “${route.name}”.`, 'ok');
    loadRoute(route);
  } catch (e) {
    setStatus(`${messageFor(e)}${state.route ? ' Your previous route is still loaded.' : ''}`, 'error');
  }
}

async function loadSample(file: string, label: string): Promise<void> {
  try {
    const res = await fetch(sampleUrl(file));
    if (!res.ok) throw new Error(`sample HTTP ${res.status}`);
    const route = parseGpx(await res.text(), label);
    setStatus(`Loaded the sample route “${route.name}”.`, 'ok');
    loadRoute(route, { isSample: true });
  } catch (e) {
    setStatus(isAppError(e) ? e.message : 'The sample route could not be loaded. Check your connection.', 'error');
    if (!state.isSample) $<HTMLSelectElement>('sample-select').value = '';
  }
}

/* ---------- drawing a route ---------- */

/** Points the rider has placed, in riding order. Straight lines join them. */
let draft: LatLon[] = [];
let drawing = false;

function setAriaDisabled(id: string, disabled: boolean): void {
  $(id).setAttribute('aria-disabled', String(disabled));
}

/** Redraws the draft and updates the count and distance; `message` is announced first. */
function renderDraft(message = ''): void {
  map.showDraft(draft);
  const n = draft.length;
  const summary = n === 0 ? 'No points yet.' : `${n} ${n === 1 ? 'point' : 'points'} · ${formatDistance(drawnDistanceM(draft), units())}`;
  $('draw-status').textContent = message ? `${message} ${summary}` : summary;
  setAriaDisabled('draw-undo', n === 0);
  setAriaDisabled('draw-clear', n === 0);
  setAriaDisabled('draw-finish', n < 2);
}

function startDrawing(): void {
  if (!drawing) {
    drawing = true;
    draft = [];
    $<HTMLInputElement>('draw-name').value = '';
    document.body.classList.add('drawing');
    show('draw-bar', true);
    $('draw-start').setAttribute('aria-expanded', 'true');
    map.startDrawing(addDraftPoint);
    renderDraft();
  }
  // On phones the map moves above the panel while drawing; bring the bar into view.
  $('draw-bar').scrollIntoView({ block: 'start' });
  $('draw-bar').focus({ preventScroll: true });
}

function stopDrawing(): void {
  drawing = false;
  draft = [];
  map.stopDrawing();
  document.body.classList.remove('drawing');
  show('draw-bar', false);
  $('draw-start').setAttribute('aria-expanded', 'false');
}

function addDraftPoint(p: LatLon): void {
  const next = addDrawnPoint(draft, p);
  if (!next) {
    if (draft.length >= MAX_DRAWN_POINTS) renderDraft(`A drawn route can have up to ${MAX_DRAWN_POINTS} points.`);
    return;
  }
  draft = next;
  renderDraft(`Point ${draft.length} added.`);
}

function finishDrawing(): void {
  if (draft.length < 2) {
    renderDraft('Add at least two points to finish.');
    return;
  }
  const route = buildDrawnRoute(draft, $<HTMLInputElement>('draw-name').value);
  setStatus(`Loaded your drawn route “${route.name}”. Save it on this device to keep it.`, 'ok');
  loadRoute(route);
  $('route-name').focus();
}

function bindDrawing(): void {
  $('draw-start').addEventListener('click', startDrawing);
  $('draw-add').addEventListener('click', () => addDraftPoint(map.center()));
  $('draw-undo').addEventListener('click', () => {
    if (draft.length === 0) return;
    draft = undoDrawnPoint(draft);
    renderDraft('Last point removed.');
  });
  $('draw-clear').addEventListener('click', () => {
    if (draft.length === 0) return;
    draft = [];
    renderDraft('All points cleared.');
  });
  const cancelDrawing = () => {
    stopDrawing();
    map.fit();
    $('draw-start').focus();
  };
  $('draw-cancel').addEventListener('click', cancelDrawing);
  // Escape leaves draw mode too, unless it's closing something else first (a dialog, the date picker).
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape' || !drawing || ev.defaultPrevented || document.querySelector('dialog[open]')) return;
    cancelDrawing();
  });
  $('draw-finish').addEventListener('click', finishDrawing);
  $('draw-name').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      finishDrawing();
    }
  });
  $('export-gpx-btn').addEventListener('click', () => {
    if (!state.route) return;
    downloadFile(gpxFileName(state.route.name), routeToGpx(state.route), 'application/gpx+xml');
    setStatus(`Exported “${state.route.name}” as a GPX file.`, 'ok');
  });
}

/* ---------- forecast ---------- */

function forecastsForSamples(): Array<LocationForecast | null> {
  if (!state.forecast) return state.samples.map(() => null);
  const byKey = new Map(state.forecast.locations.map((l) => [l.key, l]));
  return state.samples.map((s) => byKey.get(coordKey(s)) ?? null);
}

/**
 * Fetches one forecast for the current sample points and takes the route's
 * timezone from it. A newer call aborts an older one, so a slow response for
 * a previous route can't overwrite the current one. On failure the route stays
 * loaded and the rider sees the error with a retry button.
 */
async function loadForecast(): Promise<void> {
  if (!state.route) return;
  state.abort?.abort();
  const ctrl = new AbortController();
  state.abort = ctrl;
  show('wx-empty', false);
  show('wx-error', false);
  show('results', false);
  show('wx-loading', true);
  const name = state.route.name;
  const loadingMsg = `Getting the forecast for “${name}” (${state.samples.length} points along the route)…`;
  setStatus(loadingMsg, 'loading');
  setVerdictMode('loading', 'Getting the forecast…', `${state.samples.length} points along the route. This usually takes a few seconds.`);
  $('tz-note').textContent = 'Departure times become available once the forecast loads.';
  try {
    const fc = await fetchForecast(state.samples, { signal: ctrl.signal });
    if (ctrl.signal.aborted) return;
    state.forecast = fc;
    state.forecastFromCache = false;
    state.cachedForecast = fc;
    state.tzFromForecast = isValidTimeZone(fc.timezone);
    state.tz = state.tzFromForecast ? fc.timezone : deviceTimeZone();
    // The verdict now gives the answer (and announces it), so clear the loading line rather than repeat it.
    if ($('status').textContent === loadingMsg) setStatus('');
    // Keep it with the saved route so the route still opens without a connection.
    if (state.savedId) void store.saveRouteForecast(state.savedId, fc).catch(() => {});
  } catch (e) {
    if ((e as Error)?.name === 'AbortError' || ctrl.signal.aborted) return;
    const msg = messageFor(e);
    const cached = state.cachedForecast;
    // Offline or failing: fall back to the forecast saved with this route, if it covers these points.
    if (cached && forecastCovers(cached, state.samples)) {
      state.forecast = cached;
      state.forecastFromCache = true;
      state.tzFromForecast = isValidTimeZone(cached.timezone);
      state.tz = state.tzFromForecast ? cached.timezone : deviceTimeZone();
      setStatus(`${msg} Showing the forecast saved ${formatDateTime(cached.fetchedAt, deviceTimeZone())} (your device time) instead.`, 'error');
    } else {
      showForecastError(msg);
    }
  } finally {
    if (state.abort === ctrl) {
      state.abort = null;
      show('wx-loading', false);
    }
  }
  chooseDefaultDeparture();
  updateDepartureInput();
  recompute();
}

function showForecastError(msg: string): void {
  state.forecast = null;
  state.forecastFromCache = false;
  state.tzFromForecast = false;
  state.tz = deviceTimeZone();
  // The message and the one Retry button live in the verdict; this section only points there.
  show('wx-error', true);
  // The verdict shows it, so the status line stays clear. Announce it once, through the verdict's live region.
  setStatus('');
  setVerdictMode('error', 'Forecast unavailable', msg);
  announce(`Forecast unavailable. ${msg}`);
}

function rideDurationMs(): number {
  if (state.sim) return state.sim.durationMs;
  const totalKm = (state.cum[state.cum.length - 1] ?? 0) / 1000;
  return (totalKm / state.settings.speedKmh) * HOUR + state.settings.stopMinutes * 60_000;
}

/**
 * True while power timing waits for the rider to look up elevation or choose a
 * flat estimate. Until then, timing uses the average speed, labelled as such, so
 * the wind verdict still shows.
 */
function elevationChoicePending(): boolean {
  const r = state.route;
  return !!r && state.settings.paceMode === 'power' && !hasCompleteElevation(r.points) && !state.assumeFlat;
}

/** The pace model in use: power, or the average speed while an elevation choice is pending. */
function currentPace(): PaceModel {
  const s = state.settings;
  const stops = { stopMinutes: s.stopMinutes };
  return s.paceMode === 'power' && !elevationChoicePending()
    ? { kind: 'power', rider: s.rider, exposure: s.exposure, ...stops }
    : { kind: 'constant', speedKmh: s.speedKmh, ...stops };
}

/** Shows the elevation choice when a power estimate can't run on this route's elevation. */
function updateElevationGate(): void {
  const r = state.route;
  const needed = elevationChoicePending();
  show('elevation-gate', needed);
  if (!needed || !r) return;
  const pct = Math.round((1 - elevationStats(r.points).coverage) * 100);
  const n = elevationLookupCoords(r.points, state.cum).coords.length;
  $('elevation-gate-msg').textContent =
    (pct >= 100 ? 'This route has no elevation data. ' : `Elevation is missing for ${Math.max(1, pct)}% of this route. `) +
    `Power-based timing needs gradients. You can look up terrain elevation for ${n} points along the route (Copernicus DEM via Open-Meteo, about ${n} of the 10,000 free daily calls), or estimate as if the route were flat, which will be clearly labelled.`;
}

async function lookupElevation(): Promise<void> {
  if (!state.original || state.elevationBusy) return;
  state.elevationBusy = true;
  const buttons = document.querySelectorAll<HTMLButtonElement>('.lookup-ele');
  buttons.forEach((b) => (b.disabled = true));
  setStatus('Looking up elevation…');
  try {
    const orig = state.original;
    const cum = cumulativeDistances(orig.points);
    const { distances, coords } = elevationLookupCoords(orig.points, cum);
    const ele = await fetchElevations(coords);
    if (state.original !== orig) return; // route changed meanwhile
    state.original = applyElevations(orig, cum, distances, ele);
    state.assumeFlat = false;
    state.sim = null;
    applyRoute();
    updateDepartureInput();
    setStatus(`Added elevation for ${coords.length} points from the Copernicus terrain model. Save the route to keep it.`, 'ok');
  } catch (e) {
    setStatus(messageFor(e), 'error');
  } finally {
    state.elevationBusy = false;
    buttons.forEach((b) => (b.disabled = false));
  }
}

function departureBounds(): { min: number; max: number } | null {
  const fc = state.forecast;
  if (!fc) return null;
  const min = Math.max(fc.windowStartMs, Math.floor(Date.now() / HOUR) * HOUR);
  const max = Math.max(min, fc.windowEndMs - rideDurationMs());
  return { min, max };
}

function chooseDefaultDeparture(): void {
  const b = departureBounds();
  const nextHour = Math.ceil(Date.now() / HOUR) * HOUR;
  if (state.departureMs === null && state.pendingDepartTime && state.tzFromForecast) {
    // A saved route's usual time: the next time that comes round on the route's clock.
    state.departureMs = nextDepartureAt(state.pendingDepartTime, Date.now(), state.tz);
  }
  if (state.forecast) state.pendingDepartTime = null;
  if (state.departureMs === null) state.departureMs = nextHour;
  if (b && (state.departureMs < b.min || state.departureMs > b.max)) {
    state.departureMs = Math.min(Math.max(nextHour, b.min), b.max);
  }
}

function updateDepartureInput(): void {
  const input = $<HTMLInputElement>('departure');
  input.disabled = !state.route;
  if (!state.route || state.departureMs === null) return;
  const tz = state.tz;
  const b = departureBounds();
  input.min = b ? utcToWallTime(b.min, tz) : '';
  input.max = b ? utcToWallTime(b.max, tz) : '';
  input.value = utcToWallTime(state.departureMs, tz);
  $('tz-label').textContent = `(${tz.replace(/_/g, ' ')}, ${formatOffset(tz, state.departureMs)})`;

  const device = deviceTimeZone();
  let note: string;
  if (state.tzFromForecast) {
    note = `Times use the route's local timezone, ${tz.replace(/_/g, ' ')}, from the start of the route.`;
    if (device !== tz) note += ` Your device is set to ${device.replace(/_/g, ' ')}.`;
  } else {
    note = `The route's timezone is unknown until a forecast loads, so times use your device timezone (${device.replace(/_/g, ' ')}).`;
  }
  if (b) note += ` Forecast available until ${formatDateTime(state.forecast!.windowEndMs, tz)}.`;
  $('tz-note').textContent = note;
  renderPresets();
}

function renderPresets(): void {
  const box = $('dep-presets');
  const b = departureBounds();
  const presets = state.forecast && b ? departurePresets(Date.now(), state.tz, b) : [];
  box.hidden = presets.length === 0;
  box.replaceChildren(
    ...presets.map((p) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.textContent = p.label;
      btn.dataset.ms = String(p.ms);
      btn.setAttribute('aria-pressed', String(p.ms === state.departureMs));
      btn.addEventListener('click', () => {
        setDeparture(p.ms);
        // The presets are rebuilt above; keep focus on the one just pressed.
        $('dep-presets').querySelector<HTMLElement>(`[data-ms="${p.ms}"]`)?.focus();
      });
      return btn;
    }),
  );
}

/* ---------- results ---------- */

/**
 * Reruns the simulation and ride plan from the forecast already in memory and
 * redraws the results. Called after any change to departure, pace, direction
 * or settings. It sends no network request unless the sample points no longer
 * match the forecast.
 */
function recompute(): void {
  if (!state.route) return;
  show('wx-empty', false);
  if (!state.forecast || state.departureMs === null) {
    state.plan = null;
    map.clearPlan();
    show('results', false);
    return;
  }
  const forecasts = forecastsForSamples();
  if (forecasts.some((f) => f === null)) {
    // Sample positions changed (for example, rounding after reversing): fetch for the new points.
    void loadForecast();
    return;
  }
  updateElevationGate();
  const pace = currentPace();
  const base = { points: state.route.points, cum: state.cum, samples: state.samples, forecasts, departureMs: state.departureMs };
  try {
    state.sim = simulateRide({ ...base, pace, assumeFlat: state.assumeFlat });
  } catch (e) {
    if (isAppError(e) && e.code === 'ELEVATION_MISSING') {
      state.sim = null;
      state.plan = null;
      map.clearPlan();
      show('results', false);
      setVerdictMode('notice', 'Elevation needed for power timing', 'Look up elevation or choose to estimate as if flat, under Departure and pace.');
      return;
    }
    throw e;
  }
  state.plan = planRide({ ...base, elapsedAt: state.sim.elapsedAt });
  renderResults(state.plan, state.sim);
  renderVerdict(state.plan, state.sim);
  map.showPlan(state.plan, describePoint, (mm) => `${formatPrecip(mm, units())}/h`);
}

function variantFor(reversed: boolean): RouteVariant {
  const route = reversed ? reverseRoute(state.original!) : state.original!;
  const cum = cumulativeDistances(route.points);
  const samples = sampleRoute(route.points, cum);
  const byKey = new Map(state.forecast!.locations.map((l) => [l.key, l]));
  return {
    direction: reversed ? 'reverse' : 'forward',
    points: route.points,
    cum,
    samples,
    forecasts: samples.map((s) => byKey.get(coordKey(s)) ?? null),
  };
}

function renderComparison(): void {
  const body = $('compare-body');
  body.replaceChildren();
  const fc = state.forecast;
  if (!fc || !state.original || state.departureMs === null) return;
  const u = units();
  const tz = state.tz;
  const pace = currentPace();
  const spacingH = Number(($('compare-spacing') as HTMLSelectElement).value) || 2;
  const departures = departureOptions(state.compareFromMs ?? state.departureMs, fc.windowEndMs, rideDurationMs() * 1.3, spacingH * HOUR, 6);
  // Columns: the original GPX direction, then reversed.
  const variants = [variantFor(false), variantFor(true)];
  const todayRows = compareRides(variants, departures, pace, state.assumeFlat);
  // When some of these finish after dark, fill the list with the next day's daylight
  // departures, so a plan made at midday in winter still has options to compare.
  const cutoff = daylightCutoff(todayRows, departures);
  const nextDay =
    cutoff < departures.length
      ? nextDayDepartures(departures[departures.length - 1]!, forecastsForSamples()[0]?.sun, fc.windowEndMs, rideDurationMs() * 1.3, spacingH * HOUR, departures.length - cutoff)
      : [];
  const nextRows = compareRides(variants, nextDay, pace, state.assumeFlat).filter((r) => r.daylight === 'daylight');
  const nextShown = nextDay.filter((t) => nextRows.some((r) => r.departureMs === t));
  const rows = [...todayRows, ...nextRows];
  const choice = bestChoice(rows, pace);
  const best = choice.kind === 'best' ? choice.row : null;
  const outcome =
    choice.kind === 'similar'
      ? pace.kind === 'power'
        ? ` No clear best: the daylight options are within ${BEST_MARGIN.durationMs / 60_000} minutes of each other.`
        : ` No clear best: average wind differs by less than ${formatSpeed(BEST_MARGIN.meanHeadwindKmh, u)} between the daylight options.`
      : choice.kind === 'none'
        ? ' No option here is fully forecast and in daylight, so none is marked Best.'
        : '';
  $('compare-caption').textContent =
    (pace.kind === 'power'
      ? 'Predicted ride time, finish time, share of distance into a headwind and highest chance of rain. Best is the shortest predicted time'
      : 'Finish time, share of distance into a headwind, average wind along the route and highest chance of rain. Best is the least headwind (times are equal at a constant speed)') +
    ', among rides that start and finish in daylight and differ enough to notice.' +
    outcome;
  if (departures.length === 0) {
    const tr = document.createElement('tr');
    tr.setAttribute('role', 'row');
    const td = document.createElement('td');
    td.setAttribute('role', 'cell');
    td.colSpan = 3;
    td.textContent = 'No later departures fit inside the forecast window.';
    tr.append(td);
    body.append(tr);
    return;
  }
  const cell = (r: CompareRow | undefined, reverse: boolean) => {
    const td = document.createElement('td');
    td.setAttribute('role', 'cell');
    // Shown as a heading for each direction when phones stack the table as cards.
    td.dataset.label = reverse ? 'Reversed' : 'Original direction';
    if (!r) return td;
    const lines: string[] = [];
    if (pace.kind === 'power') lines.push(formatDuration(r.durationMs));
    lines.push(`finish ${formatClock(r.finishMs, tz)}`);
    if (r.daylight === 'starts-after-sunset') lines.push('starts after sunset');
    else if (r.daylight === 'starts-before-sunrise') lines.push('starts before sunrise');
    else if (r.daylight === 'ends-after-sunset') lines.push('finishes after sunset');
    lines.push(`${Math.round(r.headwindShare * 100)}% headwind`);
    if (pace.kind === 'constant' && r.meanHeadwind !== null)
      lines.push(`avg ${formatSpeed(Math.abs(r.meanHeadwind), u)} ${r.meanHeadwind >= 0 ? 'head' : 'tail'}`);
    if (r.precipProbabilityMax !== null) lines.push(`${Math.round(r.precipProbabilityMax)}% chance of rain`);
    if (!r.fullyForecast) lines.push('partly outside forecast');
    const txt = document.createElement('span');
    txt.textContent = lines.join(' · ');
    td.append(txt);
    if (r === best) {
      td.dataset.best = 'true';
      const b = document.createElement('span');
      b.className = 'badge badge-best';
      b.textContent = 'Best';
      td.prepend(b, ' ');
    }
    const isCurrent = r.departureMs === state.departureMs && reverse === state.reversed;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-small';
    btn.textContent = isCurrent ? 'Selected' : 'Use';
    // aria-disabled rather than disabled, so focus can land on Selected after Use.
    if (isCurrent) btn.setAttribute('aria-disabled', 'true');
    const choice = `${r.departureMs}:${reverse ? 'r' : 'f'}`;
    btn.dataset.choice = choice;
    btn.setAttribute('aria-label', `Use departure ${formatDateTime(r.departureMs, tz)}, ${reverse ? 'reversed' : 'original'} direction`);
    btn.addEventListener('click', () => {
      if (isCurrent) return;
      // Keep the list where it started, so the options already compared stay visible.
      state.compareFromMs = state.compareFromMs ?? state.departureMs;
      state.departureMs = r.departureMs;
      if (state.reversed !== reverse) {
        state.reversed = reverse;
        applyRoute();
      } else recompute();
      updateDepartureInput();
      setStatus(`Using ${formatDateTime(r.departureMs, tz)}, ${reverse ? 'reversed' : 'original'} direction.`, 'ok');
      // The table was rebuilt; move focus to the new Selected button, or the verdict if it's gone.
      const selected = $('compare-body').querySelector<HTMLElement>(`[data-choice="${choice}"]`);
      (selected ?? $('verdict-head')).focus();
    });
    td.append(' ', btn);
    return td;
  };
  // Departures that would only finish after dark wait behind "Show later times",
  // unless the rider has opened them or one of them is the departure in use.
  // Next-day rows come after them, in time order.
  const hidden = departures.length - cutoff;
  const selectedLate = departures.indexOf(state.departureMs ?? -1) >= cutoff;
  const showAll = state.showLateDepartures || selectedLate;
  const more = $('compare-more');
  more.hidden = hidden === 0 || selectedLate;
  more.setAttribute('aria-expanded', String(showAll));
  const darkTimes = `${hidden} ${hidden === 1 ? 'time' : 'times'}`;
  more.textContent = showAll
    ? nextShown.length ? 'Hide times that finish after dark' : 'Hide later times'
    : nextShown.length ? `Show ${darkTimes} that finish after dark` : `Show ${hidden} later ${hidden === 1 ? 'time' : 'times'} (finish after dark)`;
  const listed = [...(showAll ? departures : departures.slice(0, cutoff)), ...nextShown];
  for (const t of listed) {
    const tr = document.createElement('tr');
    tr.setAttribute('role', 'row');
    if (t === nextShown[0]) tr.className = 'compare-new-day';
    const th = document.createElement('th');
    th.scope = 'row';
    th.setAttribute('role', 'rowheader');
    th.textContent = formatDateTime(t, tz);
    tr.append(
      th,
      cell(rows.find((r) => r.departureMs === t && r.direction === 'forward'), false),
      cell(rows.find((r) => r.departureMs === t && r.direction === 'reverse'), true),
    );
    body.append(tr);
  }
}

const CLASS_ORDER: SegmentClass[] = ['headwind', 'crosswind', 'tailwind', 'calm', 'unknown'];

function renderResults(plan: RidePlan, sim: Simulation): void {
  const u = units();
  const tz = state.tz;
  const fc = state.forecast!;
  show('results', true);

  // Window / past warnings
  const warn: string[] = [];
  if (plan.summary.samplesWithoutForecast > 0) {
    warn.push(
      `Part of this ride falls outside the forecast window (${formatDateTime(fc.windowStartMs, tz)} to ${formatDateTime(fc.windowEndMs, tz)}). Sections without a forecast are shown in grey.`,
    );
  }
  if (state.departureMs! < Date.now() - HOUR) warn.push('This departure time is in the past.');
  if (state.forecastFromCache)
    warn.push(
      `A new forecast couldn't be loaded, so this is the one saved ${formatDateTime(fc.fetchedAt, deviceTimeZone())} (your device time). Use Refresh forecast to try again.`,
    );
  if (sim.assumedFlat) warn.push('Timing assumes a flat route because elevation is missing, so climbs and descents are not reflected.');
  if (currentPace().kind === 'power' && sim.stepsWithoutWeather > 0 && plan.summary.samplesWithoutForecast === 0)
    warn.push('Some sections had no wind forecast; still air was assumed there.');
  const w = $('window-warning');
  w.textContent = warn.join(' ');
  w.hidden = warn.length === 0;

  // Wind distribution bar
  const total = Object.values(plan.summary.distanceByClass).reduce((a, b) => a + b, 0) || 1;
  const bar = $('wind-bar');
  const key = $('wind-bar-key');
  bar.replaceChildren();
  key.replaceChildren();
  const parts: string[] = [];
  for (const cls of CLASS_ORDER) {
    const m = plan.summary.distanceByClass[cls];
    if (m <= 0) continue;
    const pct = (m / total) * 100;
    const seg = document.createElement('span');
    seg.className = `wb wb-${cls}`;
    seg.style.width = `${pct}%`;
    bar.append(seg);
    const li = document.createElement('li');
    li.innerHTML = `<span class="sw sw-${cls}" aria-hidden="true"></span>`;
    li.append(`${CLASS_STYLE[cls].label} ${Math.round(pct)}% · ${formatDistance(m, u)}`);
    key.append(li);
    parts.push(`${CLASS_STYLE[cls].label} ${Math.round(pct)}%`);
  }
  bar.setAttribute('aria-label', `Share of route distance by wind type: ${parts.join(', ')}`);

  // KPIs
  const s = plan.summary;
  const power = currentPace().kind === 'power';
  $('kpi-time').textContent = formatDuration(plan.durationMs);
  $('kpi-time-tag').textContent = power ? (sim.assumedFlat ? 'physics estimate, flat' : 'physics estimate') : 'estimate';
  const stopNote = sim.stopMs > 0 ? `, including ${formatDuration(sim.stopMs)} of stops` : '';
  $('kpi-finish').textContent = power
    ? `Finish about ${formatClock(plan.finishMs, tz)} · average ${formatSpeed(sim.avgSpeedKmh, u)} at ${state.settings.rider.powerW} W${stopNote}`
    : `Finish about ${formatClock(plan.finishMs, tz)} at ${formatSpeed(state.settings.speedKmh, u)}${stopNote}` +
      (elevationChoicePending() ? '. Average speed, because power timing needs elevation.' : '');
  $('kpi-wind').textContent =
    s.windSpeedMin === null ? dash : `${formatSpeed(s.windSpeedMin, u).split(' ')[0]}–${formatSpeed(s.windSpeedMax!, u)}`;
  $('kpi-gust').textContent = s.gustMax === null ? '' : `Gusts up to ${formatSpeed(s.gustMax, u)}`;
  // Same series as the temperature chart (every simulation step), so the two ranges agree.
  const temps = sim.steps.map((st) => st.weather?.temperature).filter((t): t is number => typeof t === 'number');
  const tMin = temps.length ? Math.min(...temps) : s.tempMin;
  const tMax = temps.length ? Math.max(...temps) : s.tempMax;
  $('kpi-temp').textContent = tMin === null || tMax === null ? dash : `${formatTemp(tMin, u)} to ${formatTemp(tMax, u)}`;
  const rain = rainSummary(s.precipMax, s.precipProbabilityMax, (mm) => `${formatPrecip(mm, u)}/h`);
  $('kpi-rain').textContent = rain ? rain.value : dash;
  $('kpi-rain-prob').textContent = rain ? rain.sub : '';

  // Table
  const body = $('samples-body');
  body.replaceChildren();
  plan.samples.forEach((r) => {
    const tr = document.createElement('tr');
    const wx = r.weather;
    const c = r.components;
    const cells: Array<string | Node> = [
      formatDistance(r.sample.distanceM, u),
      formatClock(r.etaMs, tz),
      c ? `${formatSpeed(Math.abs(c.headwind), u)} ${c.headwind >= 0 ? 'head' : 'tail'}` : noData(),
      wx?.windSpeed != null && wx.windDirection != null ? windCell(wx.windSpeed, wx.windDirection) : noData(),
      wx?.windGusts != null ? formatSpeed(wx.windGusts, u) : noData(),
      c ? `${formatSpeed(Math.abs(c.crosswind), u)} ${Math.abs(c.crosswind) < 0.5 ? '' : c.crosswind > 0 ? 'from right' : 'from left'}`.trim() : noData(),
      wx?.temperature != null ? formatTemp(wx.temperature, u) : noData(),
      wx?.precipitation != null
        ? `${formatPrecip(wx.precipitation, u)}/h${wx.precipitationProbability != null ? ` · ${Math.round(wx.precipitationProbability)}%` : ''}`
        : noData(),
    ];
    cells.forEach((content, ci) => {
      const td = document.createElement(ci === 0 ? 'th' : 'td');
      if (ci === 0) td.setAttribute('scope', 'row');
      if (ci === 2 && r.windClass) td.dataset.cls = r.windClass;
      td.append(content);
      tr.append(td);
    });
    body.append(tr);
  });

  renderCharts($('charts'), sim, { units: u, power });
  renderComparison();

  $('data-stamp').textContent =
    `Forecast retrieved ${formatDateTime(fc.fetchedAt, deviceTimeZone())} (your device time) from Open-Meteo, ` +
    `covering ${formatDateTime(fc.windowStartMs, tz)} to ${formatDateTime(fc.windowEndMs, tz)}. ` +
    `Arrival times are in ${tz.replace(/_/g, ' ')}. Use Refresh forecast to get the latest one.`;
}

function noData(): Node {
  const span = document.createElement('span');
  span.className = 'nodata';
  span.textContent = dash;
  span.title = 'No forecast for this time';
  const sr = document.createElement('span');
  sr.className = 'visually-hidden';
  sr.textContent = 'No forecast';
  const frag = document.createDocumentFragment();
  frag.append(span, sr);
  return frag;
}

function windCell(speedKmh: number, fromDeg: number): Node {
  const wrap = document.createElement('span');
  wrap.className = 'wind-cell';
  const arrow = document.createElement('span');
  arrow.className = 'dir-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.style.transform = `rotate(${(fromDeg + 180) % 360}deg)`;
  arrow.textContent = '↑';
  wrap.append(arrow, `${formatSpeed(speedKmh, units())} from ${compassPoint(fromDeg)}`);
  return wrap;
}

function describePoint(i: number): string {
  const r = state.plan?.samples[i];
  if (!r) return '';
  const u = units();
  const wx = r.weather;
  const lines = [`<strong>Point ${i + 1}</strong> · ${formatDistance(r.sample.distanceM, u)}`, `Arrive about ${formatClock(r.etaMs, state.tz)} <em>(estimate)</em>`];
  if (wx && wx.windSpeed !== null && wx.windDirection !== null) {
    lines.push(`Wind ${formatSpeed(wx.windSpeed, u)} from ${compassPoint(wx.windDirection)} <em>(forecast)</em>`);
    if (wx.windGusts !== null) lines.push(`Gusts ${formatSpeed(wx.windGusts, u)}`);
    if (r.components) {
      lines.push(
        `${formatSpeed(Math.abs(r.components.headwind), u)} ${r.components.headwind >= 0 ? 'headwind' : 'tailwind'}, ${formatSpeed(Math.abs(r.components.crosswind), u)} crosswind <em>(calculated)</em>`,
      );
    }
  } else lines.push('No forecast for this arrival time');
  if (wx?.precipitation != null) {
    const chance = wx.precipitationProbability != null ? `, ${Math.round(wx.precipitationProbability)}% chance` : '';
    lines.push(wx.precipitation < 0.05 ? `Dry${chance} <em>(forecast)</em>` : `Rain ${formatPrecip(wx.precipitation, u)}/h${chance} <em>(forecast)</em>`);
  }
  return lines.join('<br>');
}

/* ---------- saved routes ---------- */

async function renderSaved(): Promise<void> {
  const list = $('saved-list');
  try {
    const routes = await store.listRoutes();
    $('saved-count').textContent = `(${routes.length})`;
    list.replaceChildren();
    if (routes.length === 0) {
      const li = document.createElement('li');
      li.className = 'hint';
      li.textContent = 'No saved routes yet.';
      list.append(li);
      return;
    }
    for (const r of routes) {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'saved-name';
      name.textContent = r.name;
      const meta = document.createElement('span');
      meta.className = 'hint';
      const usual = [r.prefs?.reversed ? 'reversed' : '', r.prefs?.departTime ? `usually ${formatWallClock(r.prefs.departTime)}` : ''].filter(Boolean);
      meta.textContent = [`Saved ${formatDate(r.savedAt, deviceTimeZone())}`, ...usual].join(' · ');
      const load = document.createElement('button');
      load.type = 'button';
      load.className = 'btn btn-small';
      load.textContent = 'Open';
      load.setAttribute('aria-label', `Open ${r.name}`);
      load.addEventListener('click', () => {
        setStatus(`Opened “${r.name}”.`, 'ok');
        loadRoute(store.unpackRoute(r), { savedId: r.id, prefs: r.prefs, cachedForecast: store.validCachedForecast(r.forecast) });
      });
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn-small btn-danger';
      del.textContent = 'Delete';
      del.setAttribute('aria-label', `Delete ${r.name}`);
      del.addEventListener('click', async () => {
        if (!confirm(`Delete “${r.name}” from this device? This can't be undone.`)) return;
        await store.deleteRoute(r.id).catch((e) => setStatus(messageFor(e), 'error'));
        if (state.savedId === r.id) state.savedId = null;
        void renderSaved();
      });
      const text = document.createElement('div');
      text.append(name, meta);
      const btns = document.createElement('div');
      btns.className = 'saved-actions';
      btns.append(load, del);
      li.append(text, btns);
      list.append(li);
    }
    // A returning rider with nothing loaded yet: show their saved routes straight away,
    // so opening one is a single tap, and shorten the first-run introduction.
    if (!state.route) {
      $<HTMLDetailsElement>('saved').open = true;
      $('intro').textContent = 'Open a saved route below, import a GPX file, draw a route on the map or try a sample.';
    }
  } catch (e) {
    $('saved-count').textContent = '';
    list.replaceChildren();
    const li = document.createElement('li');
    li.className = 'hint';
    li.textContent = messageFor(e);
    list.append(li);
  }
}

async function saveCurrentRoute(): Promise<void> {
  if (!state.original) return;
  try {
    // Remember how this route is ridden: direction and the departure's time of day on the route's clock.
    const prefs: store.RoutePrefs = {
      reversed: state.reversed,
      ...(state.departureMs !== null && state.tzFromForecast ? { departTime: utcToWallTime(state.departureMs, state.tz).slice(11, 16) } : {}),
    };
    const packed = store.packRoute(state.original, state.savedId ?? undefined, undefined, prefs);
    // Keep the current forecast too, so the route still opens without a connection.
    const saved = state.forecast ? { ...packed, forecast: state.forecast } : packed;
    await store.saveRoute(saved);
    state.savedId = saved.id;
    flashButton($('save-btn') as HTMLButtonElement, 'Saved ✓', 'Update saved copy');
    void renderSaved();
  } catch (e) {
    setStatus(messageFor(e), 'error');
  }
}

/** Confirms an action on the control itself, then settles on a follow-up label. */
let flashTimer = 0;

function flashButton(btn: HTMLButtonElement, flash: string, after: string): void {
  window.clearTimeout(flashTimer);
  btn.textContent = flash;
  btn.dataset.flash = 'true';
  flashTimer = window.setTimeout(() => {
    btn.textContent = after;
    delete btn.dataset.flash;
  }, 1800);
}

/* ---------- settings & data ---------- */

function applySettingsToInputs(): void {
  const u = units();
  const speed = $<HTMLInputElement>('speed');
  $('speed-unit').textContent = speedUnit(u);
  // Round inward so every value the field allows also passes the km/h validation.
  speed.min = String(Math.ceil(kmhToDisplay(5, u)));
  speed.max = String(Math.floor(kmhToDisplay(60, u)));
  speed.value = displaySpeed();
  setFieldError(speed, null);
  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="units"]')) r.checked = r.value === u;
  $('units-now').textContent = u === 'metric' ? 'Showing km, km/h and °C.' : 'Showing miles, mph and °F.';
  $('units-switch').textContent = u === 'metric' ? 'Switch to miles' : 'Switch to km';

  const s = state.settings;
  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="pace"]')) r.checked = r.value === s.paceMode;
  show('speed-field', s.paceMode === 'constant');
  show('power-fields', s.paceMode === 'power');
  for (const span of document.querySelectorAll('.mass-unit')) span.textContent = massUnit(u);
  for (const span of document.querySelectorAll('.speed-unit-2')) span.textContent = speedUnit(u);
  for (const input of document.querySelectorAll<HTMLInputElement>('[data-rider]')) {
    const key = input.dataset.rider as keyof RiderParams;
    const conv = riderConverter(input);
    const [lo, hi] = RIDER_LIMITS[key];
    input.min = String(conv.toDisplay(lo));
    input.max = String(conv.toDisplay(hi));
    input.value = String(conv.toDisplay(s.rider[key]));
    setFieldError(input, null);
  }
  ($('p-exposure') as HTMLSelectElement).value = s.exposure;
  const stops = $<HTMLInputElement>('stops');
  stops.value = String(s.stopMinutes);
  setFieldError(stops, null);
}

/** The saved average speed as shown in the speed field (display units, nearest 0.5). */
function displaySpeed(): string {
  return String(Math.round(kmhToDisplay(state.settings.speedKmh, units()) * 2) / 2);
}

/** Display conversion for a rider field: masses in kg/lb, speeds in km/h/mph, others unchanged. */
function riderConverter(input: HTMLInputElement): { toDisplay: (v: number) => number; fromDisplay: (v: number) => number } {
  const u = units();
  const round = (v: number, step: number) => Math.round(v / step) * step;
  if ('mass' in input.dataset) return { toDisplay: (v) => round(kgToDisplay(v, u), 0.5), fromDisplay: (v) => displayToKg(v, u) };
  if ('speed' in input.dataset) return { toDisplay: (v) => Math.round(kmhToDisplay(v, u)), fromDisplay: (v) => displayToKmh(v, u) };
  return { toDisplay: (v) => v, fromDisplay: (v) => v };
}

function bindPaceForm(): void {
  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="pace"]')) {
    r.addEventListener('change', () => {
      state.settings.paceMode = r.value === 'power' ? 'power' : 'constant';
      persistSettings();
      applySettingsToInputs();
      state.sim = null;
      recompute();
      updateDepartureInput();
    });
  }
  for (const input of document.querySelectorAll<HTMLInputElement>('[data-rider]')) {
    input.addEventListener('change', () => {
      const key = input.dataset.rider as keyof RiderParams;
      const v = riderConverter(input).fromDisplay(Number.parseFloat(input.value));
      const [lo, hi] = RIDER_LIMITS[key];
      // Small tolerance so values rounded for display at the limits are accepted.
      if (!Number.isFinite(v) || v < lo * 0.995 || v > hi * 1.005) {
        // Keep what the rider typed so they can correct it; results keep the last valid value.
        const current = riderConverter(input).toDisplay(state.settings.rider[key]);
        setFieldError(input, `Enter a number from ${input.min} to ${input.max}. Still using ${current}.`);
        return;
      }
      setFieldError(input, null);
      state.settings.rider = { ...state.settings.rider, [key]: Math.min(hi, Math.max(lo, v)) };
      persistSettings();
      recompute();
      updateDepartureInput();
    });
  }
  $('p-exposure').addEventListener('change', (ev) => {
    const v = (ev.target as HTMLSelectElement).value;
    state.settings.exposure = (v === 'open' || v === 'sheltered' ? v : 'mixed') as Exposure;
    persistSettings();
    recompute();
  });
  $('stops').addEventListener('change', (ev) => {
    const input = ev.target as HTMLInputElement;
    const v = input.value.trim() === '' ? 0 : Number.parseFloat(input.value);
    if (!Number.isFinite(v) || v < 0 || v > MAX_STOP_MINUTES) {
      // Keep what the rider typed so they can correct it; results keep the last valid value.
      setFieldError(input, `Enter a number from 0 to ${MAX_STOP_MINUTES}. Still using ${state.settings.stopMinutes}.`);
      return;
    }
    setFieldError(input, null);
    state.settings.stopMinutes = Math.round(v);
    persistSettings();
    recompute();
    updateDepartureInput();
  });
  for (const b of document.querySelectorAll('.lookup-ele')) b.addEventListener('click', () => void lookupElevation());
  for (const b of document.querySelectorAll<HTMLElement>('.assume-flat')) {
    b.addEventListener('click', () => {
      state.assumeFlat = true;
      recompute();
      updateDepartureInput();
      setStatus('Estimating as if the route were flat. Results are labelled accordingly.', 'ok');
      // The button that was pressed is now hidden.
      $('verdict-head').focus();
    });
  }
  $('compare-spacing').addEventListener('change', () => renderComparison());
  $('compare-more').addEventListener('click', () => {
    state.showLateDepartures = !state.showLateDepartures;
    renderComparison();
    $('compare-more').focus();
  });
  // On phones the point-by-point table shows four columns; this reveals the rest.
  $('points-toggle').addEventListener('click', () => {
    const btn = $('points-toggle');
    const all = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(all));
    btn.textContent = all ? 'Fewer columns' : 'Show all columns';
    $('points-table').classList.toggle('show-all', all);
  });
  let lastWidth = 0;
  new ResizeObserver(([entry]) => {
    const w = Math.round(entry?.contentRect.width ?? 0);
    if (w && Math.abs(w - lastWidth) > 8 && state.sim) {
      lastWidth = w;
      renderCharts($('charts'), state.sim, { units: units(), power: currentPace().kind === 'power' });
    }
  }).observe($('charts'));
}

function persistSettings(): void {
  if (!store.saveSettings(state.settings)) {
    setStatus("Settings couldn't be saved in this browser, so they'll reset when you reload.", 'error');
  }
}

function downloadJson(filename: string, data: unknown): void {
  downloadFile(filename, JSON.stringify(data, null, 2), 'application/json');
}

function downloadFile(filename: string, text: string, type: string): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setUnits(u: UnitSystem): void {
  state.settings.units = u;
  persistSettings();
  applySettingsToInputs();
  renderRouteCard();
  recompute();
  if (drawing) renderDraft();
}

function bindDataDialog(): void {
  const dialog = $<HTMLDialogElement>('data-dialog');
  const status = $('data-status');
  $('open-data').addEventListener('click', () => {
    status.textContent = '';
    dialog.showModal();
  });

  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="units"]')) {
    r.addEventListener('change', () => setUnits(r.value === 'imperial' ? 'imperial' : 'metric'));
  }
  // The same choice, one tap away under Departure and pace.
  $('units-switch').addEventListener('click', () => setUnits(units() === 'metric' ? 'imperial' : 'metric'));

  $('export-btn').addEventListener('click', async () => {
    let routes: store.SavedRoute[] = [];
    try {
      routes = await store.listRoutes();
    } catch {
      /* export settings only */
    }
    downloadJson(`ridewind-export-${new Date().toISOString().slice(0, 10)}.json`, store.buildExport(state.settings, routes));
    status.textContent = `Exported settings and ${routes.length} saved route${routes.length === 1 ? '' : 's'}.`;
  });

  $<HTMLInputElement>('import-input').addEventListener('change', async (ev) => {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      if (file.size > MAX_GPX_BYTES) throw new AppError('IMPORT_INVALID', "That file is too large to be a RideWind export.");
      const data = store.parseImport(await file.text());
      for (const r of data.routes) await store.saveRoute(r);
      state.settings = data.settings;
      persistSettings();
      applySettingsToInputs();
      renderRouteCard();
      recompute();
      void renderSaved();
      status.textContent = `Imported settings and ${data.routes.length} route${data.routes.length === 1 ? '' : 's'}.`;
    } catch (e) {
      status.textContent = messageFor(e);
    }
  });

  $('delete-all-btn').addEventListener('click', async () => {
    if (!confirm("Delete all RideWind settings and saved routes from this browser? This can't be undone. Export first if you want a copy.")) return;
    store.clearSettings();
    try {
      await store.clearRoutes();
    } catch {
      /* storage unavailable: nothing saved */
    }
    state.settings = { ...store.DEFAULT_SETTINGS, units: defaultUnits() };
    state.savedId = null;
    applySettingsToInputs();
    renderRouteCard();
    recompute();
    void renderSaved();
    status.textContent = 'All local RideWind data has been deleted from this browser.';
  });
}

/* ---------- init ---------- */

/** Entry point, called once from main.ts: builds the map, restores settings and attaches every event handler. */
export function initApp(): void {
  map = new RouteMap($('map'));
  initPanelResize(document.querySelector<HTMLElement>('.layout')!, $('controls'), $('panel-resizer'));
  // The map pane changes size when the panel is resized; Leaflet only listens to the window.
  let mapResizeFrame = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(mapResizeFrame);
    mapResizeFrame = requestAnimationFrame(() => map.invalidateSize());
  }).observe($('map'));
  applySettingsToInputs();

  $<HTMLInputElement>('gpx-input').addEventListener('change', (ev) => {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void importGpxFile(file);
  });
  $<HTMLSelectElement>('sample-select').addEventListener('change', (ev) => {
    const select = ev.target as HTMLSelectElement;
    const opt = select.selectedOptions[0];
    if (opt?.value) void loadSample(opt.value, opt.text);
  });
  $('reverse-btn').addEventListener('click', () => {
    state.reversed = !state.reversed;
    applyRoute();
    updateDepartureInput();
    setStatus(state.reversed ? 'Route reversed.' : 'Route back in its original direction.', 'ok');
  });
  $('save-btn').addEventListener('click', () => void saveCurrentRoute());
  $('verdict-retry').addEventListener('click', () => void retryForecast($('verdict-retry')));
  $('verdict-refresh').addEventListener('click', () => void loadForecast());
  $('verdict-toggle').addEventListener('click', () => {
    verdictExpanded = !verdictExpanded;
    applyVerdictExpanded(verdictExpanded);
  });
  // Coming back to a tab left open: get a new forecast if this one is over an hour old (and we're online);
  // otherwise refresh the summary so an old forecast is flagged.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const fc = state.forecast;
    const stale = !!fc && (state.forecastFromCache || Date.now() - fc.fetchedAt >= STALE_FORECAST_MS);
    if (stale && navigator.onLine !== false && !state.abort) void loadForecast();
    else if (state.plan && state.sim) renderVerdict(state.plan, state.sim);
  });
  // Back online after showing a saved forecast: fetch a fresh one.
  window.addEventListener('online', () => {
    if (state.forecastFromCache && !state.abort) void loadForecast();
  });
  // On phones the verdict is a fixed bottom bar; reserve exactly its height so nothing hides behind it.
  new ResizeObserver(([entry]) => {
    const h = Math.ceil(entry?.borderBoxSize?.[0]?.blockSize ?? $('verdict').offsetHeight);
    document.body.style.setProperty('--verdict-h', `${h}px`);
  }).observe($('verdict'));
  bindCompactVerdict();
  // Same single request as a normal load; the departure time and settings are kept.
  $('refresh-forecast').addEventListener('click', () => void loadForecast());
  $('dep-earlier').addEventListener('click', () => shiftDeparture(-HOUR));
  $('dep-later').addEventListener('click', () => shiftDeparture(HOUR));

  $<HTMLInputElement>('departure').addEventListener('change', (ev) => {
    const v = (ev.target as HTMLInputElement).value;
    if (!v) return;
    try {
      setDeparture(wallTimeToUtc(v, state.tz));
    } catch (e) {
      setStatus(messageFor(e), 'error');
    }
  });

  // Apply valid speeds as you type (debounced); only complain once you leave the field.
  const applySpeed = (input: HTMLInputElement, strict: boolean) => {
    const kmh = displayToKmh(Number.parseFloat(input.value), units());
    if (!Number.isFinite(kmh) || kmh < 5 || kmh > 60) {
      // Keep what the rider typed so they can correct it; results keep the last valid speed.
      const unit = speedUnit(units());
      if (strict) setFieldError(input, `Enter a speed from ${input.min} to ${input.max} ${unit}. Still using ${displaySpeed()} ${unit}.`);
      return;
    }
    setFieldError(input, null);
    if (Math.abs(kmh - state.settings.speedKmh) < 1e-9) return;
    state.settings.speedKmh = kmh;
    persistSettings();
    updateDepartureInput();
    recompute();
  };
  let speedTimer = 0;
  const speedInput = $<HTMLInputElement>('speed');
  // Create the (empty) live regions up front so the first error is announced.
  for (const input of [speedInput, ...document.querySelectorAll<HTMLInputElement>('[data-rider]')]) fieldErrorFor(input);
  speedInput.addEventListener('input', () => {
    window.clearTimeout(speedTimer);
    speedTimer = window.setTimeout(() => applySpeed(speedInput, false), 400);
  });
  speedInput.addEventListener('change', () => {
    window.clearTimeout(speedTimer);
    applySpeed(speedInput, true);
  });

  bindDataDialog();
  bindPaceForm();
  bindDrawing();
  void renderSaved();
}
