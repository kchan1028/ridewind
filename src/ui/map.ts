import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { bearingAtDistance, cumulativeDistances, pointAtDistance, type LatLon } from '../lib/geo';
import type { RidePlan, SegmentClass } from '../lib/ride';

/** Colours are paired with dash patterns so classes stay distinguishable without colour vision. */
export const CLASS_STYLE: Record<SegmentClass, { color: string; dashArray?: string; weight: number; label: string }> = {
  headwind: { color: '#c8102e', weight: 6, label: 'Headwind' },
  crosswind: { color: '#d98e04', dashArray: '10 7', weight: 6, label: 'Crosswind' },
  tailwind: { color: '#1f6fb2', weight: 6, label: 'Tailwind' },
  calm: { color: '#5f6b7a', dashArray: '2 8', weight: 5, label: 'Calm' },
  unknown: { color: '#8a94a3', dashArray: '1 6', weight: 4, label: 'No forecast' },
};

export class RouteMap {
  private map: L.Map;
  private baseLine: L.Polyline | null = null;
  private routeLayer = L.layerGroup();
  private planLayer = L.layerGroup();

  constructor(el: HTMLElement) {
    this.map = L.map(el, { zoomControl: true, attributionControl: true }).setView([52.2, 5.3], 7);
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
          html: `<svg viewBox="0 0 16 16" width="16" height="16" style="transform:rotate(${bearing}deg)" aria-hidden="true"><path d="M3 11 L8 5 L13 11"/></svg>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
        interactive: false,
        keyboard: false,
      }).addTo(this.routeLayer);
    }
    // Permanent labels; for loops, push them to opposite sides so they don't overlap.
    L.circleMarker([end.lat, end.lon], { radius: 8, color: '#14213d', weight: 3, fillColor: '#ffffff', fillOpacity: 1, interactive: false })
      .bindTooltip('Finish', { permanent: true, direction: 'right', offset: [8, 0], className: 'endpoint-label' })
      .addTo(this.routeLayer);
    L.circleMarker([start.lat, start.lon], { radius: 8, color: '#ffffff', weight: 3, fillColor: '#14213d', fillOpacity: 1, interactive: false })
      .bindTooltip('Start', { permanent: true, direction: 'left', offset: [-8, 0], className: 'endpoint-label endpoint-start' })
      .addTo(this.routeLayer);
    this.fit();
  }

  fit(): void {
    if (this.baseLine) this.map.fitBounds(this.baseLine.getBounds(), { padding: [24, 24] });
  }

  invalidateSize(): void {
    this.map.invalidateSize();
  }

  clearPlan(): void {
    this.planLayer.clearLayers();
  }

  showPlan(plan: RidePlan, describePoint: (index: number) => string): void {
    this.planLayer.clearLayers();
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
        html: `<svg viewBox="0 0 24 24" width="26" height="26" style="transform:rotate(${(dir + 180) % 360}deg)" aria-hidden="true"><path d="M12 2 L19 20 L12 16 L5 20 Z"/></svg>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      L.marker([r.sample.lat, r.sample.lon], { icon, keyboard: true, title: `Point ${i + 1} wind details` })
        .bindPopup(describePoint(i))
        .addTo(this.planLayer);
    });
  }
}
