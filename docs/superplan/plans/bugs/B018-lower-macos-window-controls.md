---
id: "B018"
title: "Lower macOS Window Controls"
type: "bugfix"
status: "complete"
summary: "Move the native macOS traffic lights and their inactive placeholders down two pixels within the editor title bar."
source: "docs/superplan/human/bugs.md"
created: "2026-08-06"
order: 18
depends_on: ["B017"]
parent: ""
---

# Lower macOS Window Controls Plan

**Goal:** Center the macOS window controls more naturally within the 48-pixel editor title bar without disturbing the B017 focus treatment.
**Scope:** Move the native red/yellow/green controls down by 2 pixels by changing the main-window `trafficLightPosition.y` from 26 to 28. Move B017's inactive three-dot placeholder down by the same 2 pixels, from `top: 20px` to `top: 22px`. Preserve horizontal position, dot size and spacing, focus behavior, title-bar height, toolbar alignment, and non-macOS layout.
**Non-Goals:** This fix does not change the title-bar color, window-control size or spacing, left padding, toolbar commands, centered title, save status, drag behavior, window dimensions, or focus listener lifecycle.
**Architecture:** Native and web-rendered inactive controls remain separate platform layers but share one vertical-offset contract. Tauri configuration owns the focused native traffic lights; scoped CSS owns the inactive placeholder. The two values advance together by exactly 2 pixels, and the focused chrome regression asserts both coordinates so they cannot drift independently.
**Baseline:** B017 configures the native traffic lights at `(13, 26)` and positions the 12-pixel placeholder row at `left: 13px; top: 20px` inside a 48-pixel toolbar. The user reports that the three system buttons appear slightly high. Tauri/Wry's macOS implementation treats a larger `trafficLightPosition.y` as a larger inset from the upper edge, so increasing the native value lowers the controls.
**Reproduction:** Open an editor document in the macOS client and compare the traffic-light row with the toolbar's visual centerline. The three native controls sit slightly above the desired baseline; after focus loss, B017's placeholder follows the same high alignment.
**Root Cause:** B017 preserved the existing native vertical inset and derived the placeholder from it, but that baseline was already slightly too high for the current 48-pixel title bar. Because native and inactive states are positioned in different artifacts, both coordinates must change together to avoid a focus-transition jump.
**Exit Criteria:** Focused native traffic lights and unfocused placeholders both sit 2 pixels lower than B017, remain aligned with each other through repeated focus changes, and keep the existing horizontal position, 12-pixel placeholder geometry, title-bar height, commands, title, save status, and drag region. Non-macOS layout remains unchanged. Focused chrome tests, configuration parsing, production build, native visual smoke, and diff checks pass.

## Task 1: Lock the Shared Vertical Baseline

**Outcome:** The focused chrome regression fails unless the native and inactive control positions both use the new lower baseline.
**Files:**
- Modify: `tests/editorChromeNavigation.test.mjs`

**Change Map:**
- native position contract: require `trafficLightPosition` to remain at `x: 13` and use `y: 28`
- inactive position contract: require the placeholder row to remain at `left: 13px` and use `top: 22px`
- preservation boundary: retain B017 focus lifecycle, three-dot geometry, pointer isolation, and Shimo surface assertions

**Verification:**
- `node --test tests/editorChromeNavigation.test.mjs`

- [x] Add the paired vertical-position assertions and confirm they fail against B017's current 26/20 values.
- [x] Keep the regression focused on the shared visible baseline rather than unrelated window configuration.

## Task 2: Lower Both Native and Inactive Controls

**Outcome:** The macOS traffic-light row moves down 2 pixels without changing any other editor chrome behavior.
**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src/index.css`

**Change Map:**
- main window `trafficLightPosition`: change only `y` from 26 to 28
- `.idea-slide-window-toolbar__traffic-lights`: change only `top` from 20px to 22px

**Verification:**
- Run the focused Task 1 test.
- Parse `src-tauri/tauri.conf.json` and verify `(x, y) = (13, 28)`.
- Native macOS cases: focused and unfocused buttons share the lower baseline; toolbar commands, centered filename, Saved state, and dragging remain stable.

- [x] Apply the paired 2-pixel adjustment without changing dimensions, colors, or focus logic.
- [x] Inspect focused and unfocused native states for alignment and transition stability.

## Task 3: Verify and Deliver B018

**Outcome:** The alignment correction ships as an isolated B018 change with current test, build, native, workflow, and Git evidence.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B018-lower-macos-window-controls.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- B018 request and plan: completion state and verification evidence
- generated plan index: refreshed B018 status and dependency

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Native Tauri editor smoke for active/inactive control height and preserved toolbar behavior

- [x] Run the complete frontend regression and production build once after the alignment stabilizes.
- [x] Complete B018, refresh progress, and create a separate `fix(B018)` commit containing only this delivery.

## Completion Evidence

- Test-first regression: `node --test tests/editorChromeNavigation.test.mjs` initially failed because the native traffic-light `y` value remained 26 instead of the required 28. After the paired adjustment, the focused suite passed all 6 tests and asserted the preserved `x: 13`, new `y: 28`, preserved `left: 13px`, and new `top: 22px` contract.
- Implementation: `src-tauri/tauri.conf.json` changes only the native vertical inset from 26 to 28, while `src/index.css` changes only the inactive placeholder offset from 20px to 22px. Toolbar height, colors, geometry, focus lifecycle, horizontal position, and non-macOS rules are unchanged.
- Configuration assertion: direct JSON parsing confirmed `trafficLightPosition=13,28`.
- Full frontend regression: `node --test tests/*.test.mjs` passed 241/241 tests with no failures, skips, or cancellations.
- Production frontend build: `npm run build` passed strict TypeScript and Vite production generation. Existing Excalidraw mixed static/dynamic import and large-chunk warnings remain informational.
- Native build: `npm run tauri build -- --debug` produced the debug `IdeaNote.app` and DMG successfully.
- Native smoke: the debug bundle opened `grocery.is` with the focused native controls on the lower baseline. After raising Finder, the inactive three-dot placeholders remained on the same baseline without a visible focus-transition jump; toolbar commands, `Saved` state, centered filename, Canvas, and navigator remained stable.
- `git diff --check` passed against the stabilized implementation and workflow diff.

## Post-delivery Native Calibration

- Subsequent user-led native screenshot calibration supersedes B018's initial simple `y: 28` / `top: 22px` numeric pairing. The accepted final native traffic-light position is `(13, 26)`; the inactive web placeholder uses `left: 12.5px; top: 18px`, 13-pixel circles, and an 11-pixel gap.
- Native and web coordinates use different anchoring and geometry, so the final contract is visible focus-transition alignment rather than equal numeric offsets. The user explicitly accepted the focused native row and inactive footprint in the final screenshots.
- `tests/editorChromeNavigation.test.mjs` now asserts the accepted native and placeholder values together. The focused suite passed 10/10 tests, the complete frontend suite passed 245/245, and the production plus Tauri debug App/DMG builds succeeded without the private-transparency warning.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/bugs/B017-match-shimo-title-bar-and-inactive-traffic-lights.md`
- `docs/superplan/plans/features/F020-raise-minimum-window-height.md`
- `src-tauri/tauri.conf.json`
- `src/index.css`
- `tests/editorChromeNavigation.test.mjs`
