---
id: "02"
title: "Build the Real Directory Workspace Foundation"
type: "required"
status: "draft"
summary: "Add root-confined filesystem operations and lazily created, versioned .ideanote metadata for real directory workspaces."
source: "docs/superplan/human/prd.md"
created: "2026-08-03"
order: 2
depends_on: ["01"]
parent: ""
---

# Build the Real Directory Workspace Foundation Plan

**Goal:** Make a user-selected local directory, rather than a `.is` archive, the authoritative Workspace boundary.
**Scope:** Add Tauri commands and pure Rust services to open and scan a directory, read files on demand, create Folder and IdeaSketch entries, rename/move entries, send deletions to system Trash, refresh the tree, and atomically persist versioned `.ideanote` metadata. Opening or browsing a directory remains read-only; `.ideanote/` is created only after the first successful user-file creation/save or explicit persistent-setting change. Hide `.ideanote/` and app temporary/internal artifacts, reject paths outside the root, avoid following Symlinks, and allow readable but unwritable roots to open in read-only mode. Define schema v1 for `workspace.json`, `state.json`, `.gitignore`, `recovery/`, and `cache/` while treating real files as the only content source of truth.
**Non-Goals:** This plan does not build the React Workspace Explorer or Tabs, watch external changes, restore editor sessions, implement recovery drafts, permanently delete files, follow Symlinks, modify the root `.gitignore`, parse every file during scan, import/export Workspace packages, or migrate `.is v2`.
**Architecture:** A backend `WorkspaceService` owns a canonicalized root and validates every relative path before filesystem access. Directory scans return metadata-only `WorkspaceEntry` records and never parse document contents. Mutations use explicit commands rather than broad frontend filesystem permission; rename/move stay root-confined, creation writes a valid file first, and Trash failure leaves the source untouched. Metadata persistence is a secondary transaction: user-file success is reported even if `.ideanote` state persistence fails, with the metadata error returned separately. `workspace.json` contains `schemaVersion`, stable `workspaceId`, timestamps, and settings; `state.json` contains `schemaVersion`, relative Tab paths, active path, and Explorer state. Both use temp-file atomic replacement. `.ideanote/.gitignore` ignores `state.json`, `recovery/`, and `cache/` only.
**Baseline:** Tauri currently exposes only whole-`.is` create/open/save commands plus recent-file configuration. The frontend dialog only selects `.is` files. No backend root-confinement, directory scan, Workspace metadata, Trash, or read-only capability model exists; the current left tree is synthesized from resources embedded inside one v2 archive.
**Exit Criteria:** Opening any readable directory returns a metadata-only tree and does not alter that directory. `.ideanote/` is absent after open/browse and appears only after a successful create/save trigger. New Folder and valid empty `.is v1` creation, rename, move, Trash, refresh, and on-demand reads operate only within the canonical root; traversal, recursive Symlink, `.ideanote`, and internal-temp targets are rejected. Unwritable directories open read-only and reject mutations clearly. Corrupt or unknown metadata is preserved, ignored in favor of safe defaults, and reported without blocking file access. Focused Rust service/command tests, full backend tests, formatting, and production build pass.

## Task 1: Define Workspace Metadata and Root-Safety Contracts

**Outcome:** Workspace identity, UI state, lazy creation, and path safety have executable schemas and invariants.
**Files:**
- Create: `docs/workspace-format.md`
- Create: `src-tauri/src/workspace.rs`
- Test: `src-tauri/src/workspace.rs`

**Change Map:**
- `docs/workspace-format.md`: `.ideanote` schema v1, lifecycle triggers, ignored files, corruption behavior, and source-of-truth policy
- `src-tauri/src/workspace.rs`: metadata structs, relative-path normalization, hidden/internal-entry policy, canonical-root checks, Symlink classification, and read/write capability detection

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml workspace -- --nocapture`
- Cases: no side effect on open; traversal and Symlink escape rejected; `.ideanote` hidden; corrupt state defaults safely; read-only root reported.

- [ ] Add failing tests for schema parsing, lazy metadata, root escape, hidden entries, Symlinks, and corruption fallback.
- [ ] Document and implement the v1 Workspace metadata boundary.

## Task 2: Implement Real Directory Scans and Safe Mutations

**Outcome:** The backend can perform every current-MVP Explorer operation without granting arbitrary filesystem access to the webview.
**Files:**
- Modify: `src-tauri/src/workspace.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Test: `src-tauri/src/workspace.rs`
- Test: `src-tauri/src/commands.rs`

**Change Map:**
- `src-tauri/src/workspace.rs`: shallow/recursive metadata scan, on-demand reads, Folder and v1 IdeaSketch creation, rename, move, refresh, system Trash, and atomic user-file writes
- `src-tauri/src/commands.rs`: typed `open_workspace`, scan/read/create/rename/move/trash/refresh, and Workspace-state commands
- `src-tauri/src/lib.rs`: command registration
- Cargo manifests: narrowly scoped Trash support and any required path-safe filesystem dependency

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml workspace -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml commands -- --nocapture`
- Behavior cases: large nested tree metadata scan; extension-independent unsupported files retained; unique `Untitled.is` naming; collision-safe move; Trash failure is non-destructive; no command accepts an absolute child path outside root.

- [ ] Implement metadata-only tree scans and on-demand file reads.
- [ ] Implement root-confined create, rename, move, Trash, refresh, and atomic write operations.
- [ ] Register only explicit commands and retain clear English errors for the frontend.

## Task 3: Create Metadata Only After Successful User-File Persistence

**Outcome:** Workspace state can be restored without polluting directories merely opened for browsing.
**Files:**
- Modify: `src-tauri/src/workspace.rs`
- Modify: `src-tauri/src/commands.rs`
- Test: `src-tauri/src/workspace.rs`

**Change Map:**
- Workspace mutation transaction: successful user-file operation first, then lazy `.ideanote` creation/state write, with separate result fields for content and metadata outcomes
- metadata writer: atomic `workspace.json`/`state.json`, internal `.gitignore`, recovery/cache directory creation only when needed

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml workspace -- --nocapture`
- Cases: failed file creation produces no `.ideanote`; successful file plus failed metadata reports content success; state temp replacement is atomic; no root `.gitignore` mutation.

- [ ] Enforce user-file-first ordering for create/save and metadata persistence.
- [ ] Make metadata failures recoverable and independently observable.

## Task 4: Verify the Workspace Service Boundary

**Outcome:** The native filesystem foundation is ready for UI consumption without broadening user authorization.
**Files:**
- Modify: `docs/superplan/plans/02-directory-workspace-foundation.md`

**Change Map:**
- plan evidence: path-safety, lazy metadata, mutation, read-only, and Trash results

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `npm run build`
- `git diff --check`

- [ ] Run complete backend and build verification after focused tests pass.
- [ ] Record temporary-directory integration evidence before completion.

## References
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/01-shared-document-kernel-and-is-v1.md`
- `src-tauri/src/commands.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/recent_files.rs`
- `src-tauri/src/file_format.rs`
