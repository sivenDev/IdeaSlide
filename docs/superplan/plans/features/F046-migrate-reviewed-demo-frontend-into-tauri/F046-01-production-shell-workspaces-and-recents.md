---
id: "F046-01"
title: "Migrate the Reviewed Shell, Workspaces, and Recents"
type: "feature"
status: "complete"
summary: "Replace the remaining launch-first production chrome with the reviewed native workbench shell backed by real Workspace, recent-file, window, and document-session services."
source: "docs/superplan/human/features.md"
created: "2026-08-11"
order: 56
depends_on: ["F045"]
parent: "F046"
---

# Migrate the Reviewed Shell, Workspaces, and Recents Plan

**Goal:** Make the production Tauri application open directly into the reviewed Workspaces / editor / Agent frame while retaining the existing safe local-file and document-session core.
**Scope:** Replace the visible Home/Launch flow and legacy global title toolbar with the approved demo shell composition. Keep Workspaces and standalone-only Recents in the left panel, the registry-owned active editor or Welcome surface in the center, and the context-gated Agent host at right. Migrate the reviewed panel collapse/restore, resize, document crown, command palette, compact row menus, timeline recents, row-scoped creation, Workspace drag-and-drop, native-window safe areas, and macOS/Windows/fullscreen layouts onto real production state and Tauri v2 APIs. Workspace roots are added through existing folder selection flows, never created from a section-header button. Workspace root and directory `+` actions create only beneath that row; root/directory/file overflow actions expose only valid operations. Recents contain only files opened independently of a Workspace, sort by most-recent open time, and expose Rename, Show in Finder, and Remove.
**Non-Goals:** This plan does not migrate demo fixtures, Review Scenarios, reset/failure injection, mock window query parameters, mock notices, or the demo Excalidraw implementation. It does not add new editor formats, visible save/close toolbar buttons, a global branded title bar, Workspace search, recent Workspaces, cloud storage, multi-window editing, split editors, or silent overwrite behavior. It does not replace production recovery, watcher, autosave, external-change, or unsaved-transition rules.
**Architecture:** `AppContent` always mounts the production workbench lifecycle and removes `LaunchScreen`/`launch` routing. `EditorLayout` remains the coordinator for native close/file-open events, active sessions, panel sizing, Settings, and Agent binding; smaller shell components own only reviewed composition. The left panel projects existing Workspace services and recent-file persistence rather than copying demo state. Radix Dropdown Menu/Dialog/Alert Dialog remain the maintained focus/dismissal primitives; dnd-kit remains the drag sensor and projection layer, while every committed move still passes through the Rust Workspace containment/collision boundary. Standalone recent timestamps are written only after successful standalone opens. Finder reveal uses the Tauri opener plugin, Trash uses the existing safe backend command, and rename/move never bypass source fingerprints or Workspace-root validation. Window controls derive platform/fullscreen state from the actual Tauri window and reserve traffic-light/system-button insets without a simulated platform switch. Visual implementation follows the reviewed native token identity: Paper `#ffffff`, Workspace `#e9eae7`, Agent `#f4f4f2`, Graphite `#252930`, Cobalt `#2f5dcc`, and Danger `#b4433c`; system UI typography owns controls and monospace is restricted to paths/status. The memorable interaction remains the **status-close lens** before document identity, while the rest of the crown stays quiet.
**Baseline:** Production still contains `src/components/LaunchScreen.tsx`, `state.mode === "launch"` branching in `AppContent`, legacy toolbar chrome, recent Workspace/file presentation tied to the launch surface, and an older Workspace/Agent shell composition. Real Workspace create/rename/move/trash/watch commands, recent persistence, Workspace/Standalone document sessions, autosave, recovery, external-change protection, editor registry, dnd-kit, Radix primitives, Tauri dialog/opener/store plugins, and fullscreen/window permissions already exist. The reviewed demo proves the intended geometry and interaction details but implements them against `MockDesktopApi` and deterministic in-memory fixtures.
**Exit Criteria:** Fresh native launch displays no Home page, product-brand title strip, Save button, dedicated document Close button, or revision field. With no selected file, the center shows the approved Welcome surface and the Agent restore button is absent. Workspaces list added roots without a header-level New/Search control; root and directory rows have `+` and compact overflow menus, file rows have only valid overflow actions, all menus anchor tightly and dismiss on focus loss/Escape. Dragging files/directories inward, laterally, outward, or to a Workspace root invokes real safe moves and updates watcher/session state without escaping the root or overwriting collisions. Recents show only standalone files, are grouped on a descending time line, and support Rename, Show in Finder, and Remove without adding Workspace-owned opens. Closing either outer panel releases width to the center instead of blanking the frame; restoring/resizing one panel does not alter the other. Document clean/dirty/saving/error state and close affordance occupy the leading status-close lens. macOS windowed/fullscreen and Windows layouts reserve correct system-control space. Light/Dark/System, keyboard focus, reduced motion, 1440x900/1200x850/1100x850/850x850, real-file safety, recovery, watcher, native close, system file-open, and existing IdeaSketch behavior remain intact.

## Task 1: Replace Launch Routing with the Reviewed Workbench Frame

**Outcome:** Startup, empty, Workspace, and Standalone states share one production shell with no Home route or global toolbar.
**Files:**
- Modify: `src/App.tsx`
- Modify: `src/types.ts`
- Modify: `src/lib/appStoreReducer.ts`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/DocumentEditorHost.tsx`
- Modify: `src/components/Toolbar.tsx`
- Create: `src/components/WorkbenchWelcome.tsx`
- Create: `src/components/WorkbenchCrown.tsx`
- Remove: `src/components/LaunchScreen.tsx`
- Modify: `src/index.css`
- Modify: `tests/appStoreReducer.test.mjs`
- Modify: `tests/documentEditorHost.test.mjs`
- Modify: `tests/editorChromeNavigation.test.mjs`
- Create: `tests/reviewedWorkbenchShell.test.mjs`

**Change Map:**
- application lifecycle: remove `launch`/Home branches while preserving startup recovery, native file-open, close protection, and one mounted editor/session coordinator
- center host: show editor-owned content or Welcome only; context-gate the Agent restore affordance to an active supported document
- crown: remove global branding/Save/Close/revision chrome and introduce leading status-close lens plus document identity
- shell tokens: implement the reviewed native surfaces, density, focus, danger, dark-mode counterparts, and no decorative AI-dashboard styling

**Verification:**
- `node --test tests/appStoreReducer.test.mjs tests/documentEditorHost.test.mjs tests/editorChromeNavigation.test.mjs tests/reviewedWorkbenchShell.test.mjs`
- Cases: direct launch; empty Welcome; Workspace with no active file; standalone open/close; unsaved Save/Discard/Cancel; startup recovery; native close; system file-open; AI disabled; no active document; status-close hover/focus and clean/dirty/saving/error states.

- [x] Add shell/state regressions that fail while Home/Launch and legacy toolbar chrome remain.
- [x] Compose the reviewed always-mounted frame over the existing production session lifecycle.
- [x] Remove obsolete launch modules, props, copy, and tests only after equivalent entry points exist.

## Task 2: Deliver Real Workspaces, Standalone Recents, and Row Actions

**Outcome:** The reviewed left navigation operates on real local Workspaces and standalone recent files.
**Files:**
- Modify: `src/components/WorkspaceExplorer.tsx`
- Create: `src/components/WorkspaceSidebar.tsx`
- Create: `src/components/WorkspaceTreeRow.tsx`
- Create: `src/components/RecentFilesTimeline.tsx`
- Modify: `src/lib/tauriCommands.ts`
- Create: `src/lib/recentFiles.ts`
- Modify: `src-tauri/src/recent_files.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src/index.css`
- Modify: `tests/workspaceExplorerWiring.test.mjs`
- Create: `tests/recentFiles.test.mjs`
- Create: `tests/workspaceSidebar.test.mjs`
- Test: `src-tauri/src/recent_files.rs`

**Change Map:**
- Workspaces navigation: added roots, expansion/selection, row-scoped `+`, valid overflow actions, no readonly badge for added roots, no section-header New/Search control
- standalone recents: successful standalone-open timestamps only, descending timeline grouping, Rename/Show in Finder/Remove actions, no Workspace or Workspace-owned entries
- maintained primitives: Radix menu/dialog dismissal, compact trigger anchoring, accessible names, destructive confirmation, and keyboard operation
- native actions: route reveal, rename, remove-from-list, move, and Trash through explicit Tauri/plugin boundaries with truthful errors

**Verification:**
- `node --test tests/workspaceExplorerWiring.test.mjs tests/recentFiles.test.mjs tests/workspaceSidebar.test.mjs`
- `cd src-tauri && cargo test recent_files`
- Native cases with disposable paths: add Workspace; create file/folder from root and directory; rename; reveal; Trash cancel/confirm; missing path; collision; remove Workspace; standalone open/reopen/remove; prove Workspace-owned opens never enter Recents; menu blur/Escape dismissal.

- [x] Lock the reviewed Workspaces/Recents semantics with frontend and Rust regressions.
- [x] Recompose the left navigation using real production commands and maintained menu/dialog controls.
- [x] Verify every destructive or filesystem-affecting action against disposable local paths and safe failure states.

## Task 3: Add Safe Workspace Dragging and Native Window Geometry

**Outcome:** Workspace moves and panel/window chrome behave like a native desktop application across supported window states.
**Files:**
- Modify: `src/components/WorkspaceExplorer.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/ResizableDivider.tsx`
- Create: `src/hooks/useNativeWindowFrame.ts`
- Modify: `src/lib/panelSizing.ts`
- Modify: `src/lib/tauriCommands.ts`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src/index.css`
- Modify: `tests/panelSizing.test.mjs`
- Modify: `tests/workspaceExplorerWiring.test.mjs`
- Create: `tests/nativeWindowFrame.test.mjs`
- Create: `tests/workspaceDragProjection.test.mjs`

**Change Map:**
- dnd projection: compute inward/lateral/outward/root destinations from visible hierarchy without authorizing the filesystem mutation
- real move boundary: validate destination/root/collision in Rust, reconcile watcher and active-session paths after success, and roll UI projection back on failure
- panel geometry: independent collapse/restore/resize with released center width and persisted bounded widths
- native chrome: actual platform/fullscreen/maximized state, macOS traffic-light inset, Windows system-button inset, drag region, and compact-width rules

**Verification:**
- `node --test tests/panelSizing.test.mjs tests/workspaceExplorerWiring.test.mjs tests/nativeWindowFrame.test.mjs tests/workspaceDragProjection.test.mjs`
- Native cases: macOS windowed/fullscreen transitions; Windows layout contract; resize at 1440/1200/1100/850 widths; collapse left/right/both; keyboard dividers; file/folder inward, lateral, outward, and root drops; invalid self/descendant/cross-root/collision drops.

- [x] Add deterministic projection and native-frame contracts before changing interaction composition.
- [x] Connect dnd-kit outcomes only to validated production move commands and session reconciliation.
- [x] Verify native safe areas and independent panel geometry without simulated review scenarios.

## Delivery Evidence

- `node --test tests/*.test.mjs`: 356 tests passed, including WebKit Workspace drag, reviewed shell, panel sizing, Recents, native-frame, and maintained-menu contracts.
- `npm run build`: strict TypeScript and Vite production build completed successfully.
- `cd src-tauri && cargo test --quiet`: 147 Rust tests passed, including standalone-file and Workspace-root rename/remap safety.
- `npm run tauri dev`: native Tauri application compiled, launched, and reached the running application process.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F040-implement-workspace-loom-production-shell.md`
- `docs/superplan/plans/features/F045-refine-review-demo-workspace-actions-and-document-chrome.md`
- `docs/superplan/plans/bugs/B031-refine-compact-menus-labels-and-custom-skills.md`
- `docs/superplan/plans/bugs/B032-refine-agent-window-chrome-menus-and-workspace-dragging.md`
- `.temp/f041-native-workbench-review/CAPABILITY_MATRIX.md`
- `.temp/f041-native-workbench-review/src/app/DemoApp.jsx`
- `src/App.tsx`
- `src/components/EditorLayout.tsx`
- `src/components/WorkspaceExplorer.tsx`
- `src/lib/tauriCommands.ts`
- `src-tauri/src/workspace.rs`
- `src-tauri/src/recent_files.rs`
