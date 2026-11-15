# RideWind design

Maintenance baseline for the existing interface, based on [styles](src/styles.css), [UI behavior](src/ui/app.ts) and [the UX/UI audit](docs/ux-ui-audit.md).

## Priorities

Lead with the riding decision: wind verdict, finish, rain and daylight. Keep route, departure and pace controls close to the results they change. Reveal calculations and supporting data on demand. Preserve route, inputs and focus when loading, retrying or comparing.

## Layout

Phones stack the map and controls with a compact verdict near the bottom. Comparisons use a phone-friendly presentation. At 900 px, the panel sits beside the map and scrolls independently. Its default width is `clamp(360px, 38vw, 640px)`; resizing supports pointer and keyboard input.

Keep primary planning actions accessible without traversing every chart. Use progressive disclosure for verdict details, chart tables and extended point data. Ensure sticky content does not hide focused controls or the end of the page.

## Visual foundations

Use existing CSS tokens rather than competing palettes.

| Token | Light value | Role |
| --- | --- | --- |
| `--ink` | `#14213d` | Primary text |
| `--paper` | `#f6f4ef` | Page background |
| `--surface` | `#ffffff` | Panels and controls |
| `--line` | `#d9d4c9` | Separators |
| `--muted` | `#545e6d` | Supporting text |
| `--focus` | `#0b63ce` | Keyboard focus |
| `--head` | `#c8102e` | Headwind |
| `--cross` | `#b97800` | Crosswind |
| `--tail` | `#1f6fb2` | Tailwind |
| `--calm` | `#5f6b7a` | Calm |
| `--radius` | `6px` | Standard corners |

Use the system sans-serif stack, 16 px base size, 1.5 line height and tabular numerals. Dark appearance uses overrides under `:root[data-theme="dark"]`. Keep system/light/dark choices consistent across controls, charts and map overlays.

## Map and charts

Keep wind meanings consistent across route, legend, verdict and charts. Reinforce colour with labels, patterns and direction cues. Name chart units; keep distance labels readable on phones; offer accessible data tables. Distinguish start/finish, route direction and manually drawn sections. Preserve visible provider attribution.

## Interaction and copy

Use plain cycling language. Explain why an option is recommended and when choices are too close to distinguish. Show loading, empty, stale, partial, success and failure states explicitly. Retain user entries after validation failures. Confirm destructive clearing and deletion, and give save/retry actions visible feedback.

Disclose external road-routing requests before sending points. Require route review before use and avoid implying that routing confirms access, closures or course safety.

## Accessibility and validation

Maintain labelled controls, visible focus, stable focus after updates, keyboard alternatives to map gestures and targets at least 44 px high. Never encode weather meaning solely in colour. Check phone reflow, zoom, long route names, field errors, dark appearance and unavailable forecasts.

Use [the usability plan](docs/usability-testing.md) and [the audit](docs/ux-ui-audit.md) for review scenarios. Track screen reader, Windows high-contrast and real-phone verification explicitly in [the roadmap](ROADMAP.md).
