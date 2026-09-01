---
id: "B052"
title: "Continue Compatibility Turns after editor read Tools"
type: "bugfix"
status: "complete"
summary: "Return editor Tool results to the Compatibility provider and continue the bounded Turn until it produces a substantive answer."
source: "docs/superplan/human/bugs.md"
created: "2026-09-01"
order: 52
depends_on: []
parent: ""
---

# Continue Compatibility Turns after editor read Tools Plan

**Goal:** Ensure a Compatibility Turn continues after an editor Tool call so the provider can use the result and answer the user.
**Scope:** Extend the existing bounded Compatibility Tool loop to treat editor Tool calls as provider-visible intermediate work, return each result in the next provider request, and finalize only after a provider response without pending Tool calls. Preserve the current trusted Tool Broker, editor rebinding, prerequisite enforcement, cancellation, Skill/workspace host loop, diagnostics, and response persistence.
**Non-Goals:** Do not replace the Compatibility provider, change Codex runtime selection, alter editor Tool schemas or mutation semantics, change conversation titles, replay hidden reasoning or raw Tool payloads into persistent history, remove max-step/cancellation/safety limits, or change the separate exact Codex-version compatibility issue in B053.
**Architecture:** The Rust `run_agent` Compatibility path remains the orchestration boundary. Editor Tools continue to execute through `execute_editor_tool` and `AgentToolBroker`; their bounded normalized results are appended to the next `runtime::complete` request as ephemeral Tool results. Host/Skill Tools retain their existing activation loop and prompt refresh. A single shared round budget prevents editor and host Tool calls from creating an unbounded provider loop, and terminal reduction occurs only when the provider returns no pending Tool calls.
**Baseline:** `run_agent` currently identifies only workspace and Skill calls as `host_calls`. When a Compatibility completion contains an editor call such as `read_active_page`, it executes the call and emits the Tool result, but because `has_host_calls` is false it exits the loop immediately. An empty provider text is then replaced by `I completed the requested editor Tool activity.` instead of sending the result back for a substantive answer. The existing `compatibility_host_rounds` guard, `AgentToolBroker`, cancellation path, and `emit_tool_result` provide the safety and event primitives to retain.
**Reproduction:** Force the Compatibility runtime (or make Codex unavailable), open an IdeaSketch Page, and ask the Agent to describe the active Page. Observe `read_active_page` execute successfully, followed by the generic completion sentence; the provider never receives the Tool result in a follow-up round.
**Root Cause:** The Compatibility loop's continuation condition is keyed only to host/Skill calls, while editor calls are executed in the same loop but are treated as terminal. This drops the editor Tool result from the provider conversation and finalizes a tool-only completion with the generic fallback text.
**Exit Criteria:** A Compatibility Turn that requests `read_active_page` sends its normalized result back to the provider within the same bounded Turn and returns an answer grounded in that result. Multiple editor calls and mixed editor/host calls remain ordered and bounded by the existing policy; cancellation, Tool failure, prerequisites, diagnostics, and final transcript persistence remain correct. A focused regression fails on the old behavior and passes after the fix, and the relevant frontend/Rust/build checks pass.

## Task 1: Continue Compatibility Turns after Editor Tool Results

**Outcome:** Compatibility provider rounds continue for editor Tool calls and terminate only after a substantive no-Tool provider response or a bounded failure.
**Files:**
- Modify: `src-tauri/src/agent/mod.rs`
- Modify: `src-tauri/src/agent/provider.rs` (only if request/result serialization needs a focused adapter boundary)
- Test: relevant Rust Agent tests under `src-tauri/src/agent/`
- Test: `tests/agentRuntimeSelection.test.mjs` or the focused Agent protocol test that covers Compatibility Tool continuation

**Change Map:**
- Compatibility round state: track pending editor and host/Skill Tool results under one bounded step/round policy.
- Provider handoff: include normalized editor Tool results in the next `runtime::complete` request without persisting them as user-visible conversation messages.
- Terminal reduction: keep the generic tool-only fallback only for an explicitly exhausted/empty result path; normal successful editor Tool Turns must return provider text.
- Safety behavior: preserve `AgentToolBroker` validation/prerequisites, cancellation terminal events, Tool-result emission order, host/Skill activation refresh, and existing diagnostics.

**Verification:**
- `cd src-tauri && cargo test agent::mod`
- `cd src-tauri && cargo test agent::provider`
- `node --test tests/agentRuntimeSelection.test.mjs tests/agentProtocol.test.mjs`
- Regression fixture: Compatibility provider requests `read_active_page`, receives its normalized result on the next round, and answers with data from the result; mixed host/editor calls preserve order; max-step exhaustion, cancellation, Tool failure, and prerequisite rejection remain bounded and terminal.
- `npm run build`
- `cd src-tauri && cargo build`

- [x] Add a focused failing regression for the current tool-only generic response.
- [x] Return editor Tool results to the next Compatibility provider round under the existing bounded safety policy.
- [x] Verify normal, mixed, cancellation, failure, prerequisite, and exhaustion paths before requesting delivery approval.

## Completion Evidence

- Compatibility now treats every provider Tool call, including `read_active_page`, as an intermediate round and returns normalized results through the existing trusted Tool Broker.
- The next provider request receives bounded ephemeral Tool results and refreshed Skill instructions; editor and Host Tool calls preserve execution order.
- The Compatibility round budget is shared across editor and Host/Skill calls, and the terminal diagnostic now truthfully describes any exhausted Agent Tool loop.
- Focused Rust Agent tests (15), provider contract tests (8), frontend protocol/runtime/Skill tests (11), `npm run build`, and `cargo build` passed.
- The full Rust suite reached 175/176 passing; the sole failure is the pre-existing pinned-Codex handshake test covered by B053 (`0.151.0` installed versus expected `0.147.0`).
- The full frontend test suite passed with `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`.

## References
- `docs/superplan/human/bugs.md#B052`
- `src-tauri/src/agent/mod.rs`
- `src-tauri/src/agent/tool_broker.rs`
- `src-tauri/src/agent/provider.rs`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-02-harden-openai-compatible-adapter.md`
- `docs/superplan/plans/features/F038-markdown-editor-and-agent-extension/F038-02-markdown-agent-skill-and-tools.md`
