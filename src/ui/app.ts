import { AppError, isAppError } from '../lib/errors';
import { cumulativeDistances, elevationStats, reverseRoute, sampleRoute, type Route, type Sample } from '../lib/geo';
import { MAX_GPX_BYTES, parseGpx } from '../lib/gpx';
import { planRide, type RidePlan, type SegmentClass } from '../lib/ride';
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
  displayToKmh,
  formatDistance,
  formatElevation,
  formatPrecip,
  formatSpeed,
  formatTemp,
  kmhToDisplay,
  speedUnit,
} from '../lib/units';
import { coordKey, fetchForecast, type ForecastBundle, type LocationForecast } from '../lib/weather';
import { compassPoint } from '../lib/wind';
import { CLASS_STYLE, RouteMap } from './map';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
};
const HOUR = 3600_000;
const SAMPLE_URL = `${import.meta.env.BASE_URL}samples/afsluitdijk-sample.gpx`;

interface State {
  original: Route | null;
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
  settings: store.loadSettings(),
  abort: null,
};

let map: RouteMap;

/* ---------- helpers ---------- */

function setStatus(message: string, kind: 'info' | 'error' | 'ok' = 'info'): void {
  const el = $('status');
  el.textContent = message;
  el.dataset.kind = kind;
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

function loadRoute(route: Route, opts: { isSample?: boolean; savedId?: string | null } = {}): void {
  state.original = route;
  state.reversed = false;
  state.isSample = !!opts.isSample;
  state.savedId = opts.savedId ?? null;
  state.forecast = null;
  state.departureMs = null;
  applyRoute();
  map.invalidateSize();
  map.fit();
  void loadForecast();
}

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
  const rev = $('reverse-btn');
  rev.setAttribute('aria-pressed', String(state.reversed));
  rev.textContent = state.reversed ? 'Reversed: ride original direction' : 'Reverse direction';
}

async function importGpxFile(file: File): Promise<void> {
  try {
    if (file.size > MAX_GPX_BYTES) {
      throw new AppError('GPX_TOO_LARGE', `That file is ${(file.size / 1048576).toFixed(0)} MB. RideWind accepts GPX files up to 25 MB.`);
    }
    const route = parseGpx(await file.text(), file.name.replace(/\.[^.]+$/, '') || 'Imported route');
    loadRoute(route);
    setStatus(`Loaded “${route.name}”.`, 'ok');
  } catch (e) {
    setStatus(`${messageFor(e)}${state.route ? ' Your previous route is still loaded.' : ''}`, 'error');
  }
}

async function loadSample(): Promise<void> {
  try {
    const res = await fetch(SAMPLE_URL);
    if (!res.ok) throw new Error(`sample HTTP ${res.status}`);
    loadRoute(parseGpx(await res.text(), 'Sample route'), { isSample: true });
    setStatus('Loaded the sample route. It is an approximate demonstration route.', 'ok');
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

async function loadForecast(): Promise<void> {
  if (!state.route) return;
  state.abort?.abort();
  const ctrl = new AbortController();
  state.abort = ctrl;
  show('wx-empty', false);
  show('wx-error', false);
  show('results', false);
  show('wx-loading', true);
  try {
    const fc = await fetchForecast(state.samples, { signal: ctrl.signal });
    if (ctrl.signal.aborted) return;
    state.forecast = fc;
    state.tzFromForecast = isValidTimeZone(fc.timezone);
    state.tz = state.tzFromForecast ? fc.timezone : deviceTimeZone();
  } catch (e) {
    if ((e as Error)?.name === 'AbortError' || ctrl.signal.aborted) return;
    state.forecast = null;
    state.tzFromForecast = false;
    state.tz = deviceTimeZone();
    $('wx-error-msg').textContent = messageFor(e);
    show('wx-error', true);
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
  const totalKm = (state.cum[state.cum.length - 1] ?? 0) / 1000;
  return (totalKm / state.settings.speedKmh) * HOUR;
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
}

/* ---------- results ---------- */

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
    // Sample positions changed (e.g. rounding after reversing): fetch for the new points.
    void loadForecast();
    return;
  }
  state.plan = planRide({
    points: state.route.points,
    cum: state.cum,
    samples: state.samples,
    forecasts,
    departureMs: state.departureMs,
    speedKmh: state.settings.speedKmh,
  });
  renderResults(state.plan);
  map.showPlan(state.plan, describePoint);
}

const CLASS_ORDER: SegmentClass[] = ['headwind', 'crosswind', 'tailwind', 'calm', 'unknown'];

function renderResults(plan: RidePlan): void {
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

  const mh = plan.summary.meanHeadwind;
  $('mean-headwind').textContent =
    mh === null
      ? ''
      : Math.abs(mh) < 1
        ? 'On average, wind along your direction of travel is roughly neutral.'
        : `Averaged over the route, the wind component along your direction of travel is about ${formatSpeed(Math.abs(mh), u)} of ${mh > 0 ? 'headwind' : 'tailwind'}.`;

  // KPIs
  const s = plan.summary;
  $('kpi-time').textContent = formatDuration(plan.durationMs);
  $('kpi-finish').textContent = `Finish about ${formatClock(plan.finishMs, tz)} at ${formatSpeed(state.settings.speedKmh, u)}`;
  $('kpi-wind').textContent =
    s.windSpeedMin === null ? dash : `${formatSpeed(s.windSpeedMin, u).split(' ')[0]}–${formatSpeed(s.windSpeedMax!, u)}`;
  $('kpi-gust').textContent = s.gustMax === null ? '' : `Gusts up to ${formatSpeed(s.gustMax, u)}`;
  $('kpi-temp').textContent = s.tempMin === null ? dash : `${formatTemp(s.tempMin, u)} to ${formatTemp(s.tempMax!, u)}`;
  $('kpi-rain').textContent = s.precipMax === null ? dash : s.precipMax < 0.05 ? 'Dry' : `Up to ${formatPrecip(s.precipMax, u)}/h`;
  $('kpi-rain-prob').textContent = s.precipProbabilityMax === null ? '' : `Highest chance ${Math.round(s.precipProbabilityMax)}%`;

  // Table
  const body = $('samples-body');
  body.replaceChildren();
  plan.samples.forEach((r, i) => {
    const tr = document.createElement('tr');
    const wx = r.weather;
    const c = r.components;
    const cells: Array<string | Node> = [
      `${i + 1} · ${formatDistance(r.sample.distanceM, u)}`,
      formatClock(r.etaMs, tz),
      wx?.windSpeed != null && wx.windDirection != null ? windCell(wx.windSpeed, wx.windDirection) : noData(),
      wx?.windGusts != null ? formatSpeed(wx.windGusts, u) : noData(),
      c ? `${formatSpeed(Math.abs(c.headwind), u)} ${c.headwind >= 0 ? 'head' : 'tail'}` : noData(),
      c ? `${formatSpeed(Math.abs(c.crosswind), u)} ${Math.abs(c.crosswind) < 0.5 ? '' : c.crosswind > 0 ? 'from right' : 'from left'}`.trim() : noData(),
      wx?.temperature != null ? formatTemp(wx.temperature, u) : noData(),
      wx?.precipitation != null
        ? `${formatPrecip(wx.precipitation, u)}${wx.precipitationProbability != null ? ` · ${Math.round(wx.precipitationProbability)}%` : ''}`
        : noData(),
    ];
    cells.forEach((content, ci) => {
      const td = document.createElement(ci === 0 ? 'th' : 'td');
      if (ci === 0) td.setAttribute('scope', 'row');
      if (ci === 4 && r.windClass) td.dataset.cls = r.windClass;
      td.append(content);
      tr.append(td);
    });
    body.append(tr);
  });

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
        loadRoute(store.unpackRoute(r), { savedId: r.id });
        setStatus(`Opened “${r.name}”.`, 'ok');
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
    setStatus(`Saved “${saved.name}” in this browser.`, 'ok');
    void renderSaved();
  } catch (e) {
    setStatus(messageFor(e), 'error');
  }
}

/* ---------- settings & data ---------- */

function applySettingsToInputs(): void {
  const u = units();
  const speed = $<HTMLInputElement>('speed');
  $('speed-unit').textContent = speedUnit(u);
  speed.min = String(Math.round(kmhToDisplay(5, u)));
  speed.max = String(Math.round(kmhToDisplay(60, u)));
  speed.value = String(Math.round(kmhToDisplay(state.settings.speedKmh, u) * 2) / 2);
  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="units"]')) r.checked = r.value === u;
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

export function initApp(): void {
  map = new RouteMap($('map'));
  applySettingsToInputs();

  $<HTMLInputElement>('gpx-input').addEventListener('change', (ev) => {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void importGpxFile(file);
  });
  $('sample-btn').addEventListener('click', () => void loadSample());
  $('reverse-btn').addEventListener('click', () => {
    state.reversed = !state.reversed;
    applyRoute();
    updateDepartureInput();
    setStatus(state.reversed ? 'Route reversed.' : 'Route back in its original direction.', 'ok');
  });
  $('save-btn').addEventListener('click', () => void saveCurrentRoute());
  $('retry-btn').addEventListener('click', () => void loadForecast());

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

  $<HTMLInputElement>('speed').addEventListener('change', (ev) => {
    const input = ev.target as HTMLInputElement;
    const kmh = displayToKmh(Number.parseFloat(input.value), units());
    if (!Number.isFinite(kmh) || kmh < 5 || kmh > 60) {
      setStatus(`Enter an average speed between ${input.min} and ${input.max} ${speedUnit(units())}.`, 'error');
      applySettingsToInputs();
      return;
    }
    state.settings.speedKmh = kmh;
    persistSettings();
    updateDepartureInput();
    recompute();
  });

  bindDataDialog();
  void renderSaved();
}
