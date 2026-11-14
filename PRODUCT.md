# RideWind product overview

RideWind tells a cyclist what the wind will do on a planned ride: where it will be a headwind, crosswind or tailwind, at the time they'll actually reach each part of the route. It's a free, private web app. You load a GPX file, pick a departure time, and get a one-line answer plus a coloured map, with no account and no upload.

This page covers why RideWind exists and what it should and shouldn't do. Setup lives in the [README](README.md), the maths in [how RideWind estimates your ride](docs/model.md), and planned work in the [roadmap](ROADMAP.md).

## What problem does RideWind solve?

A normal forecast gives wind for one place at one hour. A long ride crosses many places over several hours, and the direction you're riding keeps changing. So "15 km/h from the west" doesn't tell you whether the hard part of the ride will be into the wind or with it.

RideWind works out:

- Your arrival time at each point, from a fixed average speed or from your power.
- The forecast wind, gusts, temperature and rain for the hour you're expected at each point.
- Whether each section is a headwind, crosswind, tailwind or calm, by comparing the wind direction with your direction of travel.

It also helps with the decision that comes next: leave earlier or later, or ride the route the other way round.

## Who is RideWind for?

RideWind is for road cyclists who plan rides in advance, either with a GPX file or by drawing the route on the map. It is most useful to:

- Riders planning long rides, where the wind changes over several hours. The longest bundled sample is a 140 km ride in the San Francisco Bay Area.
- Riders who can choose when to leave or which way to ride, and want the option with the least headwind.
- Riders who train with power, who can get ride times from their power, weight and bike setup instead of a guessed average speed.
- Riders who care about privacy, who don't want to create an account or upload their routes.
- Organisers sketching an event or race course who want to check its wind before the day. RideWind keeps the roads and direction they draw, marks hand-drawn sections, and asks them to review the line; it doesn't approve a course.

## How do cyclists use it?

```mermaid
flowchart LR
  A[Load a GPX route, draw one<br/>or pick a sample] --> B[Pick a<br/>departure time]
  B --> C[Set pace:<br/>speed or power]
  C --> D[Read the verdict<br/>and the map]
  D --> E{Happy with it?}
  E -- No --> F[Try another time<br/>or direction]
  F --> D
  E -- Yes --> G[Save on<br/>this device]
```

There are four core journeys:

1. **Check a planned ride.** Load the route, keep the default departure, and read the verdict, for example *Mostly crosswind · gusts 43 km/h · rain up to 4.3 mm/h · finish 1:35 PM · sunset 4:57 PM*.
2. **Choose the best time or direction.** Step the departure time an hour at a time, use a preset such as *Tomorrow 8:00 AM*, or compare up to six times in both directions. RideWind marks the best option, and **Use** applies it.
3. **Get a realistic ride time.** Switch to **Power and bike setup**. If the route has no elevation, choose whether to look it up or to estimate it as flat.
4. **Keep and move routes.** Save routes in the browser, and export them as a file to move them to another device.
5. **Draw a route.** Tap the map to set a start and tap again to extend the route along roads. Drag points to adjust it, undo and redo, reverse it or close a loop, and draw straight sections by hand where the map has no road. The wind verdict updates after each edit. Review the line, confirm it, then save it or export it as GPX.

## What can RideWind do today?

| Area | What works now |
| --- | --- |
| Routes | Imports GPX track or route points. Three Bay Area sample routes. Can reverse the route. Draws routes on the map that follow roads (FOSSGIS Valhalla, road-bike profile), with straight sections by hand, inserting points in a section by dragging its middle, address search (Nominatim), undo and redo, reverse, close loop, a review step and GPX export. See [drawing a route](docs/routing.md). |
| Forecast | Hourly wind, gusts, temperature and rain from Open-Meteo, up to 16 days ahead, at up to 40 points per route. Sunrise and sunset. |
| Timing | Constant average speed, or a power-based physics model that uses gradient, wind, weight, drag and rolling resistance. Optional planned stop time. |
| Elevation | Uses the GPX elevation when there is some. Optional lookup when there isn't. Never quietly treats a route as flat. |
| Results | One-line verdict, a map coloured by wind type, charts along the route, a departure comparison and a point-by-point table. |
| Daylight | Notes when a ride starts before sunrise or finishes after sunset. |
| Storage | Settings and saved routes stay in the browser. Export, import and delete everything. Nothing syncs. |
| Access | Works by keyboard, announces results to screen readers, doesn't rely on colour alone, and works at phone width. See [Accessibility](ACCESSIBILITY.md) for the gaps. |

## What principles guide decisions?

These come from choices already made in the code and in earlier pull requests.

- **Answer first.** The verdict comes before the detail. On phones it sits in a bar at the bottom of the screen.
- **Say what is forecast and what is estimated.** Forecast values and RideWind's own estimates are labelled differently. A result that falls outside the forecast window says so instead of guessing.
- **Never hide a guess.** A route without elevation is shown as unknown, not flat. A flat estimate is only used when you choose it, and it's labelled.
- **Keep the rider's data private.** There's no backend and no account. The GPX file never leaves the browser, and only coordinates rounded to about 100 m go to the weather service. Drawing along roads is the one exception: the points the rider places go, unrounded, to the routing service, and the draw panel says so first. Straight sections send nothing.
- **Never change the rider's course behind their back.** Reverse rides the same roads; a saved route is never routed again; hand-drawn sections stay labelled; and road snapping is never described as confirming that a road is open or a course approved.
- **Use the free weather service lightly.** One forecast request per route, cached in memory. Changing the time, pace or direction doesn't call the service again. The elevation lookup only runs when you ask, and it tells you its cost first.
- **Don't depend on colour.** Wind type is also shown by line style, patterns and text.
- **Be honest about limits.** Forecast wind doesn't account for shelter from trees, buildings or terrain, and the estimates have only been checked against five real rides, where they came within about 11%. The app and the docs both say so.

## What is RideWind not trying to be?

These limits follow from the current design, the data licence and the project's stated purpose.

- Not a service with accounts. There's no sign-in and no cloud sync. Moving data between devices is a manual export and import.
- Not a commercial product. It's a personal, non-commercial project, which the free Open-Meteo plan requires.
- Not race or pacing advice. The ride time is a planning estimate. The model leaves out stops, corners, traffic, drafting and fatigue.
- Not a full route planner. RideWind draws routes along roads so it can show their wind, but it has no turn-by-turn directions, surface or traffic data, route suggestions, freehand sketching that snaps to roads, or editing of a saved route.
- Not a course approval. Following roads shows what OpenStreetMap and a cycling profile suggest; it doesn't confirm road access, closures or permission for an event.
- Not a copy of any commercial cycling weather service. It isn't affiliated with one and makes no claim to match one.
