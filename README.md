# RideWind

[![CI](https://github.com/kchan1028/ridewind/actions/workflows/ci.yml/badge.svg)](https://github.com/kchan1028/ridewind/actions/workflows/ci.yml)

RideWind shows you the wind you'll actually ride into. Load a GPX route and pick a departure time. RideWind matches the forecast wind, gusts, temperature and rain to the moment you reach each part of the route, and colours the map by headwind, crosswind and tailwind.

It runs entirely in your browser: no account, no backend, and your route file is never uploaded.

**[Open RideWind](https://kchan1028.github.io/ridewind/)**, then choose a route from **Try a sample route…** to see it working in a few seconds. · [Documentation](docs/README.md) · [Report an issue](https://github.com/kchan1028/ridewind/issues)

## Why use it

- **See where the wind will hit you, at the time you'll be there.** The route is split into sections and coloured by wind type. A one-line verdict sums up the ride, such as *Mostly crosswind · gusts 43 km/h · rain up to 4.3 mm/h · finish 01:35 PM · sunset 04:57 PM*.
- **Pick the better time or direction.** Step the departure an hour earlier or later, use presets like *Tomorrow 08:00*, or compare up to six departure times in both directions. RideWind marks the best option.
- **Get timing from your power, not a guess.** Besides a simple average-speed mode, a power-based model uses your power, weight, drag, rolling resistance, the gradient and the forecast wind. As a check, a 200 W rider at 84 kg (rider plus bike) comes out at about 33 km/h on a calm, flat road.
- **Keep your rides private.** Settings and saved routes stay in your browser. Only coordinates rounded to about 100 m are sent to the weather service, and timestamps and other recorded data in your GPX file are discarded.

## Quick start

**Prerequisites:** [Node.js](https://nodejs.org/) 20.19 or newer (CI uses Node 22), and npm.

```bash
git clone https://github.com/kchan1028/ridewind.git
cd ridewind
npm install
npm run dev
```

When the dev server is ready, Vite prints something like:

```
  VITE v8.3.8  ready in 132 ms

  ➜  Local:   http://localhost:5173/
```

Open that address in your browser. If port 5173 is busy, Vite picks the next free port and prints that one instead.

**Configuration:** none is needed. The forecast and elevation services need no API key, and there's no `.env` file. The only environment variable is the optional `BASE_PATH`, used when the built site is served from a subpath such as GitHub Pages:

```bash
BASE_PATH=/ridewind/ npm run build
```

## Usage

1. **Load a route.** Press **Import GPX** and choose a `.gpx` file with track or route points. Or pick one of the three San Francisco Bay Area samples from **Try a sample route…**:
   - Berkeley to Morgan Territory
   - China Camp – Nicasio Valley
   - PRS (clockwise)
2. **Choose when you'll leave.** Departure times use the route's own timezone. Use the date and time field, a preset, or the **−1 h / +1 h** buttons in the verdict.
3. **Set your pace.** Choose **A constant average speed**, or **Power and bike setup** for the physics estimate. A route without elevation data asks you to look elevation up or explicitly estimate it as flat; it never quietly assumes a flat route.
4. **Read the result.** The verdict at the top (a bar along the bottom on phones) gives the answer. Below it you'll find the ride-time and weather figures, charts along the route, the departure comparison and a point-by-point table.

On 14 November 2026, the **Berkeley to Morgan Territory** sample at the default 25 km/h, leaving at the **Tomorrow 08:00** preset, gave this verdict:

```
Berkeley to Morgan Territory · 139.8 km
Mostly crosswind
gusts 43 km/h · rain up to 4.3 mm/h · 5 h 36 min, finish 01:35 PM · sunset 04:57 PM
```

Forecasts change, so your numbers will differ. To keep a route, press **Save on this device**. Data is never synced; to move it to another device, use **Data & settings → Export data** and then **Import data**.

RideWind is a planning aid. Forecast wind doesn't fully account for shelter from buildings, trees or terrain, and the estimates haven't been validated against real rides. For the details, see [how RideWind estimates your ride](docs/model.md).

## Documentation

**Using RideWind**
- [How RideWind estimates your ride](docs/model.md): sampling, time matching, wind components, the physics model (Martin et al., 1998) and comparisons.
- [Data sources and privacy](docs/data-and-privacy.md): Open-Meteo usage and limits, attribution, map tiles, and what is stored in your browser.
- [Troubleshooting](docs/troubleshooting.md): what each error message means and how to fix it.

**Working on RideWind**
- [Developing RideWind](docs/development.md): setup, commands, tests and debugging.
- [How RideWind is built](docs/architecture.md): the main parts, how data moves through them, and where to make common changes.
- [Deploying RideWind](docs/deployment.md): building, publishing with GitHub Pages, checking and rolling back.
- [Maintaining RideWind](docs/maintaining.md): branch rules and how changes reach `main`.
- [Contributing](CONTRIBUTING.md): how to propose a change and the checks it must pass.

**Policies**
- [Security policy](SECURITY.md): how to report a vulnerability privately, and how RideWind handles your data.
- [Accessibility](ACCESSIBILITY.md): what's supported, known gaps, and how to report a barrier.

## Development

RideWind is written in TypeScript and built with Vite. It uses Leaflet for the map and no UI framework. The route and weather calculations live in [`src/lib/`](src/lib) and have unit tests. The page code lives in [`src/ui/`](src/ui).

```bash
npm test         # run the unit tests
npm run build    # type-check and build the static site into dist/
```

Every command, the test setup and debugging tips are in [docs/development.md](docs/development.md). To propose a change, read [CONTRIBUTING.md](CONTRIBUTING.md). Report security problems privately as described in [SECURITY.md](SECURITY.md).

## Credits and licence

- **Code:** [MIT License](LICENSE).
- **Weather and elevation data:** [Open-Meteo.com](https://open-meteo.com/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
  - Looked-up elevation uses the Copernicus DEM GLO-90: © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the European Union and ESA. All rights reserved.
- **Map data:** © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, ODbL.

RideWind is an independent personal project for non-commercial use. It isn't affiliated with or endorsed by any commercial cycling weather service.
