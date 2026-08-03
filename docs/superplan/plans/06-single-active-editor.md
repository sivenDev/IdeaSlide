---
id: "06"
title: "Replace File Tabs with a Single Active Editor"
type: "required"
status: "draft"
summary: "Remove the visible file Tab system while retaining a safe multi-document session kernel behind one foreground editor."
source: "docs/superplan/human/prd.md"
created: "2026-08-03"
order: 6
depends_on: ["05"]
parent: ""
---

# Replace File Tabs with a Single Active Editor Plan

**Goal:** Give the current file the full center workspace while preserving document isolation, recovery, external-change protection, and future Agent/editor extensibility.
**Scope:** Remove `DocumentTabs` and all visible Tab switching, closing-other/right, and recently-closed interactions. Workspace Explorer becomes the file-switching surface and the title bar remains the authoritative current-file name/type/save-status surface. Keep a multi-document session registry internally: only the active heavy editor mounts; clean inactive sessions may be released, while Dirty, conflict, missing, read-only, root-missing, and Recovery sessions remain protected and discoverable through Explorer status. Workspace state schema v2 persists one last active path plus Explorer state and reads legacy schema-v1 `openTabs` only to choose one compatible active file. Standalone mode presents one foreground document and must resolve unsaved work before another standalone document replaces it.
**Non-Goals:** This plan does not add file back/forward history, Quick Open, recent-file navigation inside the editor, reopened-file stacks, breadcrumbs, pinned files, split editors, preview Tabs, editor thumbnails, AI Agent UI, new document formats, or Workspace import/export. It does not remove Save All, recovery, file watching, external-change protection, or the document-session/file-type registries.
**Architecture:** `ApplicationState.documents` remains the safety boundary for independently dirty or conflicted files, with `activeSessionId` selecting the one foreground editor. Tab-only reducer actions and `recentlyClosed` state are removed. File activation first commits the active editor snapshot into its session, then opens or activates the canonical target session; a clean inactive session is eligible for eviction, but protected sessions stay addressable by path. `DocumentEditorHost` continues to mount only the active registered editor. `WorkspaceExplorer` projects active and protected session state onto real file rows without owning document models. `.ideanote/state.json` advances to schema v2 with `activePath` and Explorer state; Rust and frontend readers accept schema v1 without rewriting metadata during browse-only Workspace open.
**Baseline:** Completed plan 03 introduced `DocumentTabs`, ordered open sessions, close-other/right/reopen actions, `recentlyClosed`, and schema-v1 `openTabs` persistence. `EditorLayout` renders a full Tab strip above `DocumentEditorHost`, while `Toolbar` already displays the active filename and save state. Only the active editor mounts, and completed plans 04–05 already scope editor drafts, autosave, presentation, external-file status, Save All, shutdown prompts, and Recovery to document sessions. Removing only the visual Tab component would leave hidden Tab semantics, unbounded sessions, incompatible metadata, and no visible status for protected inactive documents.
**Exit Criteria:** No file Tab strip or Tab-only command remains in the editor shell. Clicking or creating a supported Workspace file makes it the sole foreground editor without duplicate canonical sessions; the title bar shows its filename and save status. Switching files commits the current editor draft and never loses Dirty, conflict, missing, read-only, root-missing, or Recovery state; protected inactive files are identifiable in the Explorer and can be reopened there. Clean inactive sessions are eligible for release without affecting saved files. Standalone New/Open replaces the foreground document only after Save/Discard/Cancel when required. Workspace state v2 restores at most one valid active file, reads v1 metadata compatibly, writes no metadata during browse-only open, and does not restore a Tab collection. Existing IdeaSketch Pages/Cameras/Present, Save/Save As/Save All, watcher, recovery, dual-mode, and file-type/editor module contracts continue to pass focused and complete verification.

## Task 1: Convert Tab State into a Single-active Session Contract

**Outcome:** Application and Workspace metadata represent one foreground document without discarding protected background sessions.
**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/appStoreReducer.ts`
- Modify: `src/lib/workspaceState.ts`
- Modify: `src-tauri/src/workspace.rs`
- Modify: `tests/appStoreReducer.test.mjs`
- Modify: `tests/workspaceState.test.mjs`
- Test: `src-tauri/src/workspace.rs`

**Change Map:**
- `ApplicationState` and reducer actions: remove `recentlyClosed`, close-other/right/reopen actions, positional close fallback, and Tab ordering assumptions while retaining canonical-path dedupe, protected document sessions, active presentation identity, and workspace path remapping
- document activation policy: one `activeSessionId`; clean inactive sessions may be pruned, while unsaved or exceptional sessions remain registered by canonical path
- Workspace state frontend: write schema v2 `activePath`/Explorer state only and restore at most one lightweight document descriptor
- Workspace state Rust model: accept legacy schema-v1 `openTabs`, validate schema v2, avoid browse-time migration writes, and serialize the new state without an open-file collection

**Verification:**
- `node --test tests/appStoreReducer.test.mjs tests/workspaceState.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml workspace -- --nocapture`
- Cases: canonical reactivation; clean inactive eviction; Dirty/conflict/missing retention; no recently-closed state; schema-v2 round trip; schema-v1 active-path fallback; missing active file; untouched Workspace remains side-effect free.

- [ ] Add failing single-active reducer and metadata-compatibility contracts before changing production state.
- [ ] Implement the new session and state schema without weakening document safety boundaries.

## Task 2: Remove the Tab Strip and Make Explorer the File Switcher

**Outcome:** The center shell gives all Tab-strip space to the current editor and exposes document state through the existing title bar and file tree.
**Files:**
- Remove: `src/components/DocumentTabs.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/WorkspaceExplorer.tsx`
- Modify: `src/components/WorkspaceResourceRow.tsx`
- Modify: `src/index.css`
- Remove: `tests/documentTabs.test.mjs`
- Modify: `tests/editorChromeNavigation.test.mjs`
- Modify: `tests/workspaceExplorerWiring.test.mjs`

**Change Map:**
- `EditorLayout`: remove `DocumentTabs`, Tab context handlers, recently-closed wiring, and the reserved strip; keep the active `DocumentEditorHost`, external-change/recovery notices, save controls, and empty-editor fallback
- `Toolbar`: make the current file type, filename, and save state the single document identity surface without adding a second editor header
- Explorer/row projection: distinguish the current file and protected inactive Session status without turning the tree into a second Tab bar
- styles: remove `ideanote-document-tabs`/`ideanote-document-tab` rules and preserve the approved compact title bar, collapsed sidebars, resize bounds, and Excalidraw canvas sizing
- UI tests: replace Tab composition assertions with one-editor ownership, Explorer activation, current-file title, and absence of Tab-only controls

**Verification:**
- `node --test tests/editorChromeNavigation.test.mjs tests/workspaceExplorerWiring.test.mjs tests/panelDividerWiring.test.mjs`
- Interaction cases: no vertical Tab strip; Explorer click switches one editor; active/Dirty/conflict rows remain recognizable at 180px minimum width; unsupported files keep their safe fallback; current file title and save indicator remain correct.

- [ ] Remove the Tab component, CSS, and tests rather than leaving an unreachable module.
- [ ] Recompose the editor shell and Explorer status projection without adding replacement history or quick-navigation controls.

## Task 3: Preserve Switching, Saving, Recovery, and Presentation Safety

**Outcome:** File replacement and Workspace switching cannot drop editor drafts or bypass existing data-integrity decisions.
**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/DocumentEditorHost.tsx`
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/saveAll.test.mjs`
- Modify: `tests/externalFileChanges.test.mjs`
- Modify: `tests/recovery.test.mjs`
- Modify: `tests/workspacePresentationOrder.test.mjs`

**Change Map:**
- file activation coordinator: flush the mounted editor snapshot before deactivation and reuse the canonical session when the same path is selected again
- Standalone replacement: New/Open/system file-open resolves the current Dirty document with Save/Discard/Cancel before replacing it
- background protection: watcher, Recovery, Save All, shutdown, and file-tree status continue to cover retained non-active exceptional sessions
- IdeaSketch/Presentation: Pages, Cameras, Present, and presentation return remain bound to the originating active document and Page despite removal of Tab terminology

**Verification:**
- `node --test tests/ideaSketchEditor.test.mjs tests/saveAll.test.mjs tests/externalFileChanges.test.mjs tests/recovery.test.mjs tests/workspacePresentationOrder.test.mjs`
- Cases: edit A then switch to B and return; autosave failure retained on A; external delete/conflict on inactive A; Recovery reopen; Standalone dirty replacement choices; Present exits to its originating file/Page; one-file save failure does not affect another retained protected session.

- [ ] Centralize file replacement/activation around the existing snapshot, save, and close-decision boundaries.
- [ ] Keep all safety and presentation regressions green without preserving visual Tab behavior.

## Task 4: Verify and Deliver the Single-editor Workspace

**Outcome:** The PRD revision ships as a regression-safe mainline change with native interaction evidence.
**Files:**
- Modify: `docs/superplan/plans/06-single-active-editor.md`

**Change Map:**
- plan evidence: single-editor layout, v1/v2 Workspace-state compatibility, switching safety, dual-mode replacement, external changes, Recovery, and presentation results

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `npm run build`
- `git diff --check`
- Tauri acceptance: open a Workspace; switch among several `.is` files from Explorer; confirm no Tab strip; retain and revisit Dirty/conflict/missing states; restart and restore only the last active file; read legacy state v1; replace a Dirty Standalone file; verify Cameras/Present and sidebars still behave normally.

- [ ] Run focused checks during implementation and the complete regression/build matrix once the behavior stabilizes.
- [ ] Complete the native acceptance matrix and record compatibility evidence before marking plan 06 complete.

## References
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/03-multifile-workspace-shell.md`
- `docs/superplan/plans/04-ideasketch-editor-integration.md`
- `docs/superplan/plans/05-workspace-reliability-and-recovery.md`
- `docs/superplan/plans/features/F006-revision-c-editor-shell-defaults.md`
- `src/types.ts`
- `src/lib/appStoreReducer.ts`
- `src/lib/workspaceState.ts`
- `src/components/DocumentTabs.tsx`
- `src/components/EditorLayout.tsx`
- `src/components/Toolbar.tsx`
- `src/components/WorkspaceExplorer.tsx`
- `src/components/DocumentEditorHost.tsx`
- `src-tauri/src/workspace.rs`
