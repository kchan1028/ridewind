# RideWind features

Inventory of the local checkout on 15 November 2026, including existing uncommitted work. Implementation presence does not establish production deployment or completed manual verification.

| Capability | Implementation | Requirements |
| --- | --- | --- |
| GPX import and bundled samples | `src/lib/gpx.ts`, `public/samples/` | R01 |
| Road-following/straight drawing, editing, review and GPX export | `src/lib/route-editor.ts`, `src/lib/draw.ts`, `src/lib/routing.ts` | R02 |
| Place search and suggestions | `src/lib/geocode.ts` | R02, Q06 |
| Sampled, time-matched forecasts | `src/lib/geo.ts`, `src/lib/weather.ts`, `src/lib/forecast-match.ts` | R03 |
| Route-timezone departure and presets | `src/lib/time.ts`, `src/lib/presets.ts` | R04 |
| Average-speed and power-based estimates | `src/lib/simulate.ts`, `src/lib/physics.ts`, `src/lib/wind.ts` | R05 |
| Elevation lookup and explicit flat estimate | `src/lib/elevation.ts`, `src/ui/app.ts` | R06 |
| General stop allowance and positioned stops | `src/lib/stops.ts`, `src/lib/simulate.ts`, `src/ui/app.ts` | R07 |
| Wind verdict, daylight, charts, map and data tables | `src/lib/verdict.ts`, `src/lib/daylight.ts`, `src/ui/charts.ts`, `src/ui/map.ts` | R08 |
| Departure and direction comparison | `src/lib/compare.ts` | R09 |
| Forecast refresh, age and retry | `src/lib/weather.ts`, `src/ui/app.ts` | R10 |
| Saved routes, settings, backup and deletion | `src/lib/storage.ts`, `src/ui/app.ts` | R11 |
| Metric/imperial units and appearance choices | `src/lib/units.ts`, `src/lib/appearance.ts`, `src/styles.css` | R12 |
| Cached app shell and saved forecasts | `public/sw.js`, `src/main.ts`, `src/lib/storage.ts` | Q04 |
| Responsive layout and resizable desktop panel | `src/styles.css`, `src/ui/panel-resize.ts` | Q03 |

Requirement IDs refer to [REQUIREMENTS.md](REQUIREMENTS.md).

## Limits and pending work

- Forecast requests cover up to 40 sampled positions and request 16 days; usable coverage depends on the response and arrival times.
- Default providers are Open-Meteo, OpenStreetMap tiles, FOSSGIS Valhalla and Photon. Network availability and provider limits affect results.
- Saved drawings retain geometry rather than editable control points. Editing saved control points and freehand road-snapping remain roadmap proposals.
- Offline use depends on previously stored app files and forecasts. Fresh weather, map tiles, search and routing require a connection.
- Accessibility provisions do not establish complete screen reader, high-contrast or real-phone verification.

See [ROADMAP.md](ROADMAP.md) for recorded delivery status, [the model](docs/model.md) for calculation limits and [privacy](docs/data-and-privacy.md) for service disclosures.
