# Security policy

RideWind is a personal, non-commercial project maintained by one person. Security reports are welcome and handled on a best-effort basis. There is no bug bounty.

## Supported versions

There are no versioned releases. Only the latest code on `main` and the live site at <https://kchan1028.github.io/ridewind/> are supported. Fixes are made on `main` and then deployed.

## Reporting a vulnerability

**Please report privately**, not in a public issue:

1. Go to the repository's [Security tab → Report a vulnerability](https://github.com/kchan1028/ridewind/security/advisories/new). This is GitHub's private vulnerability reporting, which is enabled for this repository.
2. Describe the problem, how to reproduce it (a minimal GPX or export file helps), and what an attacker could do with it.

You'll get a reply through the advisory once it has been looked at. If the report is confirmed, the fix will be credited to you in the advisory unless you'd rather stay anonymous.

For bugs that aren't security problems, [open an issue](https://github.com/kchan1028/ridewind/issues).

## How RideWind is built, and what that means for security

RideWind is a static site with no backend, no accounts, no database and no API keys or other secrets. Everything runs in your browser.

| Area | What happens |
| --- | --- |
| GPX files | Parsed in the browser with `DOMParser`. They're never uploaded. Files over 25 MB are refused. Route names and other text from files are inserted with `textContent`, not as HTML. |
| Export/import files | Imported JSON is checked for the expected app name, version, structure and coordinate ranges before anything is saved. |
| Map popups and icons | Built only from numbers and fixed text, never from file contents. |
| Network requests | Forecasts (and, only when you ask, elevation) from `api.open-meteo.com`, with coordinates rounded to about 100 m (forecast) or 11 m (elevation); map tiles from `tile.openstreetmap.org`; and, only while drawing a route along roads, the points you place (unrounded) to the routing server, `valhalla1.openstreetmap.de` by default; and, only when you press Search in **Find a place**, what you type (after a short pause) to `photon.komoot.io`. No analytics, cookies or other third parties. No API keys or secrets are in the page. |
| Stored data | Settings in `localStorage` and saved routes in IndexedDB, in your browser only. |
| Content Security Policy | The production build includes a CSP `<meta>` tag. It only allows the site's own scripts and styles (no inline code or `eval`), data requests to `api.open-meteo.com`, the routing server's origin and the address-search origin, and images from `tile.openstreetmap.org`. The policy lives in [`src/lib/csp.ts`](src/lib/csp.ts) and has tests. |
| Dependencies | One runtime dependency, Leaflet 1.9.4, pinned to an exact version. `npm audit --omit=dev` reported 0 vulnerabilities on 14 November 2026. |

Repository protections:

- **Secret scanning and push protection** are on.
- **Dependabot alerts** are on.
- `main` only changes through pull requests that pass CI (see [Maintaining RideWind](docs/maintaining.md)).
- **GitHub Actions** runs with a read-only default token.
- Workflows from forked pull requests need approval before they run.

## Known limitations

- **Framing is blocked by a script, not a header.** GitHub Pages can't send custom headers, and `frame-ancestors` doesn't work from a `<meta>` tag. Instead, RideWind checks at startup whether it's inside another site's frame. If it is, it shows a notice with a link to open RideWind directly, and the app doesn't start. A browser with JavaScript turned off would still show the page in a frame, but the app can't run without JavaScript anyway.
- **Local data isn't encrypted.** Anyone with access to your browser profile can read your saved routes. Export files contain your routes too, so treat them as personal.
- **Third parties see some data.** Open-Meteo and OpenStreetMap see your IP address and the rounded coordinates or map areas they serve, under their own privacy policies. While you draw along roads, the routing server (FOSSGIS by default) sees your IP address and the exact points you place.
- **Actions pinned by tag.** The CI and deploy workflows use major-version tags (for example `actions/checkout@v4`), not commit SHAs.

## Scope

**In scope:**
- The code in this repository.
- The site published from it at `kchan1028.github.io/ridewind`.

Examples of what counts include script injection through GPX or export files, data leaving the browser beyond what's described above, and weaknesses in the CI and deploy workflows.

**Out of scope:**
- Open-Meteo, OpenStreetMap and GitHub's own services.
- Attacks that need control of the user's device, browser or browser extensions.
- Social engineering.
- Denial of service against third-party APIs.
