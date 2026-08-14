---
id: "F060"
title: "Define the Enacta Agent Kernel and Plugin Architecture RFC"
type: "feature"
status: "complete"
summary: "Produce a decision-ready RFC for an Enacta-owned Agent Kernel with capability-secured plugins and specialist runtime adapters."
source: "docs/superplan/human/features.md"
created: "2026-08-14"
order: 60
depends_on: []
parent: ""
---

# Define the Enacta Agent Kernel and Plugin Architecture RFC Plan

**Goal:** Establish a decision-ready architecture for evolving the existing Enacta Agent runtime into an Enacta-owned execution kernel that can safely host model providers, specialist agents, editor capabilities, workflows, and future automation.
**Scope:** Create RFC 003 under `docs/rfcs/` in English. The RFC will assess self-building against adopting Codex, jcode, Octos, or DeepSeek Harness as the product runtime; recommend an Enacta-owned Agent Kernel; define its responsibilities, protocol and event model, plugin taxonomy and lifecycle, capability security, isolation tiers, workflow and multi-Agent model, persistence and recovery, editor transaction boundary, compatibility strategy, observability, versioning, staged migration, risks, alternatives, and measurable acceptance criteria. It will explicitly map which ideas are borrowed from DeepSeek Harness, Codex, jcode, and Octos, while extending rather than duplicating the runtime delivered through RFC 001 and subsequent Agent plans.
**Non-Goals:** This plan does not implement or replace the production Agent runtime, add dependencies, install third-party runtimes, create a plugin marketplace or SDK, migrate stored Threads, enable autonomous background execution, expose arbitrary shell/network/filesystem access, weaken approvals, move editor mutations outside editor-native transactions, modify the current PRD, or promise raw chain-of-thought access. It does not select one external project as a drop-in replacement for the whole Enacta runtime.
**Architecture:** The RFC will make Enacta's Rust-owned Agent Kernel the root authority for session lifecycle, normalized Thread/Turn/Item events, scheduling, Tool dispatch, policy, approvals, cancellation, persistence, recovery, and orchestration. Plugins contribute bounded capabilities through versioned contracts: model providers, Tools, Context providers, specialist agents, workflows, persistence backends, and sandboxes. Trusted built-ins may run in-process; signed native plugins run out-of-process; portable or untrusted plugins run through WASM/WASI or a restricted subprocess. The existing Tool Broker remains the mandatory effect boundary, and editor-owned mutations continue through registry-selected editor transactions with revision/fingerprint checks, external-change rejection, atomic persistence, and native Undo/Redo. DeepSeek Harness informs the composable pipeline, Codex informs bidirectional host Tools and Thread/Turn/Item lifecycle, jcode informs provider/session/background abstractions, and Octos informs triggers, durable workflows, human gates, and multi-Agent coordination. External runtimes remain specialist adapters, not product-level authorities.
**Baseline:** The Enacta product guide defines an Agent-driven, local-first workspace whose real files are the source of truth, whose editors contribute capabilities through a registry, and whose consequential actions remain visible, reversible, auditable, and progressively autonomous. RFC 001 established an application-owned Agent protocol and hybrid adapter direction. The delivered runtime already has normalized Thread/Turn/Item state, durable local history, steering, cancellation, approvals, runtime adapters, a schema-validating Tool Broker with stable call ids and bounded execution, managed Skills, dynamic editor Tools, Workspace read/search/patch/diff/undo operations, active-document/revision protection, and editor-native transactions. The missing decision is how these pieces become a coherent Enacta-owned kernel and plugin platform for long-running workflows and multiple specialist agents without ceding product safety or data authority to an external runtime.
**Exit Criteria:** RFC 003 is understandable without reading implementation code and contains one explicit architecture decision. It defines ownership boundaries, components, protocols, plugin interfaces, trust/isolation tiers, lifecycle/state machines, scheduling and multi-Agent semantics, persistence and recovery, editor and Workspace effect routing, approval/cancellation/idempotency rules, observability, compatibility/versioning, migration phases, alternatives, risks, and acceptance criteria. It includes a capability comparison of Enacta's current runtime, DeepSeek Harness, Codex, jcode, and Octos; states which ideas are adopted, adapted, or rejected; explains its relationship to RFC 001; preserves every local-first and editor-safety invariant; cites the Enacta product guide, repository evidence, and primary upstream sources; and passes documentation, link, Superplan, and Git whitespace validation without application changes.

## Task 1: Author the Enacta Agent Kernel Architecture Decision

**Outcome:** Product and engineering receive one reviewable RFC that defines why Enacta should own its Agent Kernel, how external runtimes and plugins fit beneath it, and how the architecture can evolve safely from the production Agent Core.
**Files:**
- Create: `docs/rfcs/003-enacta-agent-kernel-and-plugin-architecture.md`
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F060-enacta-agent-kernel-and-plugin-architecture-rfc.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- decision and relationship: RFC status, decision summary, extension/supersession boundary with RFC 001, architectural principles, scope, and non-goals
- capability assessment: side-by-side evaluation of the current Enacta runtime, DeepSeek Harness, Codex, jcode, and Octos across loop ownership, protocols, Tools, providers, sessions, background work, workflows, multi-Agent coordination, plugins, security, persistence, and product fit
- kernel model: command/event boundary, Thread/Turn/Item and Job/Workflow state, native loop, scheduler, event store, Tool Registry/Pipeline/Broker, policy/approval engine, sandbox manager, and specialist-agent adapters
- plugin contract: plugin types, manifest, discovery, capability negotiation, schema/version compatibility, lifecycle, health, quotas, cancellation, idempotency, event emission, failure isolation, upgrade/rollback, and trust tiers
- effect safety: editor-owned business mutations, Workspace Host operations, revision/digest/fingerprint checks, external-change rejection, atomic writes, ChangeSet/Diff, Undo/Redo, approval gates, and fail-closed late results
- orchestration: foreground Turns, durable background Jobs, workflow DAGs, triggers, checkpoints, human gates, child/specialist-agent delegation, budgets, provenance, and result import
- operations and rollout: local persistence, redaction, diagnostics, metrics, replay/recovery, staged migration from the current Rust Agent Core, compatibility adapters, feature flags, acceptance gates, alternatives, risks, and deferred decisions

**Verification:**
- Inspect RFC 003 against `docs/product/enacta-product-guide.md`, RFC 001, RFC 002, F032, F033-04, F037-02, F050, and the current Agent/Tool Host implementation boundaries.
- Confirm every comparison claim is backed by a repository fact or a cited primary upstream source, and distinguish observed capability from architectural inspiration.
- Confirm the RFC never treats a JavaScript/Node VM as a sufficient security boundary and never grants plugins authority beyond Kernel-issued capabilities.
- Check all local Markdown links and cited repository paths.
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root /Users/zhengxiwan/ide-workspace/idea-slide validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root /Users/zhengxiwan/ide-workspace/idea-slide --catalog`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root /Users/zhengxiwan/ide-workspace/idea-slide --write --check`
- `git diff --check`

- [x] Define the Enacta-owned Kernel, plugin, event, security, and orchestration contracts.
- [x] Compare the four upstream projects and record adopted, adapted, and rejected ideas.
- [x] Specify a migration roadmap and acceptance gates that preserve the current editor and file-safety invariants.
- [x] Complete documentation and Superplan validation, mark F060 done, and create one isolated commit containing `F060`.

## Completion Evidence

- RFC: `docs/rfcs/003-enacta-agent-kernel-and-plugin-architecture.md` records the decision to evolve the current Rust Agent Core into an Enacta-owned Kernel with capability-secured plugins and specialist adapters.
- Product fit: the RFC preserves the Enacta product guide's real-file source of truth, registry-driven editors, human authority, visibility, reversibility, auditability, and progressive autonomy principles.
- Repository baseline: current `AgentRuntimeAdapter`, `AgentSessionState`, `AgentToolBroker`, `WorkspaceAgentHost`, frontend runtime, and editor Tool Host boundaries were inspected through the indexed code graph and mapped into the staged migration.
- Upstream evidence: DeepSeek Harness, jcode, and Octos were inspected at commits `47f943859bef60e4160492346772ded9b24f765a`, `6057b9f0d3e03552206bf0c10ef56f1b0e6ccb60`, and `b0dc4e6193447023d1cc31710f48eb779f6aac98`; official OpenAI Codex app-server documentation was fetched and used for current protocol claims.
- Verification: all local Markdown references resolve, cited commit-pinned upstream URLs return HTTP 200, `git diff --check` passes, the human request registry validates, and the generated Superplan index validates.

## References

- `docs/product/enacta-product-guide.md`
- `docs/superplan/human/prd.md`
- `docs/rfcs/001-codex-style-generic-agent.md`
- `docs/rfcs/002-agent-perceived-streaming-optimization.md`
- `docs/superplan/plans/features/F032-codex-style-generic-agent-rfc.md`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-04-persistent-threads-and-editor-tools.md`
- `docs/superplan/plans/features/F037-agent-runtime-visibility-and-custom-skills/F037-02-managed-custom-agent-skills.md`
- `docs/superplan/plans/features/F050-codex-like-workspace-file-operations.md`
- `src-tauri/src/agent/adapters/mod.rs`
- `src-tauri/src/agent/session.rs`
- `src-tauri/src/agent/tool_broker.rs`
- `src/lib/agent/agentRuntime.ts`
- `src/lib/agent/agentToolHost.ts`
- `https://github.com/deepseek-ai/deepseek-harness`
- `https://github.com/openai/codex`
- `https://learn.chatgpt.com/docs/app-server`
- `https://github.com/1jehuang/jcode`
- `https://github.com/octos-org/octos`
