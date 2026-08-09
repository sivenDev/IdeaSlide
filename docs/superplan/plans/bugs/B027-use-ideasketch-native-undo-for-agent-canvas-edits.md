---
id: "B027"
title: "Use IdeaSketch Native Undo for Agent Canvas Edits"
type: "bugfix"
status: "complete"
summary: "Route Agent canvas replacement through the mounted Excalidraw SDK and remove the separate Agent-only Undo/Redo stack and controls."
source: "docs/superplan/human/bugs.md"
created: "2026-08-09"
order: 27
depends_on: ["F036", "B026"]
parent: ""
---

# Use IdeaSketch Native Undo for Agent Canvas Edits Plan

**Goal:** Make Agent canvas edits behave exactly like normal IdeaSketch edits by entering Excalidraw's native history and persistence pipeline.
**Scope:** Route `replace_page_elements` for the active mounted Page through the IdeaSketch frontend SDK using one captured Excalidraw scene update; let Excalidraw `onChange` update the document model, dirty state, recovery, and autosave; remove the generic Agent binding's Undo/Redo contract, the IdeaSketch Agent snapshot stack, application toolbar Agent Undo/Redo controls, and Agent-specific keyboard interception; reject non-mounted Page replacement rather than silently bypassing native history; and keep Page add/delete/reorder as explicit document-structure mutations without claiming Excalidraw-native Undo support.
**Non-Goals:** This fix does not add a document-wide Page history system, make Page add/delete/reorder undoable through Excalidraw, write `.is` archives directly, weaken stale/read-only/external-change/cancellation validation, remove direct Agent application, add new Tool operations, or move IdeaSketch-specific SDK code into the generic Agent runtime.
**Architecture:** The generic Agent runtime continues to produce and validate typed Change Sets, but editor history is no longer part of `ActiveAgentEditorBinding`. `IdeaSketchEditor` applies an active-Page element replacement through the mounted Excalidraw imperative API with `CaptureUpdateAction.IMMEDIATELY`; the existing `SlideCanvas` `onChange` and editor-session pipeline become the only path from that scene transaction into the document model and persistence. Page-structure operations remain reducer-owned and truthfully expose no Agent-specific recovery control. A replacement targeting a Page that is not the active mounted Canvas fails closed so the implementation never falls back to model-first scene mutation while implying native Undo support.
**Baseline:** F036 and B026 apply every Agent mutation by first updating `IdeaSketchEditor` document state. Same-Page replacement then calls `syncMountedCanvasToPage`, which uses `CaptureUpdateAction.NEVER`, so Excalidraw does not record the operation in its native history. `IdeaSketchEditor` compensates with `agentHistoryRef`, generic binding `undo`/`redo`/`canUndo`/`canRedo` members, application toolbar buttons, and keyboard routing that are separate from the editor's own history.
**Reproduction:** Open a saved one-Page `.is`, create a clean Agent Thread, and run one `replace_page_elements` request. The rectangle appears and the application-level `Undo Agent edit` button becomes enabled, while the replacement was synchronized with `CaptureUpdateAction.NEVER`. Undo succeeds only through the custom Agent snapshot stack rather than the IdeaSketch/Excalidraw Undo control, proving the operation bypassed native editor history.
**Root Cause:** The direct-apply implementation treated all IdeaSketch mutations, including current-Canvas element changes, as document-model transactions so Page-structure operations could share one custom history mechanism. That model-first boundary updates Excalidraw only as a non-captured synchronization step, preventing the editor SDK from observing the Agent action as a native edit and requiring a second, misleading Undo/Redo system.
**Exit Criteria:** One Agent `replace_page_elements` request for the active Page performs exactly one `CaptureUpdateAction.IMMEDIATELY` SDK transaction, appears immediately, persists only through the normal editor pipeline, and can be undone/redone with IdeaSketch's existing Excalidraw controls. No `Undo Agent edit` or `Redo Agent edit` controls, generic binding history members, custom Agent snapshot stack, or Agent-specific history shortcuts remain. Non-active Page replacement fails without model, canvas, or file mutation. Page add/delete/reorder remain available but do not advertise canvas Undo. Stale, switched, read-only, externally changed, and cancelled mutations continue to fail closed. Focused regressions, the full frontend/Rust suites, strict build, debug package, native saved-file verification, and final diff checks pass.

## Task 1: Lock the Native Editor Transaction Boundary

**Outcome:** Focused regressions fail unless Agent canvas replacement enters Excalidraw native history and the custom Agent history surface is absent.
**Files:**
- Modify: `tests/agentDirectEditorContract.test.mjs`
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/ideaSketchAgentExtension.test.mjs`
- Modify: `tests/agentChangeSet.test.mjs`
- Modify: `tests/agentPanel.test.mjs`
- Modify: `tests/agentShellLayout.test.mjs`
- Modify: `tests/agentSecondEditorReuse.test.mjs`

**Change Map:**
- active Canvas transaction: require restored replacement elements to reach the mounted Excalidraw API with `CaptureUpdateAction.IMMEDIATELY`
- model ordering: forbid current-Page replacement from calling the reducer/model synchronization path before the SDK transaction
- truthful boundary: reject non-mounted replacement and keep Page-structure operations outside canvas-history claims
- removed history surface: forbid Agent-specific binding history members, toolbar buttons, keyboard routing, and welcome copy that promises universal Undo

**Verification:**
- `node --test tests/agentDirectEditorContract.test.mjs tests/ideaSketchEditor.test.mjs tests/ideaSketchAgentExtension.test.mjs tests/agentChangeSet.test.mjs tests/agentPanel.test.mjs tests/agentShellLayout.test.mjs tests/agentSecondEditorReuse.test.mjs`

- [x] Add behavior-level contracts that distinguish native Excalidraw capture from model-first synchronization.
- [x] Confirm the contracts fail against the current Agent snapshot and toolbar implementation.

## Task 2: Execute Active-Page Agent Edits Through the IdeaSketch SDK

**Outcome:** Agent canvas replacement is one normal Excalidraw edit and all custom Agent history plumbing is removed.
**Files:**
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src/lib/agent/types.ts`
- Modify: `src/lib/agent/extensions/ideaSketchAgentTools.ts`
- Modify: `src-tauri/agent-skills/ideasketch/SKILL.md`

**Change Map:**
- `IdeaSketchEditor`: validate active mounted Page identity, restore Tool elements, and call `updateScene` with immediate capture; let `onChange` own model/dirty/autosave propagation
- history removal: delete `agentHistoryRef`, snapshot restore, custom Undo/Redo callbacks, history invalidation, and binding capability getters
- shell cleanup: remove Agent Undo/Redo toolbar props/actions and Agent-only shortcut interception while preserving Excalidraw keyboard handling
- Tool/Skill contract: describe `replace_page_elements` as an active-Page canvas operation and avoid promising native Undo for Page structure mutations

**Verification:**
- Run the focused Task 1 suite.
- Cases: active replacement captured once; native Undo/Redo updates model and dirty state; non-active replacement rejected; add/delete/reorder still apply without custom history; no direct archive write.

- [x] Apply active-Page replacement through the mounted frontend SDK and preserve all fail-closed guards.
- [x] Remove the Agent-specific history API, state, controls, shortcuts, and misleading copy.
- [x] Keep generic editor reuse free of IdeaSketch/Excalidraw details.

## Task 3: Verify Native Undo, Persistence, and Delivery

**Outcome:** The corrected editor transaction ships with automated, native, archive-integrity, and workflow evidence.
**Files:**
- Modify: directly affected source and regression files
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B027-use-ideasketch-native-undo-for-agent-canvas-edits.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- native acceptance: clean saved fixture, one active-Page replacement, Excalidraw-native Undo to baseline, native Redo to replacement, autosave to `Saved`, reopen, and canonical archive parse
- safety acceptance: non-active Page, stale revision/fingerprint, switched document, read-only, external change, and cancellation remain non-mutating
- delivery: complete B027 only after current full regression/build/package evidence and a separate `fix(B027)` commit

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `npm run tauri build -- --debug`
- `git diff --check`
- Native disposable `.is` acceptance using only IdeaSketch/Excalidraw Undo and Redo controls, followed by saved archive inspection and reopen verification.

- [x] Run focused and complete regression/build/package verification after implementation stabilizes.
- [x] Complete the native saved-file and fail-closed matrix with no application-level Agent history controls.
- [x] Complete B027, refresh Superplan progress, inspect the final diff, and create the separate task commit.

## Completion Evidence

- Focused native-history regression suite: 13 tests passed.
- Complete frontend regression suite: 318 tests passed; `npm run build` passed.
- Rust verification: 122 tests passed; `cargo fmt` passed; `cargo clippy` passed with only pre-existing dead-code warnings.
- Debug packaging: `npm run tauri build -- --debug` passed and produced `src-tauri/target/debug/bundle/macos/IdeaNote.app`.
- Native saved-file acceptance on `/private/tmp/ideanote-b026.Zpk9lk/agent-b026-v1.is`: one Agent `replace_page_elements` call created a visible 200 by 200 rectangle; Excalidraw-native Undo removed it and enabled Redo; Redo restored it; autosave returned to `Saved`; reopening preserved the rectangle and correctly began with a fresh native history.
- Archive inspection found one non-deleted `overview-rectangle` element at `(100, 100)` with size `200 by 200`; `unzip -t` passed and SHA-256 is `858e36bd1a4a9c81fb728edac334faeec5eb0e4823f9af51743f9dd3b75937c9`.
- Final source review confirmed active-Page replacement uses `CaptureUpdateAction.IMMEDIATELY`, normal synchronization remains non-captured, non-mounted replacement fails closed, and Agent-specific history controls/contracts are absent. `git diff --check` passed.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-04-persistent-threads-and-editor-tools.md`
- `docs/superplan/plans/features/F036-direct-agent-editor-edits-with-undo.md`
- `docs/superplan/plans/bugs/B014-fix-workspace-autosave-completion-loop.md`
- `docs/superplan/plans/bugs/B016-prevent-large-page-switch-freeze.md`
- `docs/superplan/plans/bugs/B026-validate-agent-editing-of-saved-ideasketch-files.md`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/SlideCanvas.tsx`
- `src/lib/agent/agentToolHost.ts`
- `src/lib/agent/types.ts`
