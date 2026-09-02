---
id: "F073-01"
title: "Establish the IdeaSketch SDK Protocol and Transaction Kernel"
type: "feature"
status: "complete"
summary: "Introduce the typed caller-scoped IdeaSketch SDK contract, signed read snapshots, request ledger, and shared transaction coordinators without changing existing editor behavior."
source: "docs/superplan/human/features.md"
created: "2026-09-02"
order: 73
depends_on: ["F071", "B028"]
parent: "F073"
---

# Establish the IdeaSketch SDK Protocol and Transaction Kernel Plan

**Goal:** Give IdeaSketch one typed, versioned, caller-scoped JSSDK boundary whose safety, lifecycle, and transaction semantics can be reused by UI commands and Agent Tools.
**Scope:** Add the application-internal `IdeaSketchSdk` v1 protocol, namespaces, branded references, `SdkResult` and stable error taxonomy, caller profiles/scopes, capability/version negotiation, and strict public envelopes. Add host-signed document/scene snapshots with cumulative identity and mutation-ready coverage, native-interaction invalidation, canonical persistent-state digests, request-id idempotency, reconciliation, and safe session disposal. Add one document-session mutation scheduler shared by scene and document transaction coordinators; it performs authorization, freshness, cancellation, request-ledger, validation, non-yielding final validation/commit, and terminal-result sequencing through injected host adapters. Mount the host boundary in the active IdeaSketch editor without migrating existing commands or changing their observable behavior.
**Non-Goals:** This plan does not implement the complete shape/text/connector/Camera operation catalog, migrate UI or Agent callers, expose the SDK as an npm package, alter `.is v1`, add document Undo, or publish raw Excalidraw data as a public contract.
**Architecture:** `src/lib/ideasketch-sdk/` owns the public protocol and pure lifecycle/transaction kernel. The React editor supplies a private host adapter for active document/Page identity, mounted Excalidraw state, native-interaction epochs, flush/commit hooks, and availability; the protocol never imports React or Excalidraw types. Caller identity and scopes are host-issued and immutable for a facade session. Scene and document snapshots are separate opaque receipts, but their mutations share one FIFO scheduler/critical section per document session so Page flush/select/delete/reorder cannot interleave with a scene commit. Every mutation passes through exactly one semantic coordinator inside that scheduler before an adapter can commit.
**Baseline:** F070/F071 and B027/B028 already provide active-Page read-first Agent mutations, revision/source/read-only guards, and one native canvas capture, but those guarantees are embedded in Agent schemas and `IdeaSketchEditor` closures. There is no SDK facade, capability negotiation, signed cumulative coverage, stable result/error model, request ledger, reconciliation, or explicit session lifecycle.
**Exit Criteria:** A trusted UI, Agent v1, Agent v2, future external, host-internal, and legacy caller session receives a different enforced capability projection from the same protocol definition. Unsupported protocol majors, schema-digest mismatch, scope escalation, malformed envelopes, duplicate request-id payload collisions, stale snapshots, incomplete coverage, busy native interaction, ledger exhaustion, disposed sessions, and failed disposal all have deterministic tested outcomes. Scene and document requests for one document session serialize; a later queued request observes the earlier commit and a now-stale snapshot. Identical concurrent/completed requests share one application/result without reapplying. An indeterminate commit is reconciled with the same before/after digest algorithm before any successor request or session may replay. Existing UI and Agent behavior remains unchanged while the mounted editor exposes one internal SDK host target, and TypeScript strict build plus focused protocol/lifecycle tests pass.

## Task 1: Define the Public Protocol and Capability Contract

**Outcome:** All future IdeaSketch SDK consumers compile against one strict versioned type system and enforced caller capability model.
**Files:**
- Create: `src/lib/ideasketch-sdk/types.ts`
- Create: `src/lib/ideasketch-sdk/capabilities.ts`
- Create: `src/lib/ideasketch-sdk/context.ts`
- Create: `src/lib/ideasketch-sdk/index.ts`
- Test: `tests/ideaSketchSdkProtocol.test.mjs`

**Change Map:**
- `types.ts`: branded document/Page/element/Camera/asset/temp refs, protocol envelopes, namespace contracts, async `SdkResult`, synchronous `SdkSyncResult`, stable error codes including distinct editor/desktop unavailability, mutation results, diagnostics, and event types including cross-caller document-commit summaries plus SDK/native scene origins
- `capabilities.ts`: SDK/Agent/document version separation, caller profiles, host-enforced scopes, supported-versus-available projection, limits, schema digest binding, and fail-closed negotiation
- `context.ts`: implement `context.get()` and `context.getCapabilities()` from the bound host target without exposing the raw document model, source fingerprint, or mutable authority
- public entrypoint: export only IdeaSketch-owned semantic types and session creation contracts, never Excalidraw `AppState`, raw elements, DOM events, paths, or host secrets

**Verification:**
- `node --test tests/ideaSketchSdkProtocol.test.mjs`
- Cases: every RFC namespace/method is represented once; scope matrices differ by caller; protocol major/minor and Agent Tool schema negotiation; malformed/unknown builder fields, unsupported operation kinds, capability-denied subscriptions/builders, disposed-session subscriptions/builders, idempotent unsubscribe, and `requiredCapabilities` cannot widen authority; expected synchronous failures return `SdkSyncResult` and never throw.

- [x] Add the complete typed facade, version envelopes, references, result/error taxonomy, and event contracts.
- [x] Implement caller-scoped capability projection and version/schema negotiation.
- [x] Lock the public boundary against raw Excalidraw, filesystem-path, and host-secret leakage.

## Task 2: Implement Signed Snapshot, Request, and Session Lifecycles

**Outcome:** Reads, idempotent requests, reconciliation, and disposal have deterministic caller-bound lifecycles before any new mutation capability is enabled.
**Files:**
- Create: `src/lib/ideasketch-sdk/snapshots.ts`
- Create: `src/lib/ideasketch-sdk/canonicalDigest.ts`
- Create: `src/lib/ideasketch-sdk/requestLedger.ts`
- Create: `src/lib/ideasketch-sdk/session.ts`
- Test: `tests/ideaSketchSdkSnapshots.test.mjs`
- Test: `tests/ideaSketchSdkRequests.test.mjs`
- Test: `tests/ideaSketchSdkSession.test.mjs`

**Change Map:**
- canonical digest: one deterministic projection shared by snapshots and reconciliation; scene digests include including-deleted elements, all persistent element fields, every persistent Page file content hash, and persistent Page AppState while excluding selection, viewport, dialogs, active tool, and other ephemeral state; document digests additionally include Page order/titles, every Page digest, and persistent document metadata
- snapshot service: opaque document/scene ids and cursors, cumulative identity/mutation-ready coverage, relation-closure upgrades, canonical digest/source/edit-version binding, refusal to issue scene/document/private snapshots during pointer transform, native text/IME, or native history/action epochs, and invalidation when those epochs begin
- request ledger: implement `requests.getMutationResult()` and `requests.reconcile()` over caller-session request ids, join identical concurrent in-flight requests, detect payload collisions, preserve bounded non-evicting records, replay terminal results, gate indeterminate records on canonical before/after digest reconciliation, consume successor/confirmation tokens atomically, issue host-only reserved-request handles for composite pointer/picker orchestration, and prohibit blind replay through a new request or session
- session lifecycle: implement `session.getInfo()` and `session.dispose()` with idempotent subscription cleanup, caller token invalidation, owned Presentation/resource cleanup hooks, safe rebuild, and no half-disposed state when cleanup fails

**Verification:**
- `node --test tests/ideaSketchSdkSnapshots.test.mjs tests/ideaSketchSdkRequests.test.mjs tests/ideaSketchSdkSession.test.mjs`
- Cases: pagination continues one snapshot; incomplete closures never become mutation-ready; persistent scene/Page/document changes alter the canonical digest while selection/viewport/dialog/tool changes do not; native pointer/text/IME/history epochs both stale prior receipts and prohibit new scene/document/private snapshots; identical concurrent requests join one in-flight result; colliding/capacity-exhausted requests reject; composite outer requests receive one unforgeable single-use reservation with no nested caller-visible ledger entry; `getMutationResult` remains observational; terminal, unresolved, successor-token, and after-digest reconciliation outcomes; safe session rebuild cannot inherit tokens, ledger entries, or scopes; successful and failed disposal preserve the required token/resource ordering, disposed synchronous methods reject, and previously returned unsubscribe remains safe.

- [x] Implement the canonical persistent-state digest and opaque snapshot/cursor issuance with cumulative coverage, freshness, and busy-state refusal.
- [x] Implement bounded concurrent idempotency, observational result lookup, successor-token handling, and before/after reconciliation without unsafe replay.
- [x] Implement session disposal/rebuild semantics including owned-resource cleanup ordering.

## Task 3: Mount the Shared Transaction Kernel in the Editor Host

**Outcome:** Scene and Page mutations can use one reusable safety sequence while existing callers continue to behave exactly as before.
**Files:**
- Create: `src/lib/ideasketch-sdk/transactions.ts`
- Create: `src/lib/ideasketch-sdk/host.ts`
- Create: `src/lib/ideasketch-sdk/editorHostAdapter.ts`
- Create: `scripts/patch-excalidraw-paste-lifecycle.mjs`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `src/lib/slideCanvasProps.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `tests/ideaSketchSdkTransactions.test.mjs`
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/slideCanvasProps.test.mjs`
- Create: `tests/fixtures/ideaSketchPasteLifecycleHarness.jsx`

**Change Map:**
- transaction scheduler/coordinators: serialize every scene/document mutation for one document session; authorize, reserve or join a direct request or consume a host-only composite reservation, validate target/snapshot/cancellation, clone, normalize, check postconditions, perform final validation through commit without an event-loop yield, then classify terminal or indeterminate outcome and return ordered internal scene/document lifecycle records to the future dispatcher without implementing public subscriptions
- host adapter: active document/Page target, flush and canonical projections, writable/mounted/desktop availability, native interaction epoch, scene capture callback, exact per-commit settlement acknowledgements, document reducer callback, and presentation cleanup hooks
- editor/canvas lifecycle: register and revoke the active host target without exporting raw imperative APIs as JSSDK methods or altering current command paths
- Excalidraw integration patch: exact-pin `@excalidraw/excalidraw` 0.18.0 and apply one fail-closed, idempotent postinstall patch to its dev, prod, and public type bundles; cover direct and context-menu Paste from pre-clipboard-read lifecycle acquisition through the final React commit/`onChange`, preserve async handler results, add exact `updateScene({ onCommit })` acknowledgement, settle pending Paste waits on unmount, and remove the exact reproducible `node_modules/.vite` optimizeDeps cache so development cannot reuse an unpatched runtime

**Verification:**
- `node --test tests/ideaSketchSdkTransactions.test.mjs tests/ideaSketchEditor.test.mjs tests/slideCanvasProps.test.mjs tests/agentDirectEditorContract.test.mjs`
- `npm run build`
- `npm run postinstall` twice to prove patch application and idempotence, then `node --check node_modules/@excalidraw/excalidraw/dist/dev/index.js` and `node --check node_modules/@excalidraw/excalidraw/dist/prod/index.js`
- Cases: no commit before all guards pass; exactly one adapter commit; scene→Page and Page→scene concurrency serialize without lost updates or wrong-Page capture; different queued requests stale old snapshots after the predecessor commits; final validation-to-commit does not yield; ledger terminalization and FIFO release wait for the exact post-`onChange` commit acknowledgement; cancellation before commit leaves no mutation, cancellation after commit returns the committed result; a post-commit exception checks the after digest before marking indeterminate; unresolved records block replacement request/session replay; direct and context-menu Paste remain busy through clipboard reads, asynchronous content handling, and the persisted `onChange`; the real Vite/Chromium runtime resolves the patched bundle after cache invalidation; current Agent native-capture and UI command behavior remains green.

- [x] Implement one per-document FIFO mutation scheduler with distinct scene/document semantics and injected commit adapters.
- [x] Register one active IdeaSketch host target and native-interaction lifecycle in the mounted editor.
- [x] Prove this foundation introduces no second write path or observable caller regression.

## Task 4: Verify and Complete the Protocol Kernel Boundary

**Outcome:** The protocol, lifecycle, ledger, and scheduler foundation is independently complete and committed before semantic scene implementation starts.
**Files:**
- Modify: `tests/ideaSketchSdkProtocol.test.mjs`
- Modify: `tests/ideaSketchSdkSnapshots.test.mjs`
- Modify: `tests/ideaSketchSdkRequests.test.mjs`
- Modify: `tests/ideaSketchSdkSession.test.mjs`
- Modify: `tests/ideaSketchSdkTransactions.test.mjs`
- Modify: `docs/superplan/plans/features/F073-unified-ideasketch-jssdk/F073-01-sdk-protocol-and-transaction-kernel.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- ownership audit: public protocol/capability types, canonical digests, snapshot receipts, request/reconciliation records, host-only composite reservations, session lifecycle, shared scheduler, editor host adapter, Excalidraw dev/prod/type patch, exact dependency pin, and Vite cache invalidation each have one implementation owner
- plan boundary: record focused/build evidence, mark F073-01 complete, refresh the index, and create its independent implementation commit before starting F073-02

**Verification:**
- Run the focused Task 1-3 suites.
- Run the complete Node test suite once the implementation and dependency patch are frozen.
- `npm run build`
- Re-run the postinstall patch twice, syntax-check both patched runtime bundles, and confirm the Vite browser harness exercises the patched dependency.
- `git diff --check`

- [x] Complete the protocol/capability/lifecycle/transaction ownership audit and final regression evidence.
- [x] Record evidence, mark F073-01 complete, refresh the index, and create its separate implementation commit.

## Verification Evidence

- Focused protocol, snapshot, request, session, transaction, editor-host, Camera, conversion, viewport, and Agent compatibility suites: `node --test tests/ideaSketchSdkProtocol.test.mjs tests/ideaSketchSdkSnapshots.test.mjs tests/ideaSketchSdkRequests.test.mjs tests/ideaSketchSdkSession.test.mjs tests/ideaSketchSdkTransactions.test.mjs tests/ideaSketchEditor.test.mjs tests/cameraDrawing.test.mjs tests/excalidrawToDrawio.test.mjs tests/slideCanvasProps.test.mjs tests/excalidrawViewportObservers.test.mjs tests/agentDirectEditorContract.test.mjs` (94 passed).
- Complete frontend regression: `node --test tests/*.test.mjs` (547 passed, 0 failed).
- Production TypeScript/Vite build: `npm run build` (passed; only existing dynamic-import and chunk-size warnings).
- Excalidraw lifecycle patch: `npm run postinstall` twice (idempotent), `node --check node_modules/@excalidraw/excalidraw/dist/dev/index.js`, and `node --check node_modules/@excalidraw/excalidraw/dist/prod/index.js` (passed).
- Behavior-level Chromium/Vite harness: direct and successful context-menu Paste remain busy through clipboard handling and persisted `onChange`, with exact `start → change → end` lifecycle and token matching; `updateScene({ onCommit })` acknowledges after `onChange` (passed in `tests/ideaSketchEditor.test.mjs`).
- Transaction boundary regressions cover synchronous final-validation-to-commit initiation, exact settlement waiting, FIFO serialization, cancellation, reconciliation, async/malformed/throwing commit receipts, and no-op history invariants (passed in `tests/ideaSketchSdkTransactions.test.mjs`).
- Superplan workspace compatibility/index validation and `git diff --check` (passed).

## References
- `docs/superplan/human/features.md#F073`
- `docs/superplan/rfcs/F073.md`
- `docs/superplan/plans/features/F070-semantic-ideasketch-agent-drawing.md`
- `docs/superplan/plans/features/F071-semantic-layout-mutation-for-existing-ideasketch-elements.md`
- `docs/superplan/plans/bugs/B027-use-ideasketch-native-undo-for-agent-canvas-edits.md`
- `docs/superplan/plans/bugs/B028-show-real-agent-read-tools-in-execution-order.md`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/SlideCanvas.tsx`
- `src/lib/agent/agentToolHost.ts`
