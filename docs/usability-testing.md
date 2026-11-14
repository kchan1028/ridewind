# Usability testing with cyclists

**Status, 14 November 2026: no sessions with riders have been run.** Most of this page is a plan. One [expert walkthrough of the live site](#expert-walkthrough-of-the-live-site-14-november-2026) has been done: Claude, an AI assistant, worked through the main flows on desktop and phone. That walkthrough isn't participant research. It shows where the interface breaks, but not what riders think or do, so the [completed research](#completed-research) section stays empty until a real session happens.

The plan tests RideWind's four core journeys from [PRODUCT.md](../PRODUCT.md#how-do-cyclists-use-it) with real riders. It turns the hypotheses in the [UX/UI audit](ux-ui-audit.md#5-unverified-assumptions-and-questions-for-cyclist-testing) into tasks you can observe. The audit was written from a designer's and a cyclist's point of view, without riders, so each of its findings is still a hypothesis until a session confirms or rejects it.

**Safety rule for every session: participants only touch the app while stopped.** No task is done while riding, and no session asks anyone to ride. Outdoor tasks happen standing or sitting at a safe spot off the road, with the bike parked.

## What do we want to learn?

Each research question is tied to a core journey and to the audit item it would confirm or reject.

| # | Question | Journey | Audit link |
| --- | --- | --- | --- |
| R1 | Can a first-time visitor tell what RideWind does and load a route without help, on a phone? | Check a planned ride | P2-5 |
| R2 | Do riders read the verdict correctly: wind type, where the headwind is, finish time, daylight, rain? | Check a planned ride | P1-2, Q3, Q8 |
| R3 | Do riders read the map arrows the right way round ("blowing towards") without the legend? | Check a planned ride | Q1 |
| R4 | How do riders decide which departure or direction is best, and do they trust the **Best** mark? | Choose the best time or direction | P1-1, Q2 |
| R5 | On a phone, do riders find and use the reversed direction? | Choose the best time or direction | P2-2 |
| R6 | Can riders who train with power set up the power model, and does the result change any decision? | Get a realistic ride time | Q5 |
| R7 | Do riders understand the elevation choice when a route has none? | Get a realistic ride time | Source review only |
| R8 | When a value is out of range, do riders notice the error and know what happened to their entry? | Get a realistic ride time | P1-3 |
| R9 | Can riders save a route, reopen it, and move it to another device? What do they expect a saved route to remember? | Keep and move routes | P2-4, Q9 |
| R10 | Do riders who think in mph find the units setting? | All | P2-6, Q10 |
| R11 | Stopped outdoors, can a rider get the answer they need from the phone at arm's length, in sun, with gloves? | All | P2-1, P2-8, Q6, Q7 |
| R12 | Do riders notice how old the forecast is, and what do they do with poor signal? | Check a planned ride | P2-3 |

"Q" numbers refer to the questions in section 5 of the audit; "P" numbers to its findings.

## Who should take part?

Aim for **5 to 8 riders per round**. Five is usually enough to surface the larger problems; more helps when profiles differ a lot. Recruit by profile, not by person, and cover each row below at least once across the round.

| Profile | Why it matters | Covers |
| --- | --- | --- |
| Road rider who plans long rides (3 h or more) and already uses GPX routes | The main audience in PRODUCT.md | R1–R5, R9 |
| Rider who trains with a power meter | The only group who can judge the power model | R6, R7 |
| Rider who doesn't use power and rides by feel | Checks that the speed path is enough on its own | R2, R4 |
| Rider who thinks in mph (US or UK) | Default units are metric | R8, R10 |
| Gravel or mixed-surface rider | Different shelter, rolling resistance and idea of "exposed" | R2, R6 |
| Rider who plans mostly on a phone | Mobile layout and outdoor use | R5, R11 |
| Rider who uses a screen reader or zoom, if one can be recruited | Accessibility gaps that are listed but untested | All; see [Accessibility](../ACCESSIBILITY.md#known-limitations) |

One rider can fill several rows. Exclude people who worked on RideWind, since they already know the interface.

### Screener questions

Ask only what decides the profile. Record answers as categories, not free text.

1. How often do you plan a ride in advance? (Most rides / some / rarely)
2. Do you usually have the route as a GPX file? From what kind of app? (Category only, for example "route planner" or "training app")
3. Do you ride with a power meter? (Yes / no)
4. Do you think in km/h or mph?
5. Which device do you normally plan a ride on? (Phone / tablet / computer)
6. Do you use a screen reader, magnification or other assistive technology? (Optional)

### Personal information: what not to collect

- **No names, emails or phone numbers in this repository.** Use participant codes (P01, P02, ...). Keep the key that maps codes to contact details outside the repo, and delete it once the round's findings are logged.
- **Don't keep participants' own GPX files.** A route usually starts and ends at home. If a rider wants to use their own route, they load it on their own device, and nobody copies, screenshots or uploads it. Screenshots for the log use the sample routes only.
- **No face or voice recordings** unless the participant agrees in writing, and only if notes alone won't do. Screen recordings must not show the map of a personal route.
- **Don't record age, gender, body weight, FTP or exact location.** If a power task needs a weight, the rider can type a made-up number. RideWind keeps it only in that browser; clear it at the end (see [after the session](#after-the-session)).
- **Quotes go in the log only when they're short, needed to explain a finding, and stripped of anything identifying.**

## What do you need before a session?

- **A fixed build.** Record the commit or deployed version for each session. The interface changes between rounds; for example, [PR #23](https://github.com/kchan1028/ridewind/pull/23) changes how **Best** is chosen. Findings only make sense against the build that produced them.
- **Devices.** One phone for every session, plus a laptop for the planning part. Note the phone model, browser, and light or dark theme.
- **A clean browser.** Use a private window, or clear RideWind with **Data & settings → Delete all local data** before each participant, so nobody sees the previous person's saved routes or settings.
- **Routes.** The three bundled samples: Berkeley to Morgan Territory, China Camp and Nicasio Valley, and PRS (clockwise). For R7, prepare one test GPX file with no elevation, drawn along public roads and kept with the test materials. Never use a real rider's file for this.
- **Forecast conditions.** The forecast is live, so verdicts differ by day. Before each session, load each sample and note the verdict, the **Best** row and the rain wording, so the observer knows what the participant should be seeing.
- **Outdoor spot.** A bench, café terrace or car park away from traffic, ideally in direct sun at least once per round. Have a bad-weather plan: move under cover and note that the glare task wasn't done.
- **Consent.** A short form covering what's recorded, that the participant can stop at any time, and that nothing identifying goes into the project.

## How does a session run?

About 60 minutes, with a facilitator and, if possible, a separate note-taker.

| Time | Part | Notes |
| --- | --- | --- |
| 0–5 min | Welcome and consent | "We're testing the app, not you. There are no wrong answers." Ask them to think aloud. |
| 5–10 min | Background | Screener answers, how they check the wind today, what makes "a bad wind day". |
| 10–40 min | Planning tasks, indoors | T1–T8. Use the phone for riders who plan on a phone, the laptop otherwise. T1 is always on the phone. |
| 40–55 min | Outdoor tasks, stopped | T9–T11 on the phone, bike parked, rider standing or seated off the road. |
| 55–60 min | Wrap-up | What they'd change, whether they'd use it again. Then cleanup. |

### Facilitator rules

- Read scenarios as written. Don't name buttons, sections or labels from the app.
- Don't help unless the participant is stuck for about two minutes or asks to move on. Note where help was given and what was said.
- Ask "What do you expect to happen?" rather than "Did you see the ...?"
- Don't explain how RideWind works until the end.
- End an outdoor task at once if the spot becomes unsafe, or if the participant starts to wheel or ride the bike while using the phone.

## Task scenarios

The wording is neutral: it describes the rider's goal, not the interface. Each task lists what counts as success, so observers score it the same way.

Score every task as **Success** (done without help), **Partial** (done with a hint, or done with a misreading the participant didn't notice) or **Fail** (gave up, or the facilitator had to do it). Also note time on task and the participant's own confidence from 1 to 5.

### T1 · First look (R1)

> "A friend sent you this link and said it helps with planning rides around the wind. Take a look and tell me what you think it does. Then get it to show you something useful."

- **Start:** phone, fresh browser, app open on its first screen.
- **Success:** explains the purpose in their own words, then loads a sample route or their own GPX within 2 minutes without help.
- **Observe:** the first thing they tap; whether they scroll past the empty map; whether they notice the privacy note under the route import.

### T2 · Read the result (R2, R3)

> "Say you're doing this ride at the time it's showing. Tell me what the wind will be like. Where will it be hardest? Would you go?"

- **Start:** Berkeley to Morgan Territory loaded at the default departure.
- **Success:** correctly states the main wind type, roughly where the headwind is (start, middle, end, or a part of the map), the finish time, and whether the ride ends after sunset. The go / no-go reason matches what's on screen.
- **Follow-up (R3):** point to one map arrow and ask "Which way is the wind blowing here?" Success is the correct direction without opening the legend.
- **Follow-up (rain):** "How likely are you to get wet?" Success is an answer that matches the forecast chance, not just the amount.

### T3 · Leave at a different time (R4)

> "You can leave any time tomorrow morning. Find a time that suits the wind."

- **Success:** changes the departure time and can say how the wind changed. Any method counts: the time field, the hour steps, a quick preset or the comparison.
- **Observe:** which method they reach for first; whether they notice the time zone note when the route is outside their device's zone.

### T4 · Pick the best option (R4, R5)

> "You're free all day and don't mind which way round you ride. Find the time and direction you'd actually choose, and set the app to that."

- **Start:** any sample with the comparison in view; ideally a day when the **Best** row finishes after dark (check during setup).
- **Success:** picks a departure and a direction, applies it, and gives a reason. On a phone, considers the reversed direction without being prompted.
- **Observe:** what the choice is based on (headwind, tailwind on the way home, rain, daylight, temperature); whether they follow the **Best** mark, question it or ignore it; whether they find the reversed column on a phone; whether the earlier options are still there after they press **Use** a few times, and what they do if not ([W5](#w5--comparison-restarts-at-the-chosen-departure-p2-new), [#32](https://github.com/kchan1028/ridewind/issues/32)).
- **Keyboard or screen-reader participants:** after each **Use** or preset, note where focus lands and whether they can carry on without going back to the top ([W4](#w4--keyboard-focus-lost-after-use-presets-and-retry-p2-new), [#31](https://github.com/kchan1028/ridewind/issues/31)).
- **Not a success criterion:** agreeing with the **Best** mark. The aim is to learn how riders choose.

### T5 · A more accurate ride time (R6, R7)

Only for riders who train with power. Others skip to T6.

> "The finish time is based on an average speed. Make it reflect how you'd actually ride this route."

- **Start:** a sample route with elevation, then again with the prepared no-elevation GPX file.
- **Success:** switches to the power model, enters plausible values (a made-up weight is fine) and gets a new finish time. With the no-elevation file, makes a deliberate choice between looking up elevation and treating the route as flat, and can say what that choice means.
- **Observe:** whether they know their CdA and Crr or rely on the hints; whether the new time would change any decision. With the no-elevation file: whether they notice that the wind answer has disappeared, and whether they find the elevation buttons on a phone ([W6](#w6--no-wind-verdict-for-a-route-without-elevation-in-power-mode-p2-new), [#33](https://github.com/kchan1028/ridewind/issues/33)).

### T6 · Your usual pace (R8, R10)

> "Set the app to the speed you normally average on a ride like this."

- **Success:** the speed afterwards matches what the participant meant, in the units they think in.
- **Observe:** riders who think in mph typing an mph figure into a km/h field; whether an out-of-range value is noticed; what they think happened to their entry; whether they find the units setting.
- **Don't** ask anyone to type a wrong value on purpose. Only observe what happens naturally.

### T7 · Keep this route (R9)

> "You ride this loop most weekends. Make it easy to come back to next time."

- **Success:** saves the route, reloads the page and reopens it from the saved list.
- **Follow-up:** "What do you expect it to remember about how you ride it?" Note the answer, then let them check. Record any mismatch (direction, departure time, pace).

### T8 · Use it on another device (R9)

> "You planned this on your laptop. How would you get it onto your phone?"

- **Success:** finds the export in **Data & settings**, or describes another way that works, such as importing the GPX again. They can stop before actually moving the file.
- **Observe:** whether they expect an account or automatic sync.

### T9 · Glance check at a stop (R11)

Outdoors, bike parked, phone in hand, gloves on if they'd normally wear them.

> "You've stopped for a coffee partway through. Hold the phone the way you normally would. Is it a headwind for the rest of the ride, when will you finish, and will it be dark?"

- **Start:** the facilitator loads a ride on the phone and hands it over showing the result.
- **Success:** answers all three correctly within about 10 seconds, at a normal holding distance, without zooming.
- **Observe:** squinting, shading the screen, turning up brightness, mis-taps on the hour steps or other small buttons; light versus dark theme if both are tried.
- **Note:** RideWind has no "from here" mode, so "the rest of the ride" relies on the rider reading the full-ride result. Record how they cope with that; it informs audit question 6.

### T10 · Change plans at the roadside (R11)

> "Your friend is running late and you'll set off an hour later. What does that change?"

- **Success:** moves the departure by an hour with gloves on and reads the new verdict. Count mis-taps.

### T11 · Patchy signal (R12)

Optional, and only if it can be simulated safely, for example with airplane mode.

> "You opened this before you left home this morning. Is what it's showing still up to date?"

- **Start:** a result loaded at least an hour earlier, or the page reloaded with the phone offline.
- **Success:** finds when the forecast was retrieved, or recognises the error and knows what to do next.

## Mobile and outdoor considerations

- **Phone first.** Every participant does at least T1, T9 and T10 on a phone. The audit's mobile findings (the bottom verdict bar, sideways-scrolling tables, small buttons) only show up there.
- **Record the device.** Screen size, browser, theme, and whether the bottom verdict bar covered something they needed.
- **Light.** Note sun, shade or overcast for each outdoor task. A glare finding only counts if the task was done in direct sun.
- **Gloves and cold.** Ask riders to wear what they'd ride in. Count mis-taps and taps on the wrong neighbouring button, for example **Open** and **Delete** in the saved list.
- **One hand.** Note whether they hold the phone in one hand and tap with the thumb.
- **Signal.** Note connection quality. Load the result before going outside, unless running T11, so the session doesn't depend on mobile data.
- **Stopped means stopped.** Bike parked or leaning, rider off it, away from traffic and footpaths. The facilitator ends the task if this stops being true.

## Observation template

Copy this block for each participant and task. Keep filled-in copies out of the repository unless every field is free of personal details.

```markdown
### P__ · T__ · <task name>

- Date / build (commit or deployed version):
- Device / browser / theme:
- Setting: indoors | outdoors (sun / shade / overcast) | gloves: yes / no
- Route used: <sample name> | participant's own (not recorded)
- Result: Success | Partial | Fail
- Time on task:
- Confidence (1–5, participant's rating):
- Help given (what was said):

What they did, in order:
1.
2.

What they said (short, non-identifying):
-

Misreadings or errors:
-

Research question(s): R__
Possible finding (link to findings log row, if any):
```

## Expert walkthrough of the live site, 14 November 2026

**What this is:** an inspection of <https://kchan1028.github.io/ridewind/> by Claude, an AI assistant, using the in-app Chromium browser. It walked through the task scenarios above without participants. It confirms what the interface does. It can't say how riders understand it, so none of these findings count towards the [validation rule](#how-do-findings-reach-github-issues-and-the-roadmap). Each one is a hypothesis that the participant sessions should check.

**Build tested:** the live site was serving the deploy of `0d5ebd5`, the same build the [UX/UI audit](ux-ui-audit.md) inspected. Some fixes have merged to `main` since then but hadn't been deployed when this walkthrough ran, so the live site still shows the problems they fix. The **Status** column below says where that applies.

### What was tested

| Area | How | Viewport |
| --- | --- | --- |
| First screen and loading a sample (T1) | Opened the site; loaded all three samples | 1280×800 desktop; 375×812 phone with touch emulation |
| Reading the verdict, KPIs, charts, point-by-point table (T2) | Read the page text and checked it against the screen | Both |
| Changing departure: stepper, presets, comparison **Use** (T3, T4) | Clicked controls; recorded the departure, verdict and focus after each | Both |
| Power model (T5) | Switched model; read defaults, limits and the ride-time KPI | Desktop |
| Route with no elevation (T5) | Loaded a generated 11 km GPX with no elevation through the file input in script | Phone |
| Invalid GPX | Loaded a text file named `.gpx` the same way | Phone |
| Out-of-range speed (T6) | Entered 100 km/h and left the field | Desktop |
| Reverse, save, reload, reopen (T7) | Saved a reversed sample, reloaded, reopened it | Desktop |
| Data & settings dialog (T8) | Opened it; checked focus, modal state and Escape | Desktop |
| Forecast failure and retry (T11) | Made the page's requests to Open-Meteo fail, loaded a sample, then retried | Phone |
| Accessibility in the DOM | Headings, landmarks, `aria-invalid` and `aria-describedby`, focus after each action, target sizes | Both |

The test browser already held one saved route (*Sample: Afsluitdijk crossing (approximate)*) from earlier work. The walkthrough left it alone. It deleted the route it saved itself and set the pace model back to constant speed.

### What couldn't be verified

- **How riders understand it:** reading the map arrows, the rain wording, whether **Best** is trusted, what a saved route should remember. Only participant sessions can answer these (R2–R4, R9).
- **Outdoor use:** glare, gloves, one-handed use and arm's-length reading (T9, T10). Touch was emulated; target sizes were measured, not tapped.
- **Real devices:** iOS Safari and Android Chrome weren't used. The phone results come from Chromium emulating a phone.
- **Screen readers, 200% zoom and high-contrast mode:** only the markup was inspected. Nothing was listened to.
- **The native file picker and real offline use:** files went through the file input from a script, and the forecast failure was simulated in the page, not with the network off. Losing the tab or reloading with no signal wasn't tested.
- **Light theme, imperial units, export and import of data, and Delete all local data.** Delete wasn't run, so the existing test data wasn't wiped.
- **Keyboard use of the map** and routes in other time zones.

### Findings

Severity uses the audit's scale: **P0** blocks the task, **P1** is a major problem or misleading result, **P2** is real friction with a workaround, and **P3** is polish. Findings marked *New* aren't in the audit. The rest re-confirm audit findings on the live site, which keeps the audit's evidence and adds these repro steps.

| ID | Finding | Severity | Audit | Status (rechecked on live build `15a7709`, 14 Nov) |
| --- | --- | --- | --- | --- |
| W1 | **Best** goes to rides that finish in the dark, and to differences of a minute or two | P1 | P1-1 | Resolved on live ([PR #23](https://github.com/kchan1028/ridewind/pull/23)) |
| W2 | The verdict states a rain amount without its chance | P1 | P1-2 | Resolved on live ([PR #27](https://github.com/kchan1028/ridewind/pull/27)) |
| W3 | Speed error appears far from the field and the typed value is reverted | P1 | P1-3 | Resolved on live ([PR #28](https://github.com/kchan1028/ridewind/pull/28)) |
| W4 | Keyboard focus is lost after **Use**, a preset, or **Retry forecast** | P2 | *New* | Still present on live; fixed on `main` by [PR #48](https://github.com/kchan1028/ridewind/pull/48) ([#31](https://github.com/kchan1028/ridewind/issues/31)), not deployed |
| W5 | The comparison restarts at the chosen time, so earlier options disappear | P2 | *New* | Still present on live; fixed on `main` by [PR #48](https://github.com/kchan1028/ridewind/pull/48) ([#32](https://github.com/kchan1028/ridewind/issues/32)), not deployed |
| W6 | In power mode, a route with no elevation shows no wind verdict | P2 | *New* | Not rechecked; fixed on `main` by [PR #48](https://github.com/kchan1028/ridewind/pull/48) ([#33](https://github.com/kchan1028/ridewind/issues/33)), not deployed |
| W7 | A saved route forgets its direction and departure | P2 | P2-4 | Resolved on live ([PR #43](https://github.com/kchan1028/ridewind/pull/43)) |
| W8 | Phone: the fixed verdict bar takes 178 px of 812 | P2 | P2-1 | Partly resolved on live ([PR #36](https://github.com/kchan1028/ridewind/pull/36)): larger headline and one-line summary, but the bar is still 172 px |
| W9 | Phone: the **Reversed** column is cut off | P2 | P2-2 | Comparison resolved on live ([PR #40](https://github.com/kchan1028/ridewind/pull/40)); the point-by-point table still scrolls sideways |
| W10 | Phone: the first screen is an empty map | P2 | P2-5 | Still present on live |
| W11 | Small touch targets: stepper, presets, **Use**, **Open**, **Delete** | P2 | P2-8 | Resolved on live ([PR #25](https://github.com/kchan1028/ridewind/pull/25)) |
| W12 | One forecast error shown three times | P3 | P3-1 | Not rechecked |
| W13 | The status line keeps an out-of-date "Using ..." message | P3 | *New* | Still present on live; fixed on `main` by [PR #48](https://github.com/kchan1028/ridewind/pull/48) ([#34](https://github.com/kchan1028/ridewind/issues/34)), not deployed |
| W14 | The sample menu goes back to "Try a sample route…" after loading | P3 | *New* | Still present on live; fixed on `main` by [PR #48](https://github.com/kchan1028/ridewind/pull/48) ([#35](https://github.com/kchan1028/ridewind/issues/35)), not deployed |
| W15 | A comparison row that finishes late in the evening is labelled "before sunrise" | P3 | *New* | Found in the recheck; no issue yet |

#### W1 · Best goes to dark rides and to trivial differences (P1)

- **Steps:**
  1. Desktop, constant speed 25 km/h. Load **Berkeley to Morgan Territory**. The departure defaults to Sat 14 Nov, 11:00 AM.
  2. The verdict gives 5 h 36 min and a 04:58 PM sunset. The comparison marks **3:00 PM** as Best.
  3. Press **Use** on that row. The verdict reads "finish 08:35 PM · finishes after sunset (04:58 PM)".
  4. Phone, power model at the defaults. Load **China Camp and Nicasio Valley**. Best is 1:00 PM at 3 h 12 min, against 3 h 14 min for 11:00 AM.
- **Impact:** the main recommendation sends riders out in the dark, or makes them rearrange their day to save two minutes.
- **Fix:** deploy `main`, then check the live site against these steps. PR #23 already makes this change.

#### W2 · Rain amount without its chance (P1)

- **Steps:** load **PRS (clockwise)**. The verdict reads "rain up to 4.7 mm/h". On **China Camp and Nicasio Valley**, it reads "rain up to 2.5 mm/h", while the Rain KPI gives the highest chance as 10%.
- **Impact:** on a phone the verdict bar is the only summary in view, and it reads like a wet ride.
- **Fix:** deploy `main` (PR #27), then recheck the wording with riders (R2, audit Q8).

#### W3 · Speed error far from the field, value reverted (P1)

- **Steps:** desktop. Type `100` in **Average moving speed** and leave the field.
- **Observed:**
  - The field goes back to 25.
  - "Enter an average speed between 5 and 60 km/h" appears in the status line, 1,281 px above the field and off screen.
  - The field has no `aria-invalid` or `aria-describedby`.
- **Impact:** the rider doesn't know their entry was rejected. Screen-reader users get no link between the message and the field.
- **Fix:** PR #28. Show the error under the field, keep the typed value, set `aria-invalid` and link the message to the field.

#### W4 · Keyboard focus lost after Use, presets and Retry (P2, new)

- **Steps:** with the keyboard, focus **Use** on any comparison row and press Enter. Then do the same with **Tomorrow 08:00**, and with **Retry forecast** after a forecast error.
- **Observed:** each time, focus moves to `<body>`. The control was re-rendered or hidden. The next Tab starts again from the top of the page.
- **Impact:** keyboard and screen-reader users lose their place in a long page, about 4,700 px on desktop, after the comparison's main action. WCAG 2.4.3, Focus Order. The −1 h / +1 h buttons keep focus, so the behaviour is also inconsistent.
- **Fix:** after re-rendering, put focus back on the matching control: the new **Selected** cell, the same preset, or the verdict heading after a retry. Keep the preset buttons in the DOM instead of rebuilding them.

#### W5 · Comparison restarts at the chosen departure (P2, new)

- **Steps:** load **Berkeley to Morgan Territory** at 11:00 AM. The comparison lists 11:00 AM to 9:00 PM. Press **Use** on 3:00 PM, then on 7:00 PM.
- **Observed:** after each **Use**, the list starts at the new departure. After two presses it runs from 7:00 PM to 5:00 AM the next day. The earlier options are gone, and the only way back is −1 h, one step at a time.
- **Impact:** a rider trying options loses the ones they've already seen, and can't compare back to the original time. The list fills with night departures. This is the closest thing to a dead end found.
- **Fix:** keep the comparison anchored to the first departure the rider chose, or to the start of that day, with **Selected** moving within it. Add "Earlier times" and "Later times" controls. Combine this with the daylight cap from PR #23.

#### W6 · No wind verdict for a route without elevation in power mode (P2, new)

- **Steps:** phone, power model. Import a GPX with no elevation data.
- **Observed:** the verdict headline reads "Elevation needed for power timing", with "Look up elevation or choose to estimate as if flat, under Departure and pace". No wind summary is shown. The two buttons are further down the page, not in the verdict.
- **Impact:** the rider's main question, the wind, goes unanswered because of a timing setting. On a phone the buttons are out of view.
- **Fix:** show the wind verdict using constant-speed timing, labelled as such, until the rider chooses. Put **Look up elevation** and **Estimate as if flat** in the verdict too. The rule against quietly assuming flat (PRODUCT.md) still holds, because the fallback is labelled.

#### W7 · Saved route forgets direction and departure (P2)

- **Steps:** load a sample, press **Reverse direction**, change the departure, then **Save on this device**. Reload the page and open it from **Saved routes**.
- **Observed:** it opens as "Riding in the file's direction" at the next hour. The pace model carries over, but as a global setting, not per route.
- **Fix:** as in the audit, P2-4. Save the direction and the usual departure time with the route.

#### W8 · Phone verdict bar is 178 px tall (P2)

- **Steps:** 375×812, load any sample, scroll.
- **Observed:** the fixed bar is 178 px, 22% of the screen. It covers the bottom rows of the comparison while the rider scrolls through it.
- **Fix:** as in the audit, P2-1. A collapsed state with a larger headline. Riders should check what it shows (audit Q6).

#### W9 · Phone: Reversed column cut off (P2)

- **Steps:** 375×812, load **China Camp and Nicasio Valley**, scroll to the comparison.
- **Observed:** the comparison table is 463 px wide inside a 341 px frame, and the point-by-point table is 774 px wide. The **Reversed** column and its **Use** buttons are clipped at the right edge. The page itself doesn't scroll sideways.
- **Fix:** as in the audit, P2-2. Stack the two directions as cards, or add a direction toggle.

#### W10 · Phone: empty map first (P2)

- **Steps:** 375×812, fresh load.
- **Observed:** the first screen is an empty Bay Area map. **Import GPX** and the sample menu start about 640 px down, and no sentence says what the app does.
- **Fix:** as in the audit, P2-5.

#### W11 · Small touch targets (P2)

- **Observed at 375 px:**
  - −1 h / +1 h: 40 px.
  - Presets: 40 px.
  - **Use**: 32 px.
  - **Open** and **Delete**: 36 px, next to each other.
  - The radio labels are 44 px, which is fine.
- **Fix:** PR #25 (44 px buttons). Check that **Open** and **Delete** are spaced apart.

#### W12 · One forecast error, three messages (P3)

- **Steps:** make requests to Open-Meteo fail, then load **PRS (clockwise)**.
- **Observed:** "Couldn't reach Open-Meteo. Check your connection and retry. Your route is still loaded." appears in the status line, the verdict and a `role=alert` box, with two **Retry forecast** buttons. Retry works once requests succeed, and the route stays loaded.
- **Fix:** as in the audit, P3-1.

#### W13 · Out-of-date status message (P3, new)

- **Steps:** press **Use** on 7:00 PM. Then press −1 h, then **Tomorrow 08:00**.
- **Observed:** the departure changes to 08:00 tomorrow, but the status line still reads "Using Sat, Nov 14, 07:00 PM, original direction."
- **Impact:** the status contradicts the verdict. Screen-reader users who re-read the status hear the wrong time.
- **Fix:** clear the status, or replace it, whenever the departure changes in another way.

#### W14 · Sample menu doesn't show the loaded route (P3, new)

- **Steps:** choose **Berkeley to Morgan Territory** from the sample menu.
- **Observed:** the route loads and the menu goes back to "Try a sample route…".
- **Impact:** minor. The route card shows the name, but the control looks as if nothing was chosen.
- **Fix:** keep the chosen sample selected, and reset the menu only when a GPX is imported or a saved route is opened.

#### W15 · Late-evening finishes labelled "before sunrise" (P3, new)

Found during the recheck on build `15a7709`.

- **Steps:** desktop, constant speed 25 km/h. Load **Berkeley to Morgan Territory**. Look at the 5:00 PM row in the comparison.
- **Observed:** the row reads "finish 10:35 PM · before sunrise". The 1:00 PM and 3:00 PM rows, which finish at 6:35 PM and 8:35 PM, read "after sunset". The 5:00 PM ride also starts after the 4:58 PM sunset, and the row doesn't say so.
- **Impact:** minor. Every night ride is still kept out of **Best**, but "before sunrise" for a 10:35 PM finish reads as a mistake, and a ride that starts in the dark isn't flagged as one.
- **Fix:** label any ride that starts or finishes between sunset and the next sunrise in plain terms, for example "starts after sunset" or "finishes after sunset".

### What worked well

These held up and are worth keeping:

- An invalid GPX file gives a specific message and keeps the previous route loaded.
- A forecast failure keeps the route, and **Retry forecast** recovers.
- A route with no elevation is never quietly treated as flat.
- The verdict flags "finishes after sunset" for the selected departure.
- **Data & settings** is a native modal dialog that puts focus on **Close** and has a proper label.
- The heading structure is logical, the page has a skip link, and nothing scrolls sideways at 375 px.

### What should happen next

1. Done: `main` at `15a7709` was deployed on 14 Nov and the fixed findings were rechecked. See the [retesting log](#retesting-log). PR #48 (W4, W5, W6, W13, W14) merged after that deploy and needs another deploy and recheck.
2. Done: T4 now checks W5 and keyboard focus (W4), and T5 checks W6.
3. Issues are open for the new findings: [#31](https://github.com/kchan1028/ridewind/issues/31) (W4), [#32](https://github.com/kchan1028/ridewind/issues/32) (W5), [#33](https://github.com/kchan1028/ridewind/issues/33) (W6), [#34](https://github.com/kchan1028/ridewind/issues/34) (W13) and [#35](https://github.com/kchan1028/ridewind/issues/35) (W14). Each says it came from an expert walkthrough. W4 is an accessibility defect and doesn't need participant evidence. The others should be validated, under the rule above, before they go on the roadmap.

## Completed research

**No sessions with riders have been completed.** The expert walkthrough above isn't counted here. When a round runs, add a row here and fill in the logs below. Don't record planned or cancelled sessions as completed.

| Round | Dates | Build | Participants (codes and profiles) | Tasks run | Notes |
| --- | --- | --- | --- | --- | --- |
| *None yet* | | | | | |

### Findings log

A finding is something seen in sessions, not something expected. Each names the participants who showed it, so its strength is clear.

| ID | Finding | Seen in | Research question | Audit item | Severity | Status | Issue |
| --- | --- | --- | --- | --- | --- | --- | --- |
| *None yet* | | | | | | | |

- **Seen in:** participant codes and the total, for example "P02, P04, P05 (3 of 6)".
- **Severity:** the audit's scale. P0 blocks the task; P1 is a major problem or misleading result; P2 is real friction with a workaround; P3 is polish.
- **Status:** *Observed* (seen, not yet validated), *Validated* (see the rule below), *Rejected* (sessions contradict the audit hypothesis), *Fixed, awaiting retest*, *Retested: resolved* or *Retested: still present*.

### Retesting log

After a fix ships, rerun the tasks that showed the problem, with new participants where possible.

| Finding ID | Fix (PR) | Build retested | Round | Tasks rerun | Result | Seen in |
| --- | --- | --- | --- | --- | --- | --- |
| W1 | #23 | `15a7709` | Walkthrough recheck, 14 Nov | T4 | Resolved: night rows say "after sunset" and get no **Best**; with similar wind, "No clear best" | Walkthrough, no participants |
| W2 | #27 | `15a7709` | Walkthrough recheck, 14 Nov | T2 | Resolved: "low chance of rain (11%)"; the KPI reads "Low chance · 11%, up to 4.0 mm/h if it rains" | Walkthrough, no participants |
| W3 | #28 | `15a7709` | Walkthrough recheck, 14 Nov | T6 | Resolved: typed 100 stays, `aria-invalid`, message 6 px under the field: "Enter a speed from 5 to 60 km/h. Still using 25 km/h." | Walkthrough, no participants |
| W4 | #48 (not deployed) | `15a7709` | Walkthrough recheck, 14 Nov | T4 | Still present: focus goes to `<body>` after **Use** and a preset. Expected, because #48 merged after this deploy | Walkthrough, no participants |
| W5 | #48 (not deployed) | `15a7709` | Walkthrough recheck, 14 Nov | T4 | Still present: after **Use** on 12:00 PM, the list starts at 12:00 PM | Walkthrough, no participants |
| W7 | #43 | `15a7709` | Walkthrough recheck, 14 Nov | T7 | Resolved: a reversed route saved at 12:00 reopens reversed at 12:00; the list shows "reversed · usually 12:00" | Walkthrough, no participants |
| W8 | #36 | `15a7709` | Walkthrough recheck, 14 Nov | T9 (indoors only) | Partly resolved: collapsed bar with a 24 px headline, one line and **Details**, but still 172 px of 812 | Walkthrough, no participants |
| W9 | #40 | `15a7709` | Walkthrough recheck, 14 Nov | T4 | Comparison resolved: 341 px in a 341 px frame, both directions visible. The point-by-point table is still 766 px in 341 px | Walkthrough, no participants |
| W10 | none yet | `15a7709` | Walkthrough recheck, 14 Nov | T1 | Still present: an empty map first; **Import GPX** starts about 580 px down | Walkthrough, no participants |
| W11 | #25 | `15a7709` | Walkthrough recheck, 14 Nov | T7, T10 | Resolved: the stepper is 48 px; presets, **Use**, **Open** and **Delete** are 44 px; **Open** and **Delete** are 16 px apart | Walkthrough, no participants |
| W13 | #48 (not deployed) | `15a7709` | Walkthrough recheck, 14 Nov | T3 | Still present: after a preset, the status still reads "Using … 01:00 PM" | Walkthrough, no participants |
| W14 | #48 (not deployed) | `15a7709` | Walkthrough recheck, 14 Nov | T1 | Still present: the sample menu goes back to "Try a sample route…" | Walkthrough, no participants |

W6 and W12 weren't rechecked. These rechecks were done by Claude in the in-app Chromium browser, at 1280×800 and in a 375×812 phone emulation, without participants. They show whether a fix is live. They don't say whether riders find it clear, so participant retests are still needed under the rule below.

## How do findings reach GitHub issues and the roadmap?

A finding is **validated** when either:

- **at least 3 participants in a round** show the same problem on the same task, or
- **one participant** shows a P0 or a safety-related P1, such as planning a ride that ends in the dark because of the **Best** mark, or reading a low chance of rain as a washout.

Then:

1. **Open a GitHub issue** in [Issues](https://github.com/kchan1028/ridewind/issues) for each validated finding. Include the finding ID, the tasks and participant codes that showed it, the build, the severity and the audit item it confirms. Attach sample-route screenshots only, with no names, identifying quotes or personal routes.
2. **Link the issue from the findings log** and set the status to *Validated*.
3. **Update the audit's evidence label.** An audit item confirmed in testing moves from *Assumption* to observed in testing, with the finding ID. A rejected one says so. This stops a hypothesis being built as if proven, or kept as if never checked.
4. **Propose a roadmap change.** Add or move the item in [ROADMAP.md](../ROADMAP.md), with the issue linked and this page as its source. P0 and safety-related P1 findings go to **Now**; other P1 and P2 findings go to **Now** or **Next** depending on effort; P3 goes to **Next** or **Later**. Every roadmap item stays *Proposed* until the owner approves it.
5. **Retest after the fix.** When the fixing PR merges, add a row to the retesting log. Close the issue only when the retest shows it resolved; otherwise reopen it with the new evidence.

Findings that aren't validated stay in the log as *Observed*. They don't get issues or roadmap entries yet, but the next round should include a task that checks them. Findings that reject an audit hypothesis are logged too, so the matching change isn't built on a wrong assumption.

## After the session

- Delete all local data in the test browser (**Data & settings → Delete all local data**) and close private windows.
- Check that no screenshot or recording shows a personal route, a name or a face.
- Move notes into the observation template and strip anything identifying.
- Add the session to [completed research](#completed-research) only after it has actually happened.
