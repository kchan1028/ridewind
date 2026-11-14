# RideWind roadmap

**Status, 14 November 2026:** eight of the nine proposed items have shipped, with the owner choosing the approach for each. One is still open, and nothing below has a date.

Each item links to its [GitHub issue](https://github.com/kchan1028/ridewind/issues), where the detailed work is tracked. For what the product is and isn't meant to do, see [PRODUCT.md](PRODUCT.md).

## Now

| Item | Status | What's left | Source |
| --- | --- | --- | --- |
| Test with screen readers and in Windows high contrast mode | Open, [#12](https://github.com/kchan1028/ridewind/issues/12) | Reflow at 200% and 400% zoom and control labels have been checked. It still needs a person to try VoiceOver, NVDA or TalkBack, and Windows high contrast mode. | [Accessibility](ACCESSIBILITY.md#known-limitations) |

## Next

Nothing is planned yet. New ideas start as [issues](https://github.com/kchan1028/ridewind/issues).

## Later

Nothing is planned yet.

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

The design review's P0 to P3 items have all shipped:

- [PR #3](https://github.com/kchan1028/ridewind/pull/3): answer-first verdict, loading and error states, mobile bottom bar, direction cues on the map.
- [PR #4](https://github.com/kchan1028/ridewind/pull/4): tab order, inline save feedback, departure presets, type scale, press feedback, tap targets, dark-mode map colours.
- [PR #5](https://github.com/kchan1028/ridewind/pull/5): sunrise and sunset in the verdict, which PR #4 had left for later.

The full feature history is in the [merged pull requests](https://github.com/kchan1028/ridewind/pulls?q=is%3Apr+is%3Amerged).
