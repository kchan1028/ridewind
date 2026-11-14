# VoiceOver check

A 15-minute script for testing RideWind with VoiceOver on a Mac. It covers the screen-reader part of [#12](https://github.com/kchan1028/ridewind/issues/12). NVDA on Windows, TalkBack on Android and Windows high contrast mode still need their own run.

For each step, do what it says, listen, and mark the result in the table at the end. A step passes if you can do it without seeing the screen and you always know where you are. Exact wording varies between macOS versions, so judge what you hear by its meaning, not word for word.

## Before you start

- Use Safari, which works best with VoiceOver. Open the [live site](https://kchan1028.github.io/ridewind/) in a fresh window.
- Download [no-elevation.gpx](voiceover-check/no-elevation.gpx). It's a made-up 30 km straight line with no elevation data.
- Turn VoiceOver on and off with **Cmd + F5**. "VO" below means **Control + Option** held together.

| Keys | What they do |
| --- | --- |
| Tab / Shift + Tab | Next / previous control |
| VO + Space | Press the focused control |
| VO + Right / Left | Next / previous item, read one at a time |
| VO + Cmd + H | Next heading |
| VO + U | Rotor: lists headings, links and form controls. Use the arrows to pick, Enter to go |
| VO + A | Read from here to the end |
| Control | Stop speaking |

## The script

### 1. First run

1. Load the page. Press **Tab** once.
   *Expect:* "Skip to ride controls, link".
2. Press **VO + U** and look at the headings list.
   *Expect:* RideWind, Route, Departure and pace, Conditions along the ride, How to read these numbers. Each name should say what the section is for.

### 2. Load a sample and hear the answer

1. Tab to **Sample route** (a pop-up button) and choose **Berkeley to Morgan Territory**.
   *Expect:* within a few seconds, without moving focus, VoiceOver reads the verdict, for example "Mostly crosswind. gusts 40 km/h, …, finish …".
2. Tab back to the menu.
   *Expect:* it still says Berkeley to Morgan Territory, not "Try a sample route…".
3. Press **VO + Cmd + H** until you reach the verdict heading ("Mostly …"). Then Tab to **Details** and press it.
   *Expect:* "Details, button, collapsed", then "expanded" after pressing. The extra facts and **Refresh forecast** follow.

### 3. Change the departure time

1. Tab to **Leave one hour later** and press it.
   *Expect:* the verdict is read again with the new finish time. Focus stays on the button.
2. Tab to the quick departure buttons (for example **Tomorrow 08:00**) and press one.
   *Expect:* the button is reported as selected or pressed, the verdict is read again, and focus stays on that button.

### 4. Compare departures

1. Press **VO + Cmd + H** to reach **Compare departures and directions**. Move into the table with **VO + Right**.
   *Expect:* it's read as a table with Depart, Original direction and Reversed columns. Each cell gives the finish time, headwind share and chance of rain, and one may say Best.
2. Tab to a **Use** button and press it.
   *Expect:* focus lands on the same row's button, which now says **Selected**. You're not sent back to the top of the page.
3. If there's a **Show later times** button under the table, press it.
   *Expect:* "collapsed", then "expanded", and focus stays on it. The extra rows say they finish after dark.

### 5. Charts and the point-by-point table

1. Find **Along the route** (VO + Cmd + H). Move to the first chart.
   *Expect:* a one-sentence summary, such as the elevation range and headwind range.
2. Tab to **Elevation: show the data** and press it.
   *Expect:* a two-column table of distance and value, about 20 rows.
3. Make the window narrower than 600 px (drag the edge). Find **Point by point**, then Tab to **Show all columns**.
   *Expect:* "not pressed" (or "off"). After pressing, the table gains Wind, Gust, Cross and Temp.

### 6. Typing a bad value

1. In **Average moving speed**, type 200 and press **Tab**.
   *Expect:* the field is reported as invalid, and you hear a message like "Enter a speed from 5 to 60 km/h. Still using 25 km/h." The value you typed stays in the field.

### 7. A forecast error

1. Turn Wi-Fi off. Choose another sample route.
   *Expect:* the error is read once: "Forecast unavailable. Couldn't reach Open-Meteo…". There's only one **Retry forecast** button.
2. Turn Wi-Fi on. Find **Retry forecast** and press it.
   *Expect:* the new verdict is read, and focus moves to the verdict heading.

### 8. A route without elevation in power mode

1. Under **Estimate timing from**, choose **Power and bike setup**.
2. Tab to **Import GPX** and choose `no-elevation.gpx`.
   *Expect:* a wind verdict is still read, and it says the time uses your average speed. The verdict has **Look up elevation** and **Estimate as if flat**.
3. Press **Estimate as if flat**.
   *Expect:* focus moves to the verdict heading, and the ride time is described as a flat estimate.

### 9. Settings dialog

1. Tab to **Data & settings** and press it.
   *Expect:* "Data & settings, dialog". Focus moves inside, and Tab stays inside the dialog.
2. Press **Escape**.
   *Expect:* the dialog closes and focus returns to **Data & settings**.

## Results

Copy this table into a comment on [#12](https://github.com/kchan1028/ridewind/issues/12), with your macOS and Safari versions.

| Step | Pass / Fail | What you heard, if it was wrong or confusing |
| --- | --- | --- |
| 1. First run | | |
| 2. Load a sample | | |
| 3. Change departure | | |
| 4. Compare departures | | |
| 5. Charts and table | | |
| 6. Bad value | | |
| 7. Forecast error | | |
| 8. No elevation | | |
| 9. Settings dialog | | |

Open a separate issue for each failure, and say it came from this check.
