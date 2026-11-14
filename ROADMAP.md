# RideWind roadmap

**Status, 14 November 2026: the owner hasn't approved any item on this page.** Every item is a recommendation, marked *Proposed*, and none has a date. The core product is built and the design review is finished, so the main gaps left are in testing, accessibility and confidence in the estimates.

Each item names the existing document that raised it. Detailed work belongs in [GitHub Issues](https://github.com/kchan1028/ridewind/issues), and this page should link to them. The repository has no open or closed issues yet, so none are linked below. For what the product is and isn't meant to do, see [PRODUCT.md](PRODUCT.md).

## Now

Small, well-defined gaps that existing docs already describe.

| Item | Status | Why | Source |
| --- | --- | --- | --- |
| Test with screen readers (VoiceOver, NVDA, TalkBack), at 200% zoom and in Windows high contrast mode | Proposed | Only automated checks and keyboard use in Chromium have been done so far. | [Accessibility](ACCESSIBILITY.md#known-limitations) |
| Make the smaller buttons at least 44 px: departure presets, −1 h / +1 h, **Open**, **Delete** and **Use** | Proposed | They're 32 to 40 px today, below the size used for the main controls. | [Accessibility](ACCESSIBILITY.md#known-limitations) |
| Turn the items on this page into GitHub issues | Proposed | Work is meant to be tracked in issues, and there are none yet. | This page |

## Next

Changes that need some design or a decision first.

| Item | Status | Why | Source |
| --- | --- | --- | --- |
| Check ride-time estimates against real rides | Proposed | The physics model hasn't been compared with recorded rides, and the docs say so. | [README](README.md), [model](docs/model.md) |
| Give each chart a data table for screen readers | Proposed | Screen readers only get a one-line summary of each chart. | [Accessibility](ACCESSIBILITY.md#known-limitations) |
| Refresh the forecast without reloading the route | Proposed | The forecast is cached in memory, so getting a newer one means loading the route again. | [Data and privacy](docs/data-and-privacy.md), [PR #1](https://github.com/kchan1028/ridewind/pull/1) |
| Write a contributing guide | Proposed | The README notes there isn't one yet. | [README](README.md#contributing) |

## Later

Larger questions with tradeoffs the owner would need to weigh.

| Item | Status | Why | Source |
| --- | --- | --- | --- |
| Sample the forecast at more than 20 points on long routes | Proposed | Each map section uses the nearest of at most 20 points. More points cost more weather-service calls on a free, rate-limited plan. | [Data and privacy](docs/data-and-privacy.md), [PR #1](https://github.com/kchan1028/ridewind/pull/1) |
| Add protection against other sites framing the app | Proposed | GitHub Pages can't send the header that blocks framing, so this depends on a hosting change. | [Security](SECURITY.md#known-limitations) |
| Model more of a real ride, such as stops or changes in power | Proposed | The model assumes steady riding with no stops, drafting or fatigue. Any of these would add settings for the rider to fill in. | [Model](docs/model.md) |

## Done

The design review's P0 to P3 items have all shipped:

- [PR #3](https://github.com/kchan1028/ridewind/pull/3): answer-first verdict, loading and error states, mobile bottom bar, direction cues on the map.
- [PR #4](https://github.com/kchan1028/ridewind/pull/4): tab order, inline save feedback, departure presets, type scale, press feedback, tap targets, dark-mode map colours.
- [PR #5](https://github.com/kchan1028/ridewind/pull/5): sunrise and sunset in the verdict, which PR #4 had left for later.

The full feature history is in the [merged pull requests](https://github.com/kchan1028/ridewind/pulls?q=is%3Apr+is%3Amerged).
