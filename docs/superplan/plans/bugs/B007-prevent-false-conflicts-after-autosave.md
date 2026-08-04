---
id: "B007"
title: "Keep Viewport Changes from Triggering Document Saves"
type: "bugfix"
status: "complete"
summary: "Treat zoom and pan as non-dirty editor state while retaining best-effort Page selection state."
source: "docs/superplan/human/bugs.md"
created: "2026-08-04"
order: 7
depends_on: ["04"]
parent: ""
---

# Keep Viewport Changes from Triggering Document Saves Plan

**Goal:** Make viewport navigation feel local and consequence-free while retaining the selected Page as lightweight editor/session context.
**Scope:** Exclude zoom and pan from the change summary that marks an `.is` document dirty or schedules Workspace autosave. Continue allowing viewport fields to be serialized opportunistically when a real document change is saved, so this fix changes save triggering rather than the file-format shape. Preserve Page selection through the existing `DocumentSession.editorState` path without marking the model dirty or forcing a document save.
**Non-Goals:** This fix does not remove Workspace autosave for real content changes, redesign watcher self-write suppression, guarantee Page selection survives every process restart, change Page add/rename/reorder/delete persistence, alter `.is v1` compatibility, or change conflict handling for genuine filesystem modifications.
**Architecture:** Separate the app-state fields that may be included in a saved Page snapshot from the smaller set that is allowed to trigger persistence. Scene content plus meaningful document app state such as canvas background/grid remain dirty-producing; viewport (`scrollX`, `scrollY`, `zoom`) and other transient Excalidraw UI state remain live in the editor draft but cannot create a commit by themselves. Page selection continues through `onEditorStateChange` and `SET_DOCUMENT_EDITOR_STATE`, independent of model dirty state.
**Baseline:** `PERSISTED_APP_STATE_KEYS` contains `scrollX`, `scrollY`, and `zoom`, and `createDraftChangeSummary` compares that full serialized set. Excalidraw emits `onChange` for viewport navigation, so a zoom-only draft reports `contentChanged: false`, `appStateChanged: true`, and `hasPersistedChange: true`; `useEditorSession` then calls `onDirty` and schedules Workspace autosave. Page selection already calls `applyAction(..., false)` and records `activePageId` through `SET_DOCUMENT_EDITOR_STATE` without updating the document model.
**Reproduction:** Open a writable Workspace `.is`, zoom or pan without changing elements, and observe the title switch to unsaved state; after the debounce, document autosave runs and may lead to the reported conflict banner. The pure change-summary reproduction currently returns `hasPersistedChange: true` for only a zoom-value change.
**Root Cause:** The editor uses one app-state whitelist for two different policies: what may be serialized and what should make the document dirty. Because viewport fields are serializable, the change detector incorrectly treats navigation as a document edit and starts the full dirty/autosave/conflict pipeline.
**Exit Criteria:** Zooming or panning alone leaves document dirty state and revision unchanged, creates no editor commit, and does not schedule Workspace autosave or recovery. A subsequent real scene/background/grid change still enters the established save path and may include the latest viewport opportunistically. Selecting another Page updates the current session's `activePageId` without marking the `.is` model dirty or requiring an immediate document save. Focused editor-session/store regressions, the full frontend suite, production build, diff checks, and native viewport/Page-selection acceptance pass. The independently reproduced Workspace watcher self-write conflict for real autosaves is tracked as B008 and remains outside this plan's approved scope.

## Task 1: Separate Viewport Serialization from Save Triggers

**Outcome:** Zoom and pan remain available in the live draft but cannot produce a dirty document or commit on their own.
**Files:**
- Modify: `src/lib/editorSession.ts`
- Modify: `tests/editorSession.test.mjs`

**Change Map:**
- editor app-state policy: retain the serialized Page snapshot keys while defining a narrower dirty-trigger projection
- `createDraftChangeSummary`: ignore `scrollX`, `scrollY`, and `zoom` when deciding `appStateChanged`/`hasPersistedChange`
- commit behavior: viewport-only drafts return no payload; real content or meaningful app-state changes may still carry the current viewport in their saved snapshot
- editor-session regressions: viewport-only change, selection-only noise, meaningful app-state change, and content change with opportunistic viewport inclusion

**Verification:**
- `node --test tests/editorSession.test.mjs`
- Cases: zoom-only and pan-only summaries have no persisted change; viewport-only commit is null; background/grid changes remain save-producing; a scene edit persists the current viewport without viewport itself causing the save.

- [x] Replace the viewport-only persistence expectation with a focused failing no-dirty/no-commit regression.
- [x] Introduce separate serialization and dirty-trigger app-state projections with the smallest editor-session change.

## Task 2: Lock Best-effort Page Selection Recording

**Outcome:** Selecting a Page remains recorded as editor/session state without turning the document into an unsaved content edit.
**Files:**
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/appStoreReducer.test.mjs`

**Change Map:**
- `IdeaSketchEditor` contract: Page selection flushes pending real edits, uses `persistModel = false`, and reports the selected Page through `onEditorStateChange`
- `appStoreReducer` contract: `SET_DOCUMENT_EDITOR_STATE` updates `activePageId` without changing `model`, `isDirty`, or `revision`

**Verification:**
- `node --test tests/ideaSketchEditor.test.mjs tests/appStoreReducer.test.mjs`
- Cases: Page selection is recorded in the active session; no document dirty/revision change is produced; existing Page content persistence behavior remains unchanged.

- [x] Add focused contracts for best-effort selected-Page recording and non-dirty reducer behavior.
- [x] Preserve the existing selection path unless the regression exposes a missing boundary.

## Task 3: Verify and Deliver B007

**Outcome:** Viewport navigation no longer enters the save/conflict pipeline, while real edits and Page context keep their established behavior.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/bugs/B007-prevent-false-conflicts-after-autosave.md`

**Change Map:**
- B007 artifacts: completion status and current focused/full/native evidence
- generated plan index: refreshed B007 state

**Verification:**
- `node --test tests/editorSession.test.mjs tests/ideaSketchEditor.test.mjs tests/appStoreReducer.test.mjs tests/autoSaveSignature.test.mjs`
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Native Tauri acceptance: after isolating the independently reproduced B008 watcher conflict, reload a clean Workspace `.is`, zoom and pan without editing elements, wait beyond the autosave debounce, and confirm the title stays saved and no conflict notice appears; select another Page and confirm the selection is retained during the session without dirtying the file.

- [x] Run focused checks while implementing and the complete regression/build matrix once code stabilizes.
- [x] Complete native viewport/Page-selection acceptance, record the separate real-autosave watcher defect as B008, mark B007 done, refresh the plan index, and create the separate `fix(B007)` commit.

## Completion Evidence

- The focused regression was captured failing before implementation because a zoom-only draft reported `hasPersistedChange: true`; after separating serialization keys from save-trigger keys, the focused editor-session/store suite passed 28/28.
- `node --test tests/*.test.mjs` passed 169/169 against the stabilized implementation.
- `npm run build` completed successfully; only the existing Excalidraw/Vite chunk-size warnings were emitted.
- `git diff --check` passed.
- Native acceptance used the dedicated `IdeaNote B007 Acceptance.app` and a disposable Workspace. After reloading past the independently reproduced B008 conflict, keyboard zoom, Hand-tool pan, and Page 1/Page 2 selection each remained `Saved` beyond the autosave debounce with no new conflict notice.
- A real Page mutation reproduced a conflict independently of viewport interaction; B008 records the watcher self-write suppression defect rather than widening B007.

## References
- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/04-ideasketch-editor-integration.md`
- `src/components/IdeaSketchEditor.tsx`
- `src/lib/editorSession.ts`
- `src/lib/appStoreReducer.ts`
- `tests/editorSession.test.mjs`
- `tests/ideaSketchEditor.test.mjs`
- `tests/appStoreReducer.test.mjs`
- `docs/superplan/human/bugs.md#b008-workspace-autosave-self-write-events-cause-false-conflicts`
