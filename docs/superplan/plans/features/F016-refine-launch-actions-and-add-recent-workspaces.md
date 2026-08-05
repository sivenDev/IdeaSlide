---
id: "F016"
title: "Refine Launch Actions and Add Recent Workspaces"
type: "feature"
status: "complete"
summary: "Unify Home action icons with the application icon system and add persistent, reopenable recent Workspace history beside recent standalone files."
source: "docs/superplan/human/features.md"
created: "2026-08-05"
order: 16
depends_on: ["03", "F007"]
parent: ""
---

# Refine Launch Actions and Add Recent Workspaces Plan

**Goal:** Make the IdeaNote Home screen clearer and more useful by standardizing its open-action icons and giving directory Workspaces the same recent-history affordance as standalone files.
**Scope:** Replace the Home screen's `Open Workspace` and `Open File` character glyphs with appropriately sized Lucide icons while preserving the existing buttons, labels, focus behavior, and violet launch-panel styling. Add `Recent Workspaces` and `Recent Files` as two tabs sharing one full-height recent-items pane; each Workspace row shows its directory name, canonical path, relative open time, opens that directory through the normal Workspace session/restore path, and can be removed from history. Persist up to 20 successfully opened directory Workspaces in the existing global user configuration, newest first, automatically refresh their timestamp from every successful backend Workspace open, discard missing/non-directory paths when listing, and read existing recent-file-only configuration without migration or data loss.
**Non-Goals:** This plan does not redesign the overall Home split layout or branding, change New File, merge Workspace and file history into one mixed list, store recent history under a Workspace's `.ideanote/`, create `.ideanote/` while recording history, add Workspace pinning/search/grouping, change Workspace restoration semantics, rename the existing recents module, or alter supported file types.
**Architecture:** The existing global recents module remains the single persistence boundary and gains a `RecentWorkspace` collection with serde defaults so older `user.json` files remain valid. `commands::open_workspace` records the canonical root from its successful `WorkspaceOpenResult`; history-write failure is logged but never blocks opening, matching the recent-file contract. Tauri exposes typed list/remove Workspace-history commands, while `AppContent` supplies a path-aware Workspace opener to `LaunchScreen` so recent rows reuse `openWorkspace(root)` and the same document restoration/dispatch flow as directory-picker opens. `LaunchScreen` owns only presentation and optimistic list removal, loads both histories together, and reuses the established Radix-backed Tabs primitive so one active history receives the full available height. Files are the first/default tab; when file history is empty and Workspace history exists, the view falls back to Workspaces.
**Baseline:** `LaunchScreen` renders `▱` and `◇` for its two open actions and shows only `Recent Files`. The installed Lucide dependency already defines the application's icon language. `recent_files.rs` stores only `recent_files`, and `commands::open_workspace` opens a canonicalized directory without recording it. Existing Home tests cover the three entry-point labels but not icon semantics or recent Workspace behavior.
**Exit Criteria:** Home displays clear Lucide icons for Open Workspace and Open File with unchanged English labels and accessible button behavior. The right pane presents Recent Files first and Recent Workspaces second as keyboard-accessible tabs above one full-height list, including counts and independent loading/empty/list states; recent Workspace rows show name, path, and relative time, reopen through the normal Workspace flow, and can be removed. Files are active by default, while an empty file history falls back to Workspaces when available. Every successful Workspace open refreshes one canonical newest-first entry without making the open fail if global history persistence fails. Missing or non-directory history entries are not returned, existing recent-file configuration loads unchanged, neither history exceeds 20 entries, and focused Node/Rust tests, complete regressions, production builds, formatting/diff checks, and a launch-screen visual smoke check pass.

## Task 1: Protect Recent Workspace Persistence and Open Semantics

**Outcome:** Global history can safely round-trip both standalone files and canonical directory Workspaces, and successful Workspace opens refresh history without affecting Workspace side-effect rules.
**Files:**
- Modify: `src-tauri/src/recent_files.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/src/recent_files.rs`
- Test: `src-tauri/src/commands.rs`

**Change Map:**
- `recent_files::UserConfig`: backward-compatible defaulted `recent_workspaces` collection alongside existing recent files
- `recent_files::RecentWorkspace`: canonical directory path, display name, and last-opened timestamp contract
- recent Workspace commands: newest-first add/dedupe/truncate, directory filtering, and explicit removal
- `commands::open_workspace`: record the canonical opened root only after Workspace open succeeds; log and isolate history persistence errors
- Tauri invoke registry: expose list/remove recent Workspace commands to the frontend

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml recent_workspace -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml open_workspace -- --nocapture`
- Cases: legacy config with only `recent_files`; directory-only filtering; canonical dedupe and refreshed timestamp; 20-entry cap; removal; failed Workspace open creates no history; history-write failure does not turn a successful Workspace open into an error.

- [x] Add focused failing Rust contracts for legacy configuration compatibility and recent Workspace lifecycle behavior.
- [x] Implement the recent Workspace persistence API and successful-open integration without creating Workspace metadata.
- [x] Register only the frontend commands needed to list and remove Workspace history.

## Task 2: Add Typed Frontend History and Reopen Flow

**Outcome:** The frontend can load, remove, and reopen recent Workspaces through the same application-session path as Open Workspace.
**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/tauriCommands.ts`
- Modify: `src/App.tsx`
- Test: `tests/launchScreen.test.mjs`

**Change Map:**
- `RecentWorkspace`: frontend contract matching the backend record
- Tauri wrappers: resilient recent Workspace listing and explicit removal
- `AppContent`: one path-aware Workspace-open callback that handles picker and recent-row roots through `openWorkspace(root)`, `restoreWorkspaceDocuments`, and `OPEN_WORKSPACE`
- `LaunchScreenProps`: separate recent-file and recent-Workspace callbacks with unambiguous names

**Verification:**
- `node --test tests/launchScreen.test.mjs`
- Source/behavior contract: a recent Workspace row invokes the same Workspace restore callback with its path; recent files retain their standalone callback; command names and types remain distinct.

- [x] Add focused failing frontend contracts for recent Workspace commands and callback wiring.
- [x] Refactor the Workspace opener to accept an optional recent root without duplicating restore/dispatch logic.
- [x] Keep standalone recent-file behavior unchanged.

## Task 3: Refine Home Icons and Add Tabbed Recent History

**Outcome:** The Home screen uses the established icon family and gives Workspace or standalone history the full recent pane through a compact tab switcher.
**Files:**
- Modify: `src/components/LaunchScreen.tsx`
- Test: `tests/launchScreen.test.mjs`

**Change Map:**
- launch actions: `FolderOpen` and `FileInput` Lucide icons with consistent size, stroke, and decorative accessibility semantics
- history loading: concurrent recent Workspace/recent-file retrieval with stable loading and error handling
- recent pane: compact Radix-backed `Recent Files` and `Recent Workspaces` tabs with counts, no redundant explanatory subtitle, one active full-height scroll region, per-tab empty state, row action, relative time, and removal control
- initial selection and responsive layout: show Files first and active by default, switch automatically to Workspaces only when file history is empty and Workspace history is available, and preserve the existing split-screen identity at supported window sizes

**Verification:**
- `node --test tests/launchScreen.test.mjs`
- Visual smoke at the current launch-window size and a reduced height: icon alignment, hover/focus contrast, tab selection/counts, full-height scrolling, truncation, empty states, reopen actions, and removal affordances.

- [x] Replace the two character glyphs with Lucide components without changing button copy or hierarchy.
- [x] Render recent Workspaces and recent standalone files as tabs sharing one full-height list pane.
- [x] Verify keyboard focus, accessible remove names, path truncation, and compact-height behavior.

## Task 4: Verify and Deliver F016

**Outcome:** The launch-screen and history enhancement ships with current cross-layer regression evidence and isolated progress metadata.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F016-refine-launch-actions-and-add-recent-workspaces.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- F016 feature and plan: completed outcomes and final verification evidence
- generated plan index: refreshed F016 status

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `npm run build`
- `git diff --check`
- Native launch-screen smoke for action icons, both history sections, recent Workspace reopen, and history removal.

- [x] Run focused checks while iterating and the complete relevant regression/build matrix once the implementation stabilizes.
- [x] Compare the final diff with every exit criterion and record meaningful warnings or environment limitations.
- [x] Mark F016 done/complete, refresh the plan index, and create a separate `feat(F016)` commit containing only this task.

## Delivery Evidence

- Focused frontend contracts: `node --test tests/launchScreen.test.mjs` passed 3/3, covering Lucide action icons, file-first tab ordering, redundant-description removal, separate recent histories, and callback/command wiring.
- Frontend regression: `node --test tests/*.test.mjs` passed 191/191 after extending the existing WebKit runtime mock for the new recent Workspace read command.
- Focused backend contracts: recent Workspace persistence tests and `open_workspace` tests passed, including legacy serde defaults, canonical dedupe, newest-first truncation, directory filtering, removal, successful-open recording, and non-blocking history-write failure.
- Backend regression: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture` passed 85/85; `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` and `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets` passed.
- Production build: `npm run build` passed. Existing Excalidraw mixed-import and large-chunk warnings remain unchanged.
- Browser smoke: Recent Files is first and active by default, tabs switch correctly, explanatory subtitles are absent, action icons render as SVGs, and the shared list pane avoids page overflow at 1464×800 (about 667 px list height) and 1100×600 (about 467 px list height).
- Final hygiene: `git diff --check` passed, and the final diff was compared against the user-directed file-first tab layout and all F016 exit criteria.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/03-multifile-workspace-shell.md`
- `docs/superplan/plans/features/F007-framework-title-bar-icons.md`
- `src/App.tsx`
- `src/components/LaunchScreen.tsx`
- `src/lib/tauriCommands.ts`
- `src-tauri/src/commands.rs`
- `src-tauri/src/recent_files.rs`
