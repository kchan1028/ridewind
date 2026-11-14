import type { SimStep, Simulation } from '../lib/simulate';
import { formatDistance, kmhToDisplay, speedUnit, type UnitSystem } from '../lib/units';
import { classifyWind } from '../lib/wind';

const NS = 'http://www.w3.org/2000/svg';
const PAD = { l: 46, r: 10, t: 8, b: 22 };

interface Panel {
  title: string;
  tag: 'Forecast' | 'Calculated' | 'Estimate' | 'From route';
  height: number;
  summary: string;
  /** Column heading and value for the chart's data table, or none when there's nothing to list. */
  data?: { heading: string; value: (s: SimStep) => string };
  draw: (g: SVGGElement, x: (d: number) => number, w: number, h: number) => void;
}

function el<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  parent?.append(n);
  return n;
}

function text(parent: Element, x: number, y: number, s: string, cls = 'ch-label', anchor = 'end'): void {
  const t = el('text', { x, y, class: cls, 'text-anchor': anchor }, parent);
  t.textContent = s;
}

function linePath(pts: Array<[number, number]>): string {
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
}

function niceRange(min: number, max: number, minSpan: number): [number, number] {
  if (max - min < minSpan) {
    const mid = (max + min) / 2;
    return [mid - minSpan / 2, mid + minSpan / 2];
  }
  const pad = (max - min) * 0.08;
  return [min - pad, max + pad];
}

const fmt = (v: number) => Math.round(v).toLocaleString();

function yAxis(g: SVGGElement, lo: number, hi: number, h: number, label: (v: number) => string): (v: number) => number {
  const y = (v: number) => h - ((v - lo) / (hi - lo)) * h;
  for (const v of [lo, (lo + hi) / 2, hi]) {
    el('line', { x1: 0, x2: '100%', y1: y(v), y2: y(v), class: 'ch-grid' }, g);
    text(g, -6, y(v) + 4, label(v));
  }
  return y;
}

function mid(s: SimStep): number {
  return (s.startM + s.endM) / 2;
}

/** About this many rows in each chart's data table, so it stays readable on long routes. */
const TABLE_ROWS = 20;

/** The numbers behind a chart, in a collapsed table that screen readers and keyboard users can open. */
function dataTable(title: string, data: NonNullable<Panel['data']>, steps: SimStep[], u: UnitSystem): HTMLDetailsElement {
  const details = document.createElement('details');
  details.className = 'chart-data';
  const summary = document.createElement('summary');
  summary.textContent = `${title}: show the data`;
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  const table = document.createElement('table');
  table.className = 'samples';
  const head = table.createTHead().insertRow();
  for (const label of ['Distance', data.heading]) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    head.append(th);
  }
  const body = table.createTBody();
  const stride = Math.max(1, Math.ceil(steps.length / TABLE_ROWS));
  for (let i = 0; i < steps.length; i += stride) {
    const s = steps[i]!;
    const row = body.insertRow();
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = formatDistance(mid(s), u);
    row.append(th);
    row.insertCell().textContent = data.value(s);
  }
  wrap.append(table);
  details.append(summary, wrap);
  return details;
}

/** Renders elevation, wind, speed and weather along the route as small multiples sharing a distance axis. */
export function renderCharts(container: HTMLElement, sim: Simulation, opts: { units: UnitSystem; power: boolean }): void {
  const u = opts.units;
  const steps = sim.steps;
  // Charts redraw on resize; keep any data table the reader had opened.
  const open = new Set([...container.querySelectorAll<HTMLDetailsElement>('details.chart-data[open]')].map((d) => d.dataset.chart));
  container.replaceChildren();
  if (steps.length === 0) return;
  const total = steps[steps.length - 1]!.endM;
  // Minus 2 px for the figure border so the SVG never clips.
  const width = Math.max(280, Math.floor(container.clientWidth || 600) - 2);
  const innerW = width - PAD.l - PAD.r;
  const x = (d: number) => (d / total) * innerW;
  const panels: Panel[] = [];

  // Elevation, with the wind class as a strip underneath
  const withEle = steps.filter((s) => s.eleM !== null);
  if (withEle.length === steps.length) {
    const toU = (m: number) => (u === 'metric' ? m : m * 3.28084);
    const unit = u === 'metric' ? 'm' : 'ft';
    const eles = withEle.map((s) => toU(s.eleM!));
    let [lo, hi] = niceRange(Math.min(...eles), Math.max(...eles), u === 'metric' ? 20 : 60);
    // Padding should not invent below-sea-level values for a route that never goes there.
    if (Math.min(...eles) >= 0 && lo < 0) [lo, hi] = [0, hi - lo];
    panels.push({
      title: 'Elevation',
      tag: 'From route',
      height: 90,
      summary: `Elevation from ${fmt(Math.min(...eles))} to ${fmt(Math.max(...eles))} ${unit} over ${formatDistance(total, u)}. A strip below shows headwind, crosswind and tailwind sections.`,
      data: {
        heading: `Elevation (${unit}) and wind`,
        value: (s) => {
          const w = s.weather;
          const cls = w && w.windSpeed !== null && w.windDirection !== null ? classifyWind(w.windSpeed, w.windDirection, s.bearing) : 'no forecast';
          return `${fmt(toU(s.eleM!))} · ${cls}`;
        },
      },
      draw(g, xs, _w, h) {
        const y = yAxis(g, lo, hi, h - 8, (v) => `${fmt(v)} ${unit}`);
        const pts = steps.map((s) => [xs(mid(s)), y(toU(s.eleM!))] as [number, number]);
        el('path', { d: `${linePath(pts)}L${xs(total)},${h - 8}L0,${h - 8}Z`, class: 'ch-area' }, g);
        el('path', { d: linePath(pts), class: 'ch-line' }, g);
        for (const s of steps) {
          const w = s.weather;
          const cls = w && w.windSpeed !== null && w.windDirection !== null ? classifyWind(w.windSpeed, w.windDirection, s.bearing) : 'unknown';
          el('rect', { x: xs(s.startM), y: h - 6, width: Math.max(0.5, xs(s.endM) - xs(s.startM)), height: 6, class: `ch-strip wb-${cls}` }, g);
        }
      },
    });
  } else {
    panels.push({
      title: 'Elevation',
      tag: 'From route',
      height: 40,
      summary: 'Elevation is missing for this route, so no profile is shown.',
      draw(g, _x, w, h) {
        text(g, w / 2, h / 2 + 4, 'No elevation data. Not drawn as flat.', 'ch-empty', 'middle');
      },
    });
  }

  // Headwind component
  const heads = steps.map((s) => s.headwind10Kmh);
  const known = heads.filter((v): v is number => v !== null);
  if (known.length) {
    const mx = Math.max(10, ...known.map(Math.abs));
    const lo = -kmhToDisplay(mx, u);
    const hi = kmhToDisplay(mx, u);
    panels.push({
      title: 'Wind along your direction (10 m)',
      tag: 'Calculated',
      height: 90,
      data: {
        heading: `Headwind (${speedUnit(u)}, negative is tailwind)`,
        value: (s) => (s.headwind10Kmh === null ? 'no forecast' : fmt(kmhToDisplay(s.headwind10Kmh, u))),
      },
      summary: `Headwind component from ${fmt(kmhToDisplay(Math.min(...known), u))} to ${fmt(kmhToDisplay(Math.max(...known), u))} ${speedUnit(u)}. Positive is headwind, negative is tailwind.`,
      draw(g, xs, _w, h) {
        const y = yAxis(g, lo, hi, h, (v) => `${v > 0 ? '+' : ''}${fmt(v)}`);
        el('line', { x1: 0, x2: xs(total), y1: y(0), y2: y(0), class: 'ch-zero' }, g);
        const defs = el('defs', {}, g);
        el('rect', { x: 0, y: 0, width: xs(total), height: y(0) }, el('clipPath', { id: 'ch-clip-head' }, defs));
        el('rect', { x: 0, y: y(0), width: xs(total), height: h - y(0) }, el('clipPath', { id: 'ch-clip-tail' }, defs));
        let run: Array<[number, number]> = [];
        const flush = () => {
          if (run.length > 1) {
            const area = `${linePath(run)}L${run[run.length - 1]![0]},${y(0)}L${run[0]![0]},${y(0)}Z`;
            el('path', { d: area, class: 'ch-head-area', 'clip-path': 'url(#ch-clip-head)' }, g);
            el('path', { d: area, class: 'ch-tail-area', 'clip-path': 'url(#ch-clip-tail)' }, g);
            el('path', { d: linePath(run), class: 'ch-line' }, g);
          }
          run = [];
        };
        steps.forEach((s, i) => {
          const v = heads[i];
          if (v === null || v === undefined) return flush();
          run.push([xs(mid(s)), y(kmhToDisplay(v, u))]);
        });
        flush();
        text(g, 4, 11, 'headwind', 'ch-note', 'start');
        text(g, 4, h - 3, 'tailwind', 'ch-note', 'start');
      },
    });
  }

  // Predicted speed
  if (opts.power) {
    const speeds = steps.map((s) => kmhToDisplay(s.speedKmh, u));
    const hi = Math.max(...speeds) * 1.08;
    panels.push({
      title: 'Predicted speed',
      tag: 'Estimate',
      height: 80,
      data: { heading: `Speed (${speedUnit(u)})`, value: (s) => fmt(kmhToDisplay(s.speedKmh, u)) },
      summary: `Predicted speed from ${fmt(Math.min(...speeds))} to ${fmt(Math.max(...speeds))} ${speedUnit(u)}, averaging ${fmt(kmhToDisplay(sim.avgSpeedKmh, u))}.`,
      draw(g, xs, _w, h) {
        const y = yAxis(g, 0, hi, h, (v) => fmt(v));
        el('path', { d: linePath(steps.map((s, i) => [xs(mid(s)), y(speeds[i]!)])), class: 'ch-line ch-speed' }, g);
      },
    });
  }

  // Temperature and rain
  const temps = steps.map((s) => s.weather?.temperature ?? null);
  const kt = temps.filter((v): v is number => v !== null);
  if (kt.length) {
    const toU = (c: number) => (u === 'metric' ? c : (c * 9) / 5 + 32);
    const unit = u === 'metric' ? '°C' : '°F';
    const [lo, hi] = niceRange(Math.min(...kt.map(toU)), Math.max(...kt.map(toU)), 4);
    const rain = steps.map((s) => s.weather?.precipitation ?? 0);
    const rainMax = Math.max(...rain);
    panels.push({
      title: 'Temperature and rain',
      tag: 'Forecast',
      height: 80,
      data: {
        heading: `Temperature (${unit}) and rain (mm/h)`,
        value: (s) => {
          const t = s.weather?.temperature;
          return t === null || t === undefined ? 'no forecast' : `${fmt(toU(t))} · ${(s.weather?.precipitation ?? 0).toFixed(1)}`;
        },
      },
      summary: `Temperature from ${fmt(Math.min(...kt.map(toU)))} to ${fmt(Math.max(...kt.map(toU)))}${unit}. ${rainMax > 0.05 ? `Rain up to ${rainMax.toFixed(1)} mm per hour.` : 'No rain forecast.'}`,
      draw(g, xs, _w, h) {
        if (rainMax > 0.05) {
          for (let i = 0; i < steps.length; i++) {
            const r = rain[i]!;
            if (r <= 0) continue;
            const bh = (r / Math.max(rainMax, 1)) * h * 0.6;
            el('rect', { x: xs(steps[i]!.startM), y: h - bh, width: Math.max(0.5, xs(steps[i]!.endM) - xs(steps[i]!.startM)), height: bh, class: 'ch-rain' }, g);
          }
          text(g, xs(total), 11, `rain bars, max ${rainMax.toFixed(1)} mm/h`, 'ch-note');
        }
        const y = yAxis(g, lo, hi, h, (v) => `${fmt(v)}${unit}`);
        let run: Array<[number, number]> = [];
        steps.forEach((s, i) => {
          const t = temps[i];
          if (t === null || t === undefined) {
            if (run.length > 1) el('path', { d: linePath(run), class: 'ch-line ch-temp' }, g);
            run = [];
            return;
          }
          run.push([xs(mid(s)), y(toU(t))]);
        });
        if (run.length > 1) el('path', { d: linePath(run), class: 'ch-line ch-temp' }, g);
      },
    });
  }

  for (const p of panels) {
    const fig = document.createElement('figure');
    fig.className = 'chart';
    const cap = document.createElement('figcaption');
    const title = document.createElement('span');
    title.textContent = p.title;
    const tag = document.createElement('span');
    tag.className = `src ${p.tag === 'Forecast' ? 'src-fc' : 'src-est'}`;
    tag.textContent = p.tag.toLowerCase();
    cap.append(title, ' ', tag);
    const svg = el('svg', { width, height: p.height + PAD.t + PAD.b, role: 'img', 'aria-label': `${p.title}: ${p.summary}` });
    const g = el('g', { transform: `translate(${PAD.l},${PAD.t})` }, svg);
    p.draw(g, x, innerW, p.height);
    const ticks = 4;
    for (let k = 0; k <= ticks; k++) {
      const d = (total * k) / ticks;
      text(g, x(d), p.height + 16, formatDistance(d, u), 'ch-label', k === 0 ? 'start' : k === ticks ? 'end' : 'middle');
    }
    fig.append(cap, svg);
    if (p.data) {
      const details = dataTable(p.title, p.data, steps, u);
      details.dataset.chart = p.title;
      details.open = open.has(p.title);
      fig.append(details);
    }
    container.append(fig);
  }
}
