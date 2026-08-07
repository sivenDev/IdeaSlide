---
id: "F029"
title: "Add a Preview Laser Trail and Reclaim Native Fullscreen Toolbar Space"
type: "feature"
status: "complete"
summary: "Give Preview a bounded fading laser trail and clean canvas surface, keep desktop window controls native-only, and reclaim their macOS and Windows toolbar insets in fullscreen."
source: "docs/superplan/human/features.md"
created: "2026-08-07"
order: 29
depends_on: ["F014", "F022", "F028", "B017", "B018"]
parent: ""
---

# Add a Preview Laser Trail and Reclaim Native Fullscreen Toolbar Space Plan

**Goal:** Make Preview presentation pointing and canvas chrome feel purpose-built while allowing macOS and Windows editor toolbars to reclaim native window-control space in fullscreen.
**Scope:** Enhance F028's Preview-only red laser with a short, smooth fading tail that follows mouse movement, remains non-interactive, clears when the pointer leaves or presentation overlays open, and never changes Excalidraw or document state. Hide Excalidraw's top-left main-menu trigger only while Preview is active so the presentation surface stays clean; the normal editor and Fullscreen presentation retain their existing menu behavior. In the macOS Tauri editor window, remove B017's application-drawn inactive traffic-light placeholders so native macOS controls remain the sole window-control layer and retain the 5rem left reservation in normal windows. In the Windows Tauri editor window, retain the existing 9rem right reservation for native minimize, maximize, and close controls in normal windows. Detect native fullscreen changes on both platforms and reduce the relevant platform inset to the shared 0.75rem toolbar padding while fullscreen. Browser and other non-macOS/non-Windows toolbar behavior remains unchanged.
**Non-Goals:** This feature does not add drawing, persistent annotations, configurable laser styles, touch or pen trails, an unbounded particle system, Fullscreen-presentation laser behavior, Camera/navigation changes, remove or redesign the editor's Excalidraw menu, replace or draw macOS or Windows native window controls, change the title-bar palette or commands, or modify window sizing/configuration.
**Architecture:** `PresentationMode` continues to own all presentation-only pointer and chrome UI. It will keep the current laser head and add a bounded collection of uniquely keyed trail particles; CSS animation owns fade/scale lifetime, and animation completion plus explicit pointer/overlay cleanup remove particles without timers that can outlive the component. A Preview-specific presentation class scopes the existing Excalidraw `.main-menu-trigger` override to `display: none`, avoiding changes to `SlideCanvas`'s registry-driven editor menu. `Toolbar` remains the window-chrome boundary, removes the obsolete focus listener and synthetic control markup, and owns only native fullscreen state initialized from `isFullscreen()` and refreshed from window resize events in macOS and Windows Tauri runtimes. Platform classes preserve the macOS left and Windows right reservations in normal windows, while `is-fullscreen` overrides only the applicable inset. Existing capture-phase presentation keyboard handling and native window controls remain untouched.
**Baseline:** F028 renders one 12×12 Preview laser point from local React state with `pointer-events: none`, clears it on pointer leave or when overlays open, and leaves Fullscreen presentation cursor behavior unchanged. `SlideCanvas` omits IdeaNote's custom Main Menu while view-only presentation is active, but Excalidraw's own top-left menu trigger can remain visible because the application has no Preview-specific suppression boundary. B017/B018 reserve 5rem at the left of every macOS toolbar and draw three inactive traffic-light placeholders when the window is unfocused. Native macOS controls can reappear over that synthetic layer during focus and fullscreen transitions, producing duplicate or overlapping circles. The Windows toolbar reserves 9rem on the right for native minimize, maximize, and close controls. Both platform reservations remain unused in fullscreen.
**Exit Criteria:** Preview shows a bright red laser head with a visually continuous short tail that fades and contracts behind mouse movement, stays bounded during long movement, clears on pointer leave and overlay display, does not intercept input, and never calls Excalidraw scene mutation APIs. The Excalidraw top-left main-menu trigger is absent throughout Preview and returns unchanged in the editor after exit; Fullscreen presentation menu behavior remains unchanged. The application never draws macOS traffic lights or Windows window buttons. Normal macOS windows retain the 5rem left footprint, normal Windows windows retain the 9rem right footprint, and native fullscreen reduces the relevant inset to 0.75rem so toolbar content uses the reclaimed width. Repeated focus and fullscreen transitions do not produce duplicate or overlapping controls. Browser and other desktop platforms do not call native fullscreen APIs. Focused contracts, the complete Node suite, production build, native Preview plus macOS and Windows fullscreen smoke checks where available, and diff checks pass.

## Task 1: Lock the Trail and Fullscreen Chrome Contracts

**Outcome:** Focused regressions describe the bounded Preview trail, menu-free Preview surface, and macOS/Windows fullscreen toolbar lifecycle before production edits.
**Files:**
- Modify: `tests/presentationMode.test.mjs`
- Modify: `tests/editorChromeNavigation.test.mjs`

**Change Map:**
- presentation contract: laser head preservation, bounded keyed trail particles, CSS-owned fade lifecycle, leave/overlay cleanup, Preview-only rendering, scoped top-left menu suppression, pointer isolation, and absence of Excalidraw scene writes
- toolbar contract: absence of synthetic window-control markup and focus listeners, guarded macOS/Windows `isFullscreen()` initialization, resize-driven refresh, listener cleanup, platform class ownership, and scoped fullscreen padding restoration

**Verification:**
- `node --test tests/presentationMode.test.mjs tests/editorChromeNavigation.test.mjs`

- [x] Add focused source-level assertions for the observable laser-tail, Preview menu suppression, and native-fullscreen toolbar boundaries.
- [x] Confirm the new assertions fail against the current single-point and fixed-inset implementation while preserving existing F028 and B017/B018 contracts.

## Task 2: Refine the Preview Laser and Presentation Surface

**Outcome:** Preview pointer movement produces a smooth presentation-local tail on a clean menu-free canvas without persistence or unbounded rendering work.
**Files:**
- Modify: `src/components/PresentationMode.tsx`
- Modify: `src/index.css`
- Modify: `tests/presentationMode.test.mjs`

**Change Map:**
- `PresentationMode`: Preview-scoped presentation class, bounded trail particle state and ids, pointer-move sampling, animation-end removal, and shared leave/overlay cleanup while retaining the current laser head
- presentation CSS: smaller glowing tail particles with a short fade-and-contract animation, reduced-motion-safe behavior, and a Preview-only `.main-menu-trigger` suppression rule

**Verification:**
- Run the focused Task 1 tests.
- Preview interaction cases: continuous movement creates a short smooth tail; stopping fades the tail while retaining the head; leaving the surface or opening Cameras/Settings clears both; the top-left Excalidraw menu is absent; overlays remain clickable; exiting Preview restores the normal editor menu; Fullscreen presentation keeps its existing cursor and menu behavior.

- [x] Implement the smallest bounded particle trail and Preview-only menu suppression without timers, document writes, or Excalidraw API updates.
- [x] Verify particle count, cleanup, pointer isolation, reduced-motion behavior, and menu restoration after Preview exit.

## Task 3: Reclaim Native Window-Control Insets in Fullscreen

**Outcome:** Native macOS and Windows controls remain the only window-control layers, while fullscreen reclaims their platform-specific toolbar footprints and restores them on exit.
**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/index.css`
- Modify: `tests/editorChromeNavigation.test.mjs`
- Inspect: `src-tauri/capabilities/default.json`

**Change Map:**
- `Toolbar`: remove inactive-placeholder focus tracking and markup; retain guarded macOS/Windows Tauri fullscreen state, initial `isFullscreen()` read, resize-event refresh, lifecycle cleanup, and platform plus `is-fullscreen` classes
- toolbar CSS: override `.is-mac` left padding and `.is-windows` right padding only while fullscreen, while keeping normal-window and other-platform geometry unchanged
- Tauri permissions: confirm existing window query/event permissions cover fullscreen inspection and resize observation; add only a narrowly required permission if validation proves it missing

**Verification:**
- Run the focused Task 1 tests.
- Native macOS cases: focused and unfocused normal window, enter fullscreen, fullscreen focus change, leave fullscreen; verify no synthetic circles appear, native controls do not overlap, and the 5rem left inset is present only in normal windows.
- Native Windows cases: normal window, enter fullscreen, leave fullscreen; verify no synthetic buttons appear, native minimize/maximize/close controls retain a 9rem right safety area only in the normal window, and all commands, centered title, save state, and dragging remain stable on both platforms.

- [x] Add lifecycle-safe fullscreen awareness without accumulating listeners or invoking native APIs outside macOS/Windows Tauri rendering.
- [x] Keep controls native-only, reclaim only the applicable fullscreen inset, and verify normal-window native chrome remains stable on macOS and Windows.

## Task 4: Verify and Deliver F029

**Outcome:** Both presentation refinements ship together with focused, regression, build, native, workflow, and isolated Git evidence.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/features/F029-preview-laser-trail-and-fullscreen-toolbar.md`

**Change Map:**
- F029 feature and plan: lifecycle state, checked outcomes, and final verification evidence
- generated plan index: refreshed F029 state and dependencies

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Native Tauri smoke: Preview trail motion/decay/cleanup and hidden top-left menu, editor menu restoration after exit, and macOS/Windows native-fullscreen toolbar insets plus native-only window-control matrix

- [x] Run the complete Node regression suite and production build once after implementation stabilizes.
- [x] Complete available native smoke verification, inspect the final diff, mark F029 complete, refresh the plan index, and create a separate `feat(F029)` commit.

## Completion Evidence

- Test-first coverage: the focused Preview and editor-chrome contracts first distinguished the prior single-point/fixed-inset behavior; the Windows expansion then failed 13/14 focused tests until `Toolbar` gained Windows platform ownership and the fullscreen right-inset override. The stabilized focused run passed 14/14.
- Preview implementation: `PresentationMode` keeps a bounded 24-point keyed trail, removes particles through CSS animation completion, clears the head and trail on leave or overlay display, and scopes Excalidraw main-menu suppression to Preview only. Pointer layers remain non-interactive and never call scene mutation APIs.
- Native chrome implementation: application-drawn macOS traffic-light placeholders and focus tracking are removed. macOS normal windows keep 5rem of left safety space and Windows normal windows keep 9rem on the right; both platform insets reduce to 0.75rem only while native fullscreen is reported through the lifecycle-safe Tauri resize listener. No custom macOS or Windows window controls are rendered.
- Full frontend regression: `node --test tests/*.test.mjs` passed 250/250 tests with no failures, skips, or cancellations.
- Production build: `npm run build` passed strict TypeScript and Vite production generation. The existing Excalidraw static/dynamic import overlap and large-chunk warnings remain informational.
- Native verification: the user reviewed and accepted the native macOS control ownership and fullscreen layout during iteration. A Windows runtime was not available in this workspace; the platform detection, normal 9rem reservation, fullscreen 0.75rem override, native-API guard, listener lifecycle, and absence of synthetic controls are covered by the focused regression.
- Workflow verification: Superplan registry validation, exhaustive plan catalog/search review, generated index validation, `git diff --check`, and final task-diff inspection passed.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F014-simplify-file-and-navigator-controls.md`
- `docs/superplan/plans/features/F022-export-editor-content-as-drawio.md`
- `docs/superplan/plans/features/F028-first-camera-preview-laser-pointer.md`
- `docs/superplan/plans/bugs/B017-match-shimo-title-bar-and-inactive-traffic-lights.md`
- `docs/superplan/plans/bugs/B018-lower-macos-window-controls.md`
- `src/components/PresentationMode.tsx`
- `src/components/SlideCanvas.tsx`
- `src/components/Toolbar.tsx`
- `src/index.css`
- `src-tauri/capabilities/default.json`
- `tests/presentationMode.test.mjs`
- `tests/editorChromeNavigation.test.mjs`
