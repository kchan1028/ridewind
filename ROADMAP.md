# RideWind roadmap

**Status, 14 November 2026:** the first nine roadmap items have all shipped except screen reader testing. The open work now comes from the [UX/UI audit](docs/ux-ui-audit.md). Items marked *Proposed* are recommendations the owner hasn't approved, and nothing on this page has a date.

Each item links to its [GitHub issue](https://github.com/kchan1028/ridewind/issues) or pull request, where the detailed work is tracked. For what the product is and isn't meant to do, see [PRODUCT.md](PRODUCT.md).

## Now

Bugs and checks that are open on GitHub.

| Item | Status | Tracked in |
| --- | --- | --- |
| Test with screen readers and in Windows high contrast mode. Zoom and reflow are done. | Open | [#12](https://github.com/kchan1028/ridewind/issues/12) |

## Next

Remaining steps from the [audit's implementation plan](docs/ux-ui-audit.md#6-implementation-plan), in its order of impact for the effort. None has an issue yet.

| Item | Status | Size |
| --- | --- | --- |
| Refresh the forecast automatically when it's old, and keep the last forecast for saved routes so they work offline | Done, [#50](https://github.com/kchan1028/ridewind/pull/50) | 1 to 2 days |
| Load the app itself without a connection (a service worker for RideWind's own files, never map tiles) | In review | Under a day |
| Saved routes remember the direction and usual departure time | Done, [#43](https://github.com/kchan1028/ridewind/pull/43) | Up to 2 days |
| Pick units from the browser's locale, with a speed-unit switch next to the field | Done, [#53](https://github.com/kchan1028/ridewind/pull/53) | Under half a day |
| A shorter first screen on phones, with a one-line explanation and two actions | Done, [#54](https://github.com/kchan1028/ridewind/pull/54) | Under half a day |

## Later

| Item | Status | Size |
| --- | --- | --- |
| Smoother charts, units on the axes and fewer tick labels | Proposed | Up to 2 days |
| Tidy-ups: no repeated status messages, one combined Start/Finish label on loops, one series for the temperature range | Proposed | Under half a day |
| Limit the comparison to departures that finish before sunset | Proposed | Not sized |

The audit asked for the riders' test in the [usability testing plan](docs/usability-testing.md) to decide what the verdict bar shows. The bar shipped first, so that test should now check it.

## Done

Roadmap items shipped in November 2026:

- [#13](https://github.com/kchan1028/ridewind/issues/13): every button is at least 44 px tall.
- [#14](https://github.com/kchan1028/ridewind/issues/14): ride-time estimates checked against five real rides. They came within −11% to +2% using normalised power. See [how close the estimates are](docs/model.md#how-close-are-the-estimates).
- [#15](https://github.com/kchan1028/ridewind/issues/15): each chart has a data table you can open.
- [#16](https://github.com/kchan1028/ridewind/issues/16): **Refresh forecast** gets a new forecast without reloading the route.
- [#17](https://github.com/kchan1028/ridewind/issues/17): a [contributing guide](CONTRIBUTING.md).
- [#18](https://github.com/kchan1028/ridewind/issues/18): up to 40 forecast points per route, keeping 5 km spacing on rides up to about 195 km.
- [#19](https://github.com/kchan1028/ridewind/issues/19): RideWind shows a notice instead of the app when another site puts it in a frame.
- [#20](https://github.com/kchan1028/ridewind/issues/20): an optional planned stop time that moves later arrival times and the finish.

Bugs from the expert walkthrough in the [usability testing plan](docs/usability-testing.md), fixed in November 2026:

- [#31](https://github.com/kchan1028/ridewind/issues/31): keyboard focus stays in place after **Use**, a departure preset or **Retry forecast**.
- [#32](https://github.com/kchan1028/ridewind/issues/32): the comparison keeps its first departure after **Use**, so earlier options stay listed.
- [#33](https://github.com/kchan1028/ridewind/issues/33): in power mode, a route without elevation still gets a wind verdict, timed at your average speed and labelled, with the elevation buttons in the verdict.
- [#34](https://github.com/kchan1028/ridewind/issues/34): an old "Using …" status clears when the departure changes another way.
- [#35](https://github.com/kchan1028/ridewind/issues/35): the sample menu shows the sample that's loaded.

From the UX/UI audit's implementation plan:

- [PR #23](https://github.com/kchan1028/ridewind/pull/23): **Best** departure skips rides that end in the dark and calls that are too close to split (step 1).
- [PR #27](https://github.com/kchan1028/ridewind/pull/27): the rain summary leads with the chance of rain, not the rate (step 2).
- [PR #28](https://github.com/kchan1028/ridewind/pull/28): speed and rider errors show under the field and keep what you typed (step 3).
- [PR #36](https://github.com/kchan1028/ridewind/pull/36): a glanceable verdict bar with Details, forecast age and Refresh (step 4).
- [PR #40](https://github.com/kchan1028/ridewind/pull/40): the departure comparison as cards on phones, with both directions visible (most of step 5).
- The point-by-point table shows Distance, Arrive, Head/tail and Rain on phones, with **Show all columns** for the rest (the rest of step 5).
- [PR #25](https://github.com/kchan1028/ridewind/pull/25): touch targets of at least 44 px (step 11).

The design review's P0 to P3 items have all shipped:

- [PR #3](https://github.com/kchan1028/ridewind/pull/3): answer-first verdict, loading and error states, mobile bottom bar, direction cues on the map.
- [PR #4](https://github.com/kchan1028/ridewind/pull/4): tab order, inline save feedback, departure presets, type scale, press feedback, tap targets, dark-mode map colours.
- [PR #5](https://github.com/kchan1028/ridewind/pull/5): sunrise and sunset in the verdict, which PR #4 had left for later.

The full feature history is in the [merged pull requests](https://github.com/kchan1028/ridewind/pulls?q=is%3Apr+is%3Amerged).
