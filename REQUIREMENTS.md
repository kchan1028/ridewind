# RideWind requirements

Baseline: 15 November 2026. These are expected behaviors, not a claim that all acceptance scenarios have been verified. See [product](PRODUCT.md), [features](FEATURES.md) and [roadmap](ROADMAP.md).

## Functional requirements

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| R01 | Load routes | Import GPX tracks/routes, samples and saved routes; reject invalid files with an actionable error. Discard recorded timestamps and sensor data. |
| R02 | Draw routes | Add, move, insert and remove points; undo/redo; reverse; close loops; select road-following or straight new sections; review before use; export GPX. Failed routing preserves the last complete drawing. |
| R03 | Match weather to arrival | Sample approximately every 5 km, up to 40 positions; match hourly forecasts to estimated arrival. Identify incomplete forecast coverage. |
| R04 | Set departure | Date, time, presets and hour adjustments use the route timezone and recalculate the result. |
| R05 | Estimate pace | Support average speed and power-based estimates using rider/bike setup, slope and wind. Keep invalid entries visible with field errors. |
| R06 | Handle elevation | Show missing climbing as unknown; offer explicit lookup or a labelled flat estimate. Never silently assume flat terrain. |
| R07 | Include stops | Pauses shift downstream arrival and finish. Reversal preserves positioned stops' physical locations. Reject invalid distances and excessive total stop time. |
| R08 | Explain conditions | Show wind verdict and breakdown, gusts, temperature, rain, duration, finish and daylight, supported by map, charts and tables. |
| R09 | Compare options | Compare start times and directions. Explain ranking and close calls; exclude incomplete forecasts and known darkness from recommendations. |
| R10 | Recover from failures | Distinguish network, timeout, rate-limit and response failures; retain route and allow retry. Show forecast age and refresh. |
| R11 | Save locally | Persist routes and settings on device; provide export/import and explicit deletion. Distinguish cached forecasts from fresh data. |
| R12 | Respect preferences | Support metric/imperial units and system/light/dark appearance with consistent labels and visual states. |

## Quality requirements

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| Q01 | Privacy | Parse GPX locally; round weather coordinates to three decimals and optional elevation coordinates to four. Disclose exact routing points and external search requests. No accounts or analytics in the baseline. |
| Q02 | Accessibility | Label controls; preserve keyboard focus; provide text status/errors and chart tables. Do not rely on colour alone. Target controls at least 44 px high. Track screen reader and high-contrast verification explicitly. |
| Q03 | Responsive layout | Core planning works on phones without page-wide horizontal scrolling; desktop offers a resizable panel beside the map. |
| Q04 | Offline honesty | Support cached app files and saved forecasts without promising fresh weather, routing, search or map tiles offline. Never cache map tiles in the service worker. |
| Q05 | Maintainability | Keep calculations/service clients in `src/lib/` and UI orchestration in `src/ui/`; test meaningful calculation changes. |
| Q06 | External services | Maintain attribution, bounded requests and actionable errors. Review provider terms when changing usage or commercial scope. |

## Release review

Identify affected requirement IDs and check the relevant calculation, desktop, phone, keyboard and failure scenarios. Follow [CONTRIBUTING.md](CONTRIBUTING.md) for code checks. Documentation-only changes need content and link review rather than app execution.
