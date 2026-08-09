---
id: "F035"
title: "Complete Agent History, Codex Runtime, and Streaming Activity"
type: "feature"
status: "complete"
summary: "Add permanent Thread deletion, guarantee observable text streaming, enable the pinned Codex app-server, and present a Teable-like Agent activity stream."
source: "docs/superplan/human/features.md"
created: "2026-08-09"
order: 40
depends_on: ["F033-04", "F034"]
parent: ""
---

# Complete Agent History, Codex Runtime, and Streaming Activity Plan

**Goal:** Finish the visible Agent lifecycle so users can remove unwanted history, see useful work begin immediately and update continuously, and run the richer production experience on the vetted open-source Codex app-server when available.
**Scope:** Add explicit permanent deletion for local Agent Threads across the Rust repository, Tauri client, hook, and history UI; require confirmation and safely replace the current Thread after deletion; diagnose the current native path from Provider SSE frames through Tauri channels, normalized Events, reducer updates, React rendering, and Markdown presentation; make assistant content visibly update from genuine text deltas before completion when the upstream transport is incremental; add a Teable-inspired activity stream with immediate preparing/working state, elapsed time, concise public progress narration, Plans, and expandable Tool calls/results; move runtime-neutral Turn orchestration and runtime-facing Tool governance from TypeScript into the Rust Agent Core; connect native runtime discovery/selection and the pinned Codex app-server adapter to that production path while preserving the IdeaNote-owned protocol, compatibility fallback, editor extension registry, and AI lifecycle gate; and map public Codex Thread/Turn/Item activity, cancellation, steering, approvals, Plans, dynamic editor Tools, and text deltas into normalized Events. Runtime-supplied process text is displayed only when its protocol explicitly classifies it as user-visible; reasoning-summary availability is not a product requirement.
**Non-Goals:** This plan does not display, request, persist, or infer hidden chain-of-thought; treat private/raw reasoning fields as user-visible process text; fabricate token streaming when a gateway buffers output; cosmetically replay a completed response as fake streaming; require reasoning summaries or show unsupported/not-supplied summary banners; move live editor models, editor-specific parsing, proposal construction, Change Review, Apply, or Undo into Rust; continuously synchronize full dirty editor documents to the native layer; delete user documents, Workspace metadata, Recovery data, credentials, or unrelated Threads; synchronize Agent history; restore MCP; expose arbitrary filesystem, shell, or network Tools; enable Codex built-in direct mutation against user files; auto-approve Change Sets; require Grok; remove the OpenAI-compatible fallback; add background agents, subagents, or multi-agent work; or couple the Agent runtime to IdeaSketch or any future editor format.
**Architecture:** The Rust Agent Core owns runtime discovery and selection, Turn lifecycle and normalized event ordering, Provider/Codex streaming, process/version supervision, the runtime-facing Tool Broker, Tool name/schema/call-id validation, call ledger/idempotency, cancellation/timeouts, bounded/redacted Tool results, Thread persistence, retry/error classification, and AI teardown. TypeScript is a thin UI and editor-extension boundary: it supplies registry-selected Tool definitions plus captured live editor bindings, executes editor-specific reads or proposal construction against the current unsaved model, creates Change Sets, and owns Change Review, Apply, and Undo through the active editor session. A bidirectional Tauri bridge sends a validated Tool request from Rust to the selected TypeScript editor extension and returns a typed read/proposal result to Rust; TypeScript cannot bypass the Rust ledger, and Rust cannot directly mutate or reconstruct editor state from disk. React consumes only IdeaNote-owned Thread/Turn/Item/Event and runtime interfaces. The normalized presentation contract separates assistant answer deltas, public Agent activity, and private runtime reasoning that is discarded. Text deltas pass through the Tauri channel and reducer without waiting for final completion; render updates may be frame-batched for performance but cannot replace observable incremental delivery with one terminal update. Activity begins locally with deterministic lifecycle state and elapsed time, then incorporates runtime-supplied public narration, Plans, and Tool events. Tool rows expose bounded, redacted, user-relevant inputs/results in a disclosure similar to Teable. Production selection prefers the pinned, installed, compatible Codex app-server when dynamic editor Tool and lifecycle gates pass; otherwise it explains the fallback and uses Compatibility without changing editor code. Every editor mutation remains a registry-selected proposal-only Change Set requiring explicit Apply.
**Baseline:** F033 supplies the normalized SDK/UI, compatibility Provider adapter, pinned Codex/Grok adapter prototypes, runtime discovery/selection helpers, persistent create/list/resume/rename/archive history, and trusted editor Tools. F034 supplies encrypted Provider credentials and configurable safe retry. The current code already parses `response.output_text.delta`, sends `TextDelta` over a Tauri `Channel`, converts it to `itemDelta`, and appends it in the Agent reducer, but current native testing reports that the visible Markdown answer still appears only at completion; the exact buffering boundary has not been proven. Production `AgentPanel` still constructs `createCompatibilityAgentRuntime()` unconditionally, so Codex discovery and adapters are not used for real Turns. Thread history offers Rename and Archive but no permanent Delete. A 2026-08-09 Teable Agent inspection showed the target interaction rhythm: immediate `Preparing`, elapsed time, `Working`, a short public work statement, distinct expandable read-Tool rows with safe command/result details, then the final Markdown answer. That experience did not depend on a reasoning-summary availability message.
**Exit Criteria:** A user can permanently delete any non-running local Thread after an accessible confirmation; deleting the current Thread creates or selects a safe replacement and removes the exact repository record without affecting documents or other Threads. A deterministic paced fake Provider and a native localhost Provider prove that partial assistant Markdown is visible before the completion event and continues to grow without duplication, loss, final-text flashing, or scroll jumps; timing evidence identifies whether any configured gateway itself buffers. When a gateway is incremental, IdeaNote preserves that cadence within a bounded render delay; when it is buffered, IdeaNote truthfully shows preparing/working state and activity without replaying fake token deltas. Every Turn immediately shows lifecycle state and elapsed time, renders runtime-supplied public process text when available, and presents Plans and expandable Tool steps/results in execution order. Hidden/private reasoning remains ignored; absence of public process text produces no misleading reasoning banner. Rust, rather than React, controls Turn ordering, runtime selection, Tool call identity, duplicate delivery, cancellation, timeouts, and result bounds; a synthetic second editor still executes its distinct live-model reads/proposals entirely through the TypeScript extension contract without generic runtime or UI changes. Production automatically selects the exact pinned Codex app-server when installed and compatible, exposes the selected runtime and effective capabilities, runs editor reads/proposals through the Rust Tool Broker and typed editor bridge, supports cancellation/steering/approvals according to capability, and falls back cleanly to Compatibility when Codex is missing, incompatible, crashes, or fails initialization. Restart, deletion, runtime recovery, streaming cadence, AI disable/enable, privacy, no-MCP, proposal/Review/Apply/Undo, second-editor reuse, full tests, build, packaging, and native acceptance pass.

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

- [x] Implement exact native Thread deletion and expose it through the generic client boundary.
- [x] Add confirmed history UI and safe current-Thread replacement.
- [x] Prove deletion cannot race active Turns, delayed persistence, pagination, or unrelated data.

## Task 2: Guarantee Observable Text Streaming and Agent Activity

**Outcome:** Real deltas update the answer before completion, while every Turn presents useful Teable-like progress even when the upstream Provider buffers.
**Files:**
- Modify: `src-tauri/src/agent/provider.rs`
- Modify: `src-tauri/src/agent/mod.rs`
- Modify: `src-tauri/src/agent/types.rs`
- Modify: `src/lib/agent/agentClient.ts`
- Modify: `src/lib/agent/agentRuntime.ts`
- Modify: `src/lib/agent/agentStore.ts`
- Modify: `src/lib/agent/protocol.ts`
- Modify: `src/lib/agent/types.ts`
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src/components/agent/AgentTranscript.tsx`
- Modify: `src/components/agent/AgentItem.tsx`
- Modify: `src/components/agent/AgentToolActivity.tsx`
- Modify: `src/index.css`
- Modify: `tests/agentProtocol.test.mjs`
- Modify: `tests/agentStore.test.mjs`
- Modify: `tests/agentItems.test.mjs`
- Modify: `tests/agentPanel.test.mjs`
- Test: `src-tauri/src/agent/provider.rs`

**Change Map:**
- cadence diagnosis: timestamp Provider frame receipt, native event send, frontend callback, reducer application, and bounded render flush without logging prompt/response content
- delta correctness: keep one running assistant Item, append ordered deltas immediately, reconcile final text without duplication or terminal replacement flash, and flush lifecycle/Tool boundaries promptly
- lifecycle experience: show `Preparing` immediately, transition to `Working`, display elapsed time, Stop, retry/fallback state, and completion duration without waiting for model text
- public activity: add normalized user-visible progress Items when supplied, keep deterministic lifecycle separate, and discard raw/private reasoning events
- Tool disclosure: show ordered Tool status rows with safe human labels and expandable bounded/redacted inputs/results; retain proposal Review/Apply as a separate editor-owned step
- buffered truthfulness: keep waiting/activity visible and report buffered delivery diagnostically; never replay a completed answer to imitate token streaming

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml agent -- --nocapture`
- `node --test tests/agentProtocol.test.mjs tests/agentStore.test.mjs tests/agentItems.test.mjs tests/agentPanel.test.mjs tests/agentInteraction.test.mjs`
- Deterministic paced SSE fake: at least three separated text deltas are visible in the frontend store and rendered Markdown before `completed`; final reconciliation is byte-equivalent and duplicate-free.
- Native localhost Provider: capture event/render timestamps, incremental and fully buffered modes, cancellation between deltas, Tool interleaving, Markdown growth, scroll anchoring, and no secret/content logging.

- [x] Locate and fix every application-owned boundary that delays real text deltas until completion.
- [x] Add immediate lifecycle, elapsed-time, public-progress, and expandable Tool activity modeled on the observed Teable interaction.
- [x] Prove incremental delivery is real when supplied and honestly degraded when the gateway buffers.

## Task 3: Move Turn Orchestration and Tool Governance into Rust

**Outcome:** One native Agent Core governs every runtime Turn and Tool call while editor-specific work remains reusable against the captured live TypeScript editor model.
**Files:**
- Create: `src-tauri/src/agent/tool_broker.rs`
- Modify: `src-tauri/src/agent/mod.rs`
- Modify: `src-tauri/src/agent/session.rs`
- Modify: `src-tauri/src/agent/types.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/agent/agentClient.ts`
- Modify: `src/lib/agent/agentRuntime.ts`
- Modify: `src/lib/agent/agentToolHost.ts`
- Modify: `src/lib/agent/types.ts`
- Modify: `src/components/AgentPanel.tsx`
- Modify: `tests/agentProtocol.test.mjs`
- Modify: `tests/agentToolHost.test.mjs`
- Modify: `tests/agentPanel.test.mjs`
- Modify: `tests/agentSecondEditorReuse.test.mjs`
- Test: `src-tauri/src/agent/tool_broker.rs`

**Change Map:**
- native Turn coordinator: select and initialize the runtime, impose one ordered Event sequence, supervise cancellation/timeouts, persist terminal state, and own teardown without React constructing a branded runtime
- Rust Tool Broker: validate registry-supplied Tool definitions, names, JSON Schemas, arguments, stable call ids, duplicate delivery, cancellation, result bounds, redaction, and runtime submission
- typed editor bridge: emit one normalized Tool execution request over the Tauri event channel, accept its correlated result through a native command, reject unknown/late/mismatched responses, and unblock or cancel the awaiting runtime call deterministically
- TypeScript editor executor: reduce `agentToolHost` to captured live-model editor execution, proposal construction, and typed result return; keep defensive extension checks but remove authoritative runtime ledger/orchestration state
- mutation boundary: Rust never reads stale document files as a substitute for live editor state and never Applies or saves; TypeScript cannot return an applied mutation, and every proposal remains bound to Review/Apply/Undo in the active editor session

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml agent::tool_broker -- --nocapture`
- `node --test tests/agentProtocol.test.mjs tests/agentToolHost.test.mjs tests/agentPanel.test.mjs tests/agentSecondEditorReuse.test.mjs tests/agentChangeSet.test.mjs`
- Cases: valid read/proposal; malformed schema/arguments/result; unknown Tool; duplicate call id before/after completion; late result; cancellation and timeout; oversized/redacted result; document switch; stale revision; unsupported editor; second-editor Tool with no generic runtime/UI branch; no direct Apply/save/native document reconstruction.

- [x] Make Rust the authoritative Turn coordinator and remove lifecycle/runtime orchestration from React.
- [x] Route dynamic Tool calls through a native ledger and typed Tauri request/result bridge.
- [x] Keep live editor execution and proposal/Review/Apply/Undo entirely in the reusable TypeScript extension boundary.

## Task 4: Enable Codex App-server as the Production Rich Runtime

**Outcome:** Real Agent Turns use the vetted open-source Codex runtime and expose its public lifecycle/activity through the same generic contract.
**Files:**
- Modify: `src-tauri/src/agent/adapters/mod.rs`
- Modify: `src-tauri/src/agent/adapters/codex_app_server.rs`
- Modify: `src-tauri/src/agent/adapters/codex_schema.rs`
- Modify: `src-tauri/src/agent/session.rs`
- Modify: `src-tauri/src/agent/tool_broker.rs`
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
- Codex lifecycle: initialize/initialized, Thread create/resume, Turn start, answer deltas, public activity, Plans, Tools, approvals, cancel, steer, Tool result, approval result, completion, crash, restart, and shutdown
- process-text policy: stream only Codex Items explicitly intended for user-visible activity; ignore hidden/raw reasoning and do not require reasoning summaries
- editor Tool boundary: expose only registry-selected dynamic read/proposal Tools through the Rust Tool Broker and typed editor bridge; built-in Codex mutation remains disabled/read-only and cannot Apply or save
- settings/status: explain the automatically selected runtime, exact version compatibility, fallback reason, and effective capabilities without exposing executable paths or upstream wire types
- persistence: retain stable local Thread ids plus upstream Thread mapping across restart and fallback without duplicating visible Turns

**Verification:**
- Shared offline contract suite plus installed pinned-Codex handshake and native smoke.
- `cargo test --manifest-path src-tauri/Cargo.toml agent::adapters -- --nocapture`
- `node --test tests/agentRuntimeSelection.test.mjs tests/agentProtocol.test.mjs tests/agentPanel.test.mjs tests/agentToolHost.test.mjs tests/agentChangeSet.test.mjs`
- Cases: Codex selected; missing/incompatible/crashed Codex fallback; answer-delta cadence; public activity present/absent; private reasoning ignored; Thread resume; cancellation; steering; approval; dynamic read/proposal Tool; expandable safe result; duplicate call id; stale target; AI disable teardown; no MCP; no direct write; no runtime-brand branch in editor extensions.

- [x] Route production Turns through normalized native runtime selection instead of hard-coded Compatibility.
- [x] Pass Codex answer deltas, public activity, lifecycle, and dynamic editor Tools through the Rust Tool Broker and editor extension executor.
- [x] Preserve transparent Compatibility fallback, exact version gating, persistence, redaction, AI teardown, and no-hidden-reasoning policy.

## Task 5: Complete Native Delivery and Product Contract

**Outcome:** History deletion, true streaming, Teable-like activity, and Codex production selection ship together without weakening generic editor reuse or security boundaries.
**Files:**
- Modify: `docs/rfcs/001-codex-style-generic-agent.md`
- Modify: `docs/superplan/human/prd.md`
- Modify: `docs/superplan/plans/features/F035-agent-history-codex-runtime-and-streaming-activity.md`
- Modify: `tests/agentSecondEditorReuse.test.mjs`
- Modify: `tests/settings.test.mjs`

**Change Map:**
- product contract: permanent local history deletion, observable answer streaming, Teable-like lifecycle/activity, Rust-owned Turn/Tool governance, TypeScript-owned live editor execution and Change Review, automatic Codex/Compatibility selection, and optional runtime-supplied public process text
- native matrix: delete/restart, incremental/buffered Providers, Codex rich lifecycle, fallback, public activity supplied/absent, Rust Tool Broker request/result correlation, IdeaSketch proposal/Review/Apply/Undo, second-editor Tool reuse, AI disable/enable, and process recovery
- privacy/security: no credentials, hidden reasoning, raw payloads, direct writes, MCP endpoints, or unrelated history deletion
- delivery evidence: complete frontend/Rust/build/package checks, event/render cadence evidence, and final RFC acceptance mapping

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `npm run tauri build -- --debug`
- `git diff --check`
- Native disposable-profile matrix covering delete, restart, paced and buffered streaming, preparing/working/elapsed activity, pinned Codex, fallback, public activity supplied/absent, expandable Tools, editor proposal/Review/Apply/Undo, second-editor reuse, AI teardown, privacy, and no-MCP/no-direct-write guarantees.

- [x] Update the RFC and PRD with the delivered history, streaming, activity, and runtime contracts.
- [x] Pass full native cadence, lifecycle, fallback, editor safety, privacy, accessibility, and recovery acceptance.
- [x] Record complete regression, build, packaging, and product evidence.

## Delivery Evidence

- `node --test tests/*.test.mjs`: 309 passed, 0 failed, including permanent Thread deletion, genuine delta growth, runtime metadata, Rust-owned orchestration, thin editor Tool execution, second-editor reuse, Settings runtime selection, layout, and AI lifecycle coverage.
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`: 117 passed, 0 failed; focused Agent run: 44 passed, including pre-progress Codex crash fallback and no automatic replay after visible or Tool progress.
- `IDEANOTE_CODEX_SMOKE=1 cargo test --manifest-path src-tauri/Cargo.toml installed_codex_executes_dynamic_editor_tool_smoke_when_enabled -- --nocapture`: installed Codex `0.147.0` completed a real app-server Turn, requested a dynamic editor Tool, accepted the correlated host result, and completed successfully.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`, `npm run build`, and `git diff --check`: passed. Clippy reports only known unused future adapter surfaces for steering, Grok ACP, selection helpers, and restart budgeting.
- `npm run tauri build -- --debug`: passed and produced `src-tauri/target/debug/bundle/macos/rw.37760.IdeaNote_0.1.0_aarch64.dmg`; Vite retained the known Excalidraw dynamic-import and large-chunk warnings.
- Desktop/browser acceptance verified the Home Settings entry, automatic Runtime section, independent Explorer/editor/Agent three-column layout, and Agent runtime/model/capability header. Browser-only preview correctly reported that runtime availability requires the desktop app.

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
- `src/components/agent/AgentTranscript.tsx`
- `src/components/agent/AgentToolActivity.tsx`
- `src/lib/agent/agentRuntime.ts`
- `src/lib/agent/agentToolHost.ts`
- `src/lib/agent/runtimeSelection.ts`
- `src-tauri/src/agent/provider.rs`
- `src-tauri/src/agent/repository.rs`
- `src-tauri/src/agent/tool_broker.rs`
- `src-tauri/src/agent/adapters/codex_app_server.rs`
