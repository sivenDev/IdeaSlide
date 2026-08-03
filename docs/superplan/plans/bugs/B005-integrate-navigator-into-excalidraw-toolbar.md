---
id: "B005"
title: "Move Navigator into the Excalidraw Main Menu"
type: "bugfix"
status: "complete"
summary: "Remove the detached Canvas control island, put Navigator in Excalidraw's Main Menu, and keep Camera creation in the Cameras list."
source: "docs/superplan/human/bugs.md"
created: "2026-08-04"
order: 5
depends_on: ["F009"]
parent: ""
---

# Move Navigator into the Excalidraw Main Menu Plan

**Goal:** Give Navigator and Camera creation clear, stable homes without pretending a detached top-right island is part of Excalidraw's drawing toolbar.
**Scope:** Remove the complete Canvas top-right Navigator/Camera control group introduced by F009. Add one `Navigator` command to Excalidraw's officially customizable left `MainMenu`; it toggles the current IdeaSketch Pages/Cameras panel and reflects its open state. Keep the existing right-divider notch as the direct expand/collapse affordance. Keep `Add camera` only in the Cameras tab header, where it opens Cameras and issues the existing monotonic drawing request. Preserve Pages/Cameras tabs, tooltips on list actions, read-only safeguards, Camera drawing, Present, and all document-draft behavior.
**Non-Goals:** This fix does not inject or portal controls into Excalidraw's private toolbar DOM, fork Excalidraw, rebuild the native drawing toolbar, add Camera creation to the Main Menu, remove the right divider toggle, add keyboard shortcuts, add thumbnails, resize the right panel, change presentation, or alter persistence.
**Architecture:** `SlideCanvas` already owns the customized Excalidraw `MainMenu`; it will render a `MainMenu.Item` for Navigator before the existing default items and retain only the panel-state/callback props needed by that command. `IdeaSketchEditor` remains the navigator-visibility owner and continues to send Camera drawing requests from `CameraList` through `cameraDrawingRequestToken`. `CanvasPresentationControls` and its `renderTopRightUI` wiring become obsolete and are deleted, along with the island-specific CSS and prop-comparator surface. The right divider remains a sibling editor-shell control rather than an Excalidraw menu concern.
**Baseline:** F009 renders Navigator and Add camera through `SlideCanvas.renderTopRightUI`, producing an independent white island in `.layer-ui__wrapper__top-right`. The same Add camera action already exists in the Cameras list header, so the Canvas island duplicates creation while Navigator has no entry in the customizable left Main Menu.
**Reproduction:** Open a writable IdeaSketch file. Excalidraw shows a separate two-button island to the right of its drawing toolbar. Opening the left Main Menu shows export/theme/background/clear/help commands but no Navigator command. Opening Cameras also shows another Add camera button, creating two Camera entry points.
**Root Cause:** F009 treated Navigator visibility and Camera creation as persistent Canvas toolbar actions and used `renderTopRightUI`, even though Excalidraw reserves that API for a separate top-right container. This placed Navigator in the wrong UI surface and duplicated the Camera-list creation action instead of using the already-customized `MainMenu` for view navigation.
**Exit Criteria:** Writable IdeaSketch canvases show no custom top-right Navigator/Camera island. Excalidraw's left Main Menu contains one accessible `Navigator` item that opens and hides the right Pages/Cameras panel and reflects its selected/open state. The right divider still toggles the panel. Cameras has exactly one Add camera entry in its header; using it opens Cameras and enters one drawing request. Add camera is absent from the Main Menu and Canvas toolbar. Present, Pages/Cameras lifecycle, read-only behavior, Camera drawing, view/presentation mode, Canvas badges, and save/export behavior remain unchanged. Focused contracts, full frontend regression, production build, diff checks, and browser interaction checks pass.

## Task 1: Lock the Menu and Single-entry Camera Contract

**Outcome:** Focused regressions prove the detached island is removed, Navigator belongs to Main Menu, and Camera creation has one visible entry.
**Files:**
- Create: `tests/excalidrawMainMenu.test.mjs`
- Delete: `tests/canvasPresentationControls.test.mjs`
- Modify: `tests/cameraSidebarWiring.test.mjs`
- Modify: `tests/slideCanvasProps.test.mjs`
- Modify: `tests/tooltipWiring.test.mjs`

**Change Map:**
- Main Menu contract: require one Navigator item with panel-state wiring before default menu actions
- removal contract: reject `renderTopRightUI`, `CanvasPresentationControls`, and Canvas Add camera wiring
- Camera contract: require the Cameras header as the only Add camera entry while retaining its tooltip and request callback
- prop contract: remove obsolete Canvas control props without weakening navigator state or drawing-token comparison

**Verification:**
- `node --test tests/excalidrawMainMenu.test.mjs tests/cameraSidebarWiring.test.mjs tests/slideCanvasProps.test.mjs tests/tooltipWiring.test.mjs`

- [x] Add focused failing contracts for Main Menu Navigator and single-entry Camera creation.
- [x] Confirm failures identify the current top-right island and duplicate Add camera action.

## Task 2: Move Navigator and Remove the Canvas Island

**Outcome:** Navigator uses Excalidraw's supported Main Menu while Camera creation stays exclusively in the Cameras list.
**Files:**
- Delete: `src/components/CanvasPresentationControls.tsx`
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/lib/slideCanvasProps.ts`
- Modify: `src/index.css`

**Change Map:**
- `SlideCanvas`: add a selected-aware Navigator `MainMenu.Item`, remove `renderTopRightUI`, and keep Camera drawing-token consumption internal
- `IdeaSketchEditor`: stop forwarding Canvas Add camera while retaining Navigator state/callback and Cameras-header creation
- prop comparator: remove `onAddCamera` and other obsolete top-right control surface while tracking menu Navigator state safely
- CSS/component cleanup: delete the unused control component and all detached-island selectors

**Verification:**
- Run the focused Task 1 suite.
- Interaction cases: Main Menu Navigator opens/closes Pages/Cameras; divider toggle remains synchronized; Cameras header Add camera opens Cameras and draws one frame; no Canvas/menu duplicate exists; view/read-only behavior remains safe.

- [x] Implement the Main Menu Navigator command and remove the top-right custom UI path.
- [x] Preserve Camera drawing, panel state, accessibility, and memoization boundaries.
- [x] Remove obsolete component, styles, props, and tests without widening editor behavior.

## Task 3: Verify and Deliver B005

**Outcome:** The corrected control ownership ships with regression, build, visual, and progress evidence.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B005-integrate-navigator-into-excalidraw-toolbar.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- B005 bug and plan: completed status plus root-cause and verification evidence
- generated plan index: refreshed bugfix state

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Browser acceptance: no top-right custom island; Main Menu Navigator state and toggling; divider synchronization; single Cameras-header Add camera; Camera drawing; read-only/view mode; console errors.

- [x] Run focused checks during implementation and the complete frontend regression/build matrix once stable.
- [x] Record browser evidence, mark B005 done/complete, refresh the index, and create a separate `fix(B005)` commit excluding `AGENTS.md`.

## Delivery Evidence
- Focused regression first failed against the detached `renderTopRightUI` island and obsolete Canvas `onAddCamera` surface, then passed after the fix: `node --test tests/excalidrawMainMenu.test.mjs tests/cameraSidebarWiring.test.mjs tests/slideCanvasProps.test.mjs tests/tooltipWiring.test.mjs` (21 passed).
- Full frontend regression passed: `node --test tests/*.test.mjs` (166 passed).
- Production frontend build passed: `npm run build`; only the existing Excalidraw chunking and bundle-size warnings remain.
- Native regression passed: `cargo test` (64 passed).
- `git diff --check` passed.
- Browser acceptance passed on the local Vite frontend: no detached Canvas control island; Main Menu contains one selected-aware Navigator item and no Add camera item; divider toggling stays synchronized; Cameras contains the only Add camera control; Present remains enabled with zero Cameras; drawing a Camera updates the Cameras count from 0 to 1; no console errors were reported.

## References
- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/features/F003-canvas-presentation-controls.md`
- `docs/superplan/plans/features/F005-align-workspace-camera-actions.md`
- `docs/superplan/plans/features/F006-revision-c-editor-shell-defaults.md`
- `docs/superplan/plans/features/F009-tabbed-ideasketch-navigator.md`
- `src/components/CameraList.tsx`
- `src/components/CanvasPresentationControls.tsx`
- `src/components/SlideCanvas.tsx`
- `src/components/IdeaSketchEditor.tsx`
- `src/lib/slideCanvasProps.ts`
- `src/index.css`
- `node_modules/@excalidraw/excalidraw/dist/types/excalidraw/components/main-menu/MainMenu.d.ts`
