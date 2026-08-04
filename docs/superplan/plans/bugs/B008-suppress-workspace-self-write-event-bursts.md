---
id: "B008"
title: "Suppress Complete Workspace Self-Write Event Bursts"
type: "bugfix"
status: "complete"
summary: "Treat every watcher event from one Workspace save as one application-owned operation without hiding later external changes."
source: "docs/superplan/human/bugs.md"
created: "2026-08-04"
order: 8
depends_on: ["05", "F011"]
parent: ""
---

# Suppress Complete Workspace Self-Write Event Bursts Plan

**Goal:** Make Workspace saves reliable when several `.is` files are present by preventing one application-owned atomic replacement from becoming a false external conflict.
**Scope:** Replace the watcher's one-event expected-write token with an operation-scoped save lifecycle for the exact target file. Suppress all remove/create/modify/rename notifications belonging to the in-flight save, retain a short bounded completed-save record tied to the saved file's post-write stamp so delayed notifications for that same result are also ignored, and immediately release suppression when the save fails or an event no longer matches the saved result. Preserve independent watcher handling for every other Workspace path.
**Non-Goals:** This fix does not disable external-change protection, weaken conflict UI for genuine external edits, redesign Workspace autosave, change `.is` serialization or atomic staging, add merge/version history, or resolve the inherently concurrent case where another process writes the exact same path during the application's own atomic commit.
**Architecture:** `WorkspaceWatcherState` will own per-path expected-write operations instead of consumable timestamps. `save_workspace_document` begins the operation before calling `WorkspaceService::save_document`, then completes it with the durable target's file stamp on success or cancels it on failure. Event normalization asks the registry whether each event still belongs to that operation: active writes suppress every exact-path event; completed writes suppress only while the current path still matches the recorded post-save stamp and the bounded settle window has not expired. A missing or changed post-save target clears the record and continues through normal external event classification. Entries remain exact-path and independent so saving one of two open files cannot suppress changes to the other.
**Baseline:** `register_expected_write` inserts one `HashMap<PathBuf, Instant>` entry before saving. `consume_expected` removes that entry on the first matching watcher event, and the existing regression explicitly expects the second identical event to be emitted. Workspace saves use `safe_write::write_bytes`, which stages under `.ideanote/tmp/` and atomically renames the result over the target; macOS can report that replacement as more than one target-path event.
**Reproduction:** Open a Workspace containing two `.is` files, edit the active file, and save or wait for autosave. The active document first receives a target removal and then a create/modify notification from its own atomic replacement. The UI reports `This file reappeared on disk while you have unsaved edits`, marks the document conflicted, and refuses silent overwrite. The same sequence reproduced in the isolated B007 acceptance bundle before any viewport interaction and is now confirmed by the supplied two-file screenshot.
**Root Cause:** Self-write suppression models a save as one watcher event, but the filesystem reports one atomic replacement as an event burst. The ambiguous missing-path side of a macOS rename is queued as a delayed removal without consulting the expected-write token; an existing-path event can then consume the single token, and a later create/modify event still reaches the frontend. The leaked remove followed by create/modify transitions the dirty session to `missing` and then `conflict`, producing the observed `reappeared on disk` notice.
**Exit Criteria:** Repeated explicit saves and autosaves in a two-file Workspace keep the saved document in `Saved` state with no Missing or File conflict transition. Remove/create/modify bursts for the exact application-owned replacement are suppressed as one operation, including delayed events that still match the completed saved file. A failed save leaves no suppression behind. External modification, replacement, rename, or deletion after the application save still produces the established external-change/missing/conflict behavior, and changes to a second file are never suppressed by saving the first. Focused watcher/command regressions, full Rust and frontend suites, formatting/lint/build/diff checks, and isolated native two-file acceptance pass.

## Task 1: Capture the Multi-event Save Regression

**Outcome:** Focused Rust tests distinguish one application save's event burst from a genuine later change or another file's event.
**Files:**
- Modify: `src-tauri/src/workspace_watcher.rs`
- Modify: `src-tauri/src/commands.rs`

**Change Map:**
- watcher regression: replace the one-shot expected-write contract with remove/create/modify burst suppression for one exact path
- lifecycle regression: successful completion retains only matching delayed events; failure clears the operation immediately
- isolation regression: saving `a.is` never suppresses a watcher event for `b.is`
- external-change regression: a changed or missing post-save stamp exits suppression and emits the normal event

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml workspace_watcher -- --nocapture`
- Cases: in-flight multi-event burst; delayed matching event; changed file stamp; failed save; expired record; different path.

- [x] Add a focused failing regression that reproduces the leaked second event from one atomic save.
- [x] Add safety cases proving failed saves and genuine external/different-file events remain observable.

## Task 2: Make Self-write Suppression Operation-scoped

**Outcome:** The watcher and Workspace save command share an explicit begin/complete/cancel boundary for one durable file replacement.
**Files:**
- Modify: `src-tauri/src/workspace_watcher.rs`
- Modify: `src-tauri/src/commands.rs`

**Change Map:**
- `WorkspaceWatcherState`: per-path expected-write operation state, bounded cleanup, and durable file-stamp matching
- event normalization: non-consuming membership checks during an active operation and post-save matching for delayed target events
- `save_workspace_document`: begin before persistence, complete with the saved target on success, and cancel on every error path
- watcher lifecycle: `stop` clears all expected operations along with recent and pending rename state

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml workspace_watcher -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml commands -- --nocapture`
- Cases: one save produces no projected target event; the next external write does; save errors do not poison later watcher behavior.

- [x] Implement the smallest operation-level registry without changing save data or frontend conflict policy.
- [x] Wrap Workspace document saving in a success/failure-safe watcher lifecycle.

## Task 3: Verify and Deliver B008

**Outcome:** Multi-file Workspace saving no longer creates false conflicts while external-change protection remains intact.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/bugs/B008-suppress-workspace-self-write-event-bursts.md`

**Change Map:**
- B008 artifacts: completion state and focused/full/native evidence
- generated plan index: refreshed B008 status

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml workspace_watcher -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `node --test tests/*.test.mjs`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `git diff --check`
- Isolated native acceptance: exercise a real macOS `notify` watcher over a temporary Workspace containing two valid `.is` files; save one through `WorkspaceService::save_document`, verify its complete native event burst projects no change, then externally modify the second file and verify its event remains visible. Build a dedicated `IdeaNote B008 Acceptance.app`; record any GUI automation limitation separately from the native watcher result.

- [x] Run focused checks during implementation and the complete regression/build matrix once stable.
- [x] Complete isolated native two-file and external-change acceptance, mark B008 done, refresh the plan index, and create a separate `fix(B008)` commit.

## Completion Evidence

- Test-first reproduction: `cargo test --manifest-path src-tauri/Cargo.toml workspace_watcher -- --nocapture` initially failed because the second matching modify event was emitted and an expected ambiguous remove still created a delayed-removal ticket.
- Focused watcher verification passed 10/10. It covers active remove/create/modify bursts, matching delayed events, changed and deleted post-save files, expiry, failed saves, different-file isolation, ambiguous macOS renames, and Symlink/internal-path behavior.
- The macOS-native regression `native_atomic_replace_burst_is_suppressed_without_hiding_another_file` creates two valid `.is` files, watches the real temporary Workspace through `notify`, saves `saved.is` with `WorkspaceService::save_document`, observes the actual FSEvents burst with no projected change, then externally modifies `other.is` and observes its projected event.
- Full Rust regression passed 77/77; full frontend regression passed 169/169.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`, `npm run build`, and `git diff --check` passed. Vite emitted only the existing Excalidraw mixed-import and large-chunk warnings.
- The dedicated bundle was built at `src-tauri/target/debug/bundle/macos/IdeaNote B008 Acceptance.app`. Computer-use GUI startup was attempted repeatedly but its native pipe was unavailable; native save/watcher acceptance was therefore executed deterministically in the Rust integration test rather than through UI automation.

## References
- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/05-workspace-reliability-and-recovery.md`
- `docs/superplan/plans/06-single-active-editor.md`
- `docs/superplan/plans/features/F011-filter-workspace-files-and-centralize-temp-writes.md`
- `docs/superplan/plans/bugs/B007-prevent-false-conflicts-after-autosave.md`
- `src-tauri/src/commands.rs`
- `src-tauri/src/safe_write.rs`
- `src-tauri/src/workspace.rs`
- `src-tauri/src/workspace_watcher.rs`
- `src/lib/externalFileChanges.ts`
