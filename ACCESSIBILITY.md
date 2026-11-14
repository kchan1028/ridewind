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

**Screen readers**
- The verdict ("Mostly tailwind…") is announced in a polite live region when results arrive. So are the status line and the data-settings messages.
- Forecast errors use `role="alert"`.
- Toggle buttons such as **Reverse direction** and the departure presets report their state with `aria-pressed`.
- Each chart is an image with a text summary, for example the elevation range and the headwind range.
- The map has a text description that points to the table.
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
- Main buttons and form fields are at least 44 px tall, as are the map zoom buttons on touch screens and the saved-routes toggle.
- At 375 px wide there's no horizontal scrolling; wide tables scroll inside their own frame.
- On phones, the verdict and the departure buttons sit in a bar at the bottom of the screen, within thumb reach.

## Known limitations

- **The map is visual.** Panning and zooming the map works with the keyboard (it's a Leaflet map), but the route and wind colours can only be seen. The verdict, wind bar key and point-by-point table carry the same information in text.
- **Charts don't have their own data tables.** Only the summary in each chart's text description is available to screen readers.
- **Some secondary buttons are below 44 px.** Departure presets and the −1 h / +1 h buttons are 40 px; **Open** and **Delete** in the saved routes list are 36 px; the **Use** buttons in the comparison table are 32 px.
- **Date and time entry** uses your browser's built-in picker, so how accessible it is depends on your browser.
- **Testing so far has been limited.** Checks were automated (contrast, target sizes, overflow, focus styles) plus manual keyboard use in Chromium on desktop and at phone size. It hasn't yet been tested with a screen reader (VoiceOver, NVDA, TalkBack), with 200% zoom, or in Windows high contrast mode.

## Report a problem

If something in RideWind is hard or impossible to use with your setup, please [open an issue](https://github.com/kchan1028/ridewind/issues). Say what you were trying to do, your browser and device, and any assistive technology you use. Accessibility problems are treated as bugs.
