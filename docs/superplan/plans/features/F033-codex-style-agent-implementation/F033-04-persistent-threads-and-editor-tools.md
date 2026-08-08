---
id: "F033-04"
title: "Complete Persistent Threads and Editor Tool Integration"
type: "feature"
status: "complete"
summary: "Add durable local Threads, history and resume, steering and approvals, normalized editor Tool routing, and a second-editor reuse proof."
source: "docs/superplan/human/features.md"
created: "2026-08-08"
order: 38
depends_on: ["F033-03"]
parent: "F033"
---

# Complete Persistent Threads and Editor Tool Integration Plan

**Goal:** Deliver the complete reusable Codex-style Agent lifecycle across application restarts and multiple registry-driven editor extensions.
**Scope:** Persist local Thread metadata, completed Turns, final Items, capability/runtime metadata, safe diagnostics, approval records, and bounded Tool results in the application data directory; add create/list/resume/rename/archive history; implement cancellation, capability-gated in-flight steering, approval event handling, context compaction boundaries, and normalized dynamic editor Tool routing; migrate IdeaSketch read/proposal Tools to the trusted Tool host; prove a synthetic Markdown-like editor extension can reuse the same SDK/runtime/UI without generic code changes; complete accessibility, performance, recovery, privacy, and native acceptance.
**Non-Goals:** This plan does not synchronize history to a cloud service, store API keys or hidden chain-of-thought, put Agent data inside user Workspaces/documents, add an actual production Markdown editor, permit direct model writes, enable automatic mutation approval, expose arbitrary filesystem/shell/network Tools, add background/multi-agent work, restore MCP, or silently retarget Turns after editor switches.
**Architecture:** Rust owns an atomic local Thread repository under the application data directory, schema versioning, pagination, redaction, and process/runtime resume metadata. The frontend Agent SDK owns normalized state and history projections, not storage implementation details. Every Turn persists its captured editor/document/revision binding and effective capabilities. The trusted Agent Editor Host validates Tool schemas and stable call ids, executes bounded reads or creates proposal-only Change Sets, and routes Apply/Undo through the active editor session with stale/external-change checks. Unsupported editors advertise no mutation Tools.
**Baseline:** F033-01 supplies normalized in-memory Threads and rich UI; F033-02 supplies a hardened compatibility adapter; F033-03 supplies capability-gated rich runtime adapters and selection policy. Existing conversations disappear when `AgentPanel` remounts. IdeaSketch proposals are currently parsed from response text rather than represented as normalized Tool requests/results, and no persistent history, rename/archive, steering queue, runtime resume mapping, compaction policy, or local Thread repository exists.
**Exit Criteria:** Users can create, list, resume, rename, and archive local Threads; restart the app and recover completed transcript state without credentials, raw hidden reasoning, or unbounded document snapshots; cancel a Turn and steer only on capable runtimes; observe plan, Tool, approval, retry, and Change Review history; run IdeaSketch read and proposal Tools through the normalized Tool host; switch documents without retargeting pending work; reject stale/external changes; Apply and Undo explicitly; disable AI and tear down runtime subscriptions/processes while retaining inert local history; and register a synthetic Markdown-like extension with different Context/Tools without modifying the runtime, store, or generic UI. Full frontend/Rust/build/native/privacy/recovery/accessibility verification passes.

## Task 1: Add the Versioned Local Thread Repository

**Outcome:** Completed Agent history survives application restart through a bounded, redacted, application-owned store.
**Files:**
- Create: `src-tauri/src/agent/repository.rs`
- Modify: `src-tauri/src/agent/types.rs`
- Modify: `src-tauri/src/agent/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/agent/agentClient.ts`
- Modify: `src/lib/agent/agentRuntime.ts`
- Test: `src-tauri/src/agent/repository.rs`
- Test: `tests/agentThreadRepository.test.mjs`

**Change Map:**
- storage schema: versioned Thread metadata, completed Turns/final Items, document associations, effective capabilities, safe timings/diagnostic ids, approval state, and persistence flags
- filesystem safety: application-data location, atomic writes, pagination, corruption quarantine/recovery, schema migration, and no Workspace `.ideanote` history files
- privacy: omit credentials, raw headers/payloads, hidden reasoning, unbounded context/snapshots, and non-persistable Tool results
- runtime mapping: local Thread identity remains stable when an upstream runtime supplies its own Thread/Session id

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml agent::repository -- --nocapture`
- `node --test tests/agentThreadRepository.test.mjs tests/agentStore.test.mjs`
- Cases: create/list/page/resume/rename/archive; restart; atomic replacement; corrupt entry; migration; missing upstream session; redaction; AI disabled; no Workspace writes.

- [x] Persist only bounded, explicitly persistable Thread/Turn/Item state.
- [x] Support versioning, pagination, atomic writes, migration, and corruption recovery.
- [x] Prove credentials, hidden reasoning, and unbounded document data never enter history.

## Task 2: Deliver History, Resume, Steering, and Approval Interaction

**Outcome:** The Agent UI exposes durable Thread lifecycle and capability-gated active-Turn controls.
**Files:**
- Modify: `src/components/agent/AgentThreadHeader.tsx`
- Create: `src/components/agent/AgentThreadHistory.tsx`
- Modify: `src/components/agent/AgentComposer.tsx`
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src/hooks/useAgentThread.ts`
- Modify: `src/lib/agent/agentStore.ts`
- Test: `tests/agentThreadHistory.test.mjs`
- Modify: `tests/agentInteraction.test.mjs`
- Modify: `tests/agentPanel.test.mjs`

**Change Map:**
- Thread lifecycle UI: new, list, paginated history, resume, rename, archive, runtime/model/capability summary, and degraded-state indicator
- active Turn: cancellation, queued/steered input, approval request/result, retry linkage, and completion/cancel/failure boundaries
- compaction: preserve user-visible history while runtime model context may compact independently
- accessibility: focus restoration, disclosure state, polite running status, keyboard history/transcript/composer navigation, and non-color status cues

**Verification:**
- `node --test tests/agentThreadHistory.test.mjs tests/agentInteraction.test.mjs tests/agentPanel.test.mjs`
- Browser cases: create/switch/resume/rename/archive; app restart; capable/incapable steering; cancellation; approval; retry; long history pagination; keyboard and screen-reader labels.

- [x] Expose complete local Thread history and resume behavior.
- [x] Deliver capability-gated steering, cancellation, approval, retry, and compaction states.
- [x] Complete accessible keyboard/focus behavior for the durable interaction model.

## Task 3: Route Editor Tools Through the Trusted Generic Host

**Outcome:** IdeaSketch and future editors use normalized Tool calls/results while every mutation remains a reviewable Change Set.
**Files:**
- Create: `src/lib/agent/agentToolHost.ts`
- Modify: `src/lib/agent/types.ts`
- Modify: `src/lib/agent/agentExtensionRegistry.ts`
- Modify: `src/lib/agent/extensions/ideaSketchAgentExtension.ts`
- Modify: `src/lib/agent/extensions/ideaSketchAgentTools.ts`
- Modify: `src/components/agent/IdeaSketchChangeReview.tsx`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src-tauri/src/agent/types.rs`
- Modify: `src-tauri/src/agent/mod.rs`
- Test: `tests/agentToolHost.test.mjs`
- Modify: `tests/ideaSketchAgentExtension.test.mjs`
- Modify: `tests/agentChangeSet.test.mjs`

**Change Map:**
- trusted Tool host: registry-selected definitions, bounded Context/reads, schema validation, stable call-id ledger, result size/persistence policy, cancellation, and duplicate delivery
- IdeaSketch migration: read outline/Page/selection and proposal operations enter through normalized Tool requests/results rather than response-text conventions
- safety: proposal Tools cannot Apply/save/write; Apply verifies captured document/extension/revision/fingerprint/status/external-change state and uses current editor session; Undo remains editor-owned
- document switching: in-flight Turn and pending Change Set remain bound to their original target and become stale rather than retargeted

**Verification:**
- `node --test tests/agentToolHost.test.mjs tests/ideaSketchAgentExtension.test.mjs tests/agentChangeSet.test.mjs tests/editorSession.test.mjs tests/externalFileChanges.test.mjs tests/recovery.test.mjs`
- Cases: unsupported editor; malformed arguments; bounded read; duplicate call id; cancelled Tool; proposal only; double Apply; stale revision; external change; read-only/missing target; document switch; Apply/Undo/recovery.

- [x] Route all editor Tool traffic through one schema-validating, idempotent host.
- [x] Migrate IdeaSketch without leaking `.is` semantics into the runtime or generic UI.
- [x] Re-prove proposal-only mutation, explicit Apply, stale/conflict rejection, Undo, and recovery.

## Task 4: Prove Reuse and Complete Native Delivery

**Outcome:** A second editor contract reuses the complete Agent stack, and the production-quality lifecycle passes full acceptance.
**Files:**
- Test: `tests/agentSecondEditorReuse.test.mjs`
- Modify: `tests/agentExtensionRegistry.test.mjs`
- Modify: `tests/fileTypeRegistry.test.mjs`
- Modify: `tests/agentShellLayout.test.mjs`
- Modify: `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-04-persistent-threads-and-editor-tools.md`

**Change Map:**
- second-editor proof: synthetic Markdown-like File Type/Agent Extension with different Skill, Context, read Tool, proposal Tool, and review adapter; no generic runtime/UI/store changes
- native matrix: Workspace and Single File modes, Thread restart/resume, selected runtime fallback, IdeaSketch read/proposal/review/Apply/Undo, cancellation/steering, stale/external conflict, AI disable/enable, and unsupported editor
- privacy/security: inspect application history/logs for credentials, hidden reasoning, raw Provider payloads, unbounded document snapshots, MCP endpoints, or direct Agent writes
- delivery evidence: accessibility, long-transcript performance, process/store recovery, complete tests/build, and final RFC acceptance mapping

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `npm run tauri build -- --debug`
- Native disposable-document matrix plus restart/history inspection, no-secret/no-MCP/no-direct-write audit, supported-width layout, keyboard/accessibility, and long-transcript checks.

- [x] Prove a second editor extension reuses the complete Agent core without generic changes.
- [x] Pass full native lifecycle, privacy, recovery, accessibility, performance, and build acceptance.
- [x] Record completion evidence and map every RFC acceptance criterion to current verification.

## Completion Evidence

- Frontend regression: `node --test tests/*.test.mjs` passed 305/305 tests.
- Native regression: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture` passed 106/106 tests; `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets` and `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` passed.
- Production checks: `npm run build`, `npm run tauri build -- --debug`, and `git diff --check` passed; the debug application and DMG bundled successfully.
- Native acceptance used the configured OpenAI-compatible gateway and verified Skill/Tool discovery, reasoning summaries, proposal-only `propose_add_page`, Change Review, explicit Apply, Undo, Thread history, and restart resume on a disposable IdeaSketch document.
- Privacy/recovery inspection confirmed bounded application-data Thread files without credentials, hidden reasoning, raw Provider payloads, unbounded snapshots, Workspace metadata writes, MCP endpoints, or direct Agent writes; the Responses request also omits non-portable `metadata` rejected by the tested gateway.
- Reuse coverage registered a synthetic Markdown-like extension with distinct Context and Tools while leaving the generic runtime, store, and interaction UI unchanged.

## References

- `docs/rfcs/001-codex-style-generic-agent.md`
- `docs/superplan/plans/features/F031-configurable-ai-agent/F031-02-generic-agent-runtime.md`
- `docs/superplan/plans/bugs/B023-separate-agent-right-column.md`
- `docs/superplan/plans/bugs/B024-align-tauri-versions-and-verify-agent-editing.md`
- `src/lib/agent/agentExtensionRegistry.ts`
- `src/lib/agent/extensions/ideaSketchAgentExtension.ts`
- `src/components/AgentPanel.tsx`
- `src/components/IdeaSketchEditor.tsx`
- `src-tauri/src/agent/session.rs`
