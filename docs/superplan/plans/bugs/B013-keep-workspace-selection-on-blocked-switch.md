---
id: "B013"
title: "Keep Workspace Selection on the Active File When Switching Is Blocked"
type: "bugfix"
status: "complete"
summary: "Update Workspace file selection only after the save-gated document switch succeeds."
source: "docs/superplan/human/bugs.md"
created: "2026-08-04"
order: 13
depends_on: ["B012"]
parent: ""
---

# Keep Workspace Selection on the Active File When Switching Is Blocked Plan

**Goal:** Keep the Workspace Explorer and foreground editor aligned when a file switch is rejected by save, conflict, read-only, or cancellation boundaries.
**Scope:** Treat a Workspace file click as one save-gated transition: selecting a different file updates `selectedPath` only after the active document can be saved and the target is accepted for activation. A blocked transition keeps both the active editor and file selection on the original document. Clicking the already active file restores its selection without saving or reopening it. Directory selection, create-target selection, rename/move behavior, drag-and-drop, active/protected status indicators, and successful file switching remain unchanged.
**Non-Goals:** This bugfix does not merge Explorer selection with document-session identity globally, remove independent directory selection, change Workspace autosave or save dialogs, alter conflict/recovery policies, redesign row styling, change file creation, or modify `.is` persistence.
**Architecture:** `EditorLayout.openEntry` owns the transactional file-open boundary. It will dispatch `SELECT_WORKSPACE_PATH` only for an already active file or after `prepareActiveDocumentTransition` succeeds, immediately before activating the target document. `WorkspaceResourceRow` will continue selecting directories directly, but file clicks and Enter activation will delegate to `onOpen` without preselecting the target. This preserves Explorer selection as navigation state while ensuring file selection cannot get ahead of the authoritative editor transition.
**Baseline:** B012 correctly prevents `OPEN_DOCUMENT` when the active dirty document cannot be saved. However, `WorkspaceResourceRow` currently calls `onSelect()` synchronously and then calls the async `onOpen()` for files. `EditorLayout.openEntry` can stop after `prepareActiveDocumentTransition()` returns `false`, but the earlier `SELECT_WORKSPACE_PATH` dispatch has already selected the destination row.
**Reproduction:** Open a Workspace with editable files A and B, make B dirty, then externally modify B so it enters conflict. Click A. The save boundary shows `Resolve File Change` and the title/editor remain on B, while the Explorer marks A selected.
**Root Cause:** File-row selection and activation are split across two owners in the wrong order. The row commits destination selection before `EditorLayout` knows whether the save-gated activation may proceed, so a rejected asynchronous transition leaves a non-transactional selection side effect behind.
**Exit Criteria:** A failed or cancelled switch leaves the original file selected and active. A successful switch updates selection and editor to the same target. Clicking the already active file selects it without a save or activation. Directory clicks still select directories without opening files. Keyboard Enter follows the same file transition policy. Focused regressions, the full frontend suite, production build, diff checks, and native conflict-switch acceptance pass.

## Task 1: Lock the Transactional Selection Contract

**Outcome:** Focused regressions fail if a file row preselects its target or if `EditorLayout` changes file selection before the save gate succeeds.
**Files:**
- Modify: `tests/unsavedChanges.test.mjs`
- Modify: `tests/workspaceExplorerWiring.test.mjs`

**Change Map:**
- blocked transition wiring: target selection occurs after `prepareActiveDocumentTransition()` and before `activateWorkspaceEntry(entry)`
- active-file behavior: reselect the current active path without entering the save gate
- row interaction: directory clicks call `onSelect`; file clicks and Enter delegate to `onOpen` without an eager selection side effect

**Verification:**
- `node --test tests/unsavedChanges.test.mjs tests/workspaceExplorerWiring.test.mjs`

- [x] Add focused failing wiring regressions for blocked, successful, current-file, pointer, and keyboard selection ordering.
- [x] Confirm the current implementation fails because file rows call `onSelect()` before `onOpen()`.

## Task 2: Commit File Selection Only After Transition Success

**Outcome:** Workspace file selection and active document identity change together, while independent directory selection and existing Explorer operations remain intact.
**Files:**
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/WorkspaceResourceRow.tsx`
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B013-keep-workspace-selection-on-blocked-switch.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- `EditorLayout.openEntry`: reselect the active path directly; otherwise await the active-document save gate, then select and activate the destination
- `WorkspaceResourceRow`: select directories locally; route file pointer and keyboard activation exclusively through the transactional open callback
- B013 progress: record focused/full/build/native evidence and complete the accepted request after delivery

**Verification:**
- `node --test tests/unsavedChanges.test.mjs tests/workspaceExplorerWiring.test.mjs`
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Native Tauri acceptance using a current-project isolated bundle: dirty conflicted B → click A keeps B selected and active; resolving the conflict then clicking A updates both; directory selection still works.

- [x] Implement the smallest selection-order change without weakening B012 save gating or Workspace navigation behavior.
- [x] Run focused and full verification, review the final diff, complete B013, and create a separate `fix(B013)` commit.

## Completion Evidence

- Test-first focused regressions failed two selection-order cases: file rows selected the destination before invoking the async open callback, and `EditorLayout.openEntry` selected the target before the active-document transition gate could reject it.
- Workspace file pointer and Enter activation now delegate only to `onOpen`; directory rows retain their independent `onSelect` behavior.
- `EditorLayout.openEntry` reselects an already active file without saving or reopening it. For a different file, it awaits `prepareActiveDocumentTransition()`, then selects and activates the target only after the gate succeeds.
- `node --test tests/unsavedChanges.test.mjs tests/workspaceExplorerWiring.test.mjs` passed all 7 focused tests; `node --test tests/*.test.mjs` passed all 184 frontend tests.
- `npm run build` passed; Vite emitted only the existing Excalidraw mixed-import and large-chunk warnings.
- Native acceptance passed with the current-project bundle `IdeaNote B013 Current.app`: dirty conflicted B remained titled and selected after clicking A and dismissing `Resolve File Change`; after Reload, clicking A updated both the editor title and Explorer selection; selecting `Folder` changed only Explorer navigation and left A active.

## References
- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/06-single-active-editor.md`
- `docs/superplan/plans/bugs/B012-save-active-document-before-switching.md`
- `src/components/EditorLayout.tsx`
- `src/components/WorkspaceExplorer.tsx`
- `src/components/WorkspaceResourceRow.tsx`
- `tests/unsavedChanges.test.mjs`
- `tests/workspaceExplorerWiring.test.mjs`
