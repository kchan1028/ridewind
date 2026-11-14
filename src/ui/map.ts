import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { bearingAtDistance, cumulativeDistances, haversineM, pointAtDistance, type LatLon } from '../lib/geo';
import { rainLevel, type RainLevel, type RidePlan, type SegmentClass } from '../lib/ride';

/** Start and finish closer than this are treated as one point (a loop). */
const LOOP_END_M = 200;

/** Band drawn under wet sections; it widens and darkens with rain strength, so width alone tells the levels apart. */
export const RAIN_STYLE: Record<Exclude<RainLevel, 'none'>, { weight: number; opacity: number }> = {
  light: { weight: 14, opacity: 0.45 },
  moderate: { weight: 20, opacity: 0.6 },
  heavy: { weight: 26, opacity: 0.75 },
};
const RAIN_COLOR = '#5b21b6';

/** Colours are paired with dash patterns so classes stay distinguishable without colour vision. */
export const CLASS_STYLE: Record<SegmentClass, { color: string; dashArray?: string; weight: number; label: string }> = {
  headwind: { color: '#c8102e', weight: 6, label: 'Headwind' },
  crosswind: { color: '#d98e04', dashArray: '10 7', weight: 6, label: 'Crosswind' },
  tailwind: { color: '#1f6fb2', weight: 6, label: 'Tailwind' },
  calm: { color: '#5f6b7a', dashArray: '2 8', weight: 5, label: 'Calm' },
  unknown: { color: '#8a94a3', dashArray: '1 6', weight: 4, label: 'No forecast' },
};

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * A small rotated SVG icon built with DOM APIs. The rotation is set through
 * element.style (CSSOM), which the Content Security Policy allows, rather than
 * an inline style="" attribute, which it blocks.
 */
function rotatedSvg(viewBox: string, size: number, d: string, degrees: number): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.style.transform = `rotate(${degrees}deg)`;
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}

/**
 * The Leaflet map. showRoute() draws the plain route when it loads; showPlan()
 * adds the wind-coloured sections and arrows once a forecast is matched, and
 * clearPlan() removes them again. Tiles come from tile.openstreetmap.org, which
 * the Content Security Policy in src/lib/csp.ts must allow.
 */
export class RouteMap {
  private map: L.Map;
  private baseLine: L.Polyline | null = null;
  private routeLayer = L.layerGroup();
  private planLayer = L.layerGroup();
  private drawLayer = L.layerGroup();
  private drawOff: (() => void) | null = null;

  constructor(el: HTMLElement) {
    this.map = L.map(el, { zoomControl: true, attributionControl: true }).setView([37.85, -122.2], 9); // San Francisco Bay Area
    // OSMF tile policy: this exact URL, visible attribution, no prefetching or offline caching.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);
    this.map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    this.routeLayer.addTo(this.map);
    this.planLayer.addTo(this.map);
  }

  showRoute(points: LatLon[]): void {
    this.routeLayer.clearLayers();
    this.planLayer.clearLayers();
    const latlngs = points.map((p) => [p.lat, p.lon] as [number, number]);
    this.baseLine = L.polyline(latlngs, { color: '#14213d', weight: 9, opacity: 0.25, interactive: false }).addTo(this.routeLayer);
    L.polyline(latlngs, { color: '#14213d', weight: 3, opacity: 0.8, interactive: false }).addTo(this.routeLayer);
    const start = points[0]!;
    const end = points[points.length - 1]!;
    // Direction of travel: small open chevrons, styled unlike the filled wind arrows.
    const cum = cumulativeDistances(points);
    const total = cum[cum.length - 1] ?? 0;
    const count = Math.min(10, Math.max(3, Math.round(total / 4000)));
    for (let k = 1; k <= count; k++) {
      const d = (total * k) / (count + 1);
      const p = pointAtDistance(points, cum, d);
      const bearing = bearingAtDistance(points, cum, d);
      L.marker([p.lat, p.lon], {
        icon: L.divIcon({
          className: 'dir-chevron',
          html: rotatedSvg('0 0 16 16', 16, 'M3 11 L8 5 L13 11', bearing),
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
        interactive: false,
        keyboard: false,
      }).addTo(this.routeLayer);
    }
    // A loop that ends where it starts gets one label instead of two overlapping ones.
    if (haversineM(start, end) <= LOOP_END_M) {
      L.circleMarker([start.lat, start.lon], { radius: 8, color: '#ffffff', weight: 3, fillColor: '#14213d', fillOpacity: 1, interactive: false })
        .bindTooltip('Start / Finish', { permanent: true, direction: 'top', offset: [0, -8], className: 'endpoint-label endpoint-start' })
        .addTo(this.routeLayer);
    } else {
      // Otherwise, push the labels to opposite sides so they don't overlap.
      L.circleMarker([end.lat, end.lon], { radius: 8, color: '#14213d', weight: 3, fillColor: '#ffffff', fillOpacity: 1, interactive: false })
        .bindTooltip('Finish', { permanent: true, direction: 'right', offset: [8, 0], className: 'endpoint-label' })
        .addTo(this.routeLayer);
      L.circleMarker([start.lat, start.lon], { radius: 8, color: '#ffffff', weight: 3, fillColor: '#14213d', fillOpacity: 1, interactive: false })
        .bindTooltip('Start', { permanent: true, direction: 'left', offset: [-8, 0], className: 'endpoint-label endpoint-start' })
        .addTo(this.routeLayer);
    }
    // While drawing, the route is hidden; don't move the rider's view.
    if (!this.drawOff) this.fit();
  }

  fit(): void {
    if (this.baseLine) this.map.fitBounds(this.baseLine.getBounds(), { padding: [24, 24] });
  }

  invalidateSize(): void {
    this.map.invalidateSize();
  }

  /**
   * Draw mode: the current route is hidden, and each click or tap on the map, or
   * Enter or Space while the map has focus (adding at the centre crosshair),
   * calls `onAdd`. Double-click zoom is off so a quick second tap adds a point.
   */
  startDrawing(onAdd: (p: LatLon) => void): void {
    this.stopDrawing();
    const container = this.map.getContainer();
    this.map.removeLayer(this.routeLayer);
    this.map.removeLayer(this.planLayer);
    this.drawLayer.clearLayers().addTo(this.map);
    this.map.doubleClickZoom.disable();
    container.classList.add('is-drawing');
    const label = container.getAttribute('aria-label') ?? '';
    container.setAttribute(
      'aria-label',
      'Map for drawing a route. Use the arrow keys to move the map and press Enter to add a point at the centre crosshair.',
    );
    const onClick = (e: L.LeafletMouseEvent) => {
      const ll = e.latlng.wrap();
      onAdd({ lat: ll.lat, lon: ll.lng });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.target !== container || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      onAdd(this.center());
    };
    this.map.on('click', onClick);
    container.addEventListener('keydown', onKey);
    this.drawOff = () => {
      this.map.off('click', onClick);
      container.removeEventListener('keydown', onKey);
      container.classList.remove('is-drawing');
      container.setAttribute('aria-label', label);
      this.map.doubleClickZoom.enable();
      this.map.removeLayer(this.drawLayer);
      this.routeLayer.addTo(this.map);
      this.planLayer.addTo(this.map);
    };
  }

  /** Leaves draw mode and shows the current route again. */
  stopDrawing(): void {
    this.drawOff?.();
    this.drawOff = null;
  }

  center(): LatLon {
    const c = this.map.getCenter().wrap();
    return { lat: c.lat, lon: c.lng };
  }

  /** Redraws the draft: straight legs between the points, with the first point marked. */
  showDraft(points: LatLon[]): void {
    this.drawLayer.clearLayers();
    const latlngs = points.map((p) => [p.lat, p.lon] as [number, number]);
    if (latlngs.length > 1) L.polyline(latlngs, { color: '#14213d', weight: 4, opacity: 0.9, dashArray: '8 6', interactive: false }).addTo(this.drawLayer);
    latlngs.forEach((ll, i) => {
      const first = i === 0;
      L.circleMarker(ll, {
        radius: first ? 8 : 5,
        color: first ? '#ffffff' : '#14213d',
        weight: first ? 3 : 2,
        fillColor: first ? '#14213d' : '#ffffff',
        fillOpacity: 1,
        interactive: false,
      }).addTo(this.drawLayer);
    });
  }

  clearPlan(): void {
    this.planLayer.clearLayers();
  }

  showPlan(plan: RidePlan, describePoint: (index: number) => string, rainLabel: (mmPerH: number) => string): void {
    this.planLayer.clearLayers();
    for (const seg of plan.segments) {
      if (seg.rain === 'none') continue;
      L.polyline(seg.latlngs, { ...RAIN_STYLE[seg.rain], color: RAIN_COLOR, lineCap: 'round', interactive: false }).addTo(this.planLayer);
    }
    for (const seg of plan.segments) {
      const s = CLASS_STYLE[seg.windClass];
      L.polyline(seg.latlngs, { color: s.color, weight: s.weight, dashArray: s.dashArray, opacity: 0.95, lineCap: 'butt', interactive: false }).addTo(
        this.planLayer,
      );
    }
    plan.samples.forEach((r, i) => {
      const dir = r.weather?.windDirection;
      if (dir === null || dir === undefined) return;
      // Meteorological direction is where wind comes FROM; the arrow shows where it goes.
      const icon = L.divIcon({
        className: 'wind-arrow',
        html: rotatedSvg('0 0 24 24', 26, 'M12 2 L19 20 L12 16 L5 20 Z', (dir + 180) % 360),
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      // Not a tab stop: the point-by-point table carries the same data for keyboard users.
      L.marker([r.sample.lat, r.sample.lon], { icon, keyboard: false, title: `Point ${i + 1} wind details` })
        .bindPopup(describePoint(i))
        .addTo(this.planLayer);
    });
    // Raindrop tags beside each wet point, offset so they sit next to the wind arrow rather than on it.
    plan.samples.forEach((r) => {
      const mm = r.weather?.precipitation;
      if (mm === null || mm === undefined || rainLevel(mm) === 'none') return;
      const tag = document.createElement('span');
      tag.className = `rain-tag rain-${rainLevel(mm)}`;
      tag.append(rotatedSvg('0 0 12 16', 10, 'M6 1 C6 1 1 7.5 1 10.5 A5 5 0 0 0 11 10.5 C11 7.5 6 1 6 1 Z', 0), rainLabel(mm));
      L.marker([r.sample.lat, r.sample.lon], {
        icon: L.divIcon({ className: 'rain-tag-icon', html: tag, iconSize: undefined, iconAnchor: [-14, 24] }),
        interactive: false,
        keyboard: false,
      }).addTo(this.planLayer);
    });
  }
}
