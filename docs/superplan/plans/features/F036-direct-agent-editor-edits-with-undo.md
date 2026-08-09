---
id: "F036"
title: "Apply Agent Editor Edits Directly with Undo"
type: "feature"
status: "complete"
summary: "Replace Change Review with validated direct editor mutations that form one atomic Undo/Redo transaction and persist through the normal save pipeline."
source: "docs/superplan/human/features.md"
created: "2026-08-09"
order: 41
depends_on: ["B025"]
parent: ""
---

# Apply Agent Editor Edits Directly with Undo Plan

**Goal:** Make Agent editing feel immediate: supported editor mutations apply directly, remain safely reversible in the editor, and require no Change Review step.
**Scope:** Rename IdeaSketch mutation Tools from proposal language to direct editor actions; keep the existing typed Change Set as an internal validated transaction envelope; apply successful mutation Tool results through the live editor binding before returning the Tool result to the model; remove new Change Review Items/cards; record each Agent mutation as one bounded editor-level Undo/Redo transaction; expose Undo/Redo through the editor toolbar and `Cmd/Ctrl+Z` shortcuts; invalidate Agent history after unrelated manual mutations; and preserve revision, fingerprint, read-only, external-change, cancellation, no-direct-write, autosave, recovery, and generic editor-extension boundaries.
**Non-Goals:** This feature does not auto-approve shell, filesystem deletion, credential, network, or other irreversible non-editor actions. It does not let Rust or the Agent write `.is` files directly, bypass safe persistence, merge arbitrary concurrent edits, expose hidden reasoning, add new IdeaSketch operations, or make editor-specific mutation code part of the generic Agent runtime.
**Architecture:** Editor extensions continue to produce opaque revision- and fingerprint-bound Change Sets. `AgentPanel` wraps the captured trusted Tool executor with a direct-apply adapter: reads pass through; a valid mutation Change Set is revalidated against the currently active binding, applied atomically by that binding, and converted to a normalized applied-mutation Tool result before Rust receives it. Rust records Tool activity but emits no Change Review. `IdeaSketchEditor` owns a bounded document-level Agent history stack, because Page add/delete/reorder cannot enter Excalidraw's canvas-only history. Manual model mutations clear that stack; editor toolbar and captured keyboard shortcuts delegate to it only while an Agent transaction is available, otherwise Excalidraw keeps its normal Undo behavior. Persistence remains downstream of normal model change, dirty state, autosave, recovery, and safe-write logic.
**Baseline:** Mutation Tools currently use `propose_*` names, return `kind: "proposal"`, and wait in a `changeReview` Item. `AgentPanel` applies only after the user clicks Apply. `IdeaSketchEditor` stores one `agentUndoRef` snapshot exposed only through the review card; it has no redo stack and Agent Page mutations do not participate in the editor toolbar or keyboard Undo path. Rust emits every proposal as a pending Change Review.
**Exit Criteria:** A request to add, delete, reorder, or replace IdeaSketch content calls a direct-action Tool, validates the active document and captured source, applies before the Tool result returns, visibly updates the editor without a review card, and reports a completed Tool activity. One toolbar click or `Cmd/Ctrl+Z` restores the complete pre-Agent document; Redo reapplies it; a manual edit invalidates the Agent transaction so keyboard Undo falls through to the editor's normal behavior. Stale, switched, read-only, externally changed, cancelled, malformed, duplicate, or late mutations fail closed with no edit. Files change only through existing autosave/manual save paths. Legacy persisted review Items do not become actionable. Focused, full, build, package, and native acceptance checks pass.

## Task 1: Convert Proposal Tools into Direct Mutation Transactions

**Outcome:** The generic Tool path returns an applied editor mutation instead of a user-facing proposal while preserving the Change Set safety envelope.
**Files:**
- Modify: `src/lib/agent/types.ts`
- Modify: `src/lib/agent/agentToolHost.ts`
- Modify: `src/lib/agent/extensions/ideaSketchAgentTools.ts`
- Modify: `src-tauri/agent-skills/ideasketch/SKILL.md`
- Modify: `src-tauri/src/agent/mod.rs`
- Modify: `src/components/AgentPanel.tsx`
- Test: `tests/agentToolHost.test.mjs`
- Test: `tests/ideaSketchAgentExtension.test.mjs`
- Test: `tests/agentInteraction.test.mjs`
- Test: `tests/agentPanel.test.mjs`

**Change Map:**
- Tool contract: rename `propose_add_page`, `propose_delete_page`, `propose_reorder_page`, and `propose_replace_page_elements` to direct action names while retaining bounded schemas
- direct-apply adapter: revalidate active document/extension/revision/status/source marker, apply through the active binding, and convert the internal proposal result into a truthful `mutation` result
- Rust normalization: update Tool activity/output for applied mutations and stop emitting new `changeReview` Items
- cancellation/late safety: do not apply after Turn cancellation, editor switch, stale binding, external change, or duplicate Tool completion

**Verification:**
- `node --test tests/agentToolHost.test.mjs tests/ideaSketchAgentExtension.test.mjs tests/agentInteraction.test.mjs tests/agentPanel.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml agent -- --nocapture`
- Cases: read pass-through; direct mutation success; stale/read-only/switched/cancelled failure; no Change Review; one Tool result with stable identity.

- [x] Add focused failing contracts for current proposal naming, pending review, and non-applied Tool completion.
- [x] Implement the generic direct-apply adapter and normalized mutation result.
- [x] Rename the IdeaSketch Tool/Skill surface and stop new Change Review emission.

## Task 2: Add Atomic Editor Undo and Redo for Agent Mutations

**Outcome:** Every direct Agent mutation is one reversible document transaction available from the editor itself.
**Files:**
- Modify: `src/lib/agent/types.ts`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/index.css`
- Test: `tests/agentChangeSet.test.mjs`
- Test: `tests/ideaSketchAgentExtension.test.mjs`
- Test: `tests/ideaSketchEditorContract.test.mjs`
- Test: `tests/toolbarVisuals.test.mjs`
- Test: `tests/editorSession.test.mjs`

**Change Map:**
- history: replace the single review-owned snapshot with bounded Undo/Redo stacks of complete IdeaSketch editor state
- transaction: push one snapshot before an Agent Change Set, clear redo on a new Agent mutation, and restore through the existing model/editor-state callbacks
- invalidation: clear Agent history on manual Page or canvas model mutations so editor-native history remains authoritative afterward
- controls: add accessible editor Undo/Redo actions and capture `Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z`, and platform redo only when Agent history can handle them

**Verification:**
- Focused editor/history/toolbar tests.
- Native cases: each mutation is one Undo step; Redo restores it; manual edit invalidates Agent history; normal Excalidraw Undo still works when no Agent transaction is present.

- [x] Capture the current missing editor-level Undo/Redo behavior as focused failing contracts.
- [x] Implement bounded atomic Agent history and manual-mutation invalidation.
- [x] Wire editor controls and keyboard shortcuts without consuming Excalidraw history when Agent history is empty.

## Task 3: Remove the Review Surface and Preserve Compatibility

**Outcome:** The Agent transcript reports applied editor work concisely and never asks the user to review reversible content edits.
**Files:**
- Modify: `src/lib/agent/protocol.ts`
- Modify: `src/lib/agent/agentStore.ts`
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src/components/agent/AgentItem.tsx`
- Modify: `src/components/agent/AgentTranscript.tsx`
- Delete: `src/components/agent/AgentChangeReview.tsx`
- Modify: `src-tauri/src/agent/repository.rs`
- Modify: `src/index.css`
- Test: `tests/agentItems.test.mjs`
- Test: `tests/agentProtocol.test.mjs`
- Test: `tests/agentStore.test.mjs`
- Test: `tests/agentPanel.test.mjs`
- Test: `tests/agentChangeReview.test.mjs`

**Change Map:**
- transcript: remove Change Review rendering and callbacks; applied mutations remain visible through completed Tool rows and concise activity/final Markdown
- compatibility: sanitize legacy persisted `changeReview` Items so their operations never become actionable after load
- protocol: remove product dependence on review Items while retaining only the minimum legacy ingestion shape if repository migration requires it
- copy/style: replace review-oriented welcome, diagnostics, and CSS with direct-edit language

**Verification:**
- `node --test tests/agentItems.test.mjs tests/agentProtocol.test.mjs tests/agentStore.test.mjs tests/agentPanel.test.mjs tests/agentChangeReview.test.mjs`
- Cases: no Apply/Reject/Change Review UI; legacy load is inert; Tool activity states applied mutation; no hidden auto-approval for non-editor runtime approvals.

- [x] Remove the active Change Review component and transcript plumbing.
- [x] Sanitize legacy review persistence without reviving old operations.
- [x] Verify concise direct-edit copy, activity, accessibility, and non-editor approval separation.

## Task 4: Verify Direct Editing and Hand Off to Saved-file Validation

**Outcome:** F036 delivers stable direct editor behavior, and B026 can execute its saved-file matrix against the final contract.
**Files:**
- Modify: directly affected implementation and focused regression files
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/features/F036-direct-agent-editor-edits-with-undo.md`
- Modify: `docs/superplan/plans/bugs/B026-validate-agent-editing-of-saved-ideasketch-files.md`

**Change Map:**
- native acceptance: direct add/replace mutation appears without review, editor Undo/Redo works, Stop/stale targets do not mutate, and no direct write occurs
- B026 handoff: update the validation matrix to direct mutation timing and editor history, then execute saved-file persistence only after F036 completes
- delivery: full frontend/Rust/build/package checks and a separate `feat(F036)` commit before B026 mutation testing

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `npm run tauri build -- --debug`
- `git diff --check`
- Native direct-edit acceptance on a disposable unsaved `.is` before starting B026 saved-file persistence scenarios.

- [x] Run the focused failure/fix loop and final automated/build/package matrix.
- [x] Complete native direct-edit, Undo/Redo, cancellation, stale-target, and no-direct-write acceptance.
- [x] Complete F036, refresh Superplan state, create a separate `feat(F036)` commit, then execute approved B026.

## Delivery Evidence

- `node --test tests/*.test.mjs`: 316 passed, 0 failed, including direct mutation, cancellation, legacy-review hydration, bounded Agent history, toolbar shortcuts, and second-editor reuse coverage.
- `cargo test --manifest-path src-tauri/Cargo.toml --quiet`: 121 passed, 0 failed; the Tool Broker accepts only editor-applied mutations and terminal lifecycle regressions remain green.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --quiet`, `npm run build`, and `git diff --check`: passed. Rust reports only the known unused future-adapter warnings.
- `npm run tauri build -- --debug`: passed and produced `src-tauri/target/debug/bundle/macos/IdeaNote.app` and `src-tauri/target/debug/bundle/dmg/IdeaNote_0.1.0_aarch64.dmg`; Vite retained the known Excalidraw import and large-chunk warnings.
- Native disposable-file acceptance: `delete_page` directly removed the blank `Agent Validation` Page with one completed Tool row and no review card; document-level Undo restored two Pages and enabled Redo; Redo returned to one Page; autosave reached `Saved`; restart/reopen preserved the result; direct ZIP/JSON inspection produced hash `18bac5a2f82268020f2795a6f106f9c8c33548bafc64f7e1cd4bfdc3399eb4ee` with a valid `manifest.json`, `slides/page-1.json`, and unaffected embedded file metadata.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/plans/bugs/B025-fix-agent-fallback-hangs-cancellation-and-activity-presentation.md`
- `docs/superplan/plans/bugs/B026-validate-agent-editing-of-saved-ideasketch-files.md`
- `docs/superplan/plans/features/F031-configurable-ai-agent/F031-02-generic-agent-runtime.md`
- `src/components/AgentPanel.tsx`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/Toolbar.tsx`
- `src/lib/agent/agentToolHost.ts`
- `src/lib/agent/extensions/ideaSketchAgentTools.ts`
- `src-tauri/src/agent/mod.rs`
