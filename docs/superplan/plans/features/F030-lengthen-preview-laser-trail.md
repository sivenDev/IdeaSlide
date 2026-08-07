---
id: "F030"
title: "Lengthen the Preview Laser Trail"
type: "feature"
status: "complete"
summary: "Make the IdeaSketch Preview laser trail visibly longer without weakening its bounded, presentation-local lifecycle."
source: "docs/superplan/human/features.md"
created: "2026-08-07"
order: 30
depends_on: ["F029"]
parent: ""
---

# Lengthen the Preview Laser Trail Plan

**Goal:** Make the Preview laser easier to follow during presentation gestures by leaving a moderately longer visible tail.
**Scope:** Replace F029's event-spawned DOM particles with one Preview-only Canvas that renders a connected, glowing red stroke from a timestamped history of fixed-spacing pointer samples. Process all available coalesced mouse coordinates, interpolate five-pixel samples across fast event gaps, retain them for 700ms, and cap the history at 180 points. Keep every sample at its original path coordinate while its opacity decays, keep the laser head aligned to the latest pointer, stop animation when the timed history expires, clear it on pointer leave or overlays, and render only the head when reduced motion is requested. Add a Preview-only `Laser pointer` switch to Presentation Settings; initialize it enabled for every presentation session, and when disabled restore the normal cursor, clear active laser rendering, and ignore subsequent pointer movement until re-enabled.
**Non-Goals:** This feature does not persist the laser-enabled preference across presentation sessions, add other configurable laser styles or trail parameters, change Fullscreen pointer behavior, support touch or pen trails, persist annotations, import the `cursor-effects` package, copy its cursor image renderer, add an unbounded particle system, smooth the trail by moving stored samples away from their captured path, or change Excalidraw/document state.
**Architecture:** `PresentationMode` remains the sole owner of presentation pointer UI and the session-local default-on laser preference. Pointer events update refs rather than React state; all available `getCoalescedEvents()` samples are projected into Preview coordinates and spatially interpolated into one bounded, timestamped path history. One non-interactive high-DPI Canvas redraws connected segments with width, opacity, and glow derived from sample age plus the existing bright head. Animation frames remove expired samples from the oldest end, so the tail disappears progressively along the actual movement path instead of contracting toward the head, and the loop stops after the history empties. The Preview settings switch gates cursor hiding, Canvas rendering, and pointer sampling; disabling it reuses the existing cleanup boundary. Pointer leave, overlays, mode changes, disabling the laser, and unmount cancel and clear the lifecycle. The approach adapts the fixed-position lifespan/removal model from the MIT-licensed `tholman/cursor-effects` `ghostCursor.js`, its Canvas animation lifecycle, and MDN coalesced pointer input; no dependency or copied asset is introduced.
**Baseline:** F029 spawns one DOM particle per pointer event and removes it after a CSS animation. F030's first parameter-only implementation raised the bound to 36 and lifetime to 650ms; its second implementation interpolated fixed-spacing DOM points; its third used a fixed follower chain inspired by `trailingCursor.js`. Current-project native review showed the event-driven models still read as individual red dots during fast movement, while the follower chain contracts and cuts across the captured route instead of disappearing along it. The final design therefore keeps timestamped points stationary on the route and fades them by age.
**Exit Criteria:** Normal and fast Preview gestures show one smooth, connected, longer red laser stroke with no visible dot gaps. Stored trail samples remain on the captured movement path, the oldest path segments progressively fade to zero and are removed, the head tracks the latest mouse coordinate without lag, and the animation loop stops after the 700ms history expires. The path remains bounded at 180 five-pixel samples. Preview Settings shows a default-on `Laser pointer` switch; turning it off immediately removes the laser and restores the normal cursor, pointer movement remains inert while off, and re-enabling resumes laser tracking on the next movement. Pointer leave, Cameras/Settings overlays, Preview exit, disabling the laser, and unmount clear the Canvas and cancel the frame. Fullscreen remains unchanged and does not show the toggle, reduced motion keeps the head but omits the animated tail, and no pointer movement writes React trail state, Excalidraw state, or document state. Focused presentation tests, the complete Node suite, production build, current-project native Preview smoke verification, and diff checks pass.

## Task 1: Lock the Longer Bounded Trail Contract

**Outcome:** Focused presentation coverage distinguishes the event-spawned and moving-follower implementations from the approved timestamped Canvas path history.
**Files:**
- Modify: `tests/presentationMode.test.mjs`
- Inspect: `src/components/PresentationMode.tsx`
- Inspect: `src/index.css`

**Change Map:**
- Preview laser contract: five-pixel spatial sampling, 700ms age-based fade, 180-point bound, full coalesced-event input, stationary path samples, Canvas connected-stroke rendering, default-on settings toggle, disabled-state cursor and input behavior, frame lifecycle, reduced-motion head-only behavior, cleanup, Preview-only rendering, and non-persistence

**Verification:**
- `node --test tests/presentationMode.test.mjs`

- [x] Add focused assertions for fixed-spacing timestamped samples, progressive path fade, connected Canvas stroke, default-on laser settings, disabled-state cleanup/input behavior, frame lifecycle, reduced-motion behavior, and retained pointer isolation.
- [x] Confirm the new assertions distinguish both event-driven DOM particles and a moving follower chain.

## Task 2: Extend the Preview Trail Within Existing Boundaries

**Outcome:** Preview renders the approved smooth, time-fading Canvas path trail without changing pointer ownership, document state, or Fullscreen behavior.
**Files:**
- Modify: `src/components/PresentationMode.tsx`
- Modify: `src/index.css`
- Modify: `tests/presentationMode.test.mjs`

**Change Map:**
- Preview pointer input: retain mouse-only tracking, consume all coalesced events when supported, update refs without per-move React state, spatially interpolate fast gaps, and start one bounded animation loop
- Canvas path history: retain fixed-position timestamped samples for 700ms, cap the path at 180 points, draw connected tapering/glowing segments and the exact pointer head, remove oldest samples progressively, and stop when the history expires
- settings and cursor ownership: add an accessible Preview-only default-on `Laser pointer` switch; hide the cursor and render/sample the Canvas only while enabled, and restore the normal cursor while disabled
- cleanup and accessibility: clear Canvas state and cancel frames on leave, overlays, laser disable, Preview exit, and unmount; show only the head under reduced motion
- presentation CSS: remove the obsolete DOM-particle fade keyframes and reduced-motion animation override

**Verification:**
- `node --test tests/presentationMode.test.mjs`
- Preview interaction cases: normal and fast movement produce a connected tapering trail; stopping leaves the captured route stationary while its oldest segments fade away; the laser switch is on by default; disabling it clears the laser, restores the cursor, and suppresses tracking; re-enabling resumes on movement; leaving Preview or opening Cameras/Settings clears immediately; overlays remain clickable; reduced motion keeps only the head; Fullscreen remains unchanged and omits the setting.

- [x] Replace event-spawned DOM particles and the rejected moving follower chain with the approved timestamped Canvas path history.
- [x] Add the default-on Preview laser setting and verify the longer trail remains on the captured route while fading smoothly, boundedly, non-interactively, and presentation-locally.

## Task 3: Verify and Deliver F030

**Outcome:** The laser-tail refinement ships as an isolated, regression-safe F030 change with current workflow and Git evidence.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/features/F030-lengthen-preview-laser-trail.md`

**Change Map:**
- F030 feature and plan: lifecycle state, checked outcomes, and completion evidence
- generated plan index: F030 status and dependency on F029

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Native Tauri smoke: compare Preview trail length against the F029 baseline and verify decay, pointer-leave cleanup, overlay cleanup, Fullscreen isolation, and editor return.

- [x] Run the complete Node regression suite and production build once after implementation stabilizes.
- [x] Inspect the final diff, complete available native smoke verification, update Superplan progress, and prepare the exact F030 paths for a separate `feat(F030)` commit.

## Completion Evidence

- Focused contract: the new Preview-settings assertions failed against the implementation without a laser preference, then `node --test tests/presentationMode.test.mjs` passed 4/4 after the default-on switch, disabled-state cleanup, cursor restoration, and pointer-input gate were implemented.
- Trail implementation: `PresentationMode` records fixed-position five-pixel samples, consumes coalesced pointer events, keeps a bounded 180-point history for 700ms, fades the oldest path segments in place on one high-DPI Canvas, and performs no React trail-state, Excalidraw-state, or document writes.
- Settings implementation: Preview Presentation Settings exposes an accessible session-local `Laser pointer` switch initialized on. Disabling it clears active rendering, restores the normal cursor, and blocks new laser samples; Fullscreen omits the setting.
- Full frontend regression: `node --test tests/*.test.mjs` passed 251/251 tests with no failures, skips, or cancellations.
- Build verification: `npm run build` and `npm run tauri build -- --debug` passed. Only the existing Excalidraw static/dynamic import overlap and large-chunk informational warnings remained.
- Native verification: the current-project bundle at `src-tauri/target/debug/bundle/macos/IdeaNote.app` was rebuilt and launched, and the user confirmed that the Preview laser configuration takes effect.
- Workflow verification: Superplan registry validation, exhaustive plan catalog/search review, generated index validation, `git diff --check`, and final task-diff inspection passed.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F028-first-camera-preview-laser-pointer.md`
- `docs/superplan/plans/features/F029-preview-laser-trail-and-fullscreen-toolbar.md`
- `src/components/PresentationMode.tsx`
- `src/index.css`
- `tests/presentationMode.test.mjs`
- `https://github.com/tholman/cursor-effects/blob/master/src/ghostCursor.js` (MIT fixed-position lifespan/removal reference)
- `https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getCoalescedEvents`
