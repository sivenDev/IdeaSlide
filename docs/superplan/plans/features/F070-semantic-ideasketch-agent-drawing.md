---
id: "F070"
title: "Add Semantic Incremental IdeaSketch Agent Drawing"
type: "feature"
status: "draft"
summary: "Let the IdeaSketch Agent plan bounded shape and arrow edits with bindings and apply them as one native editor transaction."
source: "docs/superplan/human/features.md"
created: "2026-09-01"
order: 70
depends_on: ["F036"]
parent: ""
---

# Add Semantic Incremental IdeaSketch Agent Drawing Plan

**Goal:** Make Agent-created IdeaSketch edits incremental and semantically reliable so a request such as drawing a rectangle and then connecting an arrow preserves element identity, bindings, and native editor safety.
**Scope:** Add bounded semantic scene reads; add editor-extension-owned drawing operations for creating shapes, creating arrows, and binding arrow endpoints to stable element references; allow one Agent Tool call to carry an ordered drawing plan; validate the plan against the captured document, active Page, revision, and source fingerprint; apply the plan through the mounted Excalidraw/editor session as one native ChangeSet with normal dirty, autosave, recovery, and Undo behavior; retain the existing Page-level tools.
**Non-Goals:** Do not expose raw Excalidraw APIs to the model; do not simulate pointerdown/move/up or browser mouse gestures; do not add playback animations; do not allow direct file writes, arbitrary element JSON, cross-Page mutation, or generic-runtime knowledge of IdeaSketch internals.
**Architecture:** The IdeaSketch Agent Extension owns a stable, domain-level `DrawingPlan` schema and converts it to valid Excalidraw elements. Read tools return bounded element summaries and stable references rather than requiring the model to reason over an unbounded raw scene. The mounted `IdeaSketchEditor` remains the only component allowed to apply the plan, using the current active Page and existing native capture/update path. The generic Agent runtime continues to receive opaque, revision-bound ChangeSets and remains format-agnostic.
**Baseline:** The extension currently exposes outline/Page reads plus Page add/delete/reorder and whole-Page element replacement. `read_active_page` caps raw elements at 80, the context exposes counts rather than element semantics, and `IdeaSketchEditor` rejects ChangeSets containing more than one operation. Existing direct editor mutations are revision/source guarded and use the mounted Excalidraw API for native history.
**Exit Criteria:** A bounded read exposes enough stable element metadata to identify a target Page and existing elements. A valid drawing plan can create a rectangle and a bound arrow in order, returns deterministic summaries and element references, and applies through one active-editor ChangeSet. Malformed, oversized, stale, read-only, switched, unsupported, or cross-Page plans fail closed without changing the document. Existing Page tools and native Undo/autosave/recovery behavior remain green.

## Task 1: Define Semantic IdeaSketch Reads and Drawing Plans

**Outcome:** The IdeaSketch Agent contract describes bounded scene metadata and validates ordered shape/arrow operations without exposing raw editor APIs.
**Files:**
- Modify: `src/lib/agent/extensions/ideaSketchAgentExtension.ts`
- Modify: `src/lib/agent/extensions/ideaSketchAgentTools.ts`
- Modify: `src-tauri/agent-skills/ideasketch/SKILL.md`
- Test: `tests/ideaSketchAgentExtension.test.mjs`

**Change Map:**
- operation types: add stable `create-shape`, `create-arrow`, and `bind-arrow` plan operations with temporary references and Page scope
- read contract: add bounded element summaries (id, type, bounds, text, bindings, z-order/group markers where available) and explicit truncation/query limits
- tool schema: add a semantic drawing-plan Tool that requires a current Page read, caps operation count and payload size, and rejects arbitrary Excalidraw element blobs
- skill guidance: teach the model to read first, use stable refs, express bindings semantically, and keep plans on one Page

**Verification:**
- `node --test tests/ideaSketchAgentExtension.test.mjs`
- Assert deterministic schemas, bounded reads, stable references, valid rectangle→arrow binding plans, and rejection of malformed/oversized/cross-Page inputs.

- [ ] Add semantic read and drawing-plan contract tests.
- [ ] Implement bounded schemas, operation validation, and concise summaries.
- [ ] Document the plan contract in the bundled IdeaSketch Skill.

## Task 2: Apply Ordered Plans Through the Native Editor Transaction

**Outcome:** The mounted IdeaSketch editor converts a validated drawing plan into native Excalidraw elements and applies the entire plan as one safe editor transaction.
**Files:**
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/lib/agent/extensions/ideaSketchAgentExtension.ts`
- Modify: `src/lib/agent/extensions/ideaSketchAgentTools.ts`
- Test: `tests/agentDirectEditorContract.test.mjs`
- Test: `tests/ideaSketchAgentExtension.test.mjs`
- Test: `tests/agentToolHost.test.mjs`

**Change Map:**
- plan application: replace the single-operation restriction with bounded ordered-plan application while preserving active document/Page/revision/source checks
- element adapter: generate valid rectangle/arrow elements, resolve temporary refs, set endpoint bindings, repair dimensions, and preserve unrelated existing elements
- native transaction: route the completed plan through the mounted Excalidraw API with one captured update and the existing model/session persistence boundary
- failure safety: reject unsupported operations, duplicate refs, invalid anchors, stale targets, read-only bindings, and late/cancelled execution before any mutation

**Verification:**
- `node --test tests/agentDirectEditorContract.test.mjs tests/ideaSketchAgentExtension.test.mjs tests/agentToolHost.test.mjs`
- `npm run build`
- Cases: rectangle then bound arrow; unrelated elements retained; one native capture; malformed/stale/read-only/switched/cancelled plans leave the scene unchanged; existing Page mutations remain compatible.

- [ ] Add focused direct-apply and native-transaction contract tests.
- [ ] Implement plan conversion, binding resolution, and atomic application.
- [ ] Verify build and focused Agent/editor regressions.

## Task 3: Complete Regression and Delivery Evidence

**Outcome:** The new semantic drawing capability is proven against existing Agent, editor-session, persistence, and safety boundaries.
**Files:**
- Modify: `docs/superplan/plans/features/F070-semantic-ideasketch-agent-drawing.md`
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/README.md`

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `git diff --check`
- Native acceptance with a disposable `.is`: run a rectangle→arrow request, confirm one completed editor mutation, inspect bindings after save/reopen, verify native Undo restores the prior scene, and confirm stale/read-only/external-change paths do not mutate.

- [ ] Run focused and final verification, record current evidence, and mark this plan complete.
- [ ] Mark F070 done and create a separate task commit containing only F070 changes.

## References
- `docs/superplan/human/prd.md`
- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F036-direct-agent-editor-edits-with-undo.md`
- `src/components/IdeaSketchEditor.tsx`
- `src/lib/agent/extensions/ideaSketchAgentExtension.ts`
- `src/lib/agent/extensions/ideaSketchAgentTools.ts`
- `src-tauri/agent-skills/ideasketch/SKILL.md`
