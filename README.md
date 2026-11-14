# RideWind

A personal cycling weather app. Load a GPX route, pick a departure time, and see the forecast wind, gusts, temperature and rain at the points you'll reach along the way. Each section of the route is coloured by headwind, tailwind or crosswind.

It's a static web page with no backend, accounts or database. It's built for personal, non-commercial use.

## What it does

- Imports GPX files with track points (`<trkpt>`) or route points (`<rtept>`), and includes three San Francisco Bay Area sample routes you can pick from a list (Berkeley to Morgan Territory, China Camp – Nicasio Valley, PRS clockwise). The map opens on the Bay Area.
- Shows the route on an OpenStreetMap map with its distance and any elevation data the file contains. If a file has no elevation, climbing is shown as **unknown**, not as zero.
- Lets you choose a departure time in the **route's own timezone**, which Open-Meteo works out from the coordinates, and reverse the route's direction.
- Estimates when you'll reach each point, either from a constant average speed or from a **power-based physics model** that uses your power, weight, drag, rolling resistance, the gradient and the forecast wind. It then matches each point to the forecast for that time.
- Predicts ride time and finish time, and **compares departure times and both route directions** to find the least windy or quickest option.
- Draws **charts along the route**: elevation (with a headwind/tailwind strip), wind along your direction, predicted speed, and temperature with rain.
- Can **look up terrain elevation** for routes without it, but only when you ask.
- Calculates headwind and crosswind components from the route's direction and the forecast wind, and colours the map with a legend.
- Saves settings and, if you choose, routes in your browser, with export, import and delete controls.

## Run it locally

Requires Node.js 20.19 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # type-check and production build into dist/
```

No API keys or environment variables are needed.

## Project layout

```
src/lib/          Pure logic, no DOM except GPX parsing
  gpx.ts            GPX → route (track or route points)
  geo.ts            distance, bearing, sampling, elevation stats
  weather.ts        Open-Meteo client and response validation
  forecast-match.ts forecast value at an arrival time
  wind.ts           head/cross components and classification
  ride.ts           combines the above into a ride plan
  physics.ts        cycling power model (Martin et al. 1998)
  simulate.ts       steps along the route: speed, timing, weather per step
  compare.ts        departure-time and direction comparison
  elevation.ts      opt-in Open-Meteo elevation lookup
  time.ts           route-timezone conversions
  storage.ts        localStorage settings, IndexedDB routes, export/import
src/ui/           Leaflet map and DOM wiring
tests/            Vitest unit tests
public/samples/   The bundled sample routes
```

## Weather data and attribution

Weather comes from the [Open-Meteo Forecast API](https://open-meteo.com/en/docs), called directly from the browser. This was checked in November 2026:

- **Terms:** the free API is for non-commercial use only. It is limited to fewer than 10,000 calls a day, 5,000 an hour and 600 a minute (300,000 a month), and needs no API key. Each location in a request counts as one call. A 16-day request for one point with 6 hourly variables plus daily sunrise and sunset costs 1 call, which was confirmed from the `X-RateLimit-Cost` header.
- **Daylight:** the same request returns sunrise and sunset. The verdict uses the start point's times to note when a ride starts before sunrise or finishes after sunset; otherwise it shows the sunset time.
- **Usage per route:** RideWind sends one request per loaded route, covering up to 20 points spaced evenly along it, so loading a route costs about 20 calls. The 16-day hourly forecast is cached in memory, so changing the departure time, speed or direction doesn't call the API again. To refresh the forecast, load the route again.
- **Privacy:** coordinates are rounded to 3 decimal places (about 100 m) before they're sent.
- **Licence:** the data is [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The app shows "Weather data by Open-Meteo.com" with links wherever forecast data appears, and notes that RideWind derives its estimates from that data.
- **Errors:** rate limiting (HTTP 429 or a "limit exceeded" reason), network failures, server errors and malformed responses each get their own message. Requests time out after 20 seconds instead of loading forever. The imported route stays loaded, and a retry button is shown.
- **Elevation lookup (opt-in):** the [Elevation API](https://open-meteo.com/en/docs/elevation-api) charges **one call per coordinate**, measured from the `X-RateLimit-Cost` header, and takes up to 100 coordinates per request. RideWind samples at most 200 points per route (at least 250 m apart) and only when you press **Look up elevation**. The button tells you how many calls it will use. These coordinates are rounded to 4 decimal places (about 11 m).
- **Elevation attribution:** the elevation data is the Copernicus DEM GLO-90 (© DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the European Union and ESA; all rights reserved). The app shows this credit whenever looked-up elevation is in use.

If you change how the app uses Open-Meteo, for example to add commercial use or move hosting to a shared server, check the [terms](https://open-meteo.com/en/terms) and [licence](https://open-meteo.com/en/licence) again.

## Map tiles

The map uses the standard OpenStreetMap tile server, `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. Under the [OSMF tile usage policy](https://operations.osmfoundation.org/policies/tiles/), light interactive use is fine as long as attribution stays visible and the app does no bulk downloading, prefetching or offline caching. RideWind does none of these. The page's referrer policy (`strict-origin-when-cross-origin`) still sends the Referer header the policy asks for. If the app ever gets heavy traffic, switch to a tile provider with its own terms.

## Your data stays in your browser

| What | Where | Notes |
| --- | --- | --- |
| Settings (speed, units, pace model, rider and bike setup, exposure) | `localStorage` | Key `ridewind:settings:v1` |
| Saved routes | IndexedDB database `ridewind` | Only saved when you press **Save on this device** |
| Forecast | Memory only | Gone when you reload |

- Nothing syncs between devices or browsers. To move data, use **Data & settings → Export data** on one device and **Import data** on the other.
- Clearing your browser's site data, or using **Delete all local data**, removes everything permanently.
- Saved routes keep only latitude, longitude and elevation. Timestamps, heart rate and other recorded data in the GPX are thrown away when the file is imported.
- Your GPX file is never uploaded. The only things that leave your browser are the rounded sample coordinates sent to Open-Meteo and the map tile requests sent to OpenStreetMap.
- Export files contain your routes, which can reveal where you live or ride. Don't commit them. `.gitignore` excludes `*.gpx` (except the samples) and `ridewind-export*.json`.

## Model assumptions

Values labelled **Forecast** come straight from Open-Meteo. Values labelled **Estimate** or **calculated** are RideWind's own arithmetic.

- **Arrival times** come from either a constant average speed or the physics model below. Neither accounts for stops.
- **Sampling:** forecast points are spread evenly along the route, about 5 km apart, with at most 20. Each map section uses the nearest sample's forecast at that section's own estimated arrival time.
- **Matching to time:** temperature and wind speed are linearly interpolated between hourly values. Wind direction is interpolated along the shorter arc, so 350° to 10° passes through 0°. Precipitation, precipitation probability and gusts are totals or maximums for the *preceding* hour in Open-Meteo, so RideWind uses the hour that contains the arrival time. Arrivals outside the forecast window are shown as "No forecast" and are never filled in.
- **Wind components:** wind direction is where the wind blows *from*. With travel bearing θ and wind from φ:
  - headwind = speed × cos(φ − θ), where positive is a headwind and negative is a tailwind
  - crosswind = speed × sin(φ − θ), where positive means the wind comes from the right
  
  Travel bearing is measured over ±250 m around each point to smooth out GPS noise.
- **Classification:** headwind means within ±45° of straight on, tailwind within ±45° of directly behind, and crosswind anything in between. Wind below 5 km/h counts as calm. These cut-offs are a display convention.
- **Wind height:** the wind is the model's 10 m wind. It doesn't fully account for shelter from buildings, trees, hedges, cuttings or local terrain, and riders usually feel less wind than this at road level.
- **Elevation:** climbing and descending use a 3 m turning-point threshold to filter noise. If only some points have elevation, the app says so and calculates from the points that do.

### Physics model (power mode)

Speed comes from the steady-state road cycling model in Martin, Milliken, Cobb, McFadden and Coggan (1998), "Validation of a mathematical model for road cycling power", *Journal of Applied Biomechanics* 14(3):276–291. For each step, RideWind finds the ground speed *v* at which your power at the pedals equals:

```
P = ( ½·ρ·CdA·v_air·|v_air|·v          aerodynamic drag, v_air = v + headwind
    + Crr·m·g·cos(atan G)·v             rolling resistance
    + m·g·sin(atan G)·v                 gravity
    + v·(91 + 8.7·v)·10⁻³ ) / η         wheel bearings; η = 0.976 drivetrain efficiency
```

`m` is rider plus bike mass, `g` = 9.80665 m/s² and `G` is the gradient. The speed is found by bisection.

- **Air density** ρ comes from the forecast temperature and the elevation, using the standard atmosphere for pressure and the dry-air gas law. Humidity is ignored.
- **Wind at rider height:** the 10 m forecast wind is scaled to about 1.2 m with a Hellmann power law, v·(1.2/10)^α. You choose the exposure: open (α 0.14, about 74%), mixed (α 0.25, about 59%) or sheltered (α 0.33, about 50%). Only the component along your direction of travel is used. Crosswind effects on drag (yaw) are ignored.
- **Steps:** the route is walked in 100 m steps. Gradient is measured over a 200 m window centred on each step and clamped to ±25% to limit the effect of noisy elevation. The clock advances step by step, so each step meets the forecast for when you'd actually get there.
- **Limits:** speed is capped at your **max descent speed**, on the assumption that you brake. On very steep climbs it bottoms out at 4 km/h (walking pace).
- **Not modelled:** acceleration and kinetic energy, corners, traffic, stops, drafting, fatigue and changes in power. Where a step has no forecast (outside the forecast window), still air and 15 °C are assumed, and the app warns you.
- **Missing elevation never silently becomes flat.** If the route has no elevation, or only some, power mode shows a choice instead of results: look up elevation, or **Estimate as if flat**. A flat estimate is labelled "Physics estimate · flat" and carries a warning. In constant-speed mode, the elevation chart says "No elevation data" instead of drawing a flat line.
- **Defaults:** 180 W, 75 kg rider, 9 kg bike and kit, CdA 0.32 m² (on the hoods), Crr 0.005, 55 km/h max descent, mixed exposure. Change them to match you.

The model's tests check it against hand calculations (aerodynamic, rolling, gravity and bearing terms), check that solving for speed exactly reverses the power calculation, and check that it responds the right way to power, wind, gradient, CdA, Crr and mass. A 200 W, 84 kg rider with CdA 0.32 and Crr 0.005 comes out at about 33 km/h on a calm flat road.

### Comparing departures and directions

For up to six departure times (every 1, 2, 3 or 6 hours from the one you chose) and both directions, RideWind runs the same simulation and reports ride time, the share of distance into a headwind, and the highest chance of rain. Only options that finish inside the forecast window are listed. **Best** means the shortest predicted time in power mode. In constant-speed mode, where every time is the same, it means the lowest average headwind. Options not fully covered by the forecast are never marked Best.

These are planning aids based on forecasts and a simplified model. They are not validated against your own rides and are not race advice. RideWind doesn't claim to match any commercial cycling weather service.

## Deployment

The app builds to static files in `dist/` and can run on any static host. The repository includes a GitHub Pages workflow (`.github/workflows/deploy-pages.yml`) that only runs when you start it manually, so nothing is published until you choose to:

1. Go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
2. Go to **Actions → Deploy to GitHub Pages → Run workflow**.
3. The site is published at `https://<user>.github.io/ridewind/`.

The workflow sets `BASE_PATH=/<repo>/` so asset paths work under the repository subpath. To deploy on every merge, change its trigger to `push: branches: [main]`.

## Branch rules

`main` is protected by three repository rulesets. The owner can edit or remove them at any time in **Settings → Rules → Rulesets**.

| Ruleset | Rules | Who can bypass |
| --- | --- | --- |
| `main: no force-push or delete` | Block force pushes, restrict deletions | Nobody, including the owner |
| `main: PR + CI` | Pull request required (0 approvals), `test-build` check must pass on the latest commit, linear history (squash or rebase merges) | Nobody |
| `main: owner-only updates` | Restrict updates: only bypass actors can push or merge to `main` | Repository admin role (the owner) |

These rules are configured for a solo maintainer:

- **No approving review is required.** GitHub doesn't let you approve your own pull request, so requiring one would lock out the only maintainer.
- **Requiring pull requests alone doesn't restrict who can change `main`.** It only controls *how* changes arrive. The "Restrict updates" ruleset limits updates to the repository admin role, and in a personal repository with no collaborators that is only the owner.
- **GitHub's legacy "Restrict who can push to matching branches" setting** is only available for organisation-owned repositories. That's why a ruleset is used instead.
- **Collaborators:** none have been added. Adding a collaborator gives them write access, though "Restrict updates" would still stop them updating `main` unless they're given the admin role.
- **Forked pull requests:** their workflows need maintainer approval before they run, and the default `GITHUB_TOKEN` permission is read-only.

The repository is **public**. Anyone can view, clone and fork it and open pull requests, but that doesn't let them change this repository.

## Not affiliated

RideWind is an independent personal project with its own branding. It isn't affiliated with, endorsed by or equivalent to any commercial cycling weather service, and it doesn't claim parity with one.

## Licence

Code: [MIT](LICENSE). Weather data: Open-Meteo, CC BY 4.0. Map data: © OpenStreetMap contributors, ODbL.
