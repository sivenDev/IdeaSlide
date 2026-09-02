---
id: "F073"
title: "Add IdeaSketch Text Editing Interfaces"
type: "feature"
status: "draft"
summary: "Let the IdeaSketch JSSDK and Agent create standalone text, attach text to shapes, and adjust existing text size through bounded native editor transactions."
source: "docs/superplan/human/features.md"
created: "2026-09-02"
order: 73
depends_on: ["F071"]
parent: ""
---

# Add IdeaSketch Text Editing Interfaces Plan

**Goal:** Make text a first-class, safe capability of the existing IdeaSketch JSSDK and Agent interfaces so diagram instructions can produce and refine readable canvas labels.
**Scope:** Extend the existing `apply_drawing_plan` JSSDK/Agent contract with text-capable operations and add a read-first `apply_text_plan` convenience Tool with bounded operations for standalone text creation, text attached to supported shapes, replacing text content, and changing text size. Reuse stable `element:<id>` references, the existing IdeaSketch change-set contract, native Excalidraw `updateScene` capture, persistence, Undo/Redo, and all revision/source/read-only/cancellation guards. Extend incremental shape creation so a new shape may optionally include its bound text in the same drawing transaction.
**Non-Goals:** Do not add a separate text editor UI, expose arbitrary Excalidraw JSON, support rich text spans, images, markdown, unsupported containers, cross-Page targets, direct file writes, or bypass existing Agent review and editor safety gates.
**Architecture:** `ideaSketchAgentTools.ts` owns the public JSSDK/Agent text-plan schemas, bounded normalization, stable-reference rules, and concise summaries. The existing `apply_drawing_plan` remains backward compatible while accepting text operations; `apply_text_plan` shares the same normalized operation model for text-only calls. `ideaSketchAgentExtension.ts` owns the typed text operations and pure scene builder: it creates native Excalidraw text elements, maintains shape/text `containerId` and `boundElements` relationships, updates text/font size without disturbing unrelated elements, and lets `restoreElements` recompute dimensions/bindings. `IdeaSketchEditor.tsx` remains the only mutation boundary and applies one text plan with `CaptureUpdateAction.IMMEDIATELY`, preserving the existing dirty/autosave/recovery and native Undo path.
**Baseline:** F070 exposes bounded semantic shapes/arrows/bindings through the existing `apply_drawing_plan` JSSDK/Agent interface, and F071 exposes stable-reference movement/resizing through `apply_layout_plan`; neither can create standalone text, attach text to a shape, or change `fontSize`. `read_active_page` already returns bounded text summaries and stable element references.
**Exit Criteria:** The existing `apply_drawing_plan` interface accepts text operations, the Agent Tool catalog also advertises `apply_text_plan`, and the IdeaSketch Skill explains both read-first contracts. A valid plan can create standalone text, create or update bound text on rectangles/ellipses/diamonds, replace text, and adjust font size; the result remains editable Excalidraw data, preserves existing arrows/groups/unrelated elements, and is captured as one native Undo step. Malformed, stale, unread, read-only, switched, cancelled, cross-Page, unsupported-target, oversized, and out-of-bounds requests fail closed without scene changes. Focused Agent-extension/editor contract tests, production TypeScript build, and diff hygiene pass.

## Task 1: Define the Text Tool Contract and Skill Guidance

**Outcome:** IdeaSketch exposes a bounded, read-first text mutation interface with stable target validation and clear agent-facing instructions.
**Files:**
- Modify: `src/lib/agent/extensions/ideaSketchAgentExtension.ts`
- Modify: `src/lib/agent/extensions/ideaSketchAgentTools.ts`
- Modify: `src-tauri/agent-skills/ideasketch/SKILL.md`
- Modify: `tests/ideaSketchAgentExtension.test.mjs`

**Change Map:**
- text operation types: add `create-text`, `set-text`, and `set-text-size` operations plus typed `IdeaSketchAgentOperation` coverage
- text schemas: extend `apply_drawing_plan` with the shared text operations and add `apply_text_plan` with bounded coordinates, text length, font-size, operation count, target refs, and supported shape constraints
- normalization: require `read_active_page`, reject truncated/unavailable/unsupported targets, duplicate refs, malformed payloads, and mixed Pages before producing a Change Set
- skill contract: document both JSSDK/Agent entry points for standalone text, shape-bound text, text replacement, and font-size updates with one mutation Tool after a successful read

**Verification:**
- `node --test tests/ideaSketchAgentExtension.test.mjs`
- Assert the Tool descriptor/schema, operation normalization, stable refs, text/font-size bounds, shape-target rules, summaries, and failure-closed malformed/stale/unread cases.

- [ ] Add the text operation types, schema, and bounded normalizer.
- [ ] Extend `apply_drawing_plan`, register `apply_text_plan`, and document read-first usage.
- [ ] Add focused contract fixtures for valid and rejected text plans.

## Task 2: Build and Apply Native Text Scenes

**Outcome:** Valid JSSDK/Agent text plans create or update native Excalidraw text while preserving shape bindings, unrelated elements, and one-step Undo semantics.
**Files:**
- Modify: `src/lib/agent/extensions/ideaSketchAgentExtension.ts`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Test: `tests/agentDirectEditorContract.test.mjs`
- Test: `tests/ideaSketchAgentExtension.test.mjs`

**Change Map:**
- scene builder: create standalone text with deterministic ids/default typography, attach text to supported shapes, update existing text/container text, and adjust `fontSize` with refreshed version metadata; accept the same operations from both drawing and text plans
- relationship repair: keep shape `boundElements` and text `containerId` coherent, preserve arrow bindings/groups/files, and leave unsupported targets unchanged by rejecting the transaction
- editor boundary: detect text-capable Change Sets from either JSSDK/Agent Tool, validate active Page/document identity and source fingerprint, call the pure builder once, restore dimensions/bindings, and capture through native Excalidraw history

**Verification:**
- `node --test tests/agentDirectEditorContract.test.mjs tests/ideaSketchAgentExtension.test.mjs`
- Cover standalone creation, new and existing shape text, text replacement, font-size changes, dimension refresh, arrow/bound-text preservation, both JSSDK/Agent entry points, one native capture, and stale/read-only/switched/cancelled/unsupported-target no-op behavior.

- [ ] Implement the pure text scene builder and bound-text helpers.
- [ ] Wire text Change Sets into the mounted editor transaction path.
- [ ] Prove native capture, persistence handoff, and fail-closed safety.

## Task 3: Complete Regression and Delivery Evidence

**Outcome:** F073 is documented as complete with current focused and final verification evidence.
**Files:**
- Modify: `docs/superplan/plans/features/F073-ideasketch-text-editing-interfaces.md`
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/README.md`

**Verification:**
- `node --test tests/ideaSketchAgentExtension.test.mjs tests/agentDirectEditorContract.test.mjs tests/agentToolHost.test.mjs`
- `npm run build`
- `git diff --check`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.7.0+codex.20260820095924/skills/using-superplan/scripts/generate_plans_readme.py --write --check --root /Users/zhengxiwan/ide-workspace/idea-slide`

- [ ] Record focused and final verification evidence.
- [ ] Mark the plan complete and F073 done only after all exit criteria pass.
- [ ] Create a separate `feat(F073)` delivery commit.

## References
- `docs/superplan/human/features.md#F073`
- `docs/superplan/plans/features/F070-semantic-ideasketch-agent-drawing.md`
- `docs/superplan/plans/features/F071-semantic-layout-mutation-for-existing-ideasketch-elements.md`
- `src/lib/agent/extensions/ideaSketchAgentTools.ts`
- `src/lib/agent/extensions/ideaSketchAgentExtension.ts`
- `src/components/IdeaSketchEditor.tsx`
- `src-tauri/agent-skills/ideasketch/SKILL.md`
