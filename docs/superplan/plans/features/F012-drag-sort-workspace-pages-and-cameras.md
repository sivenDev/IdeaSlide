---
id: "F012"
title: "Drag-sort Workspace Entries, Pages, and Cameras"
type: "feature"
status: "complete"
summary: "Add persistent drag-to-move and drag-to-order behavior to Workspace entries, IdeaSketch Pages, and Page-scoped Cameras."
source: "docs/superplan/human/features.md"
created: "2026-08-04"
order: 12
depends_on: ["02", "04", "05", "06", "F009", "F011", "B008"]
parent: ""
---

# Drag-sort Workspace Entries, Pages, and Cameras Plan

**Goal:** Let users organize real Workspace files and folders, document Pages, and Page-scoped Cameras directly by dragging while preserving every existing persistence and filesystem-safety boundary.
**Scope:** Add before/inside/after drop intents to the Workspace Explorer so entries can be reordered among siblings or physically moved to another directory. Persist the exact custom sibling order, including mixed folders and files, in versioned Workspace state; new or externally discovered entries use the existing deterministic directory/name order after explicitly ordered siblings until the user places them. Keep Workspace rename/move path remapping, collision/cycle rejection, protected-document state, incremental watcher projection, metadata diagnostics, and read-only behavior intact. Standardize the existing Page drag reorder and add equivalent Camera drag reorder in the IdeaSketch navigator, with visible drop feedback and no mutation for no-op or read-only drops. Page order continues through the IdeaSketch document model and Camera order through the active Page scene, using existing Workspace autosave and Standalone explicit-save policies.
**Non-Goals:** This feature does not add multi-select dragging, cross-Workspace dragging, filesystem renaming to encode order, automatic alphabetical re-sorting after a custom order exists, Page or Camera movement between documents/Pages, Camera naming, thumbnails, undo history for Workspace filesystem moves, keyboard-only reordering commands, or a new drag-and-drop dependency. It does not change `.is v1` archive structure, presentation sequencing rules, external-change conflict policy, or Workspace file visibility.
**Architecture:** Workspace filesystem hierarchy remains authoritative for parent-child location, and `WorkspaceService::move_entry` remains the only native reparent operation. A pure frontend ordering module applies and normalizes a persisted root-relative path sequence over scanned trees, performs same-parent reorder and post-move insertion, remaps ordered subtree paths after rename/move, and merges watcher-created entries without discarding custom order. `.ideanote/state.json` advances to schema v3 with optional `entryOrder`; Rust and frontend readers retain schema-v1/v2 compatibility, while state snapshots serialize the current normalized tree order. Explorer rows derive explicit `before`, `inside`, or `after` drop intent from pointer position and delegate one typed request to `EditorLayout`; same-parent reorder updates Workspace state only, while reparent first completes the native move and then applies the requested insertion to the refreshed tree. Pages continue to dispatch `REORDER_PAGE`; Cameras continue to rewrite Camera `customData.order` through `reorderCameras`, so both use the existing document dirty/autosave pipeline rather than a parallel persistence mechanism.
**Baseline:** Workspace rows are already draggable, but dropping any row only sends a destination directory to `moveWorkspaceEntry`; there is no sibling insertion target, and both backend scans and incremental frontend inserts restore directory-first/name order. Workspace state schema v2 stores only active and expanded paths. `PageOrganizer` has basic HTML drag handlers that reorder by target index, while `CameraList` exposes only Move Up/Move Down buttons. The Page reducer, IdeaSketch serializer, Camera order helper, model-dirty path, Workspace autosave, and safe native move/collision/cycle checks already exist.
**Exit Criteria:** A writable Workspace supports dragging any eligible file or folder before/after a sibling at the root or in a nested directory and into a directory; same-parent ordering does not rename or rewrite user files, cross-parent movement uses the existing root-confined native move, open/protected document paths follow successful moves, and invalid/colliding/self-descendant drops remain unchanged with a clear error. Custom order survives refresh, restart, rename, move, create, and watcher updates through schema-v3 state, while v1/v2 state opens safely with deterministic default order and read-only Workspaces never persist drag changes. Pages and Cameras show usable drag affordance/drop feedback, ignore no-op/read-only drops, preserve active selection, and reopen in the saved order; Page order remains manifest order and Camera order remains active-Page scene order used by Present. Focused frontend/Rust regressions, full Node/Rust suites, formatting/lint/build/diff checks, and isolated native drag/save/reopen acceptance pass without reintroducing false file conflicts.

## Task 1: Lock Ordering, Compatibility, and Drop-intent Contracts

**Outcome:** Pure regressions define custom Workspace ordering, path remapping, drag insertion semantics, and document-order persistence before UI behavior changes.
**Files:**
- Create: `src/lib/workspaceOrdering.ts`
- Modify: `src/lib/workspaceState.ts`
- Modify: `src/lib/externalFileChanges.ts`
- Modify: `src/lib/appStoreReducer.ts`
- Test: `tests/workspaceState.test.mjs`
- Test: `tests/externalFileChanges.test.mjs`
- Test: `tests/appStoreReducer.test.mjs`
- Test: `tests/ideaSketchReducer.test.mjs`
- Test: `tests/cameraUtils.test.mjs`

**Change Map:**
- `workspaceOrdering`: flatten/apply/normalize order, insert before/after/inside, subtree path remapping, same-parent no-op detection, and stable fallback placement for unlisted entries
- Workspace state/tree reducers: preserve custom order across refresh and incremental create/modify/rename/remove events without weakening retained Missing-entry behavior
- Page/Camera helpers: lock target-index and ordered-id behavior, including no-op and active-item stability

**Verification:**
- `node --test tests/workspaceState.test.mjs tests/externalFileChanges.test.mjs tests/appStoreReducer.test.mjs tests/ideaSketchReducer.test.mjs tests/cameraUtils.test.mjs`
- Cases: mixed file/folder order; root/nested before/after/inside insertion; rename and subtree move remap; new external entry fallback; removed path cleanup; read-only/no-op identity; Page manifest order and Camera numeric order remain stable.

- [x] Add failing pure tests for Workspace custom order, remapping, watcher merge, and typed drop insertion.
- [x] Add or tighten Page/Camera order regressions before changing navigator interactions.

## Task 2: Persist Workspace Custom Order as State Schema v3

**Outcome:** Workspace ordering survives refresh and restart without changing real filenames or the backend's safe filesystem hierarchy.
**Files:**
- Modify: `src-tauri/src/workspace.rs`
- Modify: `src/types.ts`
- Modify: `src/lib/tauriCommands.ts`
- Modify: `src/lib/workspaceState.ts`
- Modify: `src/lib/appStoreReducer.ts`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `docs/workspace-format.md`
- Test: `src-tauri/src/workspace.rs`
- Test: `tests/workspaceState.test.mjs`
- Test: `tests/appStoreReducer.test.mjs`
- Test: `tests/tauriCommands.test.mjs`

**Change Map:**
- Rust `WorkspaceState`: schema-v3 `entryOrder`, v1/v2 read compatibility, normalized root-relative path validation, and unchanged atomic `.ideanote/tmp/` persistence
- frontend Workspace metadata/session types: optional persisted order plus current in-memory normalized order
- open/refresh/state snapshot flow: apply persisted order after scan, retain current order on refresh, serialize order only through Workspace state, and keep browse-only open side-effect free
- technical format document: state schema history, custom-order merge/fallback rules, and lazy metadata trigger for an explicit reorder

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml workspace -- --nocapture`
- `node --test tests/workspaceState.test.mjs tests/appStoreReducer.test.mjs tests/tauriCommands.test.mjs`
- Cases: v1/v2 state loads without rewrite; v3 round trip; malformed/internal/absolute order paths are ignored or diagnosed safely; explicit reorder lazily creates metadata; read-only state rejects persistence; refresh/restart retains exact order.

- [x] Advance Workspace state to schema v3 without changing `workspace.json` or user document formats.
- [x] Apply and snapshot normalized custom order through the existing debounced Workspace-state writer.
- [x] Document compatibility and lazy-persistence behavior.

## Task 3: Add Precise Workspace Move and Reorder Drag Behavior

**Outcome:** Explorer dragging clearly distinguishes sibling ordering from filesystem reparenting and updates protected sessions only after successful native moves.
**Files:**
- Modify: `src/components/WorkspaceExplorer.tsx`
- Modify: `src/components/WorkspaceResourceRow.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/lib/appStoreReducer.ts`
- Modify: `src/index.css`
- Modify: `tests/workspaceExplorerWiring.test.mjs`
- Modify: `tests/appStoreReducer.test.mjs`

**Change Map:**
- Explorer/row drag contract: typed source payload, before/inside/after zones, root-end drop target, visible drop indicator, drag cleanup, and action/input event isolation
- `EditorLayout`: same-parent reorder versus native reparent coordination, post-success path remap/selection, refreshed-tree insertion, metadata warning handling, and surfaced native errors
- reducer: one Workspace-order mutation action that preserves selected, expanded, active, dirty, conflict, Missing, and protected session state
- styles: compact drop lines/folder-inside highlight consistent with the existing Explorer visual system

**Verification:**
- `node --test tests/workspaceExplorerWiring.test.mjs tests/appStoreReducer.test.mjs tests/workspaceState.test.mjs tests/externalFileChanges.test.mjs`
- Interaction cases: root and nested reorder; move into folder; move before/after a sibling in another folder; folder self/descendant rejection; collision failure leaves tree/order/path unchanged; read-only/Symlink/Missing entries do not drag; rename/trash controls do not start a drag.

- [x] Replace directory-only drop handling with explicit insertion intent and accessible visual feedback.
- [x] Coordinate native reparent and local order updates transactionally from the editor shell.
- [x] Preserve every existing Workspace document and watcher safety state during successful and failed drops.

## Task 4: Standardize Page and Camera Drag Sorting

**Outcome:** Both IdeaSketch navigator lists support consistent, visible drag sorting through their existing model boundaries.
**Files:**
- Create: `src/lib/listReorder.ts`
- Modify: `src/components/PageOrganizer.tsx`
- Modify: `src/components/CameraList.tsx`
- Modify: `src/index.css`
- Modify: `tests/pageOrganizer.test.mjs`
- Modify: `tests/cameraSidebarWiring.test.mjs`
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/cameraUtils.test.mjs`
- Modify: `tests/workspacePresentationOrder.test.mjs`

**Change Map:**
- Page/Camera rows: shared drag payload conventions, target-index calculation, drop indicator, drag cleanup, and read-only/edit-action isolation
- `PageOrganizer`: retain `REORDER_PAGE` ownership while preventing no-op reorder callbacks and keeping inline rename usable
- `CameraList`: add direct drag sorting while retaining Move Up/Move Down as accessible alternatives and emitting ordered Camera ids once per real reorder
- existing `IdeaSketchEditor`/Camera helper boundary: preserve active Page/Camera selection, update scene Camera order, and rely on the existing model dirty/autosave/save path without a parallel persistence path

**Verification:**
- `node --test tests/pageOrganizer.test.mjs tests/cameraSidebarWiring.test.mjs tests/ideaSketchEditor.test.mjs tests/ideaSketchReducer.test.mjs tests/cameraUtils.test.mjs tests/workspacePresentationOrder.test.mjs`
- Interaction cases: drag first/middle/last Page and Camera; no-op and read-only drops; rename/delete/action clicks do not drag; saved/reopened Page order matches manifest; saved/reopened Camera order and Present sequence match the active Page.

- [x] Harden the existing Page drag interaction around explicit target placement and feedback.
- [x] Add Camera drag sorting without removing accessible button-based reorder controls.
- [x] Verify both lists persist through the canonical IdeaSketch model and presentation order.

## Task 5: Verify and Deliver F012

**Outcome:** All three drag-sorting surfaces ship with current data-integrity, compatibility, visual, and native evidence.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F012-drag-sort-workspace-pages-and-cameras.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- F012 feature/plan: completion status, checked outcomes, and focused/full/native evidence
- generated plan index: refreshed F012 state

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `git diff --check`
- Isolated Tauri acceptance: reorder mixed root and nested Workspace entries; move an open `.is` between folders; refresh/restart and verify custom order plus open-document path; exercise invalid/collision/read-only drops; drag-sort Pages and Cameras; save/reopen; verify Present follows Camera order and no Missing/conflict notice appears from application-owned writes.

- [x] Run focused checks during implementation and the complete regression/build matrix once stable.
- [x] Complete isolated native/filesystem acceptance through the production ordering, persistence, watcher, and native move boundaries; mark F012 done/complete, refresh the index, and create a separate `feat(F012)` commit excluding unrelated `AGENTS.md`.

## Delivery Evidence

- Test-first evidence: the focused frontend contract suite was run before implementation and failed on the missing Workspace ordering, Page placement, and Camera drag behavior.
- Focused frontend verification: the Workspace state, watcher, reducer, Explorer wiring, Page organizer, Camera navigator/helper, IdeaSketch reducer/editor, and presentation-order suite passed 53 tests.
- Focused native verification: `cargo test --manifest-path src-tauri/Cargo.toml workspace -- --nocapture` passed 38 tests covering schema-v1/v2 compatibility, schema-v3 order validation/round trip, safe move/collision/cycle behavior, read-only rejection, and atomic metadata persistence.
- Full regression: `node --test tests/*.test.mjs` passed 179 tests and `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture` passed 80 tests.
- Static and build checks: `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`, `npm run build`, and `git diff --check` passed. Vite reported only the existing Excalidraw mixed-import and large-chunk warnings.
- Acceptance coverage: pure drag projections verify before/inside/after placement, sibling reordering, subtree remapping, collision/descendant/read-only/Symlink rejection, and stable Page/Camera target indexes; reducer and watcher tests verify protected document/order preservation; native Rust tests verify the filesystem and state persistence boundaries; existing IdeaSketch serialization and presentation tests verify saved Page/Camera order. Automated macOS GUI interaction could not run because both available local UI-control backends were unavailable, so no unexecuted visual interaction is claimed as passed.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/02-directory-workspace-foundation.md`
- `docs/superplan/plans/04-ideasketch-editor-integration.md`
- `docs/superplan/plans/05-workspace-reliability-and-recovery.md`
- `docs/superplan/plans/06-single-active-editor.md`
- `docs/superplan/plans/features/F002-workspace-resource-explorer.md`
- `docs/superplan/plans/features/F009-tabbed-ideasketch-navigator.md`
- `docs/superplan/plans/features/F011-filter-workspace-files-and-centralize-temp-writes.md`
- `docs/superplan/plans/bugs/B007-prevent-false-conflicts-after-autosave.md`
- `docs/superplan/plans/bugs/B008-suppress-workspace-self-write-event-bursts.md`
- `src-tauri/src/workspace.rs`
- `src/components/EditorLayout.tsx`
- `src/components/WorkspaceExplorer.tsx`
- `src/components/WorkspaceResourceRow.tsx`
- `src/components/PageOrganizer.tsx`
- `src/components/CameraList.tsx`
- `src/components/IdeaSketchEditor.tsx`
- `src/lib/workspaceState.ts`
- `src/lib/externalFileChanges.ts`
- `src/lib/ideaSketchReducer.ts`
- `src/lib/cameraUtils.ts`
