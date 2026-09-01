---
id: "F071"
title: "Add Semantic Layout Mutation for Existing IdeaSketch Elements"
type: "feature"
status: "complete"
summary: "Let the IdeaSketch Agent move and resize already-read elements while preserving bound text, bindings, and native editor safety."
source: "docs/superplan/human/features.md"
created: "2026-09-01"
order: 71
depends_on: ["F070"]
parent: ""
---

# Add Semantic Layout Mutation for Existing IdeaSketch Elements Plan

**Goal:** Let users ask the IdeaSketch Agent to refine an existing diagram layout without replacing the scene or losing semantic relationships.
**Scope:** Add a bounded `apply_layout_plan` Tool that requires `read_active_page`, accepts ordered move and resize operations addressed only by captured `element:<id>` references, validates the active Page and source snapshot, synchronizes bound text when its container moves, preserves arrow bindings, and applies all operations through one native Excalidraw transaction.
**Non-Goals:** Do not expose raw Excalidraw JSON, pointer gestures, cross-Page references, arbitrary element creation/deletion, automatic layout algorithms, direct file writes, or changes to generic Agent runtime semantics.
**Architecture:** The IdeaSketch Agent Extension owns the layout-plan schema and resolves captured element references. A pure scene builder clones the current scene, applies bounded geometry changes, and moves text elements whose `containerId` or bound-element relationship identifies a moved container. The mounted `IdeaSketchEditor` remains the only mutation boundary and uses the existing revision, source fingerprint, active Page, read-only, cancellation, persistence, recovery, and native Undo path.
**Baseline:** F070 supports semantic creation of shapes/arrows and binding of new arrows, but existing elements can only be replaced as a whole. `read_active_page` already returns bounded stable element references and the direct-apply executor guards document identity, revision, source marker, active editor, and cancellation.
**Exit Criteria:** A valid layout plan moves and resizes captured elements, keeps unrelated elements unchanged, moves bound text with its container, preserves arrow endpoint and reverse bindings, and is captured as one native Undo transaction. Malformed, stale, read-only, switched, cancelled, cross-Page, and unread element references fail closed without scene changes.

## Task 1: Define and Validate the Semantic Layout Contract

**Outcome:** The IdeaSketch Agent exposes a bounded, read-first layout Tool with stable existing-element references and concise mutation summaries.
**Files:**
- Modify: `src/lib/agent/extensions/ideaSketchAgentExtension.ts`
- Modify: `src/lib/agent/extensions/ideaSketchAgentTools.ts`
- Modify: `src-tauri/agent-skills/ideasketch/SKILL.md`
- Test: `tests/ideaSketchAgentExtension.test.mjs`

**Change Map:**
- layout schema: add `move-element` and `resize-element` operations with bounded deltas/dimensions and `element:<id>` targets
- validation: require the captured active Page and reject unread, deleted, malformed, oversized, or cross-Page targets before mutation
- operation model: keep layout operations distinct from F070 creation plans while allowing one ChangeSet to carry one ordered layout plan

**Verification:**
- `node --test tests/ideaSketchAgentExtension.test.mjs`
- Assert read prerequisite, stable target validation, bounded payloads, deterministic summaries, and failure-closed malformed/cross-Page/unread cases.

- [x] Add the layout Tool contract and regression fixtures.
- [x] Implement validation and operation summaries.
- [x] Document read-first layout guidance in the bundled Skill.

## Task 2: Apply Layout Plans as One Native Editor Transaction

**Outcome:** Existing IdeaSketch elements move or resize through one native Excalidraw update while bound text and arrow bindings remain coherent.
**Files:**
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/lib/agent/extensions/ideaSketchAgentExtension.ts`
- Test: `tests/agentDirectEditorContract.test.mjs`
- Test: `tests/ideaSketchAgentExtension.test.mjs`

**Change Map:**
- scene builder: clone the active scene, apply relative movement and bounded dimensions, and synchronize text containers
- safety boundary: route layout plans through the same active Page, revision, source fingerprint, read-only, switched-document, and cancellation checks as F070
- native capture: call `updateScene` once with `CaptureUpdateAction.IMMEDIATELY`, preserving normal dirty/autosave/recovery and one-step Undo

**Verification:**
- `node --test tests/agentDirectEditorContract.test.mjs tests/ideaSketchAgentExtension.test.mjs`
- Cases: bound text follows a moved shape; resize leaves arrow bindings intact; unrelated elements remain unchanged; one native capture; stale/read-only/switched/cancelled/cross-Page/unread targets do not mutate.

- [x] Add a pure layout scene builder with bound-text synchronization.
- [x] Wire the layout ChangeSet into the mounted editor transaction path.
- [x] Prove native capture and fail-closed safety contracts.

## Task 3: Complete Regression and Delivery Evidence

**Outcome:** F071 is documented as complete with current focused, build, and regression evidence.
**Files:**
- Modify: `docs/superplan/plans/features/F071-semantic-layout-mutation-for-existing-ideasketch-elements.md`
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/README.md`

**Verification:**
- `node --test tests/ideaSketchAgentExtension.test.mjs tests/agentDirectEditorContract.test.mjs tests/agentToolHost.test.mjs`
- `npm run build`
- `git diff --check`

- [x] Record focused and final verification evidence.
- [x] Mark F071 complete and the human feature done.
- [x] Create a separate `feat(F071)` delivery commit.

## Verification Evidence

- Focused layout/editor tests: `node --test tests/ideaSketchAgentExtension.test.mjs tests/agentDirectEditorContract.test.mjs tests/agentToolHost.test.mjs` (passed).
- Production build: `npm run build` (passed; existing Vite chunk-size and dynamic-import warnings only).
- `git diff --check` passed.

## References
- `docs/superplan/human/prd.md`
- `docs/superplan/human/features.md#F071`
- `docs/superplan/plans/features/F070-semantic-ideasketch-agent-drawing.md`
- `src/components/IdeaSketchEditor.tsx`
- `src/lib/agent/extensions/ideaSketchAgentExtension.ts`
- `src/lib/agent/extensions/ideaSketchAgentTools.ts`
