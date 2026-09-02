---
id: "F073-04"
title: "Migrate Agent Protocols to the Canonical IdeaSketch SDK"
type: "feature"
status: "approved"
summary: "Adapt Agent Tool protocols v1 and v2 to the canonical SDK while preserving direct apply, read ordering, native history, and legacy compatibility."
source: "docs/superplan/human/features.md"
created: "2026-09-02"
order: 73
depends_on: ["F073-03"]
parent: "F073"
---

# Migrate Agent Protocols to the Canonical IdeaSketch SDK Plan

**Goal:** Make the unified SDK the only Agent mutation boundary while preserving the documented Agent v1 contract and delivering the semantic v2 text-capable catalog safely.
**Scope:** Add explicit Agent Tool protocol v1/v2 negotiation and schema digest binding; keep the current eight Tool names and raw `add_page.elements`/`replace_page_elements` only for explicitly pinned v1 callers; project the v2 semantic catalog without raw replace; translate drawing/layout/text/Page operations into canonical SDK plans; retain direct application, prerequisite reads, chronological Tool activity, cancellation, and one native scene capture. Remove Agent extension-owned normalize/build/commit logic after its version-pinned compatibility translations are proven, and complete the Agent-specific contract/regression boundary before any non-Agent UI migration begins.
**Non-Goals:** This plan does not restore Change Review or Agent-only history, grant Agent clear/IO/presentation/selection scopes, silently downgrade v2 to v1, remove v1 before a later stable release, publish an npm package, change `.is v1`, or add new generic Agent runtime responsibilities.
**Architecture:** Agent descriptors are dynamically projected from the negotiated Tool protocol and enforced caller capability set captured at Turn start. Both v1 and v2 schemas translate into version-pinned strategies registered inside the canonical SDK pipeline; authorization, live target validation, postconditions, result ledger, direct apply, and commit never fork. The generic Agent host continues to treat the ChangeSet/SDK envelope opaquely. Non-Agent React command migration, Camera preview, IO, Presentation, and final rollout selection remain exclusively in F073-05.
**Baseline:** Eight Agent Tools are currently defined directly by `ideaSketchAgentTools.ts`; drawing/layout scene builders live in the extension; `IdeaSketchEditor` recognizes those operations and performs native capture. B028 requires a real `read_active_page` before scene mutation, and B027 forbids custom Agent history. There is no explicit Tool protocol version/schema digest or semantic v2 catalog, and legacy raw operations remain generally discoverable to the current Agent caller.
**Exit Criteria:** Explicit v1 callers retain all eight current Tool names, inputs, prerequisite behavior, direct application, Page structure semantics, and native active-Page capture. Default/v2 callers receive the semantic catalog, can create/update standalone and shape-bound text through canonical operations, and cannot discover or call raw replace, raw Page elements, destructive clear, IO, Presentation, or other ungranted methods. Version/schema mismatch, silent downgrade, mid-Turn catalog change, stale read ledger, cancelled/late Tool result, capability escalation, or parallel legacy/canonical Agent commit fails closed without mutation. No Agent-specific history or Change Review returns. Agent extension scene builders and editor operation branches are replaced by SDK translations, and Agent-focused Node/Rust/build plus disposable save/reopen/native-Undo evidence passes before the plan is completed and committed independently.

## Task 1: Implement Explicit Agent Tool Protocol v1 and v2 Catalogs

**Outcome:** Each Agent Turn receives one immutable, digest-bound Tool catalog whose authority is derived from the SDK caller profile.
**Files:**
- Modify: `src/lib/agent/types.ts`
- Modify: `src/lib/agent/agentToolHost.ts`
- Modify: `src/lib/ideasketch-sdk/capabilities.ts`
- Modify: `src/lib/agent/extensions/ideaSketchAgentExtension.ts`
- Modify: `src/lib/agent/extensions/ideaSketchAgentTools.ts`
- Modify: `src-tauri/agent-skills/ideasketch/SKILL.md`
- Test: `tests/ideaSketchAgentProtocol.test.mjs`
- Modify: `tests/ideaSketchAgentExtension.test.mjs`
- Modify: `tests/agentToolHost.test.mjs`

**Change Map:**
- negotiation/capability projection: `agentToolProtocolVersion`, `toolSchemaDigest`, caller session, SDK protocol, and v1/v2 Tool availability captured at Turn/executor creation with no inference or mid-Turn mutation
- v1 catalog: all current eight Tools and schemas preserved only for explicit pinned callers, including deprecated raw operations translated through registered compatibility strategies
- v2 catalog: bounded read-first outline/active Page, semantic Page operations, drawing/layout with versioned text operations, optional text alias only as a canonical convenience wrapper, and no raw replace discovery
- Skill guidance: protocol-accurate read coverage, stable refs, text/binding rules, Page history truthfulness, and unavailable scope behavior

**Verification:**
- `node --test tests/ideaSketchAgentProtocol.test.mjs tests/ideaSketchAgentExtension.test.mjs tests/agentToolHost.test.mjs`
- Cases: exact v1/v2 names/schemas/digests; pinned immutability; mismatch/no downgrade; capability-derived allowlist; raw legacy invisibility to v2; read prerequisite and bounded results.

- [ ] Add explicit immutable Tool protocol negotiation and schema digest binding.
- [ ] Preserve the pinned v1 catalog through compatibility strategies inside the canonical SDK pipeline.
- [ ] Deliver the semantic v2 catalog and text guidance without expanding Agent scopes.

## Task 2: Route Direct Agent Application Through the Canonical SDK

**Outcome:** Agent Page and scene mutations reuse the same SDK validation and commits as UI commands, with no extension-owned scene writer remaining.
**Files:**
- Modify: `src/lib/agent/extensions/ideaSketchAgentExtension.ts`
- Modify: `src/lib/agent/extensions/ideaSketchAgentTools.ts`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/lib/agent/agentToolHost.ts`
- Test: `tests/agentDirectEditorContract.test.mjs`
- Modify: `tests/ideaSketchAgentExtension.test.mjs`
- Modify: `tests/agentInteraction.test.mjs`

**Change Map:**
- adapter translation: v1/v2 Tool payloads become SDK document/scene plans and carry the captured caller/session/protocol/read-ledger binding
- direct apply: `createDirectApplyToolExecutor()` revalidates active binding and invokes the SDK; scene commits produce one native capture, Page commits report document history unavailable, and Tool success follows actual application
- retirement: remove handwritten extension scene builders and editor operation branching once equivalent canonical strategies are proven; retain only named compatibility translation where required
- safety: preserve chronological read→mutation activity, exactly-once lifecycle, source/revision/external/read-only/switch/cancellation guards, and no direct file writes

**Verification:**
- `node --test tests/agentDirectEditorContract.test.mjs tests/ideaSketchAgentExtension.test.mjs tests/agentToolHost.test.mjs tests/agentInteraction.test.mjs`
- Cases: v1 drawing/layout/raw compatibility; v2 shapes/connectors/text/Page operations; one native capture; Page no-false-Undo; stale/read-only/switched/external/cancelled/late/duplicate paths; no Change Review or Agent history surface.

- [ ] Translate every supported v1/v2 Tool into canonical SDK reads or plans.
- [ ] Make Agent direct apply consume the shared transaction/result pipeline and remove extension-owned commits/builders.
- [ ] Re-prove B027/B028 native history, read ordering, cancellation, and persistence boundaries.

## Task 3: Verify and Complete the Agent Migration Boundary

**Outcome:** Agent v1/v2 compatibility is proven independently before UI callers are migrated in F073-05.
**Files:**
- Modify: `tests/ideaSketchAgentProtocol.test.mjs`
- Modify: `tests/agentDirectEditorContract.test.mjs`
- Modify: `tests/ideaSketchAgentExtension.test.mjs`
- Modify: `tests/agentToolHost.test.mjs`
- Modify: `tests/agentInteraction.test.mjs`
- Modify: `docs/superplan/plans/features/F073-unified-ideasketch-jssdk/F073-04-agent-protocol-compatibility-adapters.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- Agent ownership audit: each v1/v2 read and mutation Tool has one SDK mapping; compatibility strategies translate only, raw Excalidraw APIs stay host-internal, and no extension/editor branch can commit independently
- saved-file evidence: pinned v1 and default v2 operate on disposable `.is` fixtures with current read prerequisites, one native scene capture, Page no-false-Undo, autosave/save/reopen, external-change, cancellation, and archive integrity
- plan boundary: mark only F073-04 complete and create its independent implementation commit; F073 remains active until F073-05 completes UI rollout and final verification

**Verification:**
- `node --test tests/ideaSketchAgentProtocol.test.mjs tests/agentDirectEditorContract.test.mjs tests/ideaSketchAgentExtension.test.mjs tests/agentToolHost.test.mjs tests/agentInteraction.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml agent -- --nocapture`
- `npm run build`
- `git diff --check`
- Native disposable `.is`: v1 drawing/layout/raw compatibility and v2 shape/connector/text/Page mutations, native Undo/Redo for scene edits, truthful Page history, save/reopen, stale/read-only/external/switch/cancel failures, and no Agent-only history or Change Review.

- [ ] Complete the exact Agent Tool ownership and single-commit audit for both protocol versions.
- [ ] Run focused/native saved-file verification and repair every Agent migration regression.
- [ ] Record evidence, mark F073-04 complete, refresh the index, and create its separate implementation commit.

## References
- `docs/superplan/human/features.md#F073`
- `docs/superplan/rfcs/F073.md`
- `docs/superplan/plans/features/F036-direct-agent-editor-edits-with-undo.md`
- `docs/superplan/plans/features/F070-semantic-ideasketch-agent-drawing.md`
- `docs/superplan/plans/features/F071-semantic-layout-mutation-for-existing-ideasketch-elements.md`
- `docs/superplan/plans/bugs/B026-validate-agent-editing-of-saved-ideasketch-files.md`
- `docs/superplan/plans/bugs/B027-use-ideasketch-native-undo-for-agent-canvas-edits.md`
- `docs/superplan/plans/bugs/B028-show-real-agent-read-tools-in-execution-order.md`
- `src/lib/agent/extensions/ideaSketchAgentTools.ts`
- `src/lib/agent/extensions/ideaSketchAgentExtension.ts`
- `src-tauri/agent-skills/ideasketch/SKILL.md`
