# Drawing a route that follows roads

**Draw a route** works like the route builders in Strava and Ride with GPS: tap the map to set a start, tap again to extend the route along roads, and drag a point to change it. This page explains how it works, which routing service it uses and why, what that service receives, and how to change it. Last checked 14 November 2026.

## What you can do

| Action | How |
| --- | --- |
| Find a place | Type an address, town or landmark in **Find a place** and press Search (or Enter). One match moves the map there with a pin; several give a list to choose from. **Add point here** puts a route point on the pin. Searching uses OpenStreetMap's Nominatim, only when you press Search (see below). |
| Start a route | Press **Draw a route**, then tap or click the map. |
| Extend it along roads | Tap again. The new section follows roads using a cycling profile that prefers paved roads. |
| Draw a section by hand | Choose **Straight line (manual, for missing roads)** under *New sections*, then tap. Use it where the map has no road, path or connection. Straight sections show as dotted amber lines while drawing and as white dots on the finished route. |
| Change a section in between | Drag the small dot in the middle of a section onto the road you want. That adds a point there and routes both halves again; tapping the dot adds the point without moving it, ready to drag. With a keyboard, select a point and press **Add point before**, which adds one halfway along the section before it. Short sections on screen have no dot until you zoom in. |
| Move a point | Drag it. Dragging anywhere else moves the map, so panning never edits the route. On a phone, **Tap adds points** can be turned off so taps only move the map. |
| Select a point | Tap it (or Tab to it). The point gets a blue ring, and a panel offers **Move to centre crosshair**, **Remove point** and **Done**. Delete or Backspace removes it; Esc deselects. |
| Undo and redo | **Undo** and **Redo**, or Ctrl/⌘+Z and Ctrl/⌘+Shift+Z (or Ctrl+Y). Each action is one step. |
| Reverse | **Reverse** rides the same roads the other way. Nothing is routed again, so the roads stay exactly as drawn. One-way streets aren't rechecked. |
| Close a loop | **Close loop** adds a section from the last point back to the start. |
| Clear | **Clear…** asks first, and **Undo** brings the route back. Cancelling a drawing that has points, or opening another route, also asks first, and the browser warns before you leave the page. |
| Finish | **Review route** shows the distance, how much follows roads, any straight sections and a reminder of what road-following does not promise. Tick *I've checked the route and its direction on the map*, then press **Use this route**. |
| Export | **Export GPX** on the finished route. The file has one track, with elevation where the routing service supplied it, and its description notes any straight sections. |

After every completed edit, the drawing becomes the loaded route: distance, climbing, arrival times and the wind verdict are worked out again from the full road geometry, not from straight lines between your points. Changing the departure time, speed, power or direction recalculates them the same way.

## Which routing service, and why

A map library such as Leaflet only draws maps. It can't work out the roads between two points; that needs a routing engine. RideWind is a static page on GitHub Pages with no server of its own, so it needs a service that a browser can call directly without exposing a secret key.

| Option | Cycling road profile | Browser use without a secret | Free limits (non-commercial) | Notes |
| --- | --- | --- | --- | --- |
| **FOSSGIS Valhalla** (`valhalla1.openstreetmap.de`), chosen | `bicycle` costing with `bicycle_type: "Road"` and `avoid_bad_surfaces`, which keeps to paved roads | Yes: no key, CORS allowed | At most 1 request a second. High-traffic sites aren't allowed. Commercial use only if routing isn't a substantial part of the offering | Run by volunteers. Requires attribution, a "report a map error" link and a contact email for the site operator. Also returns elevation along the route. |
| Stadia Maps (hosted Valhalla) | Same as above | Yes: browsers are authenticated by domain, so no key ships in the page | 200,000 credits a month, shared with maps and geocoding. The free plan is non-commercial; paid plans start at $20 a month | Same request format as FOSSGIS, so switching is a configuration change (see below). The best option if the public server's limits become a problem. |
| BRouter (`brouter.de`) | `fastbike` profile | Yes: no key, CORS allowed | No published limits. Community-run, asks for modest use | Good bike profiles, but no published terms to rely on. |
| openrouteservice (HeiGIT) | `cycling-road` profile | No: needs an API key, which would be public in the page | 2,000 directions a day, 40 a minute | Would need a small proxy server to hide the key. |
| GraphHopper Directions API | Bike profiles (which ones the free plan includes wasn't confirmed) | No: the key is sent in every request | 500 credits a day, 5 points per request | Would need a proxy server. The free plan is non-commercial. |
| Mapbox Directions | `cycling` | Public tokens are designed for browsers | 100,000 requests a month | Its cycling profile doesn't target paved roads, and RideWind uses OpenStreetMap tiles, not Mapbox maps. |

RideWind uses FOSSGIS Valhalla by default. It is the only option that needs no key, allows browser requests, has a road-bike profile that prefers paved roads, returns elevation in the same request, and has published terms that fit a personal, low-traffic, non-commercial app. As FOSSGIS recommends, the endpoint is a setting rather than hard-coded, and Stadia Maps speaks the same API.

Sources: [FOSSGIS terms of use](https://fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/), [Stadia Maps limits](https://docs.stadiamaps.com/limits) and [routing](https://stadiamaps.com/products/routing-navigation/), [openrouteservice plans](https://openrouteservice.org/plans/), [GraphHopper plans](https://docs.graphhopper.com/openapi/section/plans-and-rate-limits), [BRouter](https://brouter.de/brouter/). CORS and the request format were checked with live requests to the FOSSGIS and BRouter servers. The Mapbox figure is from memory and wasn't rechecked.

## How RideWind uses the service lightly

- **Only completed edits are routed.** A drag is routed when you let go, not while you move.
- **Requests are spaced.** At least 1.1 seconds apart (`DEFAULT_ROUTING_MIN_INTERVAL_MS`), inside the FOSSGIS limit of one a second. Rapid taps are sent together: one request carries every new point, up to 12 points per request.
- **Nothing is routed twice.** Each section is remembered by its two end points, so undo, redo and reverse don't send new requests.
- **Saved routes are never routed again.** Opening, reversing or exporting a saved route uses the stored geometry exactly, so a course can't silently change after it's saved.
- **The forecast isn't fetched on every tap.** While you draw, a new forecast point reuses the nearest point already fetched if it's within 4 km, and a new forecast is fetched only after 1.5 seconds without an edit. When you finish, the route gets an exact forecast, as an imported route would.

## Reliability

- **Out-of-date answers can't overwrite newer edits.** A routing answer only fills sections whose end points still match. If you moved or removed a point in the meantime, the answer is ignored and the new position is routed.
- **A failed request keeps the last good route.** The route goes back to its last complete version, and a message offers **Retry**, **Draw as straight line** or **Dismiss**. Network failures, timeouts (20 seconds), rate limiting, server errors, "no road near this point", "too far" and unreadable answers each have their own message.
- **Loading state.** Sections waiting for the router show as faint, animated dashed lines (not animated with reduced motion), with *Following roads…* in the panel. **Review route** waits until every section is done.

## Race courses and events

Road snapping follows what OpenStreetMap shows and what the cycling profile prefers. It doesn't check that a road is open, legal to ride or approved for a race. For a course:

- Draw it in the direction it will be ridden, and check the direction in the review step.
- Use **Straight line** for sections the router won't follow, such as a road closed for the event. They stay marked as drawn by hand everywhere: on the map, in the route card, in the review and in the exported GPX.
- If the router picks a different road from the one you want, add a point on the road you want. The router never swaps roads after you finish.
- Review the geometry before you confirm. RideWind never describes snapping as approval.

## Address search

**Find a place** uses the OpenStreetMap Foundation's public [Nominatim](https://nominatim.org/) server, chosen by the owner on 14 November 2026 after reviewing its [usage policy](https://operations.osmfoundation.org/policies/nominatim/). The policy's rules, and how RideWind follows them:

- **At most one request a second, across all users.** RideWind sends a search only when you press Search or Enter, never as you type (search-as-you-type is forbidden and gets a site blocked), waits at least 1.1 seconds between searches, and answers a repeated search from memory.
- **Moderate use only.** If RideWind's traffic grows, switch to another geocoder (for example Stadia Maps, which authenticates by domain) or a self-hosted Nominatim with `VITE_GEOCODE_URL`. The policy asks that sites can switch at OSMF's request.
- **Attribution.** Results are OpenStreetMap data under the ODbL, credited in the footer and the map.
- **Privacy.** What you type, your browser language and the area on screen (to prefer nearby results) go to OSMF under its privacy policy. Don't type personal information you don't want sent. The draw panel says this.

Results are biased toward the area on screen but not limited to it, so a common name such as "Main Street" can match places elsewhere; add a town or postcode.

## What the routing service receives

Each request sends the control points you placed, **unrounded** (road-following needs the exact position), plus the cycling settings. It doesn't send the route name or your saved routes, or anything else that identifies you beyond what any web request carries (your IP address, and the page address as the Referer). The draw panel says this before you place a point. Straight-line sections send nothing. FOSSGIS's own privacy policy applies to its servers.

## Configuration and credentials

The default needs **no credentials**. Two optional build-time settings change it:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_ROUTING_URL` | `https://valhalla1.openstreetmap.de/route` | Any Valhalla `/route` endpoint. The production build adds its origin to the Content Security Policy's `connect-src`. Non-https URLs (other than localhost) are left out, so they're blocked. |
| `VITE_ROUTING_MIN_INTERVAL_MS` | `1100` | Smallest gap between routing requests. |
| `VITE_GEOCODE_URL` | `https://nominatim.openstreetmap.org/search` | A Nominatim-compatible search endpoint for **Find a place**. Its origin is added to `connect-src` the same way. |

`VITE_` variables are compiled into the public JavaScript, so **never put a secret key in them**. To use Stadia Maps, register the site's domain in the Stadia dashboard (domain authentication needs no key in the page) and build with `VITE_ROUTING_URL=https://api.stadiamaps.com/route/v1`. To use a keyed service such as openrouteservice or GraphHopper, keep the key in a small server-side proxy (for example a Cloudflare Worker) that answers in the Valhalla format, and point `VITE_ROUTING_URL` at the proxy. No such proxy is built.

**Operator contact:** the FOSSGIS terms require an easily found contact email for the site's operator. RideWind's footer shows one (in `index.html`). Keep it there while the FOSSGIS default is in use.

## Where the code is

| File | What it does |
| --- | --- |
| [`src/lib/routing-config.ts`](../src/lib/routing-config.ts) | Default endpoint, request spacing, CSP origin and map credit. |
| [`src/lib/routing.ts`](../src/lib/routing.ts) | Builds the Valhalla request, decodes the shape, puts elevation on each point and maps errors to messages. |
| [`src/lib/geocode.ts`](../src/lib/geocode.ts) | The Nominatim search request, parsing, errors, and `PlaceSearch`, which spaces and caches searches. |
| [`src/lib/route-editor.ts`](../src/lib/route-editor.ts) | Editing operations (add, insert in a section, move, remove, reverse, close loop), joining sections into a `Route`, and `RouteSession`: history, request queue, cache, and the out-of-date and failure rules. |
| [`src/ui/map.ts`](../src/ui/map.ts) | Draws sections, draggable control points and middle handles, the searched-place pin, and the routing credit. |
| [`src/ui/app.ts`](../src/ui/app.ts) | The draw panel, the review step and the live update of the wind analysis. |

Tests: [`tests/geocode.test.ts`](../tests/geocode.test.ts), [`tests/routing.test.ts`](../tests/routing.test.ts) and [`tests/route-editor.test.ts`](../tests/route-editor.test.ts) cover request building, error mapping, timeouts, editing, undo and redo, reversing, loops, saving and GPX, rapid consecutive edits, out-of-date answers and failed requests.

Screenshots from the verification run are in [`docs/route-drawing/`](route-drawing/).
