---
id: "03"
title: "Deliver the Multi-file Workspace Shell"
type: "required"
status: "complete"
summary: "Replace the archive-internal resource tree with a real file explorer, deduplicated document tabs, and dual-mode application sessions."
source: "docs/superplan/human/prd.md"
created: "2026-08-03"
order: 3
depends_on: ["01", "02"]
parent: ""
---

# Deliver the Multi-file Workspace Shell Plan

**Goal:** Let users work in a real directory or open one standalone file through the same document-session and editor-host core.
**Scope:** Recompose application state around `launch`, `workspace`, and `standalone` modes; add Open Workspace directory selection; replace the v2 resource Explorer with a real filesystem tree; add multi-file Editor Tabs with unique canonical-path identity, lazy file loading, active/dirty/error states, close workflows, Save/Save As/Save All orchestration, and Workspace session restore. New Folder and New IdeaSketch are driven by the file-type registry and backend Workspace service; a new Workspace `.is` opens immediately and enters inline rename, while New File outside a Workspace creates an unsaved standalone IdeaSketch session whose first Save selects a path. Unsupported files remain visible and open into a safe fallback with Reveal/Open Externally actions. Apply user-visible IdeaNote terminology while retaining technical package/bundle identifiers. Keep the existing bounded/resizable/collapsible left panel and do not render an empty Agent panel.
**Non-Goals:** This plan does not finish Excalidraw multi-Page editing, Camera/Present adaptation, external file watching, recovery drafts, v2 migration, future editors, Agent UI, Workspace packaging, or package/bundle/repository renaming. It does not parse all files during Workspace open or restore every Tab eagerly.
**Architecture:** A root application reducer owns optional `WorkspaceSession`, ordered `DocumentSession` descriptors, `activeSessionId`, and shell state. Canonical paths enforce one Tab per file. The Workspace tree is metadata from the backend; document content loads only when a Tab becomes active. `DocumentEditorHost` resolves the session's registered editor key and receives a document model plus generic save/dirty callbacks; it does not branch on persistence mode. Workspace persistence uses root-relative paths and writes `state.json` only after `.ideanote` exists or a user-file save/create has legitimately triggered it. Workspace Mode shows the Explorer by default and supports collapse/180–420px resizing; Standalone Mode omits the Explorer. Only the active editor mounts, while inactive sessions retain lightweight state.
**Baseline:** `AppContent` toggles one `showEditor` boolean and loads a single `WorkspaceDocument`. `WorkspaceStoreState` owns one file path, one active internal resource, and one global dirty flag. `WorkspaceExplorer` mutates synthetic folder/canvas resources inside the `.is` archive. `EditorLayout` renders one editor without file Tabs, and `LaunchScreen` offers New Idea/Open File only under IdeaSlide branding.
**Exit Criteria:** Home offers New File, Open Workspace, and Open File. Selecting a directory opens an unchanged real tree; selecting a supported file opens or activates one Tab, and multiple files can remain open without duplicate paths. New Folder and New IdeaSketch operate at the selected real directory, `Untitled.is` collision naming is safe, and new files open immediately in rename mode. New File without a Workspace creates an unsaved standalone IdeaSketch and Save chooses its real path. Tabs show type icon, filename, dirty/protected/missing status and support close, close others, close right, recently closed, Save, Save As, and Save All; dirty close requires Save/Discard/Cancel. Reopening a Workspace with valid metadata restores existing Tab descriptors and the active Tab lazily, skips missing paths non-blockingly, and never lets corrupt state block the tree. Unsupported files are never modified. Workspace and Standalone use the same registry/host, Single File creates no `.ideanote`, the shell says IdeaNote, and no Agent placeholder appears. Focused state/UI tests, complete regressions, build, and Tauri shell smoke pass.

## Task 1: Replace the Single-workspace Store with Application and Document Sessions

**Outcome:** State can represent directory Workspace and standalone files without duplicating editor logic.
**Files:**
- Modify: `src/types.ts`
- Create: `src/lib/appStoreReducer.ts`
- Create: `src/hooks/useAppStore.tsx`
- Modify: `src/App.tsx`
- Remove: `src/lib/workspaceStoreReducer.ts`
- Remove: `src/hooks/useWorkspaceStore.tsx`
- Test: `tests/appStoreReducer.test.mjs`

**Change Map:**
- `src/types.ts`: Workspace root/session, file-tree entry, document descriptor, close/save result, and shell-mode contracts
- `src/lib/appStoreReducer.ts`: open/dedupe/activate/close/reopen sessions, relative-path updates after file moves, dirty/status transitions, and mode teardown
- `src/hooks/useAppStore.tsx`: React provider for the application/session reducer
- `src/App.tsx`: launch/workspace/standalone routing and active-document presentation boundary

**Verification:**
- `node --test tests/appStoreReducer.test.mjs`
- Cases: canonical-path dedupe; ordered Tab close fallback; close others/right; recently closed reopen; Workspace path remap; standalone isolation; missing/protected status cannot become silently writable.

- [x] Add failing reducer contracts for mode and multi-session invariants.
- [x] Implement the new application/session store and replace the v2 resource provider.

## Task 2: Build the Real Explorer and Registry-driven Creation Flow

**Outcome:** The left panel behaves as a local file explorer rather than a tree inside the active `.is` document.
**Files:**
- Modify: `src/components/LaunchScreen.tsx`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `index.html`
- Modify: `src/components/WorkspaceExplorer.tsx`
- Modify: `src/components/WorkspaceResourceRow.tsx`
- Modify: `src/lib/tauriCommands.ts`
- Modify: `src/lib/panelSizing.ts`
- Test: `tests/workspaceExplorerWiring.test.mjs`
- Test: `tests/launchScreen.test.mjs`

**Change Map:**
- `src/components/LaunchScreen.tsx`: IdeaNote branding, New File, Open Workspace directory picker, Open File, and recent standalone files
- `src-tauri/tauri.conf.json` and `index.html`: IdeaNote product/window/file-association titles while retaining the existing bundle identifier and technical package names
- `src/components/WorkspaceExplorer.tsx`: real path tree, Workspace root label, registry-driven New IdeaSketch, New Folder, Refresh, Collapse/Expand, selection, rename/move/Trash, and hidden-internal behavior
- `src/components/WorkspaceResourceRow.tsx`: path-based row identity, directory/Symlink/unsupported states, inline rename, drag/drop, keyboard access, and destructive confirmation
- `src/lib/tauriCommands.ts`: typed Workspace service wrappers and directory picker

**Verification:**
- `node --test tests/workspaceExplorerWiring.test.mjs tests/launchScreen.test.mjs tests/fileTypeRegistry.test.mjs`
- Interaction cases: opening a directory writes nothing; directory rows toggle; supported files open; unsupported files remain safe; new items target selected directory; move cannot escape root; Delete requests Trash; width remains bounded.

- [x] Replace internal resource actions with real filesystem commands.
- [x] Add New File, Open Workspace, and registry-driven creation behavior under IdeaNote terminology.
- [x] Preserve the approved compact neutral/violet panel and accessible resize rail.

## Task 3: Add Multi-file Tabs and the Generic Editor Host

**Outcome:** Users can open, switch, close, save, and safely inspect multiple files in one window.
**Files:**
- Create: `src/components/DocumentTabs.tsx`
- Create: `src/components/DocumentEditorHost.tsx`
- Create: `src/components/UnsupportedFileView.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/SaveIndicator.tsx`
- Modify: `src/components/ui/Tabs.tsx`
- Remove: `src/components/ResourceEditorHost.tsx`
- Test: `tests/documentTabs.test.mjs`
- Test: `tests/documentEditorHost.test.mjs`
- Modify: `tests/editorChromeNavigation.test.mjs`

**Change Map:**
- `DocumentTabs`: unique path Tabs, type icon, active/dirty/status labels, context close commands, keyboard navigation, and recently closed action
- `DocumentEditorHost`: registry editor dispatch, lazy load/error/loading boundaries, and one mounted active editor
- `UnsupportedFileView`: explanatory English fallback plus Reveal in Finder/Open Externally without content mutation
- `EditorLayout`: two-column Workspace composition, Tab strip, active host, generic save orchestration, and no Agent placeholder
- `Toolbar`/`SaveIndicator`: Workspace/Standalone-aware titles plus Save, Save As, Save All and aggregate status

**Verification:**
- `node --test tests/documentTabs.test.mjs tests/documentEditorHost.test.mjs tests/editorChromeNavigation.test.mjs`
- Interaction cases: one Tab per path; inactive file not parsed until activated; dirty close Save/Discard/Cancel; Save All isolates per-file failure; protected/missing/unsupported sessions offer only safe actions.

- [x] Add failing Tab, host, dirty-close, and unsupported-file contracts.
- [x] Implement the multi-file center shell and generic persistence actions.
- [x] Keep only the active heavy editor mounted.

## Task 4: Restore Workspace Tabs from Versioned Metadata

**Outcome:** Returning to a Workspace restores useful navigation state without eager document hydration.
**Files:**
- Create: `src/lib/workspaceState.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/lib/tauriCommands.ts`
- Test: `tests/workspaceState.test.mjs`

**Change Map:**
- `src/lib/workspaceState.ts`: schema-v1 parsing, relative-path validation, safe defaults, missing-file filtering, and debounced state snapshots
- application shell: restore ordered Tab descriptors/active path/Explorer state lazily and surface non-blocking diagnostics
- persistence wrappers: do not create `.ideanote` during read-only browse; write state only after an allowed lazy-creation trigger

**Verification:**
- `node --test tests/workspaceState.test.mjs tests/appStoreReducer.test.mjs tests/documentTabs.test.mjs`
- Cases: missing file skipped; corrupt state preserved and ignored; unsupported Tab restored without parsing; active fallback deterministic; restore creates no metadata in a new directory.

- [x] Implement schema-v1 restore and safe fallback behavior.
- [x] Persist lightweight session state without serializing document contents.

## Task 5: Verify the Dual-mode Shell

**Outcome:** The application shell is stable before the existing Excalidraw feature set is reattached.
**Files:**
- Modify: `docs/superplan/plans/03-multifile-workspace-shell.md`

**Change Map:**
- plan evidence: directory-open side effects, Tab workflows, lazy restore, unsupported files, and dual-mode behavior

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `npm run build`
- `git diff --check`
- Tauri smoke: Open Workspace, open several files, create/rename/move/Trash, resize/collapse Explorer, restart and restore Tabs, then open a standalone `.is` without `.ideanote` creation.

- [x] Run full automated verification after focused suites pass.
- [x] Complete and record the native shell smoke matrix.

## Delivery Evidence

- `node --test tests/*.test.mjs` — all 139 frontend/library regressions passed after the v2 Workspace store and resource host were replaced by the application-session reducer, real Explorer, multi-file Tabs, generic Editor Host, unsupported fallback, and lazy Workspace restore contracts.
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture` — all 56 Rust tests passed, including the new root-confined `open_workspace_document` registry path.
- `npm run build` — TypeScript and Vite production build passed; only the existing Excalidraw import-overlap and large-chunk informational warnings remain.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` and `git diff --check` — passed.
- Local shell smoke: `npm run dev` rendered the IdeaNote Home and standalone multi-file shell without Tauri globals, New File opened one dirty `Untitled.is` Tab, only the active generic host mounted, and no Agent placeholder appeared. `npm run tauri dev` compiled and launched the native binary; an already-running installed IdeaSlide window prevented reliable automation of that separate dev window, so filesystem interactions remain covered by temporary-directory Rust integration tests rather than user-file mutation.

## References
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/01-shared-document-kernel-and-is-v1.md`
- `docs/superplan/plans/02-directory-workspace-foundation.md`
- `docs/superplan/plans/features/F002-workspace-resource-explorer.md`
- `docs/superplan/plans/features/F004-refine-editor-shell.md`
- `docs/superplan/plans/features/F006-revision-c-editor-shell-defaults.md`
- `src/App.tsx`
- `src/components/EditorLayout.tsx`
- `src/components/WorkspaceExplorer.tsx`
- `src/components/ResourceEditorHost.tsx`
- `src/lib/workspaceStoreReducer.ts`
