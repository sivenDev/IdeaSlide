---
id: "05"
title: "Complete Workspace Reliability, Watching, and Recovery"
type: "required"
status: "complete"
summary: "Protect open documents from external filesystem changes and recover unsaved work across Workspace and Standalone modes."
source: "docs/superplan/human/prd.md"
created: "2026-08-03"
order: 5
depends_on: ["04"]
parent: ""
---

# Complete Workspace Reliability, Watching, and Recovery Plan

**Goal:** Make the directory Workspace safe under external edits, crashes, missing paths, partial save failures, and large real-world trees.
**Scope:** Add a root-scoped file watcher with incremental tree updates and self-write suppression; detect external modify/move/delete events for open Tabs; protect dirty documents from overwrite with Reload/Save As/Cancel decisions; relocate Tabs after confirmed Workspace renames/moves; retain in-memory content for deleted files; and surface read-only/root-missing states. Add versioned recovery drafts under `.ideanote/recovery/` for Workspace documents and the application data directory for Standalone documents, restore only after user confirmation, and remove drafts after confirmed save/discard. Harden Save All result aggregation, metadata diagnostics, lazy restore, large-tree updates, and shutdown/dirty-close behavior. Complete the MVP verification matrix without adding future editors or Agent features.
**Non-Goals:** This plan does not implement collaborative merge, automatic conflict resolution, full version history, cloud sync, cross-device state, permanent delete, Symlink traversal, Workspace packages, v2 migration, Markdown/IdeaTable/IdeaWorkflow, or AI Agent. Recovery is not a second authoritative copy and does not silently overwrite user files.
**Architecture:** A Rust watcher service owns one canonical Workspace root and emits normalized relative-path events. Application-issued atomic writes register short-lived expected-change tokens so watcher notifications do not trigger save loops. The app reducer applies tree deltas and document status transitions; content conflicts are resolved at the document-session boundary using persisted baseline fingerprint/mtime and current dirty state. Recovery storage is keyed by stable Workspace id plus relative path, or a standalone path hash, and includes schema version, source revision/fingerprint, timestamp, and serialized document model. Draft persistence is best effort and isolated from normal save success. Large trees use incremental updates and leave a virtualization-ready flat visible-row projection; they never eagerly parse file bodies.
**Baseline:** No file watcher or recovery store exists. `useAutoSave` only reacts to in-memory dirty state and cannot distinguish its own write from an external change. The current single-file store has no per-document baseline revision, conflict, missing-file, or recovery status. Workspace metadata failures and external moves/deletes therefore cannot be represented safely in the UI.
**Exit Criteria:** External create/rename/move/delete updates the Explorer incrementally without reparsing unrelated files. Clean open documents can reload after confirmation; dirty documents are never silently overwritten and expose Reload, Save As, or Cancel. Deleted files retain the in-memory model and allow Save As/Close; confirmed in-root moves update Tab paths and titles. Application saves do not loop through watcher events. Workspace root loss/read-only changes produce actionable English states. Dirty Workspace and Standalone documents write versioned recovery drafts to their respective locations, prompt on next open, restore only on approval, and clear after confirmed save/discard. Save All reports per-file success/failure while successful files remain saved. Large-directory and restart smoke tests, focused Node/Rust suites, complete regressions, format/lint checks, production build, and native acceptance flow pass.

## Task 1: Add Root-scoped File Watching and Incremental Tree Events

**Outcome:** Workspace state follows external filesystem changes without full rescans or recursive authorization escape.
**Files:**
- Create: `src-tauri/src/workspace_watcher.rs`
- Modify: `src-tauri/src/workspace.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Test: `src-tauri/src/workspace_watcher.rs`

**Change Map:**
- watcher service: start/stop per root, normalized create/modify/rename/remove events, `.ideanote`/temp filtering, Symlink non-traversal, and event coalescing
- self-write registry: expected atomic-replace events with bounded expiry and exact path matching
- Tauri integration: emit typed Workspace events only to the main application window

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml workspace_watcher -- --nocapture`
- Cases: external create/rename/remove; rapid bursts coalesced; own atomic save ignored; `.ideanote` and `.is.tmp` ignored; root removal reported; no Symlink recursion.

- [x] Add failing watcher normalization and self-write suppression tests.
- [x] Implement root-scoped watcher lifecycle and typed Tauri events.

## Task 2: Protect Open Sessions from External Conflicts

**Outcome:** Each Tab responds safely to modified, moved, deleted, or read-only files.
**Files:**
- Modify: `src/lib/appStoreReducer.ts`
- Create: `src/lib/externalFileChanges.ts`
- Create: `src/components/ExternalChangeNotice.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/DocumentTabs.tsx`
- Modify: `src/components/WorkspaceExplorer.tsx`
- Test: `tests/externalFileChanges.test.mjs`
- Modify: `tests/appStoreReducer.test.mjs`
- Modify: `tests/documentTabs.test.mjs`

**Change Map:**
- reducer/change classifier: baseline fingerprint/mtime, clean versus dirty decisions, path relocation, missing/read-only/root-missing states, and tree deltas
- `ExternalChangeNotice`: Reload/Save As/Cancel or Close actions with no silent overwrite
- application event wiring: watcher subscription lifecycle and active/inactive Tab status updates
- Explorer/Tabs: incremental entry updates and visible conflict/missing/read-only indicators

**Verification:**
- `node --test tests/externalFileChanges.test.mjs tests/appStoreReducer.test.mjs tests/documentTabs.test.mjs`
- Cases: clean modify; dirty modify; delete with in-memory retention; confirmed move path update; ambiguous move requests relocation; root missing; own save event no-op.

- [x] Implement pure external-change classification before UI wiring.
- [x] Add actionable conflict, missing, relocation, and read-only states.

## Task 3: Persist and Restore Versioned Recovery Drafts

**Outcome:** Unsaved work can survive abnormal exit without becoming an authoritative hidden copy.
**Files:**
- Create: `src-tauri/src/recovery.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src/lib/recovery.ts`
- Create: `src/components/RecoveryPrompt.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/DocumentEditorHost.tsx`
- Test: `src-tauri/src/recovery.rs`
- Test: `tests/recovery.test.mjs`

**Change Map:**
- Rust recovery store: schema-v1 atomic drafts, Workspace and Standalone locations, safe keying, list/read/delete, and corrupt-draft preservation
- frontend recovery scheduler: dirty-model snapshots independent of source-file save, staleness/fingerprint checks, and best-effort errors
- `RecoveryPrompt`: preview metadata and explicit Restore/Discard/Cancel choices before source overwrite

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml recovery -- --nocapture`
- `node --test tests/recovery.test.mjs`
- Cases: Workspace/Standalone locations; crash-like restart; stale source; corrupt draft; restore without immediate overwrite; clear after save/discard; metadata failure does not mark document saved.

- [x] Implement versioned recovery storage and safe location rules.
- [x] Add explicit restore/discard flow and draft lifecycle cleanup.

## Task 4: Harden Shutdown, Save All, and Large-workspace Behavior

**Outcome:** Failure in one document or metadata file cannot corrupt other successful work or freeze Workspace open.
**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/WorkspaceExplorer.tsx`
- Modify: `src/lib/workspaceState.ts`
- Modify: `src/lib/tauriCommands.ts`
- Test: `tests/saveAll.test.mjs`
- Test: `tests/workspaceState.test.mjs`
- Modify: `tests/workspaceExplorerWiring.test.mjs`

**Change Map:**
- save/shutdown coordinator: per-document flush/save results, dirty-close aggregation, successful-result retention, and window-close cancellation
- Workspace state: metadata diagnostics, retry, lazy Tab restore, and root relocation handling
- Explorer: flat visible-row projection and incremental update boundary suitable for later virtualization without eager content reads

**Verification:**
- `node --test tests/saveAll.test.mjs tests/workspaceState.test.mjs tests/workspaceExplorerWiring.test.mjs`
- Cases: one Save All failure; close with several dirty Tabs; metadata write failure after user-file success; thousands of metadata entries without document parsing; missing root relocation.

- [x] Make Save All and shutdown decisions explicit and failure-isolated.
- [x] Validate large-tree and lazy-restore behavior without premature editor hydration.

## Task 5: Complete the IdeaNote MVP Acceptance Matrix

**Outcome:** The approved PRD workflow is verified end to end and ready for human acceptance.
**Files:**
- Modify: `docs/superplan/plans/05-workspace-reliability-and-recovery.md`

**Change Map:**
- plan evidence: complete Workspace, Tabs, IdeaSketch, watching, conflict, recovery, and scope results

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `npm run build`
- `git diff --check`
- Tauri acceptance: open untouched directory; create/save `drawing.is`; verify lazy `.ideanote`; edit two Tabs; restart/restore; externally modify/move/delete; recover dirty Workspace and Standalone documents; verify `.is v1` archive and v2 protection; confirm no Agent or import/export UI.

- [x] Run all automated checks once implementation stabilizes.
- [x] Complete the native acceptance flow and obtain human verification before marking the mainline complete.

## Delivery Evidence

- `node --test tests/*.test.mjs`: 159 tests passed.
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`: 63 tests passed, including macOS ambiguous rename pairing and the Standalone Recovery camel-case IPC contract.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`, `npm run build`, and `git diff --check`: passed; Vite reported only the existing Excalidraw chunking and bundle-size warnings.
- Native acceptance used the isolated `IdeaNote Acceptance.app` bundle and confirmed external macOS rename/remove projection, clean and dirty external-change decisions, missing-root relocation, read-only-to-writable recovery, and no false conflict from application writes.
- Crash/relaunch acceptance confirmed Workspace and unnamed Standalone recovery prompts, explicit Restore/Discard behavior, and draft cleanup after save or discard.
- Native close acceptance confirmed Save, Discard, and Cancel behavior; saving an existing Standalone document updated its v1 archive before application exit.
- Existing MVP acceptance remained intact: untouched Workspace open is side-effect free, first file creation lazily creates `.ideanote`, IdeaSketch stays `.is v1`, Cameras are hidden by default, Present remains available with zero Cameras, and no Agent or Workspace import/export UI is exposed.

## References
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/02-directory-workspace-foundation.md`
- `docs/superplan/plans/03-multifile-workspace-shell.md`
- `docs/superplan/plans/04-ideasketch-editor-integration.md`
- `src/hooks/useAutoSave.ts`
- `src/components/EditorLayout.tsx`
- `src/components/WorkspaceExplorer.tsx`
- `src/lib/appStoreReducer.ts`
- `src-tauri/src/lib.rs`
- `src-tauri/src/commands.rs`
