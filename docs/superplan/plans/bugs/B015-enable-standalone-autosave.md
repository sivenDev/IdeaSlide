---
id: "B015"
title: "Enable Protected Auto-save for Standalone Files"
type: "bugfix"
status: "draft"
summary: "Auto-save existing writable standalone files without weakening external-change, recovery, or untitled-file protections."
source: "docs/superplan/human/bugs.md"
created: "2026-08-05"
order: 15
depends_on: ["B014"]
parent: ""
---

# Enable Protected Auto-save for Standalone Files Plan

**Goal:** Give an existing writable file opened in Single File Mode the same dependable debounced auto-save experience as a Workspace file.
**Scope:** Enable the established two-second auto-save lifecycle for editable standalone IdeaSketch documents that already have a real file path. Route standalone auto-save through the existing target inspection, canonical serializer, atomic standalone writer, saved-baseline update, recovery cleanup, and stable-edit completion guard. Treat the application's own standalone write as application-owned while the polling-based external-change detector observes it, without hiding a later genuine external modification. Update the PRD's explicit-save-only default to record the newly approved behavior.
**Non-Goals:** This bugfix does not auto-save an untitled document or open Save As without a user action, add an auto-save preference UI, change the debounce interval, enable unsupported or protected formats, weaken read-only/missing/conflict/external-change blocking, create `.ideanote/` in Single File Mode, change `.is v1` serialization, or alter Workspace watcher behavior.
**Architecture:** Auto-save eligibility becomes a persistence-state decision—an editable, writable document with a real target path—rather than an application-mode decision. `IdeaSketchEditor` continues to use the shared `useAutoSave` hook and delegates persistence to `EditorLayout`; it no longer decides that Standalone mode is inherently manual-only. `EditorLayout` keeps mode-specific adapters at the persistence boundary: Workspace writes retain their metadata/watcher path, while standalone writes use `saveStandaloneDocument` after `inspectDocumentTarget`. Manual and automatic standalone saves share an application-owned write marker covering the in-flight operation and returned post-write modification stamp so the two-second standalone inspection poll ignores only that write result; a missing, read-only, or differently modified target still enters the existing protection flow.
**Baseline:** `IdeaSketchEditor` currently passes `enabled: document.mode === "workspace" && ...` to `useAutoSave`, and `EditorLayout.handleAutoSave` returns immediately unless the document is a Workspace session. The standalone manual-save path already inspects the target, serializes through the registry, writes atomically through `save_file`, records the returned modification stamp, clears recovery, and updates the session. Standalone polling already detects missing, read-only, and externally modified targets. The explicit-save-only behavior was an intentional MVP default in the PRD and Plan 04, not a file-format or backend limitation.
**Reproduction:** Open an existing writable `.is v1` file through Open File or file association, make a persisted edit such as adding or renaming a Page, and wait longer than the auto-save debounce. The toolbar remains at `Unsaved changes`, a recovery draft is written, and the source archive modification time does not change until explicit Save. The focused baseline suite passes a source contract named `Workspace-only autosave`, confirming the mode gate is the current expected implementation.
**Root Cause:** The original MVP policy deliberately allowed silent debounced writes only inside a Workspace. That policy is encoded twice: the editor disables `useAutoSave` for every standalone session, and the persistence callback accepts only Workspace documents. The standalone save pipeline itself is already capable of safe writes; the missing behavior is the accepted policy and adapter routing, plus application-owned-write identification for the polling detector once writes become automatic.
**Exit Criteria:** A persisted edit to an existing writable standalone `.is` schedules one debounced write, reaches `Saved` when the edit version remains stable, clears its standalone recovery draft, creates no `.ideanote/`, and remains idle until another persisted edit. Untitled documents remain dirty until explicit Save chooses a path. Read-only, missing, externally changed, conflicting, legacy-protected, and unsupported documents never auto-overwrite. The polling detector does not classify the application's own standalone save as an external change, but detects the next genuinely different disk modification. Workspace auto-save, manual Save/Save As, B014 stable-completion semantics, viewport/Page-selection non-saving behavior, and exit coordination remain intact.

## Task 1: Lock Standalone Auto-save and Protection Contracts

**Outcome:** Focused regressions prove that a saved-path standalone document is eligible for auto-save while untitled/protected documents and genuine external changes remain excluded.
**Files:**
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/autoSaveSignature.test.mjs`
- Modify: `tests/externalFileChanges.test.mjs`
- Create: `tests/standaloneAutoSave.test.mjs`

**Change Map:**
- editor eligibility: editable Workspace and standalone documents with real paths enable the shared auto-save hook; untitled and read-only/protected sessions do not
- persistence routing: standalone auto-save selects the standalone writer and rejects missing, read-only, changed, or unresolved targets before writing
- polling boundary: an in-flight or matching completed application write is ignored, while a later different modification remains externally visible
- completion lifecycle: a stable standalone write supplies its returned source modification to the existing saved/recovery cleanup callback

**Verification:**
- `node --test tests/ideaSketchEditor.test.mjs tests/autoSaveSignature.test.mjs tests/externalFileChanges.test.mjs tests/standaloneAutoSave.test.mjs`
- Cases: existing standalone edit; untitled edit; read-only/conflict/missing target; self-write inspection during/after save; later external write; edit during in-flight auto-save.

- [ ] Add a focused failing behavior contract for existing standalone auto-save and application-owned polling suppression.
- [ ] Confirm the baseline fails because both editor eligibility and persistence routing are Workspace-only.

## Task 2: Route Standalone Documents Through Safe Auto-save

**Outcome:** Existing writable standalone files use the shared debounce/completion lifecycle and the existing safe standalone persistence adapter without false external-change conflicts.
**Files:**
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/lib/externalFileChanges.ts`

**Change Map:**
- `IdeaSketchEditor`: replace the Workspace mode gate with saved-target/editable eligibility while retaining read-only and status checks
- `EditorLayout.handleAutoSave`: inspect the current target, branch only at the persistence adapter, write standalone models with `saveStandaloneDocument`, publish the returned source modification, and preserve Workspace metadata behavior
- standalone save boundary: share application-owned write tracking between manual and automatic standalone writes
- standalone inspection poll: ignore only an in-flight write or the exact returned post-write modification stamp; continue classifying later missing/read-only/different modifications normally
- failure behavior: rejected/failed auto-saves remain dirty, retain recovery, and do not call the completion path

**Verification:**
- Run the focused Task 1 suite.
- Cases: one stable edit produces one write and reaches Saved; recovery clears only after stable completion; a concurrent real edit invalidates the older completion; own-write polling does not conflict; later external replacement does.

- [ ] Implement the smallest adapter and polling-boundary changes without duplicating the editor or serializer.
- [ ] Verify manual standalone Save/Save As and Workspace auto-save still use their established paths.

## Task 3: Align the Approved Policy and Deliver B015

**Outcome:** The PRD, request, plan, generated index, and verification evidence describe one consistent protected auto-save policy for Single File Mode.
**Files:**
- Modify: `docs/superplan/human/prd.md`
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B015-enable-standalone-autosave.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- Single File Mode save policy: existing writable files auto-save after debounce; untitled and protected targets still require explicit action
- B015 request/plan: completion status plus focused/full/native evidence
- generated plan index: refreshed B015 state

**Verification:**
- `node --test tests/ideaSketchEditor.test.mjs tests/autoSaveSignature.test.mjs tests/editorSession.test.mjs tests/externalFileChanges.test.mjs tests/recovery.test.mjs tests/standaloneAutoSave.test.mjs`
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Native Single File acceptance: open an existing writable `.is`, make one persisted edit, confirm one debounced archive update, `Saved`, and recovery deletion; wait idle and confirm stable mtime; make another edit and confirm one further save; verify no `.ideanote/`; verify untitled, external-change, read-only, and Save As paths remain protected.

- [ ] Run focused checks while implementing and the full frontend/build/native matrix once the code stabilizes.
- [ ] Review the final diff, complete B015, refresh progress, and create a separate `fix(B015)` commit.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/04-ideasketch-editor-integration.md`
- `docs/superplan/plans/05-workspace-reliability-and-recovery.md`
- `docs/superplan/plans/bugs/B007-prevent-false-conflicts-after-autosave.md`
- `docs/superplan/plans/bugs/B008-suppress-workspace-self-write-event-bursts.md`
- `docs/superplan/plans/bugs/B011-fix-untitled-save-and-window-close.md`
- `docs/superplan/plans/bugs/B014-fix-workspace-autosave-completion-loop.md`
- `src/hooks/useAutoSave.ts`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/EditorLayout.tsx`
- `src/lib/externalFileChanges.ts`
- `src/lib/tauriCommands.ts`
