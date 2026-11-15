# Accessibility verification for issue #12

Issue: [Test with screen readers, 200% zoom and Windows high contrast](https://github.com/kchan1028/ridewind/issues/12).

## Evidence and remaining checks

As of 15 November 2026, repository documentation records keyboard checks in Chromium and reflow at 640 px and 320 px. Those viewport checks are not a recorded run at actual browser zoom. The following manual runs remain unverified; do not close #12 based on a static audit or browser emulation.

| Environment | Status | Procedure |
| --- | --- | --- |
| Safari + VoiceOver on macOS | Not run | Follow [VoiceOver check](voiceover-check.md). |
| Firefox or Chrome + NVDA on Windows | Not run | Complete the core journey below using keyboard and speech. |
| Chrome + TalkBack on Android | Not run | Complete the core journey with swipe navigation and activation gestures. |
| Desktop browser at actual 200% zoom | Not run | Use browser zoom, then complete the core journey and check content/focus visibility. |
| Windows contrast theme + Edge | Not run | Enable a Windows contrast theme, then follow the high-contrast checks below. |

## Core journey

1. Open the app with the assistive technology already active. Reach the ride controls.
2. Load a sample route; confirm the control reports the selected route and the verdict is announced without moving focus.
3. Change departure by one hour and with a preset. Confirm the new result is announced and focus remains on the activated control.
4. Read the verdict, finish, daylight and rain information. Expand Details and inspect the point-by-point table.
5. Open and close Data & settings. Confirm focus enters the dialog and returns to its opener.

Record OS, browser and assistive-technology versions, tested commit or deployed URL, date, pass/fail for each step, and exact unexpected behavior. File a separate issue per defect and link it from [ACCESSIBILITY.md](../ACCESSIBILITY.md).

## Windows high-contrast checks

Repeat with a light and a dark Windows contrast theme:

- Follow the core journey; ensure text, field boundaries and keyboard focus remain visible.
- Activate a departure preset and Reverse direction. Confirm pressed controls have a visible outline.
- Start drawing, add at least two points, then tab to route-point markers. Confirm focus has an outer outline; after moving focus away, a selected point retains an inner outline.
- Search for a place and move through suggestions with arrow keys. Confirm the active suggestion has a visible outline.
- Read the wind verdict and text breakdown without depending on map colours or background patterns.

Browser forced-colors emulation is useful as an additional check, but does not replace the Windows run.

## Actual zoom checks

At 200% browser zoom, load a route, change departure, expand Details and open the settings dialog. Check that controls, error messages and the final content remain reachable, sticky content does not obscure keyboard focus, and any wide table scrolls within its own region. Record browser zoom and window size. Repeat at 400% if possible.

## Code review findings

The 15 November 2026 static review found route-point keyboard focus used only a box shadow while suppressing the normal outline. Forced-colors mode removes shadows. The fix uses an outline for focus and system-colour outlines for selected route points, pressed controls and active search suggestions. This is a code-level fix; the manual checks above are still pending.

The testing session could not access a browser-control connection and had no Windows or Android test device. No screen reader output, actual zoom result or Windows contrast result was observed.
