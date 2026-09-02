---
id: "F073-02"
title: "Deliver Semantic Scene, Text, Connector, and Camera Operations"
type: "feature"
status: "approved"
summary: "Implement bounded semantic scene reads and the complete v1 operation catalog, including native standalone and shape-bound text, through one Excalidraw transaction adapter."
source: "docs/superplan/human/features.md"
created: "2026-09-02"
order: 73
depends_on: ["F073-01"]
parent: "F073"
---

# Deliver Semantic Scene, Text, Connector, and Camera Operations Plan

**Goal:** Make every supported programmatic edit of an existing IdeaSketch Page—including text—use one read-first semantic scene transaction with native relationship and history guarantees.
**Scope:** Implement paginated semantic scene reads, relation-closure completion, asset metadata reads, strict versioned operation builders and schemas, and canonical `scene.validatePlan()`/`scene.applyPlan()`. Cover supported shape creation/style, standalone and shape-bound text creation/content/style/layout, text bind/unbind/upsert, arrow creation/binding/unbinding/style/arrowheads/free points, shape move/resize/delete, Camera create/bounds/order/delete, background, formal style conversion, and confirmed soft clear. Use native Excalidraw helpers or equivalent complete adapters for text measurement, binding geometry, version metadata, deletion tombstones, reverse relations, and one `CaptureUpdateAction.IMMEDIATELY` commit.
**Non-Goals:** This plan does not implement Page structure transactions, migrate UI or Agent catalogs, add rich text/Markdown/image/frame/group authoring, expose asset writes, allow ordinary mutation of locked/imported/Camera targets, or support raw whole-scene replacement in the new protocol.
**Architecture:** Pure builders and strict validators produce versioned operation data. A semantic projection owns stable refs and bounded relation-complete summaries. An Excalidraw adapter clones the canonical scene, applies ordered operations, uses native measurement/binding/deletion semantics, and validates global postconditions before the transaction kernel may commit. Camera is represented only through `CameraRef` and dedicated canonical operations; the trusted pointer preview/wrapper remains owned by F073-05. Destructive clear requires a host-owned caller/document/Page/snapshot/scope/TTL-bound confirmation receipt and never becomes an Agent capability.
**Baseline:** The current Agent extension can create shapes/arrows, bind new arrows, and move/resize a narrow target set with handwritten element objects. Text is only summarized during reads, Camera/UI mutations use separate closures, clear builds tombstones directly in `SlideCanvas`, and relation completeness, measurement, postconditions, snapshot coverage, and error codes are not unified.
**Exit Criteria:** The RFC v1 scene method and operation catalogs are implemented once and capability-advertised. A fresh read plus complete relation closure can create standalone text, create/upsert/bind/unbind shape text on rectangle/ellipse/diamond, replace content, change supported text style/layout/font size, grow its container, and preserve attached arrows as one native Undo step. Connector, Camera, geometry, style, delete cascade, background, formal conversion, and trusted confirmed clear obey their complete RFC invariants. Unsupported/grouped/framed/rotated/locked/imported/Camera misuse, imported arrow-label writes, incomplete/stale/busy snapshots, malformed plans, failed postconditions, and cancelled requests make no scene change. Save/reopen preserves editable native text, bindings, Camera order, tombstones, files, and unrelated scene/AppState fields.

## Task 1: Add Semantic Reads and Strict Operation Builders

**Outcome:** Callers can obtain bounded relation-aware scene receipts and construct only the supported versioned v1 operations.
**Files:**
- Create: `src/lib/ideasketch-sdk/sceneProjection.ts`
- Create: `src/lib/ideasketch-sdk/operations.ts`
- Create: `src/lib/ideasketch-sdk/operationSchemas.ts`
- Create: `src/lib/ideasketch-sdk/assets.ts`
- Modify: `src/lib/ideasketch-sdk/types.ts`
- Modify: `src/lib/ideasketch-sdk/capabilities.ts`
- Test: `tests/ideaSketchSdkSceneRead.test.mjs`
- Test: `tests/ideaSketchSdkOperations.test.mjs`

**Change Map:**
- semantic projection: bounded summaries for supported and preserved-only elements, Page-scoped refs, relation completeness, cursor pagination, targeted closure reads, Camera filtering, and non-upgrading viewport/asset summaries
- operations/builders: exact RFC page-independent scene kinds, `kind` plus `version: 1`, TempRef ordering, semantic enums, bounded coordinates/text/styles, and unknown-field rejection
- type matrix: explicit supported/rejected behavior for shapes, standalone/bound/imported-label text, arrows, Camera, locked/grouped/framed, and preserved-only element types

**Verification:**
- `node --test tests/ideaSketchSdkSceneRead.test.mjs tests/ideaSketchSdkOperations.test.mjs`
- Cases: pagination/targeted closure coverage, same ids on different Pages, Camera ref isolation, TempRef ordering, strict schemas, capability limits, unsupported reserved operations, and no raw scene payload in reads/builders.

- [ ] Implement semantic scene/Camera/asset projections and cumulative closure coverage.
- [ ] Implement every v1 pure operation builder and one canonical strict schema per kind.
- [ ] Encode the complete supported/preserved/rejected element matrix and limits in capabilities and tests.

## Task 2: Implement Native Text, Binding, Geometry, and Deletion Semantics

**Outcome:** A cloned Excalidraw scene can apply the full operation catalog while preserving native editable relationships and rejecting inconsistent results.
**Files:**
- Create: `src/lib/ideasketch-sdk/excalidrawSceneAdapter.ts`
- Create: `src/lib/ideasketch-sdk/scenePostconditions.ts`
- Modify: `src/lib/excalidrawStyleConversion.ts`
- Modify: `src/lib/cameraUtils.ts`
- Test: `tests/ideaSketchSdkText.test.mjs`
- Test: `tests/ideaSketchSdkBindings.test.mjs`
- Test: `tests/ideaSketchSdkCamera.test.mjs`
- Test: `tests/ideaSketchSdkDeletion.test.mjs`

**Change Map:**
- text adapter: native fields, original/display text, font mapping, measurement, wrapping, auto-resize, grow-container overflow, alignment, z-order, and shape/text bidirectional records
- connector/geometry adapter: bind/rebind/unbind endpoint geometry, reverse records, same-target deduplication, free-point rules, imported arrow-label preservation/reflow, and bound-text movement/resize consequences
- Camera/delete adapter: dedicated Camera invariants and order normalization, native soft tombstones, bound-text/arrow cascades, and complete affected-ref reporting
- postconditions: unique ids including tombstones, complete live relationship symmetry, Camera validity, native version fields, and preservation of unrelated elements/files/viewport/tool/dialog/selection state

**Verification:**
- `node --test tests/ideaSketchSdkText.test.mjs tests/ideaSketchSdkBindings.test.mjs tests/ideaSketchSdkCamera.test.mjs tests/ideaSketchSdkDeletion.test.mjs tests/excalidrawStyleConversion.test.mjs`
- Cases: standalone and bound text lifecycle; content/style/layout remeasurement; overflow growth; arrow geometry and imported labels; Camera append/insert/delete/reorder with historical gaps; delete cascades/tombstones; failed relation/postcondition leaves the input clone unchanged.

- [ ] Implement native editable text creation, updates, layout, bind/unbind, and upsert behavior.
- [ ] Implement connector, geometry, Camera, style, delete, and tombstone invariants with affected-ref reporting.
- [ ] Validate all global scene postconditions before allowing a commit.

## Task 3: Expose the Canonical Scene Service and One Native Commit

**Outcome:** `scene.read/getElements/validatePlan/applyPlan/requestClearConfirmation` and Camera scene writes use the shared kernel and exactly one mounted Excalidraw capture.
**Files:**
- Create: `src/lib/ideasketch-sdk/sceneService.ts`
- Create: `src/lib/ideasketch-sdk/cameraService.ts`
- Modify: `src/lib/ideasketch-sdk/host.ts`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/SlideCanvas.tsx`
- Test: `tests/ideaSketchSdkSceneTransactions.test.mjs`
- Test: `tests/ideaSketchSdkClear.test.mjs`
- Modify: `tests/agentDirectEditorContract.test.mjs`
- Modify: `tests/ideaSketchEditor.test.mjs`

**Change Map:**
- scene service: receipt-bound reads, pure validation previews, canonical normalization, coordinator invocation, affected refs, and one ordered internal scene-commit record; F073-05 exclusively owns public event subscription and facade-wide sequence dispatch
- destructive clear service: accept confirmation only from an injected host-owned trusted-UI prompt adapter; its opaque receipt binds caller, document, Page, complete snapshot, exact `content-only|all-elements` scope, and short TTL; atomically consume it on the first authorized apply attempt while identical request-id lookup reuses the ledger result; stale/cancelled/failed replacement requests require a fresh read and confirmation; F073-05 wires the existing dialog UI
- native commit: revalidate the canonical projection with all host-ephemeral elements excluded, call mounted `updateScene` once with immediate capture, and let normal `onChange` drive model/dirty/autosave/recovery; F073-05 owns pointer-preview cleanup and completion ordering

**Verification:**
- `node --test tests/ideaSketchSdkSceneTransactions.test.mjs tests/ideaSketchSdkClear.test.mjs tests/ideaSketchSdkText.test.mjs tests/ideaSketchSdkBindings.test.mjs tests/ideaSketchSdkCamera.test.mjs tests/ideaSketchSdkDeletion.test.mjs tests/agentDirectEditorContract.test.mjs tests/ideaSketchEditor.test.mjs`
- `npm run build`
- Clear cases: only trusted UI with `scene.destructive-clear` and a live exact receipt can apply; complete coverage is mandatory; first authorized attempt consumes the receipt atomically; same request-id returns the original result without consuming again; stale/cancelled/failed/new requests require reconfirmation; `content-only` preserves Camera while `all-elements` deletes Camera, and both precisely report locked/imported refs in `deletedRefs` plus relationship changes in `cascadedRefs`.
- Save/reopen fixture: create and edit standalone/bound text, connectors, Cameras, background, and tombstones; verify one native Undo/Redo step and exact persistence without unrelated changes.

- [ ] Implement canonical scene read, validation, application, confirmation, result, and ordered internal scene-commit records for the F073-05 event dispatcher.
- [ ] Route all newly implemented scene operations through one immediate native capture and normal persistence handoff.
- [ ] Prove busy/stale/cancelled/unsupported/failed requests and destructive-clear confirmation failures never leak partial state.

## Task 4: Verify and Complete the Semantic Scene Boundary

**Outcome:** The complete scene/text/connector/Camera operation service is independently complete and committed before Page/document work starts.
**Files:**
- Modify: `tests/ideaSketchSdkSceneRead.test.mjs`
- Modify: `tests/ideaSketchSdkOperations.test.mjs`
- Modify: `tests/ideaSketchSdkSceneTransactions.test.mjs`
- Modify: `tests/ideaSketchSdkText.test.mjs`
- Modify: `tests/ideaSketchSdkBindings.test.mjs`
- Modify: `tests/ideaSketchSdkCamera.test.mjs`
- Modify: `tests/ideaSketchSdkDeletion.test.mjs`
- Modify: `tests/ideaSketchSdkClear.test.mjs`
- Modify: `docs/superplan/plans/features/F073-unified-ideasketch-jssdk/F073-02-semantic-scene-text-and-camera-operations.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- ownership audit: every RFC scene method and operation kind maps to one strict schema, semantic projection, Excalidraw adapter path, postcondition set, capability entry, and internal scene-commit record
- saved-file evidence: native standalone/bound text, connectors, Cameras, background, delete tombstones, clear, files, and unrelated persistent state survive Undo/Redo and save/reopen
- plan boundary: record focused/build/native evidence, mark F073-02 complete, refresh the index, and create its independent implementation commit before starting F073-03

**Verification:**
- Run the focused Task 1-3 suites.
- `npm run build`
- `git diff --check`
- Disposable `.is` smoke: apply every operation family, verify one native scene capture, Undo/Redo, save/reopen, and failure paths with no partial state.

- [ ] Complete operation/capability/adapter ownership and final regression evidence.
- [ ] Verify representative Workspace/Standalone persistence and archive integrity.
- [ ] Record evidence, mark F073-02 complete, refresh the index, and create its separate implementation commit.

## References
- `docs/superplan/human/features.md#F073`
- `docs/superplan/rfcs/F073.md`
- `docs/superplan/plans/features/F017-convert-excalidraw-selection-to-clean-diagram-style.md`
- `docs/superplan/plans/features/F070-semantic-ideasketch-agent-drawing.md`
- `docs/superplan/plans/features/F071-semantic-layout-mutation-for-existing-ideasketch-elements.md`
- `docs/superplan/plans/bugs/B027-use-ideasketch-native-undo-for-agent-canvas-edits.md`
- `src/lib/excalidrawStyleConversion.ts`
- `src/lib/cameraUtils.ts`
- `src/components/SlideCanvas.tsx`
