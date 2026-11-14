# Usability testing with cyclists

**Status, 14 November 2026: no usability sessions have been run.** This page is a plan. The [completed research](#completed-research) section is empty on purpose, and it stays empty until a real session happens. Nothing here describes what riders think or do.

The plan tests RideWind's four core journeys from [PRODUCT.md](../PRODUCT.md#how-do-cyclists-use-it) with real riders. It turns the hypotheses in the [UX/UI audit](ux-ui-audit.md#5-unverified-assumptions-and-questions-for-cyclist-testing) into tasks you can observe. The audit was written from a designer's and a cyclist's point of view, without riders, so each of its findings is still a hypothesis until a session confirms or rejects it. (The audit is in [PR #22](https://github.com/kchan1028/ridewind/pull/22) until that merges.)

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
- **Observe:** what the choice is based on (headwind, tailwind on the way home, rain, daylight, temperature); whether they follow the **Best** mark, question it or ignore it; whether they find the reversed column on a phone.
- **Not a success criterion:** agreeing with the **Best** mark. The aim is to learn how riders choose.

### T5 · A more accurate ride time (R6, R7)

Only for riders who train with power. Others skip to T6.

> "The finish time is based on an average speed. Make it reflect how you'd actually ride this route."

- **Start:** a sample route with elevation, then again with the prepared no-elevation GPX file.
- **Success:** switches to the power model, enters plausible values (a made-up weight is fine) and gets a new finish time. With the no-elevation file, makes a deliberate choice between looking up elevation and treating the route as flat, and can say what that choice means.
- **Observe:** whether they know their CdA and Crr or rely on the hints; whether the new time would change any decision.

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

## Completed research

**No sessions have been completed.** When a round runs, add a row here and fill in the logs below. Don't record planned or cancelled sessions as completed.

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
| *None yet* | | | | | | |

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
