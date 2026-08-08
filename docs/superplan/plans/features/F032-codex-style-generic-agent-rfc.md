---
id: "F032"
title: "Author the Codex-style Generic Agent RFC"
type: "feature"
status: "draft"
summary: "Produce a decision-ready RFC for a Codex-style, editor-agnostic Agent experience and runtime built on open-source foundations."
source: "docs/superplan/human/features.md"
created: "2026-08-08"
order: 34
depends_on: ["F031-02", "B023", "B024"]
parent: ""
---

# Author the Codex-style Generic Agent RFC Plan

**Goal:** Define a reviewable product and architecture contract for evolving IdeaNote's generic Agent toward Codex-like interaction and capability without coupling the Agent core to IdeaSketch or any future editor.
**Scope:** Create an independent English RFC under `docs/rfcs/` that specifies the target right-column experience, thread/turn/item model, Markdown messages, streamed agent/reasoning-summary/plan/tool activity, cancellation and in-flight steering, persistent local history, provider capability negotiation, safe retry and diagnostics, approvals, Change Review, and editor-contributed dynamic Tools, Skills, Context, and apply adapters. Compare extending the current Rig/OpenAI-compatible runtime, adopting the open-source Codex app-server, and using a hybrid IdeaNote-owned adapter; make one explicit recommendation with boundaries, migration phases, risks, and observable acceptance criteria. Use the current gateway/streaming diagnosis and completed F031/B023/B024 architecture as baseline evidence.
**Non-Goals:** This plan does not implement the RFC, change runtime dependencies, alter the current Agent UI, reintroduce MCP as a product surface, expose arbitrary shell/network/filesystem tools, add multi-agent execution, enable automatic mutation approval, clone Codex branding, or promise raw chain-of-thought. It does not define editor-specific Markdown, IdeaTable, or IdeaWorkflow business tools beyond proving that their future extensions can reuse the generic contract.
**Architecture:** The RFC must preserve an IdeaNote-owned `AgentRuntime`/`AgentProtocol` boundary. Its recommended direction should evaluate the open-source `openai/codex` app-server as a local Agent kernel for threads, turns, items, approvals, history, streamed events, reasoning summaries, and dynamic tool calls, while insulating IdeaNote from its JSON-RPC/version/experimental APIs and retaining a provider-compatible fallback path where required. Editor capabilities continue to enter only through File Type Registry Agent Extensions and must produce proposal-only Change Sets. The UI consumes normalized IdeaNote events rather than provider or app-server wire types. MCP remains retired; editor tool invocation uses the Agent runtime's client-owned dynamic-tool boundary.
**Baseline:** F031 delivered settings, AI gating, a Rig-based OpenAI-compatible text-stream runtime, open Agent Skills, assistant-ui primitives, an Agent Extension Registry, and reviewed IdeaSketch Change Sets. B023 placed Agent in the independent right column, and B024 proved proposal/Apply/Undo in the native app. Current diagnosis shows plain-string Markdown rendering, no reasoning-summary event model, Chat Completions-only requests, gateway buffering of SSE chunks, intermittent TLS request failures, no retry/backoff, weak error classification, no persisted thread model, and a flattened UI that does not represent plans, tools, approvals, or turn items as first-class activity.
**Exit Criteria:** A standalone RFC exists and is understandable without reading implementation code. It defines the user-visible Codex-style interaction contract, generic runtime protocol, event/state model, open-source adoption decision, provider capability matrix, editor-extension boundary, storage and security rules, failure/retry behavior, phased migration, verification strategy, and explicit non-goals. The RFC explains how real reasoning summaries differ from raw reasoning, how buffered gateways degrade streaming, how safe retry avoids duplicated partial output or tool execution, and how future editors reuse the Agent without runtime changes. It cites current repository evidence and official OpenAI documentation for Codex app-server capabilities, passes documentation and Superplan validation, and contains no implementation changes or credentials.

## Task 1: Define the Product Interaction and Protocol Contract

**Outcome:** The RFC gives product and engineering one concrete Codex-style Agent experience and a normalized thread/turn/item protocol that can be implemented independently of any editor or provider.
**Files:**
- Create: `docs/rfcs/001-codex-style-generic-agent.md`

**Change Map:**
- RFC problem statement: current Markdown, reasoning, streaming, diagnostics, history, and activity-model gaps
- interaction design: independent right-column layout, thread header/history, transcript, Markdown messages, reasoning-summary disclosure, plan and tool timeline, approval/review cards, composer, cancel, retry, steer, and configuration/error states
- domain protocol: `AgentThread`, `AgentTurn`, normalized `AgentItem` variants, lifecycle statuses, ordered deltas, capability flags, correlation ids, idempotency, cancellation, and resume semantics
- editor integration: registry-selected Skill, bounded Context, dynamic read/proposal Tools, Change Review, apply/undo adapter, stale-target rejection, and unsupported-editor fallback
- accessibility and performance: keyboard/focus behavior, screen-reader labels, virtualized long transcripts, delta batching, scroll anchoring, and responsive right-column widths

**Verification:**
- Inspect the RFC against F031, B023, B024, the PRD Agent invariants, and the reproduced native/gateway evidence.
- Confirm every user-visible state has an explicit event/state source and no editor-specific behavior leaks into the generic protocol.

- [ ] Specify the Codex-style interaction model with observable UI states and transitions.
- [ ] Define the normalized thread/turn/item/delta protocol and provider capability contract.
- [ ] Preserve the File Type Registry Agent Extension and review-before-apply safety boundary.

## Task 2: Select the Open-source Runtime Direction and Migration Roadmap

**Outcome:** The RFC makes a defensible build-versus-adopt decision and breaks delivery into independently verifiable phases without prematurely changing production code.
**Files:**
- Create: `docs/rfcs/001-codex-style-generic-agent.md`

**Change Map:**
- options analysis: extend current Rig runtime; embed/adapt Codex app-server; hybrid adapter with Codex kernel plus OpenAI-compatible fallback
- recommendation: ownership boundaries, open-source packages/components, version pinning, schema generation, process lifecycle, Tauri integration, and fallback/degradation behavior
- provider matrix: Responses/reasoning summary support, Chat Completions compatibility, real versus buffered streaming, tool support, retry classification, request diagnostics, and model capability discovery
- persistence/security: local thread store, document/workspace association, context compaction, credential redaction, bounded logs, approval records, no direct writes, and no MCP product endpoint
- roadmap: Markdown and activity fixes, normalized protocol, Codex app-server spike, runtime adapter migration, history/steering/approvals, provider hardening, and later editor reuse
- decision risks: experimental dynamic tools, upstream protocol churn, app-server process distribution, provider compatibility, gateway buffering, migration of existing conversations, and test determinism

**Verification:**
- `git diff --check`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root /Users/zhengxiwan/ide-workspace/idea-slide validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --catalog --root /Users/zhengxiwan/ide-workspace/idea-slide`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --write --check --root /Users/zhengxiwan/ide-workspace/idea-slide`

- [ ] Compare maintained open-source options and record one recommended architecture.
- [ ] Define capability degradation, safe retry, diagnostics, persistence, and security policy.
- [ ] Provide phased implementation slices and acceptance evidence for subsequent delivery plans.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F031-configurable-ai-agent/F031-02-generic-agent-runtime.md`
- `docs/superplan/plans/bugs/B023-separate-agent-right-column.md`
- `docs/superplan/plans/bugs/B024-align-tauri-versions-and-verify-agent-editing.md`
- `src/components/AgentPanel.tsx`
- `src/lib/agent/agentClient.ts`
- `src/lib/agent/agentExtensionRegistry.ts`
- `src-tauri/src/agent/runtime.rs`
- `src-tauri/src/agent/provider.rs`
- `https://learn.chatgpt.com/docs/app-server`
- `https://github.com/openai/codex/tree/main/codex-rs/app-server`
- `https://github.com/assistant-ui/assistant-ui`
- `https://github.com/0xPlaygrounds/rig`
