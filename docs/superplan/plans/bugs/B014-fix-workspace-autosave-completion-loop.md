---
id: "B014"
title: "Finish Workspace Auto-save and Stop Repeat Writes"
type: "bugfix"
status: "complete"
summary: "Mark a stable Workspace autosave complete and stop persisted-equivalent Excalidraw updates from rescheduling the same write."
source: "docs/superplan/human/bugs.md"
created: "2026-08-05"
order: 14
depends_on: ["B007", "B008"]
parent: ""
---

# Finish Workspace Auto-save and Stop Repeat Writes Plan

**Goal:** Make a successful Workspace autosave settle into `Saved`, clear its recovery draft, and remain idle until another persisted document edit occurs.
**Scope:** Distinguish persisted draft changes from Excalidraw `onChange` emissions that are equivalent after normalization. Continue updating the live draft reference for every emission, but advance the edit version and schedule preview/autosave work only when the persisted projection changes between the previous and next draft. Preserve invalidation when a real edit or a revert occurs during an in-flight save. After a stable save, run the existing completion callback so dirty state and recovery are cleared and no identical archive write repeats.
**Non-Goals:** This bugfix does not change the two-second autosave debounce, enable autosave for Standalone or untitled documents, alter `.is v1` serialization, remove opportunistic viewport persistence during a real save, weaken B007 viewport filtering or B008 watcher self-write suppression, change manual Save/Save As, modify conflict/read-only policies, or redesign recovery storage.
**Architecture:** `useAutoSave` keeps its current safety rule: a save is complete only when the persisted edit version is unchanged across the async write. `useEditorSession` will make that version semantic by comparing the normalized persisted projection of the previous live draft with the next draft before incrementing it or scheduling `syncPreviewDraft`. Transient or identical emissions still refresh `draftRef` and pending-summary state, but cannot invalidate completion or create another autosave trigger. `createDraftChangeSummary` remains the shared persisted-projection boundary and accepts either a saved Page or a live draft snapshot for consecutive-draft comparison.
**Baseline:** `useAutoSave` captures `getEditVersion()` before writing and calls `onSaveComplete` only if that value still matches afterward. `useEditorSession.updateDraft` currently increments `editVersionRef` and starts the preview/autosave debounce for every Excalidraw `onChange`, even when `createDraftChangeSummary` reports no persisted delta. A post-save persisted-equivalent emission therefore invalidates the completion callback, leaves `isDirty` and recovery intact, increments `autoSaveVersion`, and schedules the same document again.
**Reproduction:** In the current-project native bundle, open a writable Workspace `.is`, add a Page, and wait beyond the autosave debounce. The archive gains the new Page on disk, but the toolbar remains `Unsaved changes` after eight seconds and the recovery file remains. With no further user input, the archive modification time changed again from `1785861157` to `1785861164`, proving that the unchanged document was written repeatedly.
**Root Cause:** The edit version used as the autosave completion guard tracks raw Excalidraw notification count rather than persisted draft identity. Persisted-equivalent notifications that arrive during or after the async save change the guard and create a fresh autosave revision, so the successful write can neither commit its `Saved` state nor terminate the save cycle.
**Exit Criteria:** Adding, renaming, reordering, deleting, or drawing real content in a writable Workspace `.is` performs one debounced save for the stable snapshot, changes the toolbar to `Saved`, clears the matching recovery draft, and leaves the archive modification time stable until another persisted edit. A real edit or revert during an in-flight save prevents the older snapshot from being marked complete and schedules the newest persisted state. Selection, zoom, pan, and persisted-equivalent Excalidraw emissions do not advance autosave. Manual save, save-gated file switching, conflict detection, and watcher self-write suppression remain intact. Focused regressions, the full frontend suite, production build, diff checks, and current-project native acceptance pass.

## Task 1: Lock Persisted-version Autosave Semantics

**Outcome:** Focused regressions distinguish real consecutive-draft changes and reverts from persisted-equivalent Excalidraw emissions, and fail if no-op emissions can advance the autosave completion guard.
**Files:**
- Modify: `tests/editorSession.test.mjs`

**Change Map:**
- persisted draft comparison: identical, selection-only, and viewport-only consecutive drafts report no persisted delta
- real edit lifecycle: scene/app-state changes and a revert to the saved projection count as new persisted versions
- hook wiring contract: `editVersionRef` and `syncPreviewDraft` scheduling are gated by the consecutive persisted-draft comparison rather than raw `onChange`

**Verification:**
- `node --test tests/editorSession.test.mjs`

- [x] Add focused failing regressions for persisted-equivalent notifications, real changes, and real reverts.
- [x] Confirm the current hook advances edit/autosave versions unconditionally after every `onChange`.

## Task 2: Advance Autosave Only for Persisted Draft Deltas

**Outcome:** Stable successful saves reach the existing completion callback, while real concurrent changes still invalidate stale saves safely.
**Files:**
- Modify: `src/lib/editorSession.ts`
- Modify: `src/hooks/useEditorSession.ts`

**Change Map:**
- `createDraftChangeSummary`: accept saved Page or live draft projections as the previous persisted snapshot
- `useEditorSession.updateDraft`: compare the previous live draft with the next draft before replacement; always retain the latest draft and pending state, but increment `editVersionRef` and schedule `syncPreviewDraft` only for a persisted delta
- in-flight behavior: a real change or revert advances the version; transient/no-op emissions leave the version stable so `useAutoSave` may commit completion

**Verification:**
- Run the focused Task 1 test.
- Cases: Page add settles to Saved; post-save no-op notification does not reschedule; editing during an in-flight save preserves dirty state for the newer snapshot; reverting during an in-flight save still invalidates the older write.

- [x] Implement the smallest persisted-version boundary without changing autosave debounce or save/conflict policy.
- [x] Verify stable completion, recovery cleanup, and real-concurrent-edit invalidation.

## Task 3: Verify and Deliver B014

**Outcome:** Workspace autosave completion ships with focused, regression, build, native, and progress evidence.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B014-fix-workspace-autosave-completion-loop.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- B014 request and plan: completion status plus focused/full/native evidence
- generated plan index: refreshed B014 state

**Verification:**
- `node --test tests/editorSession.test.mjs`
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Current-project native acceptance: add a Page and wait beyond debounce; confirm one archive update, `Saved`, and recovery deletion; wait again with no input and confirm stable mtime; perform a second real edit and confirm exactly one new save; zoom/pan and Page selection remain non-saving; normal file switching remains aligned.

- [x] Run focused and full verification after implementation stabilizes.
- [x] Review the final diff, complete B014, refresh progress, and create a separate `fix(B014)` commit.

## Completion Evidence

- Test-first regression: the new focused hook contract failed against the baseline because `editVersionRef` and preview/autosave scheduling were still unconditional for every Excalidraw `onChange`.
- Focused verification: `node --test tests/editorSession.test.mjs` passed 15/15; the related editor-session/autosave regression set passed 28/28.
- Full verification: `node --test tests/*.test.mjs` passed 186/186, and `npm run build` passed with only the pre-existing Excalidraw mixed-import and chunk-size warnings.
- Current-project native bundle: `src-tauri/target/debug/bundle/macos/IdeaNote B014 Current.app` (`com.zhengxiwan.ideanote.b014current`) was built from this worktree and tested against `/tmp/ideanote-b014-native.b6kgc2`.
- Native stable completion: the first Page addition changed `A.is` from mtime `1785862357` to `1785862434`, reached `Saved`, and removed the recovery draft. A second Page addition changed mtime once to `1785862562`, reached `Saved`, left recovery empty, and remained at `1785862562` through a further six-second idle interval.
- Native non-saving paths: selecting another Page and zooming the canvas to 110% left `A.is` at mtime `1785862562` and the toolbar at `Saved`; the focused persisted-projection regression also covers scroll/pan app-state noise. Switching normally to `B.is` updated the active title/Explorer state without a save prompt and left `A.is` unchanged.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/04-ideasketch-editor-integration.md`
- `docs/superplan/plans/05-workspace-reliability-and-recovery.md`
- `docs/superplan/plans/bugs/B007-prevent-false-conflicts-after-autosave.md`
- `docs/superplan/plans/bugs/B008-suppress-workspace-self-write-event-bursts.md`
- `docs/superplan/plans/bugs/B012-save-active-document-before-switching.md`
- `src/hooks/useAutoSave.ts`
- `src/hooks/useEditorSession.ts`
- `src/lib/editorSession.ts`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/EditorLayout.tsx`
- `tests/editorSession.test.mjs`
