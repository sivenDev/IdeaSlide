---
id: "F033-02"
title: "Harden the OpenAI-compatible Agent Adapter"
type: "feature"
status: "draft"
summary: "Add capability negotiation, Responses support where available, classified diagnostics, safe retry, and honest streaming telemetry to the current native adapter."
source: "docs/superplan/human/features.md"
created: "2026-08-08"
order: 36
depends_on: ["F033-01"]
parent: "F033"
---

# Harden the OpenAI-compatible Agent Adapter Plan

**Goal:** Make the existing Provider path reliable and diagnosable while preserving compatibility with configured gateways and the normalized Agent SDK.
**Scope:** Refactor the current Rig/OpenAI-compatible runtime behind an explicit adapter contract; negotiate effective capabilities; add a Responses-capable path when the configured endpoint supports it and retain Chat Completions fallback; emit normalized text, reasoning-summary, Tool, lifecycle, timing, and classified error Events; implement bounded exponential-backoff retry only before visible output or Tool execution; diagnose TLS/network/timeouts and buffered gateways without exposing credentials or raw sensitive payloads. Keep the current Provider settings and secure credential vault.
**Non-Goals:** This plan does not require every gateway to support Responses, fake reasoning summaries, cosmetically replay buffered output as transport streaming, retry after partial output or Tool execution, change user credentials, make a rich runtime the default, persist Thread history, expose arbitrary Tools, restore MCP, or permit direct document writes.
**Architecture:** Rust owns Provider requests, credentials, capability discovery, retry policy, timing, cancellation, and redaction. The frontend receives only normalized Events and effective capabilities. Responses and Chat Completions implementations remain private strategies behind the same adapter. A stable request/Turn id and Tool execution ledger prevent duplicated visible output and proposal effects. Streaming telemetry records request, connection, first event, first text, last event, and completion timestamps; buffering classification is diagnostic metadata, not fabricated streaming.
**Baseline:** `runtime.rs` currently constructs a Chat Completions-compatible request through Rig, reports text deltas, and returns an unclassified string error. The configured gateway has intermittently produced TLS failures and may buffer hundreds of SSE events until completion. There is no retry/backoff, effective capability record, first-event timing, Responses path, reasoning-summary event, or structured diagnostic id.
**Exit Criteria:** Offline fake Providers prove Responses-capable and Chat Completions fallback paths, capability degradation, real and buffered streaming classification, cancellation, TLS/network/timeout/HTTP/model error mapping, redaction, safe retry before first output, and no automatic retry after visible output or Tool execution. The Agent UI receives normalized Events without Provider types, a compatibility gateway still completes ordinary requests, credentials never enter frontend state or logs, and Rust tests/format/lint plus frontend contract tests and native smoke pass.

## Task 1: Establish Adapter Capabilities and Error Contracts

**Outcome:** The native runtime reports effective Provider capabilities and actionable redacted errors through the normalized protocol.
**Files:**
- Modify: `src-tauri/src/agent/types.rs`
- Modify: `src-tauri/src/agent/provider.rs`
- Modify: `src-tauri/src/agent/runtime.rs`
- Modify: `src-tauri/src/agent/mod.rs`
- Modify: `src/lib/agent/agentClient.ts`
- Modify: `src/lib/agent/protocol.ts`
- Test: `src-tauri/src/agent/provider.rs`
- Test: `src-tauri/src/agent/runtime.rs`
- Modify: `tests/agentProtocol.test.mjs`

**Change Map:**
- capability negotiation: text streaming, reasoning summary, Tool calls, cancellation, steering, and timing/buffering signals
- error taxonomy: configuration, authentication, permission, rate limit, network, TLS, timeout, provider, protocol, model, context, Tool, runtime, cancellation, and unknown
- diagnostics: stable ids, safe recovery hints, bounded metadata, and secret/header/URL-query redaction
- transport normalization: Rust-native events map to the IdeaNote protocol without leaking Rig or Provider response types

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml agent -- --nocapture`
- `node --test tests/agentProtocol.test.mjs tests/agentStore.test.mjs`
- Cases: every error category; redacted API key/header/query; unsupported capabilities; cancellation distinguished from failure.

- [ ] Normalize effective capabilities across Responses and Chat Completions strategies.
- [ ] Classify failures with safe diagnostics and recovery actions.
- [ ] Keep Provider and Rig types private to the Rust adapter.

## Task 2: Add Responses Support, Safe Retry, and Streaming Diagnostics

**Outcome:** The compatibility runtime uses the richest supported Provider path and handles transient failures without duplicating partial work.
**Files:**
- Modify: `src-tauri/src/agent/provider.rs`
- Modify: `src-tauri/src/agent/runtime.rs`
- Modify: `src-tauri/src/agent/session.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Test: `src-tauri/src/agent/provider.rs`
- Test: `src-tauri/src/agent/runtime.rs`

**Change Map:**
- Provider strategies: Responses-capable execution with Chat Completions fallback and explicit capability evidence
- retry policy: transient-only exponential backoff with jitter, bounded attempts, cancellation awareness, and no retry after visible/Event or Tool progress
- streaming metrics: request/connect/first-event/first-text/last-event/completion timing and buffered-burst classification
- Tool safety: stable call ids and execution ledger preserve proposal-only idempotency across transport duplicates

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml agent -- --nocapture`
- Fake servers: real SSE cadence; fully buffered SSE; TLS/connect failure; timeout; 429/5xx then success before output; failure after first delta; duplicate Tool call id; cancellation during backoff.

- [ ] Use Responses capabilities when verified and degrade safely to Chat Completions.
- [ ] Retry only before visible output or Tool execution and expose attempt metadata in the same Turn.
- [ ] Diagnose buffered gateways without fabricating incremental output.

## Task 3: Verify Configured-gateway Compatibility and Native Safety

**Outcome:** The hardened adapter improves reliability without breaking the existing secure settings and IdeaSketch proposal flow.
**Files:**
- Modify: `tests/agentPanel.test.mjs`
- Modify: `tests/settings.test.mjs`
- Modify: `tests/agentChangeSet.test.mjs`
- Modify: `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-02-harden-openai-compatible-adapter.md`

**Change Map:**
- frontend acceptance: capability indicator, honest waiting/buffering status, classified error card, retry state, and cancellation
- native acceptance: configured Provider read Turn plus proposal/review/Apply/Undo on a disposable unsaved IdeaSketch document
- evidence: no credential/raw authorization data in frontend events, logs, diagnostics, Thread state, or persisted settings

**Verification:**
- `node --test tests/agentPanel.test.mjs tests/settings.test.mjs tests/agentChangeSet.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `node --test tests/*.test.mjs`
- `npm run build`
- Native smoke with a disposable unsaved `.is`: read, streamed/buffered status, transient-failure recovery when reproducible, proposal, explicit Apply, Undo, cancellation, and AI disable.

- [ ] Preserve configured gateway compatibility and secure credential ownership.
- [ ] Re-prove proposal-only mutation, explicit Apply/Undo, cancellation, and AI teardown.
- [ ] Record focused, full, build, native, redaction, and buffering evidence.

## References

- `docs/rfcs/001-codex-style-generic-agent.md`
- `docs/superplan/plans/features/F031-configurable-ai-agent/F031-02-generic-agent-runtime.md`
- `docs/superplan/plans/bugs/B024-align-tauri-versions-and-verify-agent-editing.md`
- `src-tauri/src/agent/runtime.rs`
- `src-tauri/src/agent/provider.rs`
- `src-tauri/src/agent/session.rs`
- `src-tauri/src/agent/types.rs`
- `src/lib/agent/agentClient.ts`
