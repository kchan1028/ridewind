import { AppError, isAppError } from '../lib/errors';
import { bestRow, compareRides, departureOptions, type CompareRow, type RouteVariant } from '../lib/compare';
import { applyElevations, elevationLookupCoords, fetchElevations } from '../lib/elevation';
import { cumulativeDistances, elevationStats, hasCompleteElevation, reverseRoute, sampleRoute, type Route, type Sample } from '../lib/geo';
import { MAX_GPX_BYTES, parseGpx } from '../lib/gpx';
import { RIDER_LIMITS, type Exposure, type RiderParams } from '../lib/physics';
import { planRide, type RidePlan, type SegmentClass } from '../lib/ride';
import { simulateRide, type PaceModel, type Simulation } from '../lib/simulate';
import { rideDaylight } from '../lib/daylight';
import { departurePresets } from '../lib/presets';
import { windVerdict } from '../lib/verdict';
import * as store from '../lib/storage';
import {
  deviceTimeZone,
  formatClock,
  formatDateTime,
  formatDuration,
  formatOffset,
  isValidTimeZone,
  utcToWallTime,
  wallTimeToUtc,
} from '../lib/time';
import {
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
} from '../lib/units';
import { coordKey, fetchForecast, type ForecastBundle, type LocationForecast } from '../lib/weather';
import { compassPoint } from '../lib/wind';
import { renderCharts } from './charts';
import { CLASS_STYLE, RouteMap } from './map';

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
  elevationBusy: boolean;
  settings: store.Settings;
  abort: AbortController | null;
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
  elevationBusy: false,
  settings: store.loadSettings(),
  abort: null,
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

function setVerdictMode(mode: VerdictMode, head: string, facts: string): void {
  const v = $('verdict');
  v.hidden = false;
  v.dataset.mode = mode;
  if (mode !== 'ready') delete v.dataset.tone;
  document.body.classList.add('has-verdict');
  $('verdict-head').textContent = head;
  $('verdict-facts').textContent = facts;
  show('verdict-detail', mode === 'ready');
  show('depart-stepper', mode === 'ready');
  show('verdict-retry', mode === 'error');
  const r = state.route;
  $('verdict-route').textContent = r
    ? `${r.name} · ${formatDistance(state.cum[state.cum.length - 1] ?? 0, units())}${state.reversed ? ' · reversed' : ''}`
    : '';
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
  if (s.precipMax !== null) {
    const p = s.precipProbabilityMax;
    facts.push(s.precipMax < 0.05 ? (p !== null && p >= 30 ? `rain ${Math.round(p)}% chance` : 'dry') : `rain up to ${formatPrecip(s.precipMax, u)}/h`);
  }
  facts.push(`${formatDuration(plan.durationMs)}, finish ${formatClock(plan.finishMs, tz)}${sim.assumedFlat ? ' (flat estimate)' : ''}`);
  const light = rideDaylight(state.departureMs!, plan.finishMs, forecastsForSamples()[0]?.sun);
  if (light.kind === 'starts-before-sunrise') facts.push(`starts in the dark (sunrise ${formatClock(light.sunriseMs!, tz)})`);
  else if (light.kind === 'ends-after-sunset') facts.push(`finishes after sunset (${formatClock(light.sunsetMs!, tz)})`);
  else if (light.kind === 'daylight') facts.push(`sunset ${formatClock(light.sunsetMs!, tz)}`);
  setVerdictMode('ready', headline, facts.join(' · '));
  $('verdict').dataset.tone = tone;
  $('depart-label').textContent = `Leave ${formatDateTime(state.departureMs!, tz)}`;
  const b = departureBounds();
  ($('dep-earlier') as HTMLButtonElement).disabled = !b || state.departureMs! - HOUR < b.min;
  ($('dep-later') as HTMLButtonElement).disabled = !b || state.departureMs! + HOUR > b.max;
  announce(`${headline}. ${facts.join(', ')}.`);
}

function shiftDeparture(deltaMs: number): void {
  const b = departureBounds();
  if (!b || state.departureMs === null) return;
  const next = state.departureMs + deltaMs;
  if (next < b.min || next > b.max) return;
  state.departureMs = next;
  updateDepartureInput();
  recompute();
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
function loadRoute(route: Route, opts: { isSample?: boolean; savedId?: string | null } = {}): void {
  state.original = route;
  state.reversed = false;
  state.isSample = !!opts.isSample;
  state.savedId = opts.savedId ?? null;
  state.forecast = null;
  state.departureMs = null;
  state.assumeFlat = false;
  state.sim = null;
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
  if (ele.gainM === null) {
    $('fact-gain').textContent = 'Unknown';
    $('fact-loss').textContent = 'Unknown';
    $('fact-range').textContent = 'Unknown';
    note.textContent = 'This file has no elevation data, so climbing is unknown. RideWind does not assume the route is flat.';
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
  show('legend', true);
  $('reverse-btn').setAttribute('aria-pressed', String(state.reversed));
  $('direction-note').textContent = state.reversed
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
  }
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
    state.tzFromForecast = isValidTimeZone(fc.timezone);
    state.tz = state.tzFromForecast ? fc.timezone : deviceTimeZone();
    if ($('status').textContent === loadingMsg) setStatus(`Forecast ready for “${name}”.`, 'ok');
  } catch (e) {
    if ((e as Error)?.name === 'AbortError' || ctrl.signal.aborted) return;
    state.forecast = null;
    state.tzFromForecast = false;
    state.tz = deviceTimeZone();
    const msg = messageFor(e);
    $('wx-error-msg').textContent = msg;
    show('wx-error', true);
    setStatus(msg, 'error');
    setVerdictMode('error', 'Forecast unavailable', msg);
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

function rideDurationMs(): number {
  if (state.sim) return state.sim.durationMs;
  const totalKm = (state.cum[state.cum.length - 1] ?? 0) / 1000;
  return (totalKm / state.settings.speedKmh) * HOUR;
}

function currentPace(): PaceModel {
  const s = state.settings;
  return s.paceMode === 'power' ? { kind: 'power', rider: s.rider, exposure: s.exposure } : { kind: 'constant', speedKmh: s.speedKmh };
}

/** Shows the elevation choice when a power estimate can't run on this route's elevation. */
function updateElevationGate(): void {
  const r = state.route;
  const needed = !!r && state.settings.paceMode === 'power' && !hasCompleteElevation(r.points);
  show('elevation-gate', needed && !state.assumeFlat);
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
      btn.setAttribute('aria-pressed', String(p.ms === state.departureMs));
      btn.addEventListener('click', () => {
        state.departureMs = p.ms;
        updateDepartureInput();
        recompute();
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
  map.showPlan(state.plan, describePoint);
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
  const departures = departureOptions(state.departureMs, fc.windowEndMs, rideDurationMs() * 1.3, spacingH * HOUR, 6);
  // Columns: the original GPX direction, then reversed.
  const variants = [variantFor(false), variantFor(true)];
  const rows = compareRides(variants, departures, pace, state.assumeFlat);
  const best = bestRow(rows, pace);
  $('compare-caption').textContent =
    pace.kind === 'power'
      ? 'Predicted ride time, share of distance into a headwind and highest chance of rain. Best is the shortest predicted time.'
      : 'Share of distance into a headwind, average wind along the route and highest chance of rain. Best is the least headwind (times are equal at a constant speed).';
  if (departures.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = 'No later departures fit inside the forecast window.';
    tr.append(td);
    body.append(tr);
    return;
  }
  const cell = (r: CompareRow | undefined, reverse: boolean) => {
    const td = document.createElement('td');
    if (!r) return td;
    const lines: string[] = [];
    if (pace.kind === 'power') lines.push(formatDuration(r.durationMs));
    lines.push(`${Math.round(r.headwindShare * 100)}% headwind`);
    if (pace.kind === 'constant' && r.meanHeadwind !== null)
      lines.push(`avg ${formatSpeed(Math.abs(r.meanHeadwind), u)} ${r.meanHeadwind >= 0 ? 'head' : 'tail'}`);
    if (r.precipProbabilityMax !== null) lines.push(`rain ${Math.round(r.precipProbabilityMax)}%`);
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
    btn.disabled = isCurrent;
    btn.setAttribute('aria-label', `Use departure ${formatDateTime(r.departureMs, tz)}, ${reverse ? 'reversed' : 'original'} direction`);
    btn.addEventListener('click', () => {
      state.departureMs = r.departureMs;
      if (state.reversed !== reverse) {
        state.reversed = reverse;
        applyRoute();
      } else recompute();
      updateDepartureInput();
      setStatus(`Using ${formatDateTime(r.departureMs, tz)}, ${reverse ? 'reversed' : 'original'} direction.`, 'ok');
    });
    td.append(' ', btn);
    return td;
  };
  for (const t of departures) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
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
  if (sim.assumedFlat) warn.push('Timing assumes a flat route because elevation is missing, so climbs and descents are not reflected.');
  if (state.settings.paceMode === 'power' && sim.stepsWithoutWeather > 0 && plan.summary.samplesWithoutForecast === 0)
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
  const power = state.settings.paceMode === 'power';
  $('kpi-time').textContent = formatDuration(plan.durationMs);
  $('kpi-time-tag').textContent = power ? (sim.assumedFlat ? 'physics estimate, flat' : 'physics estimate') : 'estimate';
  $('kpi-finish').textContent = power
    ? `Finish about ${formatClock(plan.finishMs, tz)} · average ${formatSpeed(sim.avgSpeedKmh, u)} at ${state.settings.rider.powerW} W`
    : `Finish about ${formatClock(plan.finishMs, tz)} at ${formatSpeed(state.settings.speedKmh, u)}`;
  $('kpi-wind').textContent =
    s.windSpeedMin === null ? dash : `${formatSpeed(s.windSpeedMin, u).split(' ')[0]}–${formatSpeed(s.windSpeedMax!, u)}`;
  $('kpi-gust').textContent = s.gustMax === null ? '' : `Gusts up to ${formatSpeed(s.gustMax, u)}`;
  $('kpi-temp').textContent = s.tempMin === null ? dash : `${formatTemp(s.tempMin, u)} to ${formatTemp(s.tempMax!, u)}`;
  $('kpi-rain').textContent = s.precipMax === null ? dash : s.precipMax < 0.05 ? 'Dry' : `Up to ${formatPrecip(s.precipMax, u)}/h`;
  $('kpi-rain-prob').textContent = s.precipProbabilityMax === null ? '' : `Highest chance ${Math.round(s.precipProbabilityMax)}%`;

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
        ? `${formatPrecip(wx.precipitation, u)}${wx.precipitationProbability != null ? ` · ${Math.round(wx.precipitationProbability)}%` : ''}`
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
    `Arrival times are in ${tz.replace(/_/g, ' ')}. Reload the route to refresh the forecast.`;
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
      meta.textContent = `Saved ${new Date(r.savedAt).toLocaleDateString()}`;
      const load = document.createElement('button');
      load.type = 'button';
      load.className = 'btn btn-small';
      load.textContent = 'Open';
      load.setAttribute('aria-label', `Open ${r.name}`);
      load.addEventListener('click', () => {
        setStatus(`Opened “${r.name}”.`, 'ok');
        loadRoute(store.unpackRoute(r), { savedId: r.id });
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
    const saved = store.packRoute(state.original, state.savedId ?? undefined);
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
  speed.value = String(Math.round(kmhToDisplay(state.settings.speedKmh, u) * 2) / 2);
  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="units"]')) r.checked = r.value === u;

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
  }
  ($('p-exposure') as HTMLSelectElement).value = s.exposure;
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
        const label = document.querySelector(`label[for="${input.id}"]`)?.textContent ?? 'This value';
        setStatus(`${label} must be between ${input.min} and ${input.max}.`, 'error');
        applySettingsToInputs();
        return;
      }
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
  for (const b of document.querySelectorAll('.lookup-ele')) b.addEventListener('click', () => void lookupElevation());
  $('assume-flat-btn').addEventListener('click', () => {
    state.assumeFlat = true;
    recompute();
    updateDepartureInput();
    setStatus('Estimating as if the route were flat. Results are labelled accordingly.', 'ok');
  });
  $('compare-spacing').addEventListener('change', () => renderComparison());
  let lastWidth = 0;
  new ResizeObserver(([entry]) => {
    const w = Math.round(entry?.contentRect.width ?? 0);
    if (w && Math.abs(w - lastWidth) > 8 && state.sim) {
      lastWidth = w;
      renderCharts($('charts'), state.sim, { units: units(), power: state.settings.paceMode === 'power' });
    }
  }).observe($('charts'));
}

function persistSettings(): void {
  if (!store.saveSettings(state.settings)) {
    setStatus("Settings couldn't be saved in this browser, so they'll reset when you reload.", 'error');
  }
}

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function bindDataDialog(): void {
  const dialog = $<HTMLDialogElement>('data-dialog');
  const status = $('data-status');
  $('open-data').addEventListener('click', () => {
    status.textContent = '';
    dialog.showModal();
  });

  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="units"]')) {
    r.addEventListener('change', () => {
      state.settings.units = r.value === 'imperial' ? 'imperial' : 'metric';
      persistSettings();
      applySettingsToInputs();
      renderRouteCard();
      recompute();
    });
  }

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
    state.settings = { ...store.DEFAULT_SETTINGS };
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
    select.value = '';
  });
  $('reverse-btn').addEventListener('click', () => {
    state.reversed = !state.reversed;
    applyRoute();
    updateDepartureInput();
    setStatus(state.reversed ? 'Route reversed.' : 'Route back in its original direction.', 'ok');
  });
  $('save-btn').addEventListener('click', () => void saveCurrentRoute());
  $('retry-btn').addEventListener('click', () => void loadForecast());
  $('verdict-retry').addEventListener('click', () => void loadForecast());
  $('dep-earlier').addEventListener('click', () => shiftDeparture(-HOUR));
  $('dep-later').addEventListener('click', () => shiftDeparture(HOUR));

  $<HTMLInputElement>('departure').addEventListener('change', (ev) => {
    const v = (ev.target as HTMLInputElement).value;
    if (!v) return;
    try {
      state.departureMs = wallTimeToUtc(v, state.tz);
      updateDepartureInput();
      recompute();
    } catch (e) {
      setStatus(messageFor(e), 'error');
    }
  });

  // Apply valid speeds as you type (debounced); only complain once you leave the field.
  const applySpeed = (input: HTMLInputElement, strict: boolean) => {
    const kmh = displayToKmh(Number.parseFloat(input.value), units());
    if (!Number.isFinite(kmh) || kmh < 5 || kmh > 60) {
      if (strict) {
        setStatus(`Enter an average speed between ${input.min} and ${input.max} ${speedUnit(units())}.`, 'error');
        applySettingsToInputs();
      }
      return;
    }
    if (Math.abs(kmh - state.settings.speedKmh) < 1e-9) return;
    state.settings.speedKmh = kmh;
    persistSettings();
    updateDepartureInput();
    recompute();
  };
  let speedTimer = 0;
  const speedInput = $<HTMLInputElement>('speed');
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
  void renderSaved();
}
