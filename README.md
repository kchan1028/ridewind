# RideWind

A personal cycling weather app. Load a GPX route, pick a departure time, and see the forecast wind, gusts, temperature and rain at the points you'll reach along the way. Each section of the route is coloured by headwind, tailwind or crosswind.

It's a static web page with no backend, accounts or database. It's built for personal, non-commercial use.

## What it does

- Imports GPX files with track points (`<trkpt>`) or route points (`<rtept>`), and includes a sample route you can load with one click. The sample is a simplified, approximate crossing of the Afsluitdijk in the Netherlands.
- Shows the route on an OpenStreetMap map with its distance and any elevation data the file contains. If a file has no elevation, climbing is shown as **unknown**, not as zero.
- Lets you choose a departure time in the **route's own timezone**, which Open-Meteo works out from the coordinates, and reverse the route's direction.
- Estimates when you'll reach each sampled point from a constant average speed, then matches each point to the forecast for that time.
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
  time.ts           route-timezone conversions
  storage.ts        localStorage settings, IndexedDB routes, export/import
src/ui/           Leaflet map and DOM wiring
tests/            Vitest unit tests
public/samples/   The bundled sample route
```

## Weather data and attribution

Weather comes from the [Open-Meteo Forecast API](https://open-meteo.com/en/docs), called directly from the browser. This was checked in November 2026:

- **Terms:** the free API is for non-commercial use only. It is limited to fewer than 10,000 calls a day, 5,000 an hour and 600 a minute (300,000 a month), and needs no API key. Each location in a request counts as one call. A 16-day, 6-variable request for one point costs 1 call, which was confirmed from the `X-RateLimit-Cost` header.
- **Usage per route:** RideWind sends one request per loaded route, covering up to 20 points spaced evenly along it, so loading a route costs about 20 calls. The 16-day hourly forecast is cached in memory, so changing the departure time, speed or direction doesn't call the API again. To refresh the forecast, load the route again.
- **Privacy:** coordinates are rounded to 3 decimal places (about 100 m) before they're sent.
- **Licence:** the data is [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The app shows "Weather data by Open-Meteo.com" with links wherever forecast data appears, and notes that RideWind derives its estimates from that data.
- **Errors:** rate limiting (HTTP 429 or a "limit exceeded" reason), network failures, server errors and malformed responses each get their own message. The imported route stays loaded, and a retry button is shown.

If you change how the app uses Open-Meteo, for example to add commercial use or move hosting to a shared server, check the [terms](https://open-meteo.com/en/terms) and [licence](https://open-meteo.com/en/licence) again.

## Map tiles

The map uses the standard OpenStreetMap tile server, `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. Under the [OSMF tile usage policy](https://operations.osmfoundation.org/policies/tiles/), light interactive use is fine as long as attribution stays visible and the app does no bulk downloading, prefetching or offline caching. RideWind does none of these. The page's referrer policy (`strict-origin-when-cross-origin`) still sends the Referer header the policy asks for. If the app ever gets heavy traffic, switch to a tile provider with its own terms.

## Your data stays in your browser

| What | Where | Notes |
| --- | --- | --- |
| Settings (speed, units) | `localStorage` | Key `ridewind:settings:v1` |
| Saved routes | IndexedDB database `ridewind` | Only saved when you press **Save on this device** |
| Forecast | Memory only | Gone when you reload |

- Nothing syncs between devices or browsers. To move data, use **Data & settings → Export data** on one device and **Import data** on the other.
- Clearing your browser's site data, or using **Delete all local data**, removes everything permanently.
- Saved routes keep only latitude, longitude and elevation. Timestamps, heart rate and other recorded data in the GPX are thrown away when the file is imported.
- Your GPX file is never uploaded. The only things that leave your browser are the rounded sample coordinates sent to Open-Meteo and the map tile requests sent to OpenStreetMap.
- Export files contain your routes, which can reveal where you live or ride. Don't commit them. `.gitignore` excludes `*.gpx` (except the sample) and `ridewind-export*.json`.

## Model assumptions

Values labelled **Forecast** come straight from Open-Meteo. Values labelled **Estimate** or **calculated** are RideWind's own arithmetic.

- **Arrival times** assume a constant average moving speed. Stops, climbs and wind aren't accounted for yet.
- **Sampling:** forecast points are spread evenly along the route, about 5 km apart, with at most 20. Each map section uses the nearest sample's forecast at that section's own estimated arrival time.
- **Matching to time:** temperature and wind speed are linearly interpolated between hourly values. Wind direction is interpolated along the shorter arc, so 350° to 10° passes through 0°. Precipitation, precipitation probability and gusts are totals or maximums for the *preceding* hour in Open-Meteo, so RideWind uses the hour that contains the arrival time. Arrivals outside the forecast window are shown as "No forecast" and are never filled in.
- **Wind components:** wind direction is where the wind blows *from*. With travel bearing θ and wind from φ:
  - headwind = speed × cos(φ − θ), where positive is a headwind and negative is a tailwind
  - crosswind = speed × sin(φ − θ), where positive means the wind comes from the right
  
  Travel bearing is measured over ±250 m around each point to smooth out GPS noise.
- **Classification:** headwind means within ±45° of straight on, tailwind within ±45° of directly behind, and crosswind anything in between. Wind below 5 km/h counts as calm. These cut-offs are a display convention.
- **Wind height:** the wind is the model's 10 m wind. It doesn't fully account for shelter from buildings, trees, hedges, cuttings or local terrain, and riders usually feel less wind than this at road level.
- **Elevation:** climbing and descending use a 3 m turning-point threshold to filter noise. If only some points have elevation, the app says so and calculates from the points that do.

These are planning aids, not validated performance predictions or race advice.

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
