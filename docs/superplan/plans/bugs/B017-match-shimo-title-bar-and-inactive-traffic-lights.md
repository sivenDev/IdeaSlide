---
id: "B017"
title: "Match the Shimo Title Bar and Preserve Inactive Traffic Lights"
type: "bugfix"
status: "complete"
summary: "Use a Shimo-style light gray editor title bar and preserve the macOS traffic-light footprint while the window is inactive."
source: "docs/superplan/human/bugs.md"
created: "2026-08-06"
order: 17
depends_on: ["F014"]
parent: ""
---

# Match the Shimo Title Bar and Preserve Inactive Traffic Lights Plan

**Goal:** Make the editor window chrome feel visually continuous and intentional in both focused and unfocused macOS states.
**Scope:** Change the custom editor title/status bar from near-white to the Shimo reference's light neutral gray. On macOS, observe native window focus and render three aligned neutral placeholder dots only while the window is unfocused, inside the existing traffic-light reservation. Keep the native red/yellow/green controls untouched while focused, preserve the current title, file commands, save indicator, drag region, toolbar height, and non-macOS padding/layout.
**Non-Goals:** This fix does not replace native window controls, make placeholder dots interactive, change `trafficLightPosition`, redesign the Launch Screen, alter toolbar commands or typography, change save-state colors, add blur/transparency effects, or modify window sizing and file behavior.
**Architecture:** `Toolbar` remains the editor-window chrome boundary. In Tauri on macOS it reads the initial focus state from `getCurrentWindow().isFocused()` and subscribes to `onFocusChanged`, cleaning up the listener on unmount. A decorative, accessibility-hidden three-dot group is rendered only for the unfocused macOS state and positioned from the same left/top geometry as `trafficLightPosition`; CSS owns its neutral color, spacing, and pointer-event isolation. Browser/non-Tauri rendering defaults to focused and does not invoke native APIs.
**Baseline:** `src-tauri/tauri.conf.json` uses `titleBarStyle: "Overlay"`, hides the native title, and places macOS traffic lights at `(13, 26)`. `Toolbar` reserves their area only through `.idea-slide-window-toolbar.is-mac { padding-left: 5rem; }`. The toolbar background is hard-coded to `rgb(255 255 255 / 96%)`, and there is no focus-state listener or inactive decoration. When macOS does not paint the native controls for an unfocused overlay window, the reserved space becomes visibly empty.
**Reproduction:** Open any editable document in the macOS Tauri client, then focus another application or window. The native red/yellow/green controls disappear while the toolbar retains its 5rem left padding, leaving a blank area at the start of the near-white title bar. The supplied Shimo reference instead uses a light gray title strip and keeps three subdued circles visible in that inactive footprint.
**Root Cause:** The overlay title bar delegates active controls to macOS but treats the reserved region as spacing only. Because the React toolbar does not observe window focus, it cannot supply the inactive visual state when the native controls are absent. Its independent near-white background also diverges from the requested Shimo title-bar surface.
**Exit Criteria:** The editor title/status bar matches the reference's light neutral gray. On macOS focus loss, three neutral circles remain aligned at the native traffic-light coordinates without intercepting input; on focus regain they disappear before/under the restored native controls. Repeated focus changes do not accumulate listeners. Browser and non-macOS layouts do not render the placeholders or call Tauri focus APIs. Home/Open/Save actions, Save As, save status, centered title, dragging, keyboard focus, and toolbar dimensions remain unchanged. Focused chrome contracts, the full frontend suite, production build, native focus smoke check, and diff checks pass.

## Task 1: Lock the Inactive Window Chrome Regression

**Outcome:** A focused contract fails unless the editor title bar uses the reference surface and owns a macOS-only, lifecycle-safe inactive traffic-light placeholder.
**Files:**
- Modify: `tests/editorChromeNavigation.test.mjs`

**Change Map:**
- title-bar surface contract: require the Shimo-style light neutral background instead of the current near-white value
- focus lifecycle contract: require guarded `isFocused` initialization, `onFocusChanged` subscription, and listener cleanup
- placeholder contract: require three decorative dots rendered only for unfocused macOS windows and excluded from pointer/accessibility behavior
- preservation boundary: retain current toolbar actions, centered title, save indicator, and drag-region assertions

**Verification:**
- `node --test tests/editorChromeNavigation.test.mjs`

- [x] Add the focused title-bar/focus-state assertions and confirm they fail against the current implementation.
- [x] Keep the regression tied to observable inactive chrome and lifecycle ownership rather than generated framework internals.

## Task 2: Implement the Shimo Surface and Inactive Placeholder

**Outcome:** The editor chrome uses the requested neutral surface and preserves the macOS window-control footprint through focus changes.
**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/index.css`

**Change Map:**
- `Toolbar`: track macOS Tauri focus state, subscribe/unsubscribe safely, and render an accessibility-hidden three-dot placeholder only while unfocused
- `.idea-slide-window-toolbar`: adopt the Shimo reference-style light gray background without changing height or border ownership
- inactive traffic-light styles: align three neutral circles with the configured native coordinates and keep them non-interactive

**Verification:**
- Run the focused Task 1 test.
- Native macOS cases: focused → unfocused → focused repeatedly; placeholders align with native controls, do not flash over active controls, do not block dragging/actions, and remain absent on non-macOS/browser rendering.

- [x] Apply the smallest focus-aware component and scoped CSS change.
- [x] Verify toolbar command alignment, centered title, save states, and drag behavior remain stable.

## Task 3: Verify and Deliver B017

**Outcome:** The window-chrome fix ships with focused, regression, build, native visual, workflow, and isolated Git evidence.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B017-match-shimo-title-bar-and-inactive-traffic-lights.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- B017 request and plan: completion state, checked outcomes, and final verification evidence
- generated plan index: refreshed B017 status and dependency

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Native Tauri editor smoke for Shimo surface, focus transitions, placeholder alignment, toolbar actions, centered title, save states, and drag region

- [x] Run the complete frontend regression and production build once after implementation stabilizes.
- [x] Mark B017 and its human request complete, refresh the plan index, and create a separate `fix(B017)` commit containing only this delivery.

## Completion Evidence

- Test-first regression: `node --test tests/editorChromeNavigation.test.mjs` initially failed in the new inactive-window chrome contract because `Toolbar` had no focus lifecycle, placeholder markup, or Shimo surface. The stabilized focused rerun passed all 6 tests.
- Implementation: `Toolbar` now initializes focus through Tauri, subscribes to `onFocusChanged`, protects the initial-read/event race, cleans late and active listeners, and renders three accessibility-hidden, non-interactive neutral dots only for an unfocused macOS window. `src/index.css` applies the `#efefef` Shimo-style surface and aligns 12px placeholders from the configured 13px traffic-light origin.
- Permission review: the existing `core:default` capability includes `core:window:default` and `allow-is-focused`; the existing `core:event:default` permission covers focus event listener registration, so no capability expansion was required.
- Full frontend regression: `node --test tests/*.test.mjs` passed 241/241 tests with no failures, skips, or cancellations.
- Production frontend build: `npm run build` passed strict TypeScript and Vite production generation. Existing Excalidraw mixed static/dynamic import and large-chunk warnings remain informational.
- Native build: `npm run tauri build -- --debug` produced the current debug `IdeaNote.app` and DMG successfully.
- Native smoke: the debug bundle opened `grocery.is` with the Shimo-style title surface, intact Home/Open/Save/Save As controls, `Saved` status, centered filename, Canvas, and navigator. Switching focus to Finder and re-inspecting the client completed without a crash or stalled window. The Computer Use purple control overlay occupies the exact macOS traffic-light area, so it prevented reliable pixel-level screenshot evidence of the three placeholder dots; their focus lifecycle, geometry, accessibility, and pointer isolation are covered by the focused regression and successful native focus transition.
- `git diff --check` passed against the stabilized implementation and workflow diff.

## Post-delivery Visual Calibration

- After native screenshot review, the user approved a stronger IdeaNote-specific cool-gray violet title surface: `#dedee3` with a `#cfd0d8` lower boundary. The Home/Open separator uses `#c4c5ce`, keeping command groups legible without becoming a dominant divider.
- The inactive traffic-light placeholder was visually calibrated to three 13-pixel neutral circles at `left: 12.5px; top: 18px` with an 11-pixel gap. Focus lifecycle, accessibility hiding, and pointer isolation remain unchanged.
- The window keeps the macOS overlay title style and decorations but no longer requests native transparency. This removes the Tauri `macos-private-api` warning without enabling private APIs or changing the opaque application surfaces.
- `tests/editorChromeNavigation.test.mjs` locks the final palette, separator, placeholder geometry, focus behavior, and no-transparency contract. The focused suite passed 10/10 tests, the complete frontend suite passed 245/245, and production plus Tauri debug App/DMG builds succeeded.
- The user reviewed the final native title bar and menu-trigger screenshots and explicitly accepted the delivered appearance.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/features/F006-revision-c-editor-shell-defaults.md`
- `docs/superplan/plans/features/F007-framework-title-bar-icons.md`
- `docs/superplan/plans/features/F014-simplify-file-and-navigator-controls.md`
- `src-tauri/tauri.conf.json`
- `src/components/Toolbar.tsx`
- `src/index.css`
- `tests/editorChromeNavigation.test.mjs`
