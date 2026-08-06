---
id: "F028"
title: "Start Presentation at the First Camera and Add a Preview Laser Pointer"
type: "feature"
status: "complete"
summary: "Keep presentation startup Camera-aware and replace the Preview cursor with a non-persistent laser pointer."
source: "docs/superplan/human/features.md"
created: "2026-08-07"
order: 28
depends_on: ["F003", "F006", "B002"]
parent: ""
---

# Start Presentation at the First Camera and Add a Preview Laser Pointer Plan

**Goal:** Make IdeaSketch playback open at the intended first Camera when available and give Preview mode a presentation-friendly laser pointer.
**Scope:** Preserve and regression-lock the current Page-scoped startup behavior: ordered Cameras begin at Camera 1 and receive an immediate initial viewport, while a Page with no Cameras keeps its saved Excalidraw viewport. In Preview mode only, hide the ordinary cursor over the presentation surface and show a visible red laser point that follows mouse movement without changing or persisting Excalidraw elements, files, or app state. Fullscreen keeps its existing pointer behavior.
**Non-Goals:** This plan does not change Camera ordering, Camera bounds or padding math, transition timing after the initial Camera, keyboard navigation, presentation overlays, Fullscreen cursor behavior, touch gestures, `.is` persistence, or editor refresh behavior after presentation exit. It does not add laser trails, drawing, collaboration, or a configurable pointer style.
**Architecture:** `PresentationMode` remains the sole owner of playback viewport and presentation-only pointer UI. Camera startup continues through `extractCameras`, index zero, and the existing API-ready viewport effect; the zero-Camera path continues to pass through the Page's saved app state unchanged. The Preview laser is local React/UI state rendered above the read-only canvas with `pointer-events: none`; pointer coordinates are captured at the presentation container, the browser cursor is hidden only while Preview pointer input is active, and no Excalidraw scene update is used for the pointer.
**Baseline:** `PresentationMode` already initializes `currentCameraIndex` to zero, waits for valid Excalidraw viewport dimensions, immediately applies the first ordered Camera target once, and leaves the saved Page app state intact when no Cameras exist. There is no focused regression covering both startup branches, and Preview currently uses the normal mouse cursor with no laser indicator.
**Exit Criteria:** Preview and Fullscreen open Camera-backed Pages at the first ordered Camera without an initial animated detour; Pages with no Cameras retain their saved viewport behavior. Preview replaces the normal canvas cursor with a visible red laser point that tracks mouse movement, disappears when the pointer leaves, does not intercept controls, and never mutates or persists the scene. Fullscreen pointer behavior, Camera navigation, keyboard capture, and presentation-exit refresh remain unchanged. Focused presentation contracts, the full Node suite, production build, diff checks, and a native Preview smoke check pass.

## Task 1: Lock Camera Startup and Preview Pointer Contracts

**Outcome:** Focused regressions describe the Camera-backed and zero-Camera startup branches plus the Preview-only laser boundary before implementation changes.
**Files:**
- Create: `tests/presentationMode.test.mjs`
- Inspect: `src/components/PresentationMode.tsx`

**Change Map:**
- `tests/presentationMode.test.mjs`: first ordered Camera initialization, zero-Camera saved viewport fallback, Preview-only laser rendering and cursor ownership, pointer-leave cleanup, non-interactive overlay, and absence of scene persistence for pointer movement

**Verification:**
- `node --test tests/presentationMode.test.mjs`

- [x] Add focused source-level contracts for both startup viewport branches and the Preview-only laser pointer boundary.
- [x] Confirm the laser assertions fail against the current implementation while the existing Camera behavior assertions document the baseline.

## Task 2: Add the Non-Persistent Preview Laser Pointer

**Outcome:** Preview mode provides a red laser point without affecting Fullscreen, Camera navigation, or document state.
**Files:**
- Modify: `src/components/PresentationMode.tsx`
- Modify: `tests/presentationMode.test.mjs`

**Change Map:**
- `PresentationMode`: Preview pointer tracking, scoped cursor hiding, pointer-leave reset, and a presentation-local laser overlay above the read-only Excalidraw canvas
- focused regression: observable Preview/Fullscreen distinction and no Excalidraw scene writes for laser movement

**Verification:**
- `node --test tests/presentationMode.test.mjs tests/workspacePresentationOrder.test.mjs tests/cameraSidebarWiring.test.mjs tests/editorChromeNavigation.test.mjs`
- Interaction cases: first Camera is visible immediately; zero-Camera Page opens at its saved viewport; Preview shows and moves the red laser point; leaving the presentation surface removes it; overlays remain clickable; Fullscreen retains the normal pointer.

- [x] Implement the minimum PresentationMode-local laser state and overlay.
- [x] Run the focused presentation and editor-navigation regressions.

## Task 3: Verify and Deliver the Playback Refinement

**Outcome:** The Camera startup contract and Preview laser ship as an isolated, regression-safe F028 change.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/features/F028-first-camera-preview-laser-pointer.md`

**Change Map:**
- F028 feature and plan: completion status, checked outcomes, and final evidence
- generated plan index: refreshed F028 lifecycle state

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Native Tauri smoke: Preview and Fullscreen on one Page with Cameras and one Page without Cameras; verify Camera 1 startup, saved-viewport fallback, Preview laser tracking/leave behavior, overlay interaction, Fullscreen pointer behavior, and clean editor return.

- [x] Run the complete Node regression suite and production build once after implementation stabilizes.
- [x] Complete the native playback smoke matrix, inspect the final diff, mark F028 complete, refresh the plan index, and create a separate `feat(F028)` commit.

## Delivery Evidence

- The complete Node regression suite passed: 248 tests, 0 failures.
- `npm run build` passed; only the existing Excalidraw import-overlap and large-chunk informational warnings remained.
- Native Tauri smoke checks entered and exited Preview and Fullscreen successfully on a disposable unsaved Page without saving a file; Preview hid the ordinary cursor while Fullscreen retained its existing behavior.
- Browser DOM inspection confirmed one 12×12 red laser overlay at the moved mouse position with `pointer-events: none`, and confirmed the Preview canvas cursor was hidden.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/04-ideasketch-editor-integration.md`
- `docs/superplan/plans/features/F003-canvas-presentation-controls.md`
- `docs/superplan/plans/features/F006-revision-c-editor-shell-defaults.md`
- `docs/superplan/plans/bugs/B002-refresh-editor-after-presentation-exit.md`
- `src/components/PresentationMode.tsx`
- `src/lib/cameraUtils.ts`
- `src/lib/cameraViewport.ts`
- `tests/workspacePresentationOrder.test.mjs`
