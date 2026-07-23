---
id: "F003"
title: "Contextualize Canvas Presentation Controls"
type: "feature"
status: "complete"
summary: "Move camera and presentation actions into the active Canvas and add bounded Workspace sidebar resizing."
source: "docs/superplan/human/features.md"
created: "2026-07-23"
order: 3
depends_on: []
parent: ""
---

# Contextualize Canvas Presentation Controls Plan

**Goal:** Make camera creation, camera-list access, and presentation playback feel native to the active Excalidraw Canvas while giving the Workspace tree a compact adjustable width.
**Scope:** Remove Present from the global application toolbar and replace the existing ambiguous Canvas `Camera` button with an Excalidraw top-right control group containing `Cameras <count>` and `Present`. `Cameras` toggles the current Canvas's right sidebar; the sidebar header exposes `Add Camera`, which activates the existing rectangle-drawing mode. `Present` retains preview/fullscreen choices but always starts with the first Camera and plays only the current Canvas's ordered Cameras; it is disabled when the current Canvas has no Cameras. Replace the Workspace title/header's text buttons with an unlabeled compact IDE-style action bar followed directly by the resource tree: a `New resource` dropdown populated from the resource-type registry, a separate `New folder` button, and `Collapse all`. Do not repeat the `.is` filename as a tree root because the window toolbar already shows it. New items use the selected Folder as parent or the selected file's parent as the sibling location, then enter inline rename. Make the left Workspace sidebar default to 240px and support pointer dragging between a 180px minimum and 420px maximum while preserving its collapse marker and last in-session expanded width.
**Non-Goals:** This plan does not add thumbnails, camera names, new transitions, cross-Canvas presentation sequences, a persisted sidebar-width preference, right-sidebar resizing, touch-specific resizing gestures, filesystem refresh, sorting, an inactive overflow menu, or a new `.is` format version.
**Architecture:** `EditorLayout` remains the owner of panel visibility, panel width, active Canvas identity, Camera extraction, and presentation dispatch. A Canvas-specific control component is rendered through Excalidraw's supported `renderTopRightUI` slot via `ResourceEditorHost`/`SlideCanvas`, so non-Canvas resources expose no camera or presentation actions. Camera creation crosses the sibling boundary with a monotonic request token: `CameraList` increments the request, and the mounted `SlideCanvas` consumes each new token through its existing drawing state without exposing internal Excalidraw APIs. `App` projects only `state.activeResourceId` into `PresentationMode`, keeping the legacy workspace-wide projection available for persistence and MCP compatibility but removing it from interactive Present. `WorkspaceExplorer` owns its folder-expansion state and compact header interactions, while the resource registry exposes the ordered set of user-creatable non-folder types so future file types appear in the dropdown without another header redesign. Resource creation preserves the existing parent-selection rule and adds an explicit created-id/rename handoff. `ResizableDivider` gains an optional pointer-resize contract for the left panel; a pure clamping helper owns the 180/420 bounds, while the right divider remains collapse-only.
**Baseline:** The global `Toolbar` owns Preview, Fullscreen, and From Beginning actions. `SlideCanvas.renderTopRightUI` renders a standalone orange `Camera` button that starts drawing, while `CameraList` has no creation action. `App` passes every depth-first Canvas to `PresentationMode`, which advances between Cameras and then between Canvases. The Workspace header uses wide `+ Folder` and `+ Canvas` text buttons with hardcoded resource types and has no Collapse all action or automatic post-create rename. `EditorLayout` hardcodes the Workspace panel to 280px, and `ResizableDivider` only exposes a collapse button.
**Exit Criteria:** The global toolbar contains only workspace/file actions. On a Canvas, Excalidraw's top-right area shows `Cameras <count>` and `Present`; Cameras toggles the right panel, Add Camera in that panel enters drawing mode, and the old standalone Camera button is absent. Present is disabled with zero Cameras and otherwise Preview/Fullscreen plays Camera 1 through the last Camera of only the active Canvas, without moving into another Canvas. Non-Canvas resources show neither control. The Workspace panel begins with an unlabeled compact action bar using accessible icons for New resource, New folder, and Collapse all, followed directly by root-level resources; it shows neither a WORKSPACE label nor a duplicate `.is` filename root. New resource currently lists Canvas and automatically picks up future registered creatable types, creation follows the selected folder/sibling rule, and the created row immediately opens rename. No misleading Refresh or empty overflow action is shown. The Workspace sidebar opens at 240px, drags smoothly but never below 180px or above 420px, remembers its last width after collapse/restore in the same editor session, and retains an accessible collapse control. Focused UI/state tests, the full Node suite, production build, and editor smoke checks pass.

## Task 1: Move Camera and Present Actions Into the Active Canvas

**Outcome:** Camera management and presentation playback are contextual Canvas controls with unambiguous creation and list behaviors.
**Files:**
- Create: `src/components/CanvasPresentationControls.tsx`
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/ResourceEditorHost.tsx`
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `src/components/CameraList.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/PresentationMode.tsx`
- Test: `tests/canvasPresentationControls.test.mjs`
- Modify: `tests/cameraSidebarWiring.test.mjs`
- Modify: `tests/editorChromeNavigation.test.mjs`
- Modify: `tests/workspacePresentationOrder.test.mjs`
- Modify: `tests/tooltipWiring.test.mjs`

**Change Map:**
- `src/components/CanvasPresentationControls.tsx`: Canvas-only Cameras toggle/count and disabled-aware Present menu
- `src/components/Toolbar.tsx`: remove presentation props, menu, and global action
- `src/components/EditorLayout.tsx`: own Canvas control callbacks, camera-drawing request token, and active-Canvas presentation dispatch
- `src/components/ResourceEditorHost.tsx`: pass Canvas-only controls and drawing requests to `SlideCanvas`
- `src/components/SlideCanvas.tsx`: replace the standalone Camera control, consume Add Camera requests, and keep drawing mechanics internal
- `src/components/CameraList.tsx`: add an accessible `Add Camera` header action
- `src/App.tsx`: supply `PresentationMode` with only the active Canvas
- `src/components/PresentationMode.tsx`: present a camera-only sequence without cross-Canvas indicators/navigation

**Verification:**
- `node --test tests/canvasPresentationControls.test.mjs tests/cameraSidebarWiring.test.mjs tests/editorChromeNavigation.test.mjs tests/workspacePresentationOrder.test.mjs tests/tooltipWiring.test.mjs`
- Interaction cases: Cameras toggles the right panel; Add Camera activates one drawing request; Present is disabled with zero Cameras; Preview and Fullscreen both start at Camera 1; next/previous never leave the active Canvas; selecting a Folder hides the controls

- [x] Add failing control-placement, Add Camera, disabled Present, and active-Canvas-only playback regressions.
- [x] Remove the global Present action and add the Canvas top-right control group.
- [x] Move camera drawing activation into the CameraList header through a request-token boundary.
- [x] Limit interactive presentation input to the active Canvas and simplify camera-only navigation labels.
- [x] Run the focused Canvas control and presentation suite.

## Task 2: Build a Compact, Resizable Workspace Explorer

**Outcome:** The Workspace tree has scalable IDE-style creation controls, uses less space by default, and can be resized without collapsing the Canvas or consuming the full editor width.
**Files:**
- Create: `src/lib/panelSizing.ts`
- Modify: `src/lib/resourceTypeRegistry.ts`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/WorkspaceExplorer.tsx`
- Modify: `src/components/WorkspaceResourceRow.tsx`
- Modify: `src/components/ResizableDivider.tsx`
- Test: `tests/panelSizing.test.mjs`
- Modify: `tests/panelDividerWiring.test.mjs`
- Modify: `tests/workspaceExplorerWiring.test.mjs`

**Change Map:**
- `src/lib/panelSizing.ts`: default/minimum/maximum Workspace widths and pure clamping behavior
- `src/lib/resourceTypeRegistry.ts`: ordered user-creatable resource definitions for the New resource menu
- `src/components/EditorLayout.tsx`: session-local Workspace width state and dynamic panel styles
- `src/components/WorkspaceExplorer.tsx`: unlabeled compact action bar, registry-driven resource dropdown, selected-node create location, Collapse all, direct root-level tree, and post-create rename handoff
- `src/components/WorkspaceResourceRow.tsx`: externally requested inline rename entry for a newly created resource
- `src/components/ResizableDivider.tsx`: optional pointer drag handling, resize cursor/hit target, and collapse-button event isolation

**Verification:**
- `node --test tests/panelSizing.test.mjs tests/panelDividerWiring.test.mjs tests/workspaceExplorerWiring.test.mjs tests/editorChromeNavigation.test.mjs`
- Interaction cases: the panel shows no WORKSPACE label or duplicate `.is` root; New resource lists Canvas from the registry; New folder is direct; items are created inside a selected Folder or beside a selected file and enter rename; Collapse all closes every folder; initial width is 240px; dragging clamps at 180px and 420px; collapse produces zero width; restore returns to the last expanded width; right divider remains fixed-width and collapse-only

- [x] Add failing compact-header, registry menu, create-location, post-create rename, Collapse all, width-clamping, and divider drag regressions.
- [x] Expose user-creatable resource definitions and replace the wide hardcoded creation buttons with compact Explorer actions.
- [x] Preserve selected-node creation semantics, start inline rename for new items, and implement Collapse all.
- [x] Implement the shared Workspace panel sizing policy.
- [x] Add pointer resizing to the left divider without changing right-sidebar behavior.
- [x] Wire session-local width state and collapse/restore behavior in `EditorLayout`.
- [x] Run the focused Workspace header and panel suite.

## Task 3: Verify and Deliver the Contextual Editor Controls

**Outcome:** The combined Canvas controls and panel resizing remain compatible with editor persistence, Excalidraw interaction, and the existing workspace shell.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/features/F003-canvas-presentation-controls.md`

**Change Map:**
- F003 plan and feature entry: completion status and final behavior evidence
- generated plans index: refreshed feature status

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Editor smoke: toggle Cameras, add and draw a Camera, play the active Canvas in Preview and Fullscreen, switch Canvas and confirm isolation, resize/collapse/restore Workspace at both bounds

- [x] Run the complete Node regression suite and production build once after implementation stabilizes.
- [x] Complete the editor smoke matrix and record any environment limitation.
- [x] Review the final diff, mark F003 complete, refresh the plan index, and create a task-level F003 commit.

## Delivery Evidence

- `node --test tests/*.test.mjs` — 119 tests passed after the final rename-request lifecycle fix.
- `npm run build` — TypeScript and Vite production build passed; existing Excalidraw dynamic-import and bundle-size warnings remain informational.
- `git diff --check` — passed after the completion metadata update.
- UI smoke attempt: the existing Tauri development process and Vite server were running. A normal browser cannot boot the app because Tauri window metadata is unavailable outside the native shell, and macOS Computer Use could not resolve the development window among duplicate IdeaSlide bundle locations. The running user session was not terminated or replaced. Canvas-only control placement, disabled Present, Add Camera token wiring, single-Canvas presentation navigation, Explorer actions, rename handoff, and resize bounds are covered by focused source/state contracts and the production build.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F002-workspace-resource-explorer.md`
- `src/App.tsx`
- `src/components/EditorLayout.tsx`
- `src/components/Toolbar.tsx`
- `src/components/ResourceEditorHost.tsx`
- `src/components/SlideCanvas.tsx`
- `src/components/CameraList.tsx`
- `src/components/PresentationMode.tsx`
- `src/components/WorkspaceExplorer.tsx`
- `src/components/WorkspaceResourceRow.tsx`
- `src/components/ResizableDivider.tsx`
- `src/lib/resourceTypeRegistry.ts`
- `tests/editorChromeNavigation.test.mjs`
- `tests/cameraSidebarWiring.test.mjs`
- `tests/panelDividerWiring.test.mjs`
- `tests/workspacePresentationOrder.test.mjs`
