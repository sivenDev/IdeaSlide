---
id: "F005"
title: "Align Workspace Actions and Camera Presentation Header"
type: "feature"
status: "complete"
summary: "Match the approved editor-shell revision by completing the Workspace action bar and moving Present into the Cameras header."
source: "docs/superplan/human/features.md"
created: "2026-07-24"
order: 5
depends_on: ["F004"]
parent: ""
---

# Align Workspace Actions and Camera Presentation Header Plan

**Goal:** Make the production editor match the approved Revision B prototype, with Workspace actions reading like a file explorer and presentation controls belonging to the Camera sequence.
**Scope:** Update the Workspace header to show New resource, New folder, a visual separator, Collapse all, and a right-aligned More menu in the same order and density as the approved HTML prototype. The More menu exposes the safe complementary `Expand all` action so the ellipsis is functional rather than decorative. Reduce the Excalidraw top-right island to the Cameras toggle and count. Move the existing Preview/Fullscreen Present dropdown into the Cameras header beside a compact icon-only Add Camera action; Present remains visible but disabled with zero Cameras and becomes enabled when the current Canvas has Cameras.
**Non-Goals:** This plan does not change Camera extraction, presentation sequencing, Camera naming, thumbnails, Workspace persistence, resource creation semantics, panel sizing, the `.is` format, or presentation mode itself. It does not add destructive operations to the Workspace overflow menu or remove the Canvas Cameras toggle.
**Architecture:** `EditorLayout` remains the owner of presentation callbacks and passes them to `CameraList` instead of through the Canvas-only control path. `CanvasPresentationControls` becomes a single-purpose Cameras toggle. `CameraList` owns only the header menu presentation and delegates Preview/Fullscreen callbacks unchanged. `WorkspaceExplorer` continues to own folder expansion state and adds a header separator plus an overflow dropdown containing `Expand all`; no new global state is introduced. Shared production styles in `src/index.css` implement the approved compact header treatment.
**Baseline:** F004 currently renders Cameras and Present together inside Excalidraw, while `CameraList` owns only Add Camera. The production Workspace header has New resource, New folder, and a right-aligned Collapse all button, but lacks the approved separator and More affordance. The approved `.temp/f004-editor-shell-prototype/` Revision B demonstrates the desired placement and enabled/disabled Present states without console errors.
**Exit Criteria:** The Workspace header visibly follows New resource → New folder → separator → Collapse all → More, and More opens a functional `Expand all` command. Excalidraw's top-right island contains only Cameras and its count. The Cameras header contains icon-only Add Camera and a Present dropdown; Present is disabled with zero Cameras and exposes Preview/Fullscreen once at least one Camera exists. Existing Camera creation, current-Canvas-only presentation, resource creation/rename, panel collapse/resize, focused UI contracts, the full Node suite, and production build remain green.

## Task 1: Lock the Approved Control Placement with Focused Contracts

**Outcome:** Tests capture the approved Workspace action order and the transfer of Present from the Canvas island into the Cameras header.
**Files:**
- Modify: `tests/canvasPresentationControls.test.mjs`
- Modify: `tests/cameraSidebarWiring.test.mjs`
- Modify: `tests/workspaceExplorerWiring.test.mjs`

**Change Map:**
- Canvas control contract: require Cameras-only Excalidraw UI and reject Present menu wiring there
- Camera sidebar contract: require disabled-aware Present, Preview, Fullscreen, and compact Add Camera in the header
- Workspace contract: require separator, Collapse all, More, and Expand all wiring

**Verification:**
- `node --test tests/canvasPresentationControls.test.mjs tests/cameraSidebarWiring.test.mjs tests/workspaceExplorerWiring.test.mjs`

- [x] Add focused failing contracts for the approved Revision B control ownership and header order.
- [x] Confirm the focused suite fails because production still implements the F004 placement.

## Task 2: Move Present and Complete the Workspace Action Bar

**Outcome:** Production components and shared styling match the approved Revision B prototype without changing the underlying editor behavior.
**Files:**
- Modify: `src/components/CanvasPresentationControls.tsx`
- Modify: `src/components/CameraList.tsx`
- Modify: `src/components/WorkspaceExplorer.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/ResourceEditorHost.tsx`
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `src/index.css`

**Change Map:**
- `CanvasPresentationControls`: remove presentation callbacks/menu and retain the Cameras toggle/count island
- `CameraList`: accept Preview/Fullscreen callbacks and render compact Add plus disabled-aware Present dropdown in its header
- `WorkspaceExplorer`: add the approved separator, direct Collapse all position, More dropdown, and Expand all behavior
- `EditorLayout` → `ResourceEditorHost` → `SlideCanvas`: stop forwarding presentation callbacks into the Canvas control path while preserving camera toggle/count wiring
- `src/index.css`: remove obsolete Canvas Present/divider styling and add Camera header action/menu styling

**Verification:**
- `node --test tests/canvasPresentationControls.test.mjs tests/cameraSidebarWiring.test.mjs tests/workspaceExplorerWiring.test.mjs tests/resourceEditorHost.test.mjs`
- Interaction cases: Cameras still toggles the sidebar; Add Camera still issues one drawing request; Present disabled/enabled states follow Camera count; Preview/Fullscreen callbacks remain reachable; Collapse all and Expand all update folder expansion.

- [x] Implement the minimum component and prop changes to transfer Present into `CameraList`.
- [x] Implement the approved Workspace action sequence with a functional More menu.
- [x] Apply the approved compact header styles and remove obsolete Canvas Present styles.
- [x] Run the focused UI suite and review the component diff against the prototype.

## Task 3: Verify and Deliver the Approved Revision

**Outcome:** The revised control placement ships without regressions to editor behavior or build integrity.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/features/F005-align-workspace-camera-actions.md`

**Change Map:**
- F005 plan and feature entry: final status and implementation evidence
- generated plan index: refreshed F005 status

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Compare production structure and states with the approved Revision B browser prototype; attempt Tauri smoke without disturbing existing user processes.

- [x] Run the complete Node regression suite and production build once after implementation stabilizes.
- [x] Review the final diff and record browser/Tauri smoke evidence or environment limitations.
- [x] Mark F005 complete, refresh the plan index, and create a separate F005 commit excluding `AGENTS.md` and `.temp`.

## Delivery Evidence

- TDD red: the initial focused Revision B contracts failed in five expected places because Present and its menu still lived in `CanvasPresentationControls`, the Camera header lacked presentation actions, and the Workspace header lacked the separator/More sequence.
- Focused green: 19 UI and shared-tooltip contracts passed after the final icon-only Add Camera tooltip adjustment.
- `node --test tests/*.test.mjs` — 122 tests passed.
- `npm run build` — TypeScript and Vite production build passed; existing Excalidraw dynamic-import and large-chunk warnings remain informational.
- `git diff --check` — passed against the stabilized implementation.
- Approved browser prototype evidence remains current for the visual direction: Canvas top-right contains only Cameras; the Cameras header contains Add and disabled/enabled Present states; the Present menu exposes Preview and Fullscreen without browser console errors.
- Tauri smoke limitation: a clean `npm run tauri dev` successfully built and launched `target/debug/idea-slide`, but macOS Computer Use resolved the shared `com.zhengxiwan.idea-slide` identity to the separately installed `/Applications/IdeaSlide.app`, whose old Slide/Cameras/Present toolbar confirmed it was not the debug window. The installed app instance opened by the smoke attempt and the temporary development process were closed afterward. No user files or existing application data were changed.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F003-canvas-presentation-controls.md`
- `docs/superplan/plans/features/F004-refine-editor-shell.md`
- `.temp/f004-editor-shell-prototype/`
- `src/components/CanvasPresentationControls.tsx`
- `src/components/CameraList.tsx`
- `src/components/WorkspaceExplorer.tsx`
- `src/components/EditorLayout.tsx`
- `src/components/ResourceEditorHost.tsx`
- `src/components/SlideCanvas.tsx`
- `src/index.css`
