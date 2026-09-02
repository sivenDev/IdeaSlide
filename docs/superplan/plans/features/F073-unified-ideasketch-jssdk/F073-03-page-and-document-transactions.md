---
id: "F073-03"
title: "Deliver Canonical IdeaSketch Page and Document Transactions"
type: "feature"
status: "approved"
summary: "Implement snapshot-bound Page reads, operations, parsing, selection, and atomic document transactions before Agent and UI callers migrate."
source: "docs/superplan/human/features.md"
created: "2026-09-02"
order: 73
depends_on: ["F073-02", "F065", "F064"]
parent: "F073"
---

# Deliver Canonical IdeaSketch Page and Document Transactions Plan

**Goal:** Give Agent and UI callers one complete `pages` service for safe Page structure changes before either caller family is migrated.
**Scope:** Implement paginated document snapshots plus `pages.list()`, `pages.select()`, `pages.parseExcalidraw()`, `pages.validatePlan()`, and `pages.applyPlan()` for add/import/duplicate/rename/reorder/delete/create-from-selection. Add strict versioned Page builders to the shared `operations` namespace, parsed-draft token lifecycle, detached bounded `initialScene` execution through the F073-02 semantic adapter, and atomic document reducer/session commits inside the shared per-document mutation scheduler. Mount the canonical Page service in the active editor host while leaving existing UI closures and Agent Tool schemas on their compatibility paths until F073-04/F073-05.
**Non-Goals:** This plan does not migrate Agent Tools or UI controls, add document-level Undo, modify an existing Page scene through a Page plan, accept raw public element arrays/files, change `.is v1`, open file pickers, implement Presentation/selection/view/IO services, or change existing Page control placement.
**Architecture:** Document receipts use the F073-01 canonical digest and scheduler. Page operations validate and execute on a complete document clone; optional new-Page seeds call the F073-02 operation schemas and scene postconditions only on a detached new Page. The commit adapter flushes the active draft, revalidates the same scheduler-owned target, applies one reducer/model transition, returns deterministic Page/element TempRef mappings, and produces one bounded internal document-commit record for F073-05 to broadcast across authorized caller facades. `pages.select()` is non-persistent but uses injected lifecycle hooks to stop owned Presentation, revoke old receipts, bind the new Page, and publish internal ordered lifecycle records; public event dispatch remains F073-05-owned.
**Baseline:** F064 imports Excalidraw into a Page, F065 duplicates Pages, and the reducer supports select/add/duplicate/rename/reorder/delete, but these are React closures/actions without document snapshots, strict Page operation envelopes, parsed-draft receipts, request-ledger results, or shared serialization with scene mutations. Agent v1 Page Tools use their own payload normalization and cannot yet target a canonical `pages.applyPlan()`.
**Exit Criteria:** Every RFC v1 Page method and operation has one strict implementation and capability entry. Page reads paginate one `documentSnapshotId`; mutations serialize with scene requests, flush the right draft, revalidate after the predecessor commit, retain at least one Page, reject out-of-range reorder rather than clamp, preserve/import/duplicate full files/AppState/Camera order, select deterministically, mark dirty once, report document history unavailable, and produce one bounded internal document-commit record even when the active Page is unchanged. F065 duplicate remains adjacent with a fresh Page id and independent full clone. Detached seeds accept only the RFC allowlist and earlier same-seed TempRefs; forbidden StableRefs, update/delete/clear/files, indexed Camera, duplicate/cross-seed TempRefs, parse-token reuse/expiry, or failed scene postconditions commit nothing. `pages.select()` flush does not self-stale and orders stop record → old token invalidation → new context record. The service is independently tested and committed before Agent migration begins.

## Task 1: Define Page Operations, Document Receipts, and Parsing Tokens

**Outcome:** The SDK exposes the complete strict Page catalog and caller-bound document read/token model without migrating callers.
**Files:**
- Create: `src/lib/ideasketch-sdk/pageOperations.ts`
- Create: `src/lib/ideasketch-sdk/pagesService.ts`
- Modify: `src/lib/ideasketch-sdk/types.ts`
- Modify: `src/lib/ideasketch-sdk/capabilities.ts`
- Modify: `src/lib/excalidrawImport.ts`
- Test: `tests/ideaSketchSdkPages.test.mjs`
- Modify: `tests/excalidrawImport.test.mjs`

**Change Map:**
- Page builders/schemas: add/import/duplicate/rename/reorder/delete/create-from-selection with `kind`, `version: 1`, strict titles/indexes/refs, bounded seed plans, and no raw elements/files fields
- document reads/tokens: cumulative Page summaries and cursor, canonical document digest binding, one-use/expiring parsed-page drafts, and request/session ownership
- capability catalog: supported Page methods/operations, document read/write/parse scopes, dynamic availability, seed/import/page-count/title limits, and Agent/UI caller differences

**Verification:**
- `node --test tests/ideaSketchSdkPages.test.mjs tests/excalidrawImport.test.mjs tests/ideaSketchSdkProtocol.test.mjs`
- Cases: pagination, strict fields and unknown rejection, title/index/last-Page constraints, parsed token expiry/reuse/caller binding, F065 duplicate contract, created TempRef mappings, and exact capability projection.

- [ ] Implement every v1 Page builder/schema and its capability/limit entries once.
- [ ] Implement document snapshots/cursors and caller-bound parsed-draft token lifecycle.
- [ ] Preserve the established import and duplicate content contracts without exposing raw scene mutation.

## Task 2: Apply Page Plans Through the Shared Document Scheduler

**Outcome:** Page mutations and selection use one atomic reducer/session boundary that cannot interleave unsafely with scene commits.
**Files:**
- Modify: `src/lib/ideasketch-sdk/pagesService.ts`
- Modify: `src/lib/ideasketch-sdk/transactions.ts`
- Modify: `src/lib/ideaSketchReducer.ts`
- Modify: `src/lib/excalidrawStyleConversion.ts`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Test: `tests/ideaSketchSdkPageTransactions.test.mjs`
- Modify: `tests/ideaSketchReducer.test.mjs`
- Modify: `tests/editorSession.test.mjs`
- Modify: `tests/ideaSketchEditor.test.mjs`

**Change Map:**
- plan execution: complete-clone validation, detached seed/import/duplicate execution, stable TempRef resolution, one scheduler-owned reducer/model commit, and exact created/updated/deleted Page results
- concurrency/persistence: active draft flush, scene↔Page FIFO serialization, post-flush snapshot revalidation, deterministic selection/dirty result, no document or Agent-specific Undo claim, and one ordered internal document-commit record containing only operation kinds plus affected Page refs
- selection lifecycle: invalid target rejection; successful flush not treated as unrelated staleness; stop owned Presentation hook, invalidate old tokens/context, bind new Page, and produce internal ordered records for the future public dispatcher

**Verification:**
- `node --test tests/ideaSketchSdkPageTransactions.test.mjs tests/ideaSketchSdkPages.test.mjs tests/ideaSketchReducer.test.mjs tests/editorSession.test.mjs tests/ideaSketchEditor.test.mjs`
- Cases: Page→scene and scene→Page queue order, stale successor snapshot, pending active draft, failed detached seed rollback, forbidden seed StableRef/update/delete/clear/files/indexed Camera/duplicate or cross-seed TempRef, import token atomic consumption, adjacent independent duplicate, last-Page deletion, exact reorder bounds, dirty once, non-active Page rename/reorder still produce a document-commit record, and select stop→invalidate→context ordering.

- [ ] Implement atomic Page plan execution and active-editor host commit through the shared scheduler.
- [ ] Lock F064/F065 import/duplicate behavior plus detached seed isolation and rollback.
- [ ] Prove Page selection/mutation sequencing, scene concurrency, persistence handoff, and truthful history semantics.

## Task 3: Verify and Complete the Page Service Boundary

**Outcome:** The canonical Page service is ready for both Agent and UI adapters as an independently completed dependency.
**Files:**
- Modify: `tests/ideaSketchSdkPages.test.mjs`
- Modify: `tests/ideaSketchSdkPageTransactions.test.mjs`
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `docs/superplan/plans/features/F073-unified-ideasketch-jssdk/F073-03-page-and-document-transactions.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- ownership audit: Page schemas, validation, parse tokens, selection, apply results, reducer commit, document receipt semantics, and internal document-commit records exist only in the SDK service; old callers may translate but cannot redefine them
- saved-file evidence: add/import/duplicate/rename/reorder/delete/create-from-selection across Workspace and Standalone save/reopen with files/AppState/Camera order and no false document Undo
- plan boundary: mark F073-03 complete and create its independent implementation commit before starting F073-04

**Verification:**
- Run the focused Task 1–2 suites.
- `npm run build`
- `git diff --check`
- Disposable `.is` smoke: execute every Page operation, confirm deterministic active Page/dirty state, save/reopen and inspect the archive, then exercise stale/concurrent/last-Page/invalid-seed/token-failure paths with no mutation.

- [ ] Complete Page method/operation/capability ownership and focused regression evidence.
- [ ] Verify representative Workspace/Standalone persistence and archive integrity.
- [ ] Record evidence, mark F073-03 complete, refresh the index, and create its separate implementation commit.

## References
- `docs/superplan/human/features.md#F073`
- `docs/superplan/rfcs/F073.md`
- `docs/superplan/plans/04-ideasketch-editor-integration.md`
- `docs/superplan/plans/05-workspace-reliability-and-recovery.md`
- `docs/superplan/plans/features/F017-convert-excalidraw-selection-to-clean-diagram-style.md`
- `docs/superplan/plans/features/F064-import-excalidraw-files-into-ideasketch.md`
- `docs/superplan/plans/features/F065-duplicate-pages-from-pages-list.md`
- `src/lib/ideaSketchReducer.ts`
- `src/lib/excalidrawImport.ts`
- `src/components/IdeaSketchEditor.tsx`
