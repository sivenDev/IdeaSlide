---
id: "B012"
title: "Save the Active Document Before Switching Files"
type: "bugfix"
status: "complete"
summary: "Automatically save the one active dirty document before Workspace switching or creation and remove the obsolete Save All path."
source: "docs/superplan/human/bugs.md"
created: "2026-08-04"
order: 12
depends_on: ["06", "B011"]
parent: ""
---

# Save the Active Document Before Switching Files Plan

**Goal:** Make the single-editor Workspace persist the current dirty file before changing document identity, so hidden dirty sessions and Save All errors cannot accumulate.
**Scope:** When a different Workspace file is opened or a new Workspace file is requested, first flush the active IdeaSketch snapshot and directly run the existing save boundary for that active document. Continue only after the save succeeds. A cancelled Save As, conflict/read-only refusal, or write failure keeps the current file active; new-file creation must not call the backend until the current save succeeds. Selecting the already active path and switching from a clean document remain immediate. Remove Save All from keyboard shortcuts and session-exit coordination. If a legacy in-memory state already contains multiple dirty documents, Home and native close resolve them sequentially with individual Save/Discard/Cancel decisions, active document first, without a bulk label or failure summary.
**Non-Goals:** This bugfix does not change `.is` serialization, Workspace autosave timing, Save/Save As commands, file filters or default names, recovery storage, external-change overwrite protection, Workspace file creation format, reducer protection for conflict/missing/read-only sessions, tree selection/expansion, native window-close lifecycle, or the two-step individual Save/Discard/Cancel wording used when leaving the application.
**Architecture:** Replace `saveCoordinator` and its batch result model with a small `unsavedChanges` boundary for two single-document policies: direct save-before-transition and active-first sequential exit resolution. `EditorLayout` remains the owner of dialogs and persistence. Its Workspace open callback becomes async and saves the active dirty document before dispatching `OPEN_DOCUMENT`; its create callback saves before calling `createWorkspaceDocument`. `WorkspaceExplorer` accepts a cancelled creation result without entering rename mode. Session exit calls the same per-document save function one file at a time and stops immediately on save failure or Cancel. The hidden Alt/Option Save All shortcut and every `Save All` label are removed.
**Baseline:** `openEntry` currently flushes the active snapshot and immediately dispatches `OPEN_DOCUMENT`; it never saves or asks the active document to resolve. The single-editor reducer deliberately retains dirty sessions as protected background state, so editing A and opening B leaves A dirty but hidden. `handleCreateDocument` creates the new file first and then calls the same unguarded open path. B011's exit coordinator therefore sees A and B together and falls back to the retained Save All aggregation, producing the reported `Some files could not be saved` alert. An undocumented Alt/Option+Save shortcut also still invokes Save All even though the visible toolbar removed that command.
**Reproduction:** Open a Workspace with A and B, edit A, then open B before A's autosave completes or after A remains dirty. Edit B or create another file, then choose Home. The application can report `Save All — Some files could not be saved: Untitled.is` because A was retained as a hidden dirty session. Creating a file while A is dirty also reaches the filesystem before A is resolved.
**Root Cause:** File activation is treated as a reducer-only identity change rather than a persistence transaction. The reducer correctly preserves an unresolved dirty session to avoid data loss, but `EditorLayout` never performs the required active-document save before dispatching that transition. This mismatch between the single-visible-editor UX and the retained multi-session safety kernel permits multiple dirty documents, which keeps the obsolete Save All branch reachable.
**Exit Criteria:** Editing A and opening B saves A exactly once before B becomes active. Save failure, Save As cancellation, external-change refusal, or read-only refusal leaves A active and does not open B. New-file creation does not invoke `createWorkspaceDocument` until A saves successfully, and a failed/cancelled save creates no file. Clean transitions and reselecting the active file do not issue redundant writes. Home and native close contain no Save All wording or aggregation; legacy multiple-dirty state is processed one file at a time, active first, and stops safely on failure or Cancel. No Save All shortcut, handler, coordinator module, alert, or production source literal remains. Focused behavior regressions, the full frontend suite, production build, diff checks, and native Workspace switching/creation acceptance pass.

## Task 1: Lock the Single-document Transition Contract

**Outcome:** Failing regressions prove active-document auto-save ordering, blocked transitions, sequential legacy exit handling, and the absence of Save All semantics.
**Files:**
- Create: `tests/unsavedChanges.test.mjs`
- Remove: `tests/saveAll.test.mjs`
- Modify: `tests/editorChromeNavigation.test.mjs`
- Modify: `tests/workspaceExplorerWiring.test.mjs`
- Modify: `tests/recovery.test.mjs`

**Change Map:**
- transition behavior: dirty active document saves once before a target action; clean documents bypass save; `false` blocks the target action
- exit behavior: dirty documents resolve sequentially with the active document first and stop on failure/cancellation rather than aggregating results
- source contract: Workspace open/create await the transition boundary; creation cancellation is representable; Save All handler, shortcut, labels, and coordinator imports are rejected
- close contract: retain the awaited native close lifecycle while switching its decision source to sequential per-file resolution

**Verification:**
- `node --test tests/unsavedChanges.test.mjs tests/editorChromeNavigation.test.mjs tests/workspaceExplorerWiring.test.mjs tests/recovery.test.mjs`

- [x] Add focused behavior and wiring regressions before changing production code.
- [x] Confirm the current implementation fails because open/create bypass saving and Save All remains reachable.

## Task 2: Save Before Transition and Remove Save All

**Outcome:** Every real Workspace document transition is gated by one direct active-document save, while application exit remains safe without any bulk operation.
**Files:**
- Create: `src/lib/unsavedChanges.ts`
- Remove: `src/lib/saveCoordinator.ts`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/WorkspaceExplorer.tsx`

**Change Map:**
- `unsavedChanges`: direct dirty-document save gate plus active-first sequential resolver with explicit proceed/discard/cancel results
- `EditorLayout.openEntry`: ignore the already active path; flush and save the active dirty document; dispatch the target only after success
- `EditorLayout.handleCreateDocument`: save first, create second, and return cancellation without filesystem mutation
- `EditorLayout.confirmSessionExit`: resolve each dirty document individually, clear recovery only for explicit discards, and preserve B011's awaited native-close/error lifecycle
- save shortcuts: retain Save and Save As capture; remove Alt/Option Save All and all batch warning presentation
- `WorkspaceExplorer`: do not start rename/expansion work when document creation was cancelled

**Verification:**
- Run the focused Task 1 suite.
- Cases: dirty A to B success/failure; clean A to B; active A reselected; dirty A then New File success/failure; untitled Save As cancellation; external-change/read-only refusal; legacy A+B dirty exit save/discard/cancel order; native close retry after a blocked outcome.

- [x] Implement the transition as save-then-act without weakening existing save/conflict/recovery boundaries.
- [x] Delete the obsolete Save All module and all reachable or hidden Save All behavior.

## Task 3: Verify and Deliver B012

**Outcome:** The single-editor save-before-switch policy ships with regression, build, interaction, and progress evidence.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B012-save-active-document-before-switching.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- B012 request/plan: completion status plus focused/full/native evidence
- generated plan index: refreshed B012 status

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Native Tauri acceptance: dirty A → B; dirty A → New File; save failure/cancel blocks the transition; Home and native close show only individual file decisions; normal clean switching remains immediate.

- [x] Run focused and full verification after implementation stabilizes.
- [x] Review the final diff, complete B012, refresh progress, and create a separate `fix(B012)` commit.

## Completion Evidence

- Test-first focused regressions failed because Workspace open/create bypassed active-document saving, the creation callback could not represent cancellation, and the hidden Save All shortcut/coordinator remained reachable.
- Dirty active documents now call the existing direct save boundary before a different Workspace file is activated or before `createWorkspaceDocument` runs; a `false` result blocks the transition and returns no created entry.
- Clean documents bypass the save gate, and selecting the already active Workspace path performs no redundant save or activation.
- Legacy multiple-dirty state is resolved sequentially with the active document first; the process stops on save failure or Cancel and records explicit discards for recovery cleanup only when the whole exit decision proceeds.
- The Save All handler, Alt/Option shortcut, bulk warning, `saveCoordinator.ts`, and its batch test were removed. Production `src/` contains no Save All or coordinator reference.
- `node --test tests/unsavedChanges.test.mjs tests/editorChromeNavigation.test.mjs tests/workspaceExplorerWiring.test.mjs tests/recovery.test.mjs` passed all 15 focused tests; `node --test tests/*.test.mjs` passed all 184 frontend tests.
- `npm run build` and `git diff --check` passed; Vite emitted only the existing Excalidraw mixed-import and large-chunk warnings.
- Automated native acceptance could not run: port 1420 was already owned by an existing Vite process, which was left untouched, and Computer Use returned `Transport closed`. Save ordering and cancellation are covered by behavior and source-order regressions plus the successful TypeScript build.

## References
- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/05-workspace-reliability-and-recovery.md`
- `docs/superplan/plans/06-single-active-editor.md`
- `docs/superplan/plans/features/F010-clarify-save-and-workspace-actions.md`
- `docs/superplan/plans/bugs/B011-fix-untitled-save-and-window-close.md`
- `src/components/EditorLayout.tsx`
- `src/components/WorkspaceExplorer.tsx`
- `src/lib/appStoreReducer.ts`
- `src/lib/saveCoordinator.ts`
- `tests/saveAll.test.mjs`
- `tests/editorChromeNavigation.test.mjs`
- `tests/workspaceExplorerWiring.test.mjs`
- `tests/recovery.test.mjs`
