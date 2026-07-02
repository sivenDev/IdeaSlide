---
id: "B002"
title: "Refresh Editor After Presentation Exit"
type: "bugfix"
status: "complete"
summary: "Refresh the editor Excalidraw canvas after leaving presentation mode so it does not stay visually corrupted until manual zoom."
source: "docs/superplan/human/bugs.md"
created: "2026-07-02"
order: 2
depends_on: []
parent: ""
---

# Refresh Editor After Presentation Exit Plan

**Goal:** Leaving presentation mode returns to a correctly rendered editor canvas without requiring manual zoom.
**Scope:** Add a small presentation-exit refresh signal from `App` to `EditorLayout`/`SlideCanvas`, and make the editor Excalidraw API refresh after the window has had time to settle.
**Non-Goals:** This plan does not change slide persistence, presentation navigation, camera viewport math, thumbnail rendering, or the Excalidraw scene data model.
**Architecture:** `PresentationMode` remains the fullscreen/presentation owner. `App` records an editor refresh token when presentation exits, passes it into `EditorLayout`, and `EditorLayout` forwards it to `SlideCanvas`; `SlideCanvas` schedules `api.refresh()` across animation frames and a short timeout so a late fullscreen resize cannot leave the canvas using stale measurements.
**Baseline:** Exiting presentation dispatches `EXIT_PRESENTATION` immediately. Fullscreen exit happens asynchronously in `PresentationMode` cleanup, while the editor Excalidraw canvas can mount before the window size is stable. Manual zoom triggers Excalidraw to remeasure/repaint, which matches the reported recovery behavior.
**Reproduction:** Enter presentation/fullscreen mode, exit back to the editor, observe the editor canvas rendering as misaligned or visually corrupted, then zoom once and observe the rendering recover.
**Root Cause:** The editor canvas can initialize against stale fullscreen/overlay dimensions because presentation exit and fullscreen restoration are not sequenced with an editor canvas refresh.
**Exit Criteria:** Presentation exit increments an editor refresh signal, the editor forwards it to the canvas, the canvas invokes Excalidraw `refresh()` after the API is ready and layout has settled, regression tests lock the wiring, and the production build succeeds.

## Task 1: Refresh Editor Canvas After Presentation Exit

**Outcome:** The editor canvas performs a deterministic Excalidraw refresh after presentation exit instead of waiting for user zoom.
**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/SlideCanvas.tsx`
- Test: `tests/editorChromeNavigation.test.mjs`
- Test: `tests/cameraBadgeWiring.test.mjs`

**Verification:**
- `node --test tests/editorChromeNavigation.test.mjs tests/cameraBadgeWiring.test.mjs`
- `node --test tests/*.test.mjs`
- `npm run build`

- [x] Add a failing source-level test requiring `App` to maintain and increment an editor refresh token when presentation exits.
- [x] Add a failing source-level test requiring `EditorLayout` to pass the refresh token to `SlideCanvas`.
- [x] Add a failing source-level test requiring `SlideCanvas` to schedule `api.refresh()` on refresh token changes after the Excalidraw API is ready.
- [x] Run `node --test tests/editorChromeNavigation.test.mjs tests/cameraBadgeWiring.test.mjs` and confirm the new tests fail before production code changes.
- [x] Update `App` to wrap presentation exit in a callback that dispatches `EXIT_PRESENTATION` and increments the editor refresh token.
- [x] Update `EditorLayout` props and canvas wiring to forward the refresh token.
- [x] Update `SlideCanvas` props and effect logic to schedule `api.refresh()` with `requestAnimationFrame` and a short timeout, cleaning up pending callbacks on unmount or token changes.
- [x] Re-run focused tests and confirm they pass.
- [x] Run the full source-level test suite and production build.
- [x] Mark B002 and this plan complete after verification.

## References
- `src/App.tsx`
- `src/components/PresentationMode.tsx`
- `src/components/EditorLayout.tsx`
- `src/components/SlideCanvas.tsx`
- `node_modules/@excalidraw/excalidraw/dist/types/excalidraw/types.d.ts`
