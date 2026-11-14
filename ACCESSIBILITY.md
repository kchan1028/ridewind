# Accessibility

RideWind aims to meet [WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA. It hasn't been formally audited or certified. This page describes what has been built and checked, and where it still falls short.

## What's in place

**Keyboard**
- Every control is a native button, input, select or link, so it works with Tab, Enter, Space and the arrow keys.
- A **Skip to ride controls** link is the first thing on the page.
- The controls come before the map in the page, so Tab reaches them first.
- Wind markers on the map aren't tab stops. The point-by-point table holds the same information.
- **Data & settings** is a native dialog: focus moves into it, and Esc closes it.
- Focused elements get a 3 px outline.
- **Draw a route** works without a pointer. While drawing, the map shows a crosshair at its centre: move the map with the arrow keys and press Enter or Space on the map, or use **Add point at centre**, to add a point there. **Draw a route** reports the open drawing bar with `aria-expanded`, and focus moves into the bar. **Undo last point**, **Clear** and **Finish route** stay focusable when there's nothing to act on (`aria-disabled` rather than `disabled`), so focus isn't dropped after the last undo. Enter in **Route name** finishes the route, and focus then moves to the new route's name. **Cancel**, or Esc, leaves draw mode and returns focus to **Draw a route**.
- Focus isn't lost when the page redraws. After **Use** in the comparison it moves to the new **Selected** button, after a departure preset it stays on that preset, and after **Retry forecast** or **Estimate as if flat** it moves to the verdict heading.

**Screen readers**
- The verdict ("Mostly tailwind…") is announced in a polite live region when results arrive. So are the status line and the data-settings messages.
- A forecast error shows once, in the verdict, with one **Retry forecast** button, and is announced once through the verdict's live region. The Conditions section only says where to find it.
- An out-of-range speed or rider setting shows its error right under the field. The field gets `aria-invalid`, the message is linked with `aria-describedby` and announced through a polite live region, and what you typed stays in the field for you to correct.
- Toggle buttons such as **Reverse direction** and the departure presets report their state with `aria-pressed`.
- Each chart is an image with a text summary, for example the elevation range and the headwind range. Below each chart, **show the data** opens a table of the values at about 20 points along the route.
- The map has a text description that points to the table. While drawing, it changes to explain the arrow keys, Enter and the crosshair.
- While drawing, each added or removed point is announced in a polite live region with the point count and running distance, for example "Point 3 added. 3 points · 12.4 km".
- The page language is set to English.

**Colour and contrast**
- Wind type is never shown by colour alone:
  - **Map:** headwind is a solid line, crosswind dashed and calm dotted.
  - **Wind bar:** crosswind is striped and "no forecast" is hatched.
  - **Verdict:** a text headline states the result.
- Text contrast was measured in November 2026 in the light and dark themes. All text met AA (4.5:1). The lowest values were 5.97:1 (light) and 7.21:1 (dark), for the muted hint text.
- Light and dark themes follow your system setting.

**Motion**
- Animations are short (120–180 ms).
- With **Reduce motion** turned on in your system settings, button press movement and scaling are switched off, and only brief fades remain.

**Touch and small screens**
- All buttons and form fields are at least 44 px tall, including the departure presets, **Open**, **Delete** and **Use**, as are the map zoom buttons on touch screens. The **−1 h / +1 h** buttons are 48 px.
- Down to 320 px wide there's no horizontal scrolling; wide tables scroll inside their own frame. Below 600 px the point-by-point table shows four columns (Distance, Arrive, Head/tail and Rain) so it fits without scrolling, and **Show all columns** (a toggle button with `aria-pressed`) brings back the others. The departure comparison is shown as one card per departure instead, and it keeps its table roles (`role="table"`, `row`, `cell`) so screen readers still read it as a table.
- **Draw a route** works by tapping the map. On phones the map moves above the controls while drawing, and the verdict bar steps aside until you finish or cancel, so it doesn't cover the map or the drawing controls. Double-tap zoom is off while drawing, so a quick second tap adds a point.
- On phones, the verdict and the departure buttons sit in a bar at the bottom of the screen, within thumb reach. The bar shows a one-line summary in 16 px bold text; **Details** (a button with `aria-expanded`) opens the full facts, the wind key and the forecast time. The page reserves the bar's exact height, so nothing is hidden behind it.

## Known limitations

- **Drawing is visual.** You can place points with the keyboard, but choosing where they go means looking at the map. Drawn routes follow straight lines, not roads.
- **The map is visual.** Panning and zooming the map works with the keyboard (it's a Leaflet map), but the route and wind colours can only be seen. The verdict, wind bar key and point-by-point table carry the same information in text.
- **Date and time entry** uses your browser's built-in picker, so how accessible it is depends on your browser.
- **Not yet tested with a real screen reader or high contrast mode.** Checks so far are automated (contrast, target sizes, overflow, focus styles, labels on every control), manual keyboard use in Chromium, and reflow at 640 px and 320 px wide, which is what 200% and 400% zoom give on a 1280 px screen. It still needs testing with VoiceOver, NVDA or TalkBack, and in Windows high contrast mode ([#12](https://github.com/kchan1028/ridewind/issues/12)). The [VoiceOver check](docs/voiceover-check.md) is a 15-minute script for the Mac part.

## Report a problem

If something in RideWind is hard or impossible to use with your setup, please [open an issue](https://github.com/kchan1028/ridewind/issues). Say what you were trying to do, your browser and device, and any assistive technology you use. Accessibility problems are treated as bugs.
