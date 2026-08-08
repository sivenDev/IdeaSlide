---
id: "F035"
title: "Complete Agent History, Codex Runtime, and Reasoning Visibility"
type: "feature"
status: "draft"
summary: "Add permanent Thread deletion, enable the pinned Codex app-server through the generic runtime boundary, and make reasoning-summary availability explicit."
source: "docs/superplan/human/features.md"
created: "2026-08-09"
order: 40
depends_on: ["F033-04", "F034"]
parent: ""
---

# Complete Agent History, Codex Runtime, and Reasoning Visibility Plan

**Goal:** Finish the visible Agent lifecycle so users can remove unwanted history, run the production experience on the vetted open-source Codex app-server when available, and understand whether a Turn supplied a real reasoning summary.
**Scope:** Add explicit permanent deletion for local Agent Threads across the Rust repository, Tauri client, hook, and history UI; require a clear confirmation and safely replace the current Thread after deletion; connect native runtime discovery/selection and the pinned Codex app-server adapter to the production `AgentRuntime` path while preserving the IdeaNote-owned protocol, compatibility fallback, editor Tool host, and AI lifecycle gate; map Codex Thread/Turn/Item events, cancellation, steering, approvals, Plans, reasoning summaries, and dynamic editor Tools into normalized Events; and show a model-supplied reasoning summary when received or an explicit unsupported/not-supplied/degraded state when none is available. Update the RFC and product contract to reflect the selected production policy.
**Non-Goals:** This plan does not display or infer hidden chain-of-thought; fabricate a reasoning stream; delete user documents, Workspace metadata, Recovery data, credentials, or unrelated Threads; synchronize Agent history; restore MCP; expose arbitrary filesystem, shell, or network Tools; enable Codex built-in direct mutation against user files; auto-approve Change Sets; require Grok; remove the OpenAI-compatible fallback; add background agents, subagents, or multi-agent work; or couple the Agent runtime to IdeaSketch or any future editor format.
**Architecture:** Rust remains responsible for durable Thread deletion, local process lifecycle, exact Codex version checks, upstream protocol translation, runtime selection, redaction, and shutdown. React consumes only IdeaNote-owned Thread/Turn/Item/Event and runtime interfaces. Production selection prefers the already pinned, installed, and compatible Codex app-server when its dynamic editor Tool and lifecycle gates pass; otherwise it reports the reason and falls back to Compatibility without changing editor code. Codex built-in mutation capabilities remain disabled or read-only, and every editor mutation continues through the trusted registry-selected Tool host as a proposal-only Change Set requiring explicit Apply. Reasoning is represented as a three-way product state: supplied summary Items, unavailable because the runtime does not support summaries, or not supplied for this Turn despite support. Raw reasoning events remain ignored and never persisted.
**Baseline:** F033 supplies the normalized SDK/UI, compatibility Provider adapter, pinned Codex/Grok adapter prototypes, runtime discovery/selection helpers, persistent create/list/resume/rename/archive history, and trusted editor Tools. F034 supplies encrypted Provider credentials and configurable safe retry. Production `AgentPanel` still constructs `createCompatibilityAgentRuntime()` unconditionally, so Codex discovery and adapters are not used for real Turns. Thread history offers Rename and Archive but no permanent Delete. The compatibility request path can parse `response.reasoning_summary_text.delta`, and the UI can render `reasoningSummary` Items, but production Turns often finish with no summary event and provide no explicit explanation; raw hidden reasoning is correctly ignored.
**Exit Criteria:** A user can permanently delete any non-running local Thread after an accessible confirmation; deleting the current Thread creates or selects a safe replacement and removes the exact repository record without affecting documents or other Threads. Production automatically selects the exact pinned Codex app-server when installed and compatible, exposes the selected runtime and effective capabilities, runs editor reads/proposals through dynamic Tools, supports cancellation/steering/approvals according to capability, and falls back cleanly to Compatibility when Codex is missing, incompatible, crashes, or fails initialization. Every Turn shows a real streamed reasoning-summary Item only when supplied and otherwise shows a precise unsupported/not-supplied/degraded state without exposing hidden chain-of-thought. Restart, deletion, runtime recovery, AI disable/enable, privacy, no-MCP, proposal/Review/Apply/Undo, second-editor reuse, full tests, build, packaging, and native acceptance pass.

## Task 1: Add Permanent Local Thread Deletion

**Outcome:** Thread history supports an explicit, safe, and complete permanent-delete lifecycle.
**Files:**
- Modify: `src-tauri/src/agent/repository.rs`
- Modify: `src-tauri/src/agent/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/agent/agentClient.ts`
- Modify: `src/hooks/useAgentThread.ts`
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src/components/agent/AgentThreadHistory.tsx`
- Modify: `src/lib/agent/agentStore.ts`
- Modify: `tests/agentThreadHistory.test.mjs`
- Modify: `tests/agentThreadRepository.test.mjs`
- Test: `src-tauri/src/agent/repository.rs`

**Change Map:**
- repository deletion: validate the exact Thread id, remove only its record atomically/safely, treat missing records idempotently where appropriate, and return redacted actionable errors
- lifecycle guard: reject deletion while the target Turn is running; after confirmation, switch away from the current Thread before repository removal and leave one valid current Thread
- history UI: add an accessible destructive action, explicit Thread title confirmation, pending/disabled state, focus restoration, and clear failure recovery
- state cleanup: remove the deleted summary/page entry and prevent delayed persistence or events from recreating the deleted Thread

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml agent::repository -- --nocapture`
- `node --test tests/agentThreadRepository.test.mjs tests/agentThreadHistory.test.mjs tests/agentPanel.test.mjs tests/agentStore.test.mjs`
- Cases: delete inactive/current/archived Thread; cancel confirmation; running Turn blocked; missing/corrupt record; pagination boundary; restart; delayed save/event; focus and keyboard behavior; no document, credential, Workspace, or sibling-Thread deletion.

- [ ] Implement exact native Thread deletion and expose it through the generic client boundary.
- [ ] Add confirmed history UI and safe current-Thread replacement.
- [ ] Prove deletion cannot race active Turns, delayed persistence, pagination, or unrelated data.

## Task 2: Enable Codex App-server as the Production Rich Runtime

**Outcome:** Real Agent Turns use the vetted open-source Codex runtime when it satisfies IdeaNote's capability and editor Tool gates.
**Files:**
- Modify: `src-tauri/src/agent/adapters/mod.rs`
- Modify: `src-tauri/src/agent/adapters/codex_app_server.rs`
- Modify: `src-tauri/src/agent/adapters/codex_schema.rs`
- Modify: `src-tauri/src/agent/session.rs`
- Modify: `src-tauri/src/agent/types.rs`
- Modify: `src-tauri/src/agent/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/agent/agentClient.ts`
- Modify: `src/lib/agent/agentRuntime.ts`
- Modify: `src/lib/agent/runtimeSelection.ts`
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src/components/settings/AgentSettings.tsx`
- Modify: `tests/agentRuntimeSelection.test.mjs`
- Modify: `tests/agentPanel.test.mjs`
- Test: `src-tauri/src/agent/adapters/codex_app_server.rs`

**Change Map:**
- production factory: replace unconditional Compatibility construction with native runtime discovery, effective selection, normalized lifecycle subscription, and transparent fallback diagnostics
- Codex lifecycle: initialize/initialized, Thread create/resume, Turn start, text/reasoning/Plan/Tool/approval Items, cancel, steer, Tool result, approval result, completion, crash, restart, and shutdown
- editor Tool boundary: expose only registry-selected dynamic read/proposal Tools; built-in Codex mutation remains disabled/read-only and cannot Apply or save
- settings/status: explain the automatically selected runtime, exact version compatibility, fallback reason, and effective capabilities without exposing executable paths or upstream wire types
- persistence: retain stable local Thread ids plus upstream Thread mapping across restart and fallback without duplicating visible Turns

**Verification:**
- Shared offline contract suite plus installed pinned-Codex handshake and native smoke.
- `cargo test --manifest-path src-tauri/Cargo.toml agent::adapters -- --nocapture`
- `node --test tests/agentRuntimeSelection.test.mjs tests/agentProtocol.test.mjs tests/agentPanel.test.mjs tests/agentToolHost.test.mjs tests/agentChangeSet.test.mjs`
- Cases: Codex selected; missing/incompatible/crashed Codex fallback; Thread resume; cancellation; steering; approval; dynamic read/proposal Tool; duplicate call id; stale target; AI disable teardown; no MCP; no direct write; no runtime-brand branch in editor extensions.

- [ ] Route production Turns through normalized native runtime selection instead of hard-coded Compatibility.
- [ ] Pass Codex lifecycle and dynamic editor Tools through the trusted proposal-only host.
- [ ] Preserve transparent Compatibility fallback, exact version gating, persistence, redaction, and AI teardown.

## Task 3: Make Reasoning-summary Availability Explicit

**Outcome:** Users see real reasoning summaries when supplied and a truthful explanation when they are unavailable or omitted.
**Files:**
- Modify: `src/lib/agent/protocol.ts`
- Modify: `src/lib/agent/agentStore.ts`
- Modify: `src/lib/agent/agentRuntime.ts`
- Modify: `src/lib/agent/types.ts`
- Modify: `src/components/agent/AgentReasoningSummary.tsx`
- Modify: `src/components/agent/AgentItem.tsx`
- Modify: `src/components/agent/AgentThreadHeader.tsx`
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src-tauri/src/agent/provider.rs`
- Modify: `src-tauri/src/agent/adapters/codex_schema.rs`
- Modify: `src-tauri/src/agent/adapters/grok_acp.rs`
- Modify: `src-tauri/src/agent/repository.rs`
- Modify: `tests/agentItems.test.mjs`
- Modify: `tests/agentProtocol.test.mjs`
- Modify: `tests/agentStore.test.mjs`

**Change Map:**
- normalized state: distinguish runtime unsupported, supported-but-not-supplied for this Turn, streamed summary, and degraded/runtime-failure states
- event mapping: accept only official summary events such as `response.reasoning_summary_text.delta` and normalized Codex/ACP summary Items; continue ignoring raw reasoning/chain-of-thought events
- UI: stream and complete supplied summaries in a disclosure; otherwise render one concise non-error explanation instead of implying that reasoning should be visible
- persistence/privacy: persist only user-visible supplied summaries and safe availability metadata; never store hidden reasoning, raw upstream payloads, or fabricated text

**Verification:**
- `node --test tests/agentItems.test.mjs tests/agentProtocol.test.mjs tests/agentStore.test.mjs tests/agentPanel.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml agent -- --nocapture`
- Cases: summary delta stream; runtime unsupported; supported but Provider omitted; fallback after Responses; Codex summary Item; raw reasoning ignored; cancellation/partial summary; restart persistence; screen-reader disclosure and no duplicate unavailable Items.

- [ ] Add explicit reasoning-summary availability semantics to the normalized protocol and store.
- [ ] Render only supplied summaries and truthful unavailable/degraded states.
- [ ] Prove raw hidden reasoning is ignored, never fabricated, and never persisted.

## Task 4: Complete Native Delivery and Product Contract

**Outcome:** The three lifecycle improvements ship together without weakening generic editor reuse or security boundaries.
**Files:**
- Modify: `docs/rfcs/001-codex-style-generic-agent.md`
- Modify: `docs/superplan/human/prd.md`
- Modify: `docs/superplan/plans/features/F035-agent-history-codex-runtime-and-reasoning-visibility.md`
- Modify: `tests/agentSecondEditorReuse.test.mjs`
- Modify: `tests/settings.test.mjs`

**Change Map:**
- product contract: permanent local history deletion, automatic Codex/Compatibility selection, runtime status, and three-way reasoning-summary availability
- native matrix: delete/restart, Codex rich lifecycle, fallback, reasoning supplied/omitted, IdeaSketch proposal/Review/Apply/Undo, second-editor Tool reuse, AI disable/enable, and process recovery
- privacy/security: no credentials, hidden reasoning, raw payloads, direct writes, MCP endpoints, or unrelated history deletion
- delivery evidence: complete frontend/Rust/build/package checks and final RFC acceptance mapping

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `npm run tauri build -- --debug`
- `git diff --check`
- Native disposable-profile matrix covering delete, restart, pinned Codex, fallback, supplied/omitted reasoning summaries, editor Tool proposal/Review/Apply/Undo, second-editor reuse, AI teardown, privacy, and no-MCP/no-direct-write guarantees.

- [ ] Update the RFC and PRD with the delivered runtime, deletion, and reasoning contracts.
- [ ] Pass full native lifecycle, fallback, editor safety, privacy, accessibility, and recovery acceptance.
- [ ] Record complete regression, build, packaging, and product evidence.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/rfcs/001-codex-style-generic-agent.md`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-01-normalized-agent-sdk-and-ui.md`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-02-harden-openai-compatible-adapter.md`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-03-rich-runtime-comparison.md`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-04-persistent-threads-and-editor-tools.md`
- `docs/superplan/plans/features/F034-encrypted-ai-token-configuration.md`
- `src/components/AgentPanel.tsx`
- `src/components/agent/AgentThreadHistory.tsx`
- `src/components/agent/AgentReasoningSummary.tsx`
- `src/lib/agent/agentRuntime.ts`
- `src/lib/agent/runtimeSelection.ts`
- `src-tauri/src/agent/repository.rs`
- `src-tauri/src/agent/adapters/codex_app_server.rs`
