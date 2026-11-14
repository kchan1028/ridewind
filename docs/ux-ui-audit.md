# RideWind UX/UI audit

Date: 14 November 2026 · Build: `main` at `0d5ebd5` · Scope: review and plan only, no behaviour changes.

## Method and tooling

- **Impeccable** (design skill): loaded, along with its `audit` and `critique` references, and its project-context step ran. At the audited commit there was **no `PRODUCT.md`**, so the product truth here comes from `README.md`, `ACCESSIBILITY.md`, `docs/` and the code. [`PRODUCT.md`](../PRODUCT.md) and [`ROADMAP.md`](../ROADMAP.md) were added afterwards. The critique was run in **one context** (degraded: the skill asks for two isolated assessment agents). Its detector (`impeccable detect`) was run over `index.html`, `src/styles.css` and `src/ui/`.
- **Awesome Design**: two skills share the name (`awesome-design` and `anthropic-skills:awesome-design`). Both were read, and both are installers that copy the VoltAgent brand `DESIGN.md` library into a project. Neither has an audit procedure. Because this audit doesn't change the design direction, no brand library was copied into the repo and no brand system was applied.
- **Perspectives:** a product designer, a UX/UI designer and an avid cyclist. The cyclist perspective is used to raise hypotheses. It is no substitute for testing with riders (see [Questions for cyclist testing](#5-unverified-assumptions-and-questions-for-cyclist-testing)).
- **Evidence labels:** **Observed** means reproduced in the running app. **Source** means read in the code but not exercised. **Assumption** means it needs user research.

## 1. Overall assessment

RideWind does one job well. It answers "what wind will I ride into, and when?" for a GPX route, and it gives that answer first in a verdict, then backs it up with figures, charts and a table. The privacy story is unusually clear, the error handling for the forecast is solid, and accessibility work is visibly deliberate: native controls, live regions, a skip link, patterns as well as colours, and a reduced-motion variant.

The weak points sit where the product makes **recommendations** and where it is used **on a phone away from a desk**:

- The comparison awards **"Best" to departures that finish hours after dark**, and it does so over differences of 1–2 km/h.
- The rain summary states an alarming amount ("up to 4 mm/h") without saying it's only an 11% chance.
- Validation errors appear about 1,200 px from the field and silently undo what the rider typed.
- On a phone, the fixed verdict bar takes 22–27% of the screen while its small text is hard to glance at. The comparison table hides the reversed direction behind a sideways scroll.
- Nothing shows how old the forecast is at the point of decision, and nothing survives a reload with poor signal.

Impeccable's heuristic score is **26/40 (Acceptable)**: a solid foundation, with recommendation trust and mobile use outdoors as the main gaps.

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | The loading and error states are clear, but the forecast's age isn't shown near the verdict |
| 2 | Match with the real world | 3 | The wind language is good. The rain amount without a probability misleads |
| 3 | User control and freedom | 3 | The stepper, presets, reverse and Use controls are easy to undo |
| 4 | Consistency and standards | 3 | The temperature range differs between the KPI and the chart. Some messages appear three times |
| 5 | Error prevention | 2 | "Best" recommends night rides. Invalid input is silently reverted |
| 6 | Recognition rather than recall | 3 | Saved routes forget the direction, departure and pace |
| 7 | Flexibility and efficiency | 2 | No way to keep a "usual ride" set-up. Units are buried in a dialog |
| 8 | Aesthetic and minimalist design | 2 | The panel is about 4,700 px tall. The status line repeats the verdict |
| 9 | Error recovery | 2 | The forecast errors are good. Field validation is poor |
| 10 | Help and documentation | 3 | "Reading these numbers" and the field hints are helpful, if long |

## 2. What was inspected

**Devices and viewports (Chromium, in-app browser):**
- Desktop at 1280×800 (two-column layout, panel 440 px).
- Phone at 375×812 (mobile emulation with a touch user agent).
- Dark theme, the system default in the test browser. The light theme was not visually inspected; `ACCESSIBILITY.md` records the contrast measurements for both themes.

**Journeys:**

1. **First run → sample route → verdict** (desktop and phone).
2. **Import your own GPX**: source review only. The file picker can't be driven in the test browser. This covered the size limit, the parse errors and the "previous route is still loaded" message.
3. **Choose a departure**: the datetime field, presets, −1 h / +1 h, and the timezone note.
4. **Set your pace**: the constant speed and power models, the out-of-range values, and the elevation gate (source).
5. **Compare departures and directions**: Use, Best, and the spacing select.
6. **Read the detail**: KPIs, charts, the point-by-point table and the map markers.
7. **Save and reopen a route**: Save → "Saved ✓" → Saved routes list.
8. **Data & settings**: units, export, import, and delete all.

**States:** empty (first run), loading, ready, forecast error (Open-Meteo blocked in the page), invalid speed, invalid power, saved, and the dialog open. Offline and storage-denied were checked in source. The keyboard path was checked with Tab on the phone layout, along with the focus ring.

**Screenshots:** in [`docs/ux-ui-audit/`](ux-ui-audit/). The ready state is in [desktop-verdict-map.jpg](ux-ui-audit/desktop-verdict-map.jpg) and the departure controls on a phone are in [mobile-departure.jpg](ux-ui-audit/mobile-departure.jpg). Each finding below links its own evidence.

## 3. Prioritised findings

Severity: **P0** blocks the task; **P1** is a major problem or misleading result; **P2** causes real friction and has a workaround; **P3** is polish. Within each band, findings are ordered by user impact.

### P1-1 · "Best" departure ignores daylight and trivial differences

> **Status: fixed** in [#23](https://github.com/kchan1028/ridewind/pull/23). Dark rides are never Best, each option shows its finish time, and near-equal options get "No clear best". Capping rows at sunset is still open.

- **Where:** Compare departures and directions. `bestRow` in [`src/lib/compare.ts:74`](../src/lib/compare.ts); rows are built in [`src/ui/app.ts:486`](../src/ui/app.ts).
- **Observed:**
  1. Load **Berkeley to Morgan Territory** at 25 km/h with the default departure, Sat 14 Nov 11:00.
  2. The verdict shows a 5 h 36 min ride with sunset at 4:58 PM.
  3. The comparison marks **3:00 PM as Best**, with 10% headwind and an average 2 km/h tailwind. That ride would finish around 8:35 PM, 3.5 hours after sunset.
  4. The rows run to a 9:00 PM departure, and none of them mentions darkness.
  5. The "Best" margin over 11:00 is 9 percentage points of headwind and about 3 km/h of average wind.
- **Impact:** a rider who trusts the badge plans a ride that ends in the dark without lights, or rearranges their day for a difference they would never feel. The comparison is the product's main recommendation, so this damages trust in the rest of it.
- **Severity rationale:** P1. The badge actively recommends an unsafe choice. It isn't a P0 because the verdict elsewhere does warn about darkness for the selected departure.
- **Fix:**
  - Compute `rideDaylight` for every row.
  - Show each row's **finish time**, with "after sunset" or "before sunrise" marked as text.
  - Exclude dark rows from Best, or let the rider allow them.
  - Only award Best when the gap is meaningful, for example ≥10 percentage points of headwind share or ≥5 minutes of power-model time. Otherwise show "No clear winner. Wind is similar at all these times."
  - Cap the rows at the last departure that finishes before sunset, and add a "Show later times" link.
- **Evidence:** [desktop-sticky-verdict-compare.jpg](ux-ui-audit/desktop-sticky-verdict-compare.jpg)

### P1-2 · Rain summary states an amount without its likelihood

- **Where:** the verdict facts in [`src/ui/app.ts:135-138`](../src/ui/app.ts) and the Rain KPI.
- **Observed:**
  - On **PRS (clockwise)**, the verdict reads "rain up to 4.0 mm/h". The Rain KPI reads "Up to 4.0 mm/h · Highest chance 11%".
  - On **China Camp**, it reads "rain up to 5.8 mm/h" with a 10% chance.
  - The verdict, which is the only text on the phone bar, leaves out the probability entirely.
- **Impact:** 4–6 mm/h reads as a soaking. A rider glancing at the phone bar cancels or changes a ride that is 90% likely to stay dry. Showing the amount without the chance misstates the forecast.
- **Severity rationale:** P1. It misleads the headline answer that the product exists to give.
- **Fix:** put the chance first and the amount second, in plain words. For example: "10% chance of showers (up to 6 mm/h if it rains)". Below a threshold, say 20%, show "Low chance of rain" in the verdict and keep the amount for the KPI and table. Apply the same wording to the comparison's "rain 10%".
- **Evidence:** [mobile-result.jpg](ux-ui-audit/mobile-result.jpg), [mobile-charts.jpg](ux-ui-audit/mobile-charts.jpg)

### P1-3 · Field validation is far away, silent and destructive

> **Status: fixed** in the inline field errors PR. Errors now appear under the field, are linked and announced, and the typed value is kept.

- **Where:** speed in [`src/ui/app.ts:1015-1029`](../src/ui/app.ts); rider fields in [`src/ui/app.ts:844-861`](../src/ui/app.ts).
- **Observed:**
  1. On the phone, type **100** in Average moving speed and leave the field. The value snaps back to **25**. The only message, "Enter an average speed between 5 and 60 km/h", appears in the status line **1,199 px above** the field, off screen.
  2. Steady power **900** behaves the same way.
  3. No `aria-invalid` or `aria-describedby` is set.
- **Impact:** the rider believes their entry was accepted, or that the app ignored it. Imperial users who type a km/h figure from habit get a silent reset. Screen-reader users hear a status message with no link to the field.
- **Severity rationale:** P1 for usability, and it fails WCAG 3.3.1 (Error Identification) in spirit, because the error isn't identified at the field.
- **Fix:**
  - Show the error inline under the field and link it with `aria-describedby`.
  - Set `aria-invalid="true"` and keep the rider's typed value until they correct it.
  - Keep using the last valid value for the results, and say so: "Still using 25 km/h".
  - Use one helper for every numeric field.

### P2-1 · The verdict bar costs space but is hard to glance at outdoors

- **Where:** `.verdict` in [`src/styles.css:951`](../src/styles.css) (sticky on desktop) and [`src/styles.css:1065`](../src/styles.css) (fixed on the phone).
- **Observed:**
  - **Phone:** the bar is **178 px** of an 812 px screen, about 22%. On a 667 px phone it would be about 27%. The facts line is 13 px text in a dense middle-dot list, and the wind-bar key is hidden, so headwind red and tailwind blue have no labels in the bar.
  - **Desktop:** the sticky verdict is **270 px**, which covers about a third of the panel while the rider reads the comparison and the tables. It hides the table caption and header.
- **Impact:** at a café stop in sun, the rider needs one large answer (wind type, finish time, sunset, rain chance) at arm's length. Today they get small text and a bar that also hides the content they scroll to.
- **Fix:**
  - Give the bar two states. **Collapsed** is the default once the rider scrolls: the headline at 20 px or more, plus one 16 px line with the finish time and a daylight or rain flag, plus −1 h / +1 h. **Expanded** on tap adds the bar, key and facts.
  - On desktop, collapse it to one line after scrolling past the Route section.
  - Raise the stepper buttons to 48 px for gloved or wet fingers.
- **Evidence:** [mobile-result.jpg](ux-ui-audit/mobile-result.jpg), [desktop-sticky-verdict-compare.jpg](ux-ui-audit/desktop-sticky-verdict-compare.jpg)

### P2-2 · On a phone, the reversed direction is hidden behind a sideways scroll

> **Status: partly fixed** in the comparison cards PR. Below 600 px each departure is a card with both directions stacked and labelled, with no sideways scrolling, and explicit table roles keep screen-reader semantics. Trimming the point-by-point table's columns on phones is still open.

- **Where:** the comparison table inside `.table-wrap`.
- **Observed:**
  - At 375 px the table is **778 px wide** inside a 374 px frame for the point-by-point table, and 463 px for the comparison.
  - The **Reversed** column is cut off, so a Best badge in that column is invisible until the rider scrolls sideways.
  - The point-by-point table needs two screens of sideways scrolling.
- **Impact:** choosing a direction is half of the feature. A thumb-only user may never discover it.
- **Fix:**
  - Below 600 px, show one card per departure, with both directions stacked: "Original: 17% headwind · Use" and "Reversed: 9% headwind · Best · Use".
  - Or add a **Direction: Original | Reversed** segmented control above a single column.
  - For the point-by-point table, keep Distance, Arrive, Head/tail and Rain on the phone and put the rest behind "More columns".
- **Evidence:** [mobile-compare.jpg](ux-ui-audit/mobile-compare.jpg)

### P2-3 · Forecast age is hidden, and nothing survives a reload with poor signal

- **Where:** `#data-stamp` at the bottom of the results; the forecast is held only in memory (see `docs/data-and-privacy.md`). Offline behaviour was checked in source: there is no service worker or manifest.
- **Observed:**
  - "Forecast retrieved 10:13 AM… Reload the route to refresh the forecast." sits in small type below the point-by-point table.
  - There is no refresh control.
  - A tab left open overnight shows yesterday's forecast with no warning.
  - Reloading the page, or the phone discarding the tab, loses the forecast. With poor signal, the rider then sees "Couldn't reach Open-Meteo".
- **Impact:** checking the wind before a ride, or again at a stop, is the core habit. Stale or missing data at that moment undermines the decision.
- **Fix:**
  - Show "Updated 10:13 (12 min ago)" in the verdict, with a **Refresh** button.
  - On `visibilitychange`, refetch automatically when the forecast is more than 60 minutes old, and say so.
  - Cache the last forecast for each **saved** route in IndexedDB with its timestamp, and show it as "Last forecast from 07:40, offline" when the network fails.
  - Add an offline-capable app shell. Don't cache OSM tiles, to stay within the tile policy.

### P2-4 · Saved routes don't remember how you ride them

- **Where:** `packRoute(state.original)` in [`src/ui/app.ts:772`](../src/ui/app.ts) saves geometry only.
- **Source:** reopening a saved route resets it to the file's direction and the next hour. The pace model is global, not per route.
- **Impact:** a weekly "Saturday loop, anticlockwise, 08:00, 28 km/h" needs three or four steps every time, and it's easy to forget the reverse, which flips the whole verdict.
- **Fix:** save the direction and the preferred departure time of day with the route, and restore them when it opens. Show "Saturday 08:00 · reversed" in the saved list. Changing a preference doesn't create a separate route.

### P2-5 · First run on a phone opens on an empty map

- **Observed:**
  - At 375 px, the first screen is a 52 vh map of the Bay Area with nothing on it.
  - Import GPX and the sample select start at about 640 px.
  - The brand tagline is hidden on narrow screens, so there's no sentence saying what the app does.
- **Impact:** first-time visitors from a link don't see the value or the first action. Riders outside the Bay Area see somebody else's map.
- **Fix:**
  - Until a route loads, shrink the map to a short strip, or hide it, and lead with one sentence ("See the wind you'll ride into, timed to when you reach each part of your route") plus the two actions.
  - Expand the map once a route loads.
- **Evidence:** [mobile-first-run.jpg](ux-ui-audit/mobile-first-run.jpg)

### P2-6 · Units are hidden in "Data & settings", and metric is always the default

- **Where:** `DEFAULT_SETTINGS.units = 'metric'` in `src/lib/storage.ts`; the control is in the dialog.
- **Impact:** US and UK riders (mph) start in km/h and may not think to look under "Data". Speed validation then quotes km/h limits.
- **Fix:**
  - Default the units from `navigator.language`, with en-US as imperial.
  - Add a small km/h | mph switch next to Average moving speed.
  - Rename the dialog to "Settings & data".

### P2-7 · Wind chart is noisy and axes lack units on a phone

- **Where:** [`src/ui/charts.ts`](../src/ui/charts.ts).
- **Observed:**
  - "Wind along your direction" draws a spike at every change of GPS bearing, which forms a white comb on the PRS and China Camp routes.
  - The y-axis reads ±13 with no unit.
  - The last two x labels run together ("82.1 km109.4 km").
- **Impact:** the chart's job, showing where the headwind stretches are, is lost in noise.
- **Fix:**
  - Smooth the headwind component over about 500 m to 1 km.
  - Label the unit on the axis ("km/h").
  - Use fewer x ticks below 400 px.
  - Use the same band colours as the map.
- **Evidence:** [mobile-charts.jpg](ux-ui-audit/mobile-charts.jpg)

### P2-8 · Secondary touch targets are below 44 px

- **Observed sizes:**
  - Presets: 40 px.
  - −1 h / +1 h: 40 px. These are the main controls on the phone bar.
  - Use: 32 px.
  - Open and Delete: 36 px.
  - Leaflet zoom on desktop: 30 px.
  - These meet WCAG 2.5.8 (24 px) but not 44 px. This is already listed in `ACCESSIBILITY.md`.
- **Impact:** a rider stopped at the roadside with gloves on, or at a cold café table, misses taps. Open and Delete sit next to each other.
- **Fix:**
  - Use 44 px minimum everywhere and 48 px for the stepper.
  - Leave at least 8 px between Open and Delete.
  - Make Use a full-width row target in the phone card layout (see P2-2).

### P3-1 · One error, three messages

- **Observed:** with the forecast blocked, the same sentence appears in the status line, the verdict bar and the Conditions alert. A screen reader hears it at least twice (`role=status` and `role=alert`).
- **Fix:** keep the verdict for display and announce through a single region. Clear the status line when the verdict carries the same message. Do the same with "Forecast ready for …", which duplicates the verdict and pushes Route down on the phone.
- **Evidence:** [mobile-forecast-error.jpg](ux-ui-audit/mobile-forecast-error.jpg)

### P3-2 · Start and Finish labels collide on loop routes

- **Where:** [`src/ui/map.ts:82-85`](../src/ui/map.ts).
- **Observed:** on loop routes, the labels sit side by side over one point. On the phone, "Finish" is clipped at the map edge on PRS.
- **Fix:** when the start and finish are within about 200 m of each other, show one "Start / Finish" label. Keep labels inside the map bounds with `autoPan` padding.

### P3-3 · KPI and chart disagree slightly

- **Observed:** the temperature KPI says 12–16°C while the chart summary says 12–17°C, on the same route. One uses the sampled points and the other the simulation steps.
- **Fix:** derive both from the same series.

### P3-4 · Detector findings (Impeccable)

- **Flat type hierarchy (`index.html`):** a false positive. The static scan doesn't see the CSS, and the verdict headline (24 px) and section headings do form a hierarchy.
- **Side-tab and border accents (`styles.css:274`, `:959`, `:1077`):** the verdict border carries the wind type, and the crosswind border is dashed, so it isn't colour alone. That is functional, so keep it. The warning callout's left border is decorative and could become a full outline, but it's low priority.

## 4. Strengths worth preserving

- **The answer comes first.** The verdict headline ("Mostly crosswind") plus the finish and sunset times answer the real question before any detail.
- **Wind type isn't shown by colour alone.** Solid, dashed and dotted map lines, a striped crosswind bar, and text headlines.
- **Privacy is explained at the moment it matters.** "Your file is read in this browser… about 20 rounded points are sent" sits right under Import.
- **The forecast error is handled well.** The error is specific, a retry sits next to it, and the route stays loaded.
- **The provenance labels (forecast, estimate, calculated)** are honest and unobtrusive.
- **The timezone handling uses the route's local zone**, and it says so when the device's zone differs. That matters for travel rides.
- **The elevation gate refuses to assume a flat route**, explains the trade-off, and states the API cost.
- **The keyboard work holds up.** A skip link, a native dialog, a visible 3 px focus ring, and focus that stays visible above the phone bar in testing.
- **Reduced motion is handled with care.** It keeps fades and drops scale and movement, which is better than a blanket kill.

## 5. Unverified assumptions and questions for cyclist testing

These are hypotheses from the cyclist perspective. Test them with 5–8 riders, mixing road and gravel riders, metric and imperial users, and people who use or don't use power meters. Each task is done twice: once at home planning a ride, and once standing outdoors with a phone.

1. **Arrow convention:** the map arrows show where the wind **goes to**, while the table says "from NW". Do riders read the arrows correctly without the legend? Would "wind from" arrows match their mental model better?
2. **What makes a time best?** Do riders choose by headwind share, tailwind on the way home, rain, finish before dark, or temperature? Does anyone trust a single badge?
3. **Headwind on the way home:** is "headwind one way, tailwind the other" enough, or do riders want "Tailwind for the last 30 km" stated outright?
4. **The 45° sectors and the calm threshold below 5 km/h:** do these labels match what riders feel? Is 10 m wind at the "Mixed" exposure level believable?
5. **Power mode:** do riders know their CdA and Crr, or do they want presets such as "Road, hoods" or "Gravel"? Does a time estimate from power change any decisions?
6. **Use at a stop:** at a café, what do riders look at? Probably the verdict for the rest of the ride. That suggests a "from here" mode that starts the plan from the current position and time, which doesn't exist today.
7. **Glare:** can the verdict be read at arm's length in direct sun in both themes? Do riders want a high-contrast outdoor mode?
8. **Rain wording:** which phrasing leads to the right go or no-go decision ("10% chance, up to 6 mm/h" or "Low chance of showers")?
9. **The re-check habit:** do riders open RideWind again on the morning of the ride? From a saved route, or by importing again from Strava or Komoot? This decides how much P2-3 and P2-4 matter.
10. **Units:** do UK riders want mph with °C?

## 6. Implementation plan

Ordered by user impact relative to effort. "S" is under half a day, "M" is one to two days, "L" is three days or more. Each step is independently shippable and needs no redesign of working patterns.

| # | Change | Fixes | Impact | Effort | Notes |
|---|---|---|---|---|---|
| 1 | ~~Daylight-aware, threshold-based comparison~~ **Done in #23** | P1-1 | High | S–M | Row cap at sunset still open |
| 2 | Rain wording led by probability, in the verdict, KPI and comparison | P1-2 | High | S | Copy plus `verdict` facts; test the thresholds |
| 3 | Inline field validation helper (`aria-invalid`, `aria-describedby`, keep the typed value) | P1-3 | High | S | One helper for speed and the six rider fields |
| 4 | Collapsible, glanceable verdict bar (collapsed on scroll, larger text, 48 px stepper, "Updated X min ago" and Refresh) | P2-1, P2-3 (part), P2-8 (part) | High | M | The biggest change for use outdoors; check with VoiceOver |
| 5 | Phone layout for the comparison (cards or a direction toggle) and reduced columns for the point-by-point table | P2-2 | Med–High | M | Keep the table on desktop |
| 6 | Auto-refresh when the forecast is stale, plus a cached last forecast for saved routes (offline fallback) | P2-3 | Medium | M | Respect the OSM tile policy (no tile caching) |
| 7 | Saved routes remember the direction and usual departure time | P2-4 | Medium | S–M | Schema version bump in `storage.ts` |
| 8 | Units from the locale, plus an inline speed-unit switch | P2-6 | Medium | S | |
| 9 | Compact first-run screen on the phone (short map, value sentence, two actions) | P2-5 | Medium | S | |
| 10 | Chart smoothing, axis units and tick thinning | P2-7 | Medium | S–M | |
| 11 | Touch targets of at least 44 px and spacing between Open and Delete | P2-8 | Low–Med | S | Update `ACCESSIBILITY.md` |
| 12 | De-duplicated status and alerts; a merged Start/Finish label; one series for the temperature range | P3-1 to P3-3 | Low | S | |

Before step 4, run the riders' test from section 5, at least questions 2, 6 and 8, because the answers decide what the collapsed bar shows. After the changes, run a screen-reader pass (VoiceOver on iOS, NVDA), 200% zoom, and outdoor readability checks. `ACCESSIBILITY.md` lists all three as untested.
