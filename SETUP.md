# RideWind setup

Repository setup reference, based on [package.json](package.json), [vite.config.ts](vite.config.ts) and the existing [development guide](docs/development.md).

## Prerequisites

Node.js 20.19 or newer, npm and a modern browser. The development guide records Node 22 for CI. Internet access is needed for dependency installation and live external services. Default configuration requires no API key, application backend or hosted database.

## Start locally

From the repository directory:

```bash
npm ci
npm run dev
```

Open the address printed by the server, choose a sample route and confirm the map and weather verdict load. Failed external requests should show a recoverable message while retaining the route.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start development server. |
| `npm run typecheck` | Check TypeScript without emitting files. |
| `npm test` | Run unit tests once. |
| `npm run test:watch` | Watch and rerun tests. |
| `npm run build` | Type-check and build static files into `dist/`. |
| `npm run preview` | Serve the production build locally. |

## Optional configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `BASE_PATH` | Hosting path at build time | `/` |
| `VITE_ROUTING_URL` | Valhalla routing endpoint | FOSSGIS public endpoint |
| `VITE_ROUTING_MIN_INTERVAL_MS` | Minimum routing request interval | `1100` |
| `VITE_GEOCODE_URL` | Address search endpoint | Photon public endpoint |

Client configuration is public: never put credentials in `VITE_` variables. Provider changes also require compatibility, attribution and usage-limit review.

For hosting at `/ridewind/`:

```bash
BASE_PATH=/ridewind/ npm run build
npm run preview
```

Check the preview for missing assets and console errors. Publishing is a separate action; see [deployment](docs/deployment.md).

## Troubleshooting

- Use the printed server address if the normal port is occupied.
- Check network connectivity and provider responses when forecasts, maps, routing or search fail.
- Inspect browser storage for saved-route issues. Clearing site data removes local user data.
- Check production Content Security Policy errors when a provider works in development but fails in preview.

More detail: [development](docs/development.md), [troubleshooting](docs/troubleshooting.md) and [data and privacy](docs/data-and-privacy.md).
