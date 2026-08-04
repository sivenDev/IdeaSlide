---
id: "F011"
title: "Filter Workspace Files and Centralize Temporary Writes"
type: "feature"
status: "complete"
summary: "Show only registry-openable files in Workspace Explorer and stage every Workspace temporary write under .ideanote/tmp."
source: "docs/superplan/human/features.md"
created: "2026-08-04"
order: 11
depends_on: ["02", "05", "06"]
parent: ""
---

# Filter Workspace Files and Centralize Temporary Writes Plan

**Goal:** Keep the Workspace tree focused on files IdeaNote can edit while moving all Workspace-mode temporary persistence artifacts behind the hidden `.ideanote/tmp/` boundary.
**Scope:** Preserve every navigable real directory and the existing non-recursive Symlink policy, but include regular files in Workspace scans and watcher projections only when the backend Document Format Registry marks their type openable; the current visible file set is `.is`. Keep explicit standalone/open-file unsupported handling intact. Add one shared safe-write primitive for collision-free staging, flush, create-or-replace commit, target-parent sync, failure cleanup, and original-file preservation. Workspace document creation/save, `workspace.json`, `state.json`, `.ideanote/.gitignore`, and Workspace Recovery draft replacement stage only under `<workspace>/.ideanote/tmp/`; Standalone document and Recovery persistence remain outside Workspace metadata. Extend lazy metadata lifecycle so a failed first Workspace document create/save removes any newly created empty staging directories, while a successful user-file write remains successful even if later metadata persistence reports an error. Update the technical format documents and `.ideanote/.gitignore` contract to include `tmp/`.
**Non-Goals:** This feature does not add new file formats, expose unsupported files in Explorer, remove the explicit Unsupported File fallback for non-Explorer entry points, follow Symlinks, change `.is v1` payload structure, create `.is.bak`, add version history, change Save/Save As UX, alter Workspace root `.gitignore`, or create `.ideanote/` in Single File Mode. It does not promise safe atomic replacement across a nested mount point or different filesystem; such a commit must fail without overwriting the original.
**Architecture:** The backend registry is the authority for Workspace file visibility so initial scans and incremental watcher events cannot diverge from frontend editor support. `DocumentFormatDefinition` exposes an `openable` capability and Workspace projection helpers keep directories plus allowed special entries while filtering unsupported regular files before they enter the frontend tree model. A new Rust safe-write module accepts an explicit target, staging directory, and create/replace mode; format, metadata, and Recovery writers serialize their own bytes but delegate filesystem commit mechanics to this module. `WorkspaceService` owns `.ideanote/tmp/` creation and a rollback guard for first-persistence failures, then passes that staging boundary to the generic document-format writer. Metadata and Workspace Recovery use the same directory, while Standalone callers retain their existing app-local or same-filesystem safe strategy without Workspace metadata. The watcher ignores the complete `.ideanote/` subtree case-insensitively and emits no visible create/rename projection for unsupported regular files.
**Baseline:** `WorkspaceService::scan_directory` currently returns every non-internal regular file and records `file_type: None` for unsupported extensions; `WorkspaceService::entry` lets watcher events reinsert those files. The IdeaSketch writer stages at `path.with_extension("is.tmp")`, Workspace metadata uses a sibling `<metadata-name>.tmp`, and Recovery uses a sibling `*.json.tmp`. `.ideanote/.gitignore` omits `tmp/`. The watcher already ignores the literal `.ideanote` first path component and temporary suffixes, but its filtering is case-sensitive and unsupported external files still produce entries. Existing tests explicitly require unsupported files to remain visible and same-directory temporary artifacts to be cleaned.
**Exit Criteria:** Opening or refreshing a Workspace returns all real directories, supported `.is` files, and the established safe Symlink representation, but no unsupported regular file and no `.ideanote/` entry. External create/rename/move events add supported files and directories incrementally while unsupported files remain absent; renaming a visible supported file to an unsupported extension removes it. Workspace document creation/save, metadata updates, and Workspace Recovery replacement create temporary files only inside `.ideanote/tmp/`; target directories contain no sibling `.is.tmp`, metadata `.tmp`, Recovery `.json.tmp`, or `.is.bak`. Failed replacement preserves the original target and removes its staging file. A failed first create/save leaves no newly created `.ideanote/`, while a successful first persistence creates valid metadata whose internal `.gitignore` includes `tmp/`. Single File Mode creates no `.ideanote/` and its save/recovery behavior remains functional. Focused Rust regressions, the complete Node/Rust suites, formatting, production build, diff checks, and isolated native Workspace acceptance pass.

## Task 1: Lock Visibility and Temporary-write Safety Contracts

**Outcome:** Focused regressions fail against the current unsupported-file projection and sibling-temp implementation before production behavior changes.
**Files:**
- Test: `src-tauri/src/workspace.rs`
- Test: `src-tauri/src/workspace_watcher.rs`
- Test: `src-tauri/src/document_formats/idea_sketch.rs`
- Test: `src-tauri/src/recovery.rs`

**Change Map:**
- Workspace tests: nested directories stay visible, unsupported regular files disappear, registry-supported extension matching is case-insensitive, and first-write failure rolls back newly created staging metadata
- watcher tests: unsupported create/rename events have no tree entry, supported-to-unsupported rename removes the visible entry, and every `.ideanote` descendant is ignored
- IdeaSketch tests: caller-selected staging directory, collision-free temporary names, no sibling `.is.tmp`/`.is.bak`, and failed replacement preserves the original
- Recovery tests: Workspace draft replacement stages under `.ideanote/tmp/`, Standalone storage stays app-local, and failed draft replacement cleans staging

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml workspace -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml workspace_watcher -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml document_formats -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml recovery -- --nocapture`

- [x] Replace visibility-retention expectations with registry-openable projection cases and confirm the focused failure.
- [x] Add temporary-location, rollback, collision, and original-preservation cases before implementing the shared writer.

## Task 2: Make Workspace Visibility Registry-driven

**Outcome:** Initial scans and incremental watcher events expose the same supported file set without parsing document contents.
**Files:**
- Modify: `src-tauri/src/document_formats/mod.rs`
- Modify: `src-tauri/src/workspace.rs`
- Modify: `src-tauri/src/workspace_watcher.rs`
- Test: `src-tauri/src/document_formats/mod.rs`
- Test: `src-tauri/src/workspace.rs`
- Test: `src-tauri/src/workspace_watcher.rs`

**Change Map:**
- `DocumentFormatDefinition`: explicit `openable` capability plus a case-insensitive path predicate used by Workspace projection
- `WorkspaceService::scan_directory` and watcher entry lookup: keep directories and the existing Symlink policy, filter unsupported regular files before returning `WorkspaceEntry` data, and preserve metadata-only scanning
- watcher normalization: ignore `.ideanote/` as a complete case-insensitive subtree and remove suffix-specific visibility assumptions now covered by the hidden metadata boundary

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml document_formats -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml workspace -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml workspace_watcher -- --nocapture`
- Cases: empty directory retained; nested `.is` retained; `.IS` retained; `.md`/`.txt` omitted; external unsupported create omitted; supported-to-unsupported rename removes the old entry; unsupported-to-supported rename adds the new entry.

- [x] Add the backend openable capability without hard-coding a second Workspace-only extension list.
- [x] Apply one visibility predicate to scan and watcher projection while retaining directory, Symlink, sorting, and path-safety behavior.

## Task 3: Centralize Workspace Temporary Writes Under `.ideanote/tmp/`

**Outcome:** Document, metadata, and Workspace Recovery persistence share one failure-safe commit boundary and leave user directories free of sibling temporary artifacts.
**Files:**
- Create: `src-tauri/src/safe_write.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/document_formats/mod.rs`
- Modify: `src-tauri/src/document_formats/idea_sketch.rs`
- Modify: `src-tauri/src/workspace.rs`
- Modify: `src-tauri/src/recovery.rs`
- Modify: `docs/file-format.md`
- Modify: `docs/workspace-format.md`
- Test: `src-tauri/src/safe_write.rs`
- Test: `src-tauri/src/document_formats/idea_sketch.rs`
- Test: `src-tauri/src/workspace.rs`
- Test: `src-tauri/src/recovery.rs`

**Change Map:**
- `safe_write`: unique staging allocation, byte flush, create-new versus replace commit, parent-directory sync, cross-filesystem/error propagation, and guaranteed staging cleanup
- document-format writer: accept an explicit persistence/staging policy so Workspace uses `.ideanote/tmp/` while Standalone preserves its non-Workspace strategy
- `WorkspaceService`: prepare `.ideanote/tmp/`, roll back newly created empty metadata staging after failed first user-file persistence, retain user-file-first metadata error semantics, atomically update metadata through the shared writer, and ensure internal `.gitignore` contains `tmp/` without touching the root `.gitignore`
- Recovery writer: send Workspace atomic draft staging to `.ideanote/tmp/` and keep Standalone Recovery in app data
- technical docs: replace unsupported-file visibility and sibling-temp contracts with the accepted registry-filter and centralized staging behavior

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml safe_write -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml document_formats -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml workspace -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml recovery -- --nocapture`
- Inspect a temporary Workspace after create, repeated save, state update, Recovery draft write, and forced failure; verify only durable user files plus hidden `.ideanote/` data remain and `.ideanote/tmp/` contains no abandoned staging file.

- [x] Implement and adopt the shared safe-write boundary across every Workspace temporary-write producer in scope.
- [x] Preserve lazy metadata, no-clobber creation, no-backup replacement, metadata failure isolation, and Standalone no-`.ideanote` behavior.
- [x] Synchronize `docs/file-format.md` and `docs/workspace-format.md` with the implemented contract.

## Task 4: Verify and Deliver F011

**Outcome:** The filtered Explorer and centralized temporary-write policy ship with complete data-integrity evidence.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/features/F011-filter-workspace-files-and-centralize-temp-writes.md`

**Change Map:**
- F011 feature and plan: completion status, checked outcomes, and final focused/full/native evidence
- generated plan index: refreshed F011 state

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `git diff --check`
- Isolated Tauri acceptance: open a Workspace containing empty directories, `.is`, `.md`, `.txt`, and a pre-existing `.ideanote`; verify only directories and `.is` appear; create/save/recover an IdeaSketch; externally rename between supported and unsupported extensions; inspect that all Workspace staging stays under `.ideanote/tmp/`, no sibling temp/backup appears, and Single File Mode creates no `.ideanote/`.

- [x] Run focused checks during implementation and the complete regression/build matrix once the implementation stabilizes.
- [x] Complete isolated native and filesystem acceptance, record evidence, mark F011 done, and refresh the plan index before the separate `feat(F011)` delivery commit.

## Delivery Evidence

- Test-first evidence: the new staging contract initially failed to compile because `write_file_with_staging` did not exist; the pre-change Workspace-focused baseline passed 25 tests.
- Focused native acceptance: `cargo test --manifest-path src-tauri/Cargo.toml workspace -- --nocapture` passed 30 tests covering directory retention, `.is`/`.IS` visibility, unsupported-file filtering, watcher rename transitions, lazy metadata, `.gitignore` preservation, Symlink rejection, no sibling temporary files, empty staging cleanup, and Workspace Recovery placement.
- Full Rust regression: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture` passed 72 tests.
- Frontend regression: `node --test tests/*.test.mjs` passed 166 tests.
- Static and build checks: `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`, `npm run build`, and `git diff --check` passed. Vite reported only the existing dynamic-import and large-chunk warnings.
- Isolated filesystem inspection is encoded in native Rust tests: completed document, metadata, and Recovery writes leave `.ideanote/tmp/` empty; user directories contain no sibling `.is.tmp`, `.tmp`, or `.is.bak`; read-only Recovery lookup and Standalone persistence do not create Workspace metadata.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/01-shared-document-kernel-and-is-v1.md`
- `docs/superplan/plans/02-directory-workspace-foundation.md`
- `docs/superplan/plans/03-multifile-workspace-shell.md`
- `docs/superplan/plans/05-workspace-reliability-and-recovery.md`
- `docs/superplan/plans/06-single-active-editor.md`
- `docs/file-format.md`
- `docs/workspace-format.md`
- `src-tauri/src/document_formats/mod.rs`
- `src-tauri/src/document_formats/idea_sketch.rs`
- `src-tauri/src/workspace.rs`
- `src-tauri/src/workspace_watcher.rs`
- `src-tauri/src/recovery.rs`
