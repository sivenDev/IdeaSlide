---
id: "B011"
title: "Fix Untitled Save and Window Close Coordination"
type: "bugfix"
status: "complete"
summary: "Route a single unsaved untitled document through Save As without a false Save All error and make native window close await the same visible exit decision."
source: "docs/superplan/human/bugs.md"
created: "2026-08-04"
order: 11
depends_on: ["06"]
parent: ""
---

# Fix Untitled Save and Window Close Coordination Plan

**Goal:** Make leaving an unsaved untitled IdeaSketch document save, cancel, discard, and close predictably without misleading failure alerts or silent native-close interception.
**Scope:** Separate the single-dirty-document exit path from bulk Save All reporting. When Home or native close is confirmed with one dirty untitled document, call the existing document save boundary directly so its empty path opens Save As; continue only after that save succeeds. Treat a cancelled Save As as cancellation rather than a `Save All` failure, keep the editor/window open, and retain the specific `Save Error` feedback for real persistence errors. Preserve per-file Save All aggregation and its summary only for multiple dirty documents. Rewrite the Tauri close-request handler as an awaited handler that follows the documented lifecycle: await the exit decision, prevent the native close only when the decision is cancelled/failed, exit the application only after success/discard, reset the re-entry guard in every non-exit path, and surface coordination exceptions instead of logging them only to the console.
**Non-Goals:** This bugfix does not change `.is` serialization, Save As file filters or default names, autosave, recovery-draft locations, Workspace save behavior, external-change protection, the visible toolbar, the two-step Save/Discard/Cancel wording, application window configuration, or multi-document Save All failure isolation.
**Architecture:** `saveCoordinator` will expose one pure exit-save coordinator that distinguishes the single-document path from a true batch while reusing the existing `saveAllDocuments` implementation for multiple dirty documents. `EditorLayout` remains the owner of native dialogs and document persistence: it supplies `saveDocument`, shows the batch summary only when the coordinator reports a multi-document failure, and uses the same `confirmSessionExit` result for Home, file replacement, Workspace replacement, and native close. The close listener will use Tauri's awaitable `onCloseRequested` contract instead of eagerly cancelling the event before the dialog chain runs.
**Baseline:** `confirmSessionExit` always calls `handleSaveAll()` after the user presses Save, even when exactly one dirty untitled document exists. `handleSaveAll` converts any `false` save result—including an uncompleted Save As—into the screenshot's `Some files could not be saved: Untitled.is` warning. The window-close listener immediately calls `event.preventDefault()`, then runs the same exit decision in a detached promise chain; coordination errors are console-only, so a failed dialog/close path leaves the window open with no user-facing feedback.
**Reproduction:** Create a new untitled `.is` document, make an edit, click Home, choose Save in the unsaved-changes prompt, and observe the `Save All` failure alert for `Untitled.is` instead of a successful Save As/return flow. In a fresh dirty untitled document, click the macOS close control and observe that the window remains open without a visible unsaved-changes decision or error.
**Root Cause:** The exit coordinator conflates a single-document save with the multi-document Save All operation, so the boolean `false` used for an untitled Save As cancellation/failure is reclassified as a bulk-save error. Independently, the native close listener prevents the close before awaiting its asynchronous decision and hides exceptions in the console, contrary to the Tauri handler's awaitable prevent-on-cancel lifecycle. Both symptoms originate in `EditorLayout` exit orchestration rather than the file-format writer.
**Exit Criteria:** With one dirty untitled document, Home and native close show the unsaved-changes choice; Save opens the existing `.is` Save As flow and continues only after a successful write. Cancelling Save As leaves the document/window open without a `Save All` warning; a real write failure leaves it open with the existing specific Save Error. Discard continues Home/close and Cancel remains in the editor. Multiple dirty documents retain Save All aggregation and the per-file failure summary. Native close no longer eagerly prevents the event, prevents only cancelled/failed decisions, resets its guard after non-exit outcomes, and displays a close-coordination error if the handler itself fails. Focused behavior regressions, full frontend tests, production build, diff checks, and native Home/window-close acceptance pass.

## Task 1: Reproduce the Exit-save Contract in Tests

**Outcome:** A focused failing regression distinguishes single untitled saves, Save As cancellation, true Save All batches, and the native close lifecycle.
**Files:**
- Modify: `tests/saveAll.test.mjs`
- Modify: `tests/recovery.test.mjs`

**Change Map:**
- exit-save behavior: one dirty document invokes the direct save result without bulk-failure presentation; multiple dirty documents retain isolated batch results
- cancellation behavior: a single `false` result blocks exit without becoming a `Save All` warning
- native close contract: await `confirmSessionExit`, call `preventDefault` only on a non-exit result/error, reset `closeInProgress`, and surface coordination errors

**Verification:**
- `node --test tests/saveAll.test.mjs tests/recovery.test.mjs`

- [x] Add focused regressions for single untitled Save, cancellation, multi-document failure reporting, and close-event ordering.
- [x] Confirm the current implementation fails specifically because it always uses `handleSaveAll` and eagerly prevents native close.

## Task 2: Separate Single Save from Save All and Repair Native Close

**Outcome:** Home and window close share one reliable unsaved-exit decision without masking Save As cancellation or suppressing close feedback.
**Files:**
- Modify: `src/lib/saveCoordinator.ts`
- Modify: `src/components/EditorLayout.tsx`

**Change Map:**
- `saveCoordinator`: add a pure dirty-exit save result that identifies single versus batch execution while preserving `saveAllDocuments` behavior
- `confirmSessionExit`: use the direct single-document result, show `Save All` failures only for a real batch, and continue navigation only on success/discard
- Tauri close listener: use an async awaited callback, prevent only cancelled/failed close, keep the re-entry guard consistent, call `exitApplication` only after confirmation, and show a user-facing coordination error on unexpected exceptions

**Verification:**
- Run the focused Task 1 suite.
- Cases: untitled Save As success/cancel/failure; saved standalone document; two dirty documents with one failure; Home, Open File, Open Workspace, system file-open, and native close all honor the same boolean exit boundary.

- [x] Implement the smallest coordinator change without altering the save writer or dialog copy.
- [x] Repair the native close lifecycle and retain multi-document failure isolation.

## Task 3: Verify and Deliver B011

**Outcome:** The unsaved-exit repair ships with current regression, build, native interaction, and progress evidence.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B011-fix-untitled-save-and-window-close.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- B011 request/plan: completion state and focused/full/native evidence
- generated plan index: refreshed B011 status

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Native Tauri acceptance: untitled Home Save/Save As success, Save As cancel, Discard, Cancel, native close Save/Discard/Cancel, and a normal saved-file close.

- [x] Run focused and full verification once implementation stabilizes.
- [x] Review the final diff, complete B011, refresh progress, and create a separate `fix(B011)` commit.

## Completion Evidence

- Test-first regressions failed on the missing single-document exit coordinator and the non-awaited close handler, then passed after implementation.
- A single dirty untitled document now invokes the existing direct save boundary once; a cancelled Save As returns `false`, keeps the editor open, and does not produce a `Save All` warning.
- Multiple dirty documents still run isolated saves and report only their failed file results through the existing `Save All` warning.
- Native close now awaits `confirmSessionExit`, prevents close for re-entry/cancel/error outcomes, resets the guard after every non-exit outcome, and shows a `Close Error` message for unexpected coordination failures.
- `node --test tests/saveAll.test.mjs tests/recovery.test.mjs` passed all 7 focused tests; `node --test tests/*.test.mjs` passed all 184 frontend tests.
- `npm run build` and `git diff --check` passed; Vite emitted only the existing Excalidraw mixed-import and large-chunk warnings.
- Automated native UI acceptance could not run because the Computer Use transport returned `Transport closed`; the native lifecycle is covered by the focused source contract and successful TypeScript production build.

## References
- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/05-workspace-reliability-and-recovery.md`
- `docs/superplan/plans/06-single-active-editor.md`
- `docs/superplan/plans/features/F010-clarify-save-and-workspace-actions.md`
- `src/components/EditorLayout.tsx`
- `src/lib/saveCoordinator.ts`
- `src/lib/tauriCommands.ts`
- `tests/saveAll.test.mjs`
- `tests/recovery.test.mjs`
