---
id: "F033-03"
title: "Compare Codex App-server and Grok Build ACP Runtimes"
type: "feature"
status: "complete"
summary: "Build pinned local adapters and run one contract suite to decide how Codex app-server and Grok Build ACP can safely serve IdeaNote."
source: "docs/superplan/human/features.md"
created: "2026-08-08"
order: 37
depends_on: ["F033-01", "F033-02"]
parent: "F033"
---

# Compare Codex App-server and Grok Build ACP Runtimes Plan

**Goal:** Replace feature-list speculation with executable evidence about which open-source rich runtime can satisfy IdeaNote's normalized Agent and editor Tool contracts.
**Scope:** Add adapter-private local stdio process supervision, JSON-RPC framing, version negotiation, schema mapping, and contract fakes; pin and evaluate one Codex app-server release and one Grok Build/ACP release; map lifecycle, text, reasoning summary, plan, Tool, approval, cancellation, resume, and recovery events into the IdeaNote protocol; prove Codex client-owned dynamic Tools; determine whether Grok can accept IdeaNote host Tools without MCP, unrestricted filesystem/shell mutation, or a broad fork; preserve the OpenAI-compatible adapter as fallback. Runtime selection remains capability-gated and experimental until native editor acceptance passes.
**Non-Goals:** This plan does not expose upstream protocol types to React or editor extensions, restore MCP, auto-approve mutation, enable Grok/Codex built-in unrestricted coding Tools against user documents, bundle an unverified runtime by default, require users to install both runtimes, expose arbitrary executable paths to the frontend, add background agents/subagents, or remove the compatibility Provider path.
**Architecture:** Rust owns local process launch, stdio, lifecycle supervision, version checks, authentication handoff, and upstream protocol translation. A shared `AgentRuntimeAdapter` contract and offline contract harness drive Codex, Grok, compatibility, and fake implementations. Executables and protocol versions are exactly pinned or explicitly discovered and rejected when incompatible. Codex dynamic Tools route to the existing trusted Editor Host. Grok starts with `mcpServers: []`; host Tool support must be proven through ACP or a small upstream-compatible Tool-router bridge. If that gate fails, Grok advertises read-only/research capabilities or remains an architectural reference rather than a mutation runtime.
**Baseline:** RFC 001 recommends a hybrid adapter architecture. Official Codex app-server documentation establishes Threads, Turns, Items, streamed reasoning summaries/plans/Tools, approvals, cancellation/steering, persistent history, and experimental dynamic Tools. Grok Build is Apache-2.0 Rust and supports headless/ACP embedding, persistent Sessions, Plans, permissions, and custom models, but its official ACP path does not document a stable client-owned dynamic Tool equivalent and accepts MCP servers during Session creation. IdeaNote's MCP product surface is already removed.
**Exit Criteria:** Offline contract tests map both protocols without leaking their types. Codex proves create/resume/list Thread, start/cancel/steer Turn, Markdown text, reasoning summary, plan, dynamic editor Tool, approval, crash recovery, and version mismatch behavior. Grok proves initialize/authenticate, Session create/resume, prompt/update streaming, plan/tool updates, cancellation/process recovery, and custom model/Base URL handling; it either proves safe host editor Tools with `mcpServers: []` or is explicitly capability-limited. Neither runtime mutates a document before Change Review Apply. A recorded comparison selects a default-rich-runtime rule or preserves both as optional adapters based on test evidence. Rust/frontend contract tests, security checks, packaging feasibility, and disposable native acceptance pass.

## Task 1: Build the Shared Local Runtime Adapter and Contract Harness

**Outcome:** Rich runtimes share one supervised, testable, adapter-private process and protocol boundary.
**Files:**
- Create: `src-tauri/src/agent/adapters/mod.rs`
- Create: `src-tauri/src/agent/adapters/contract.rs`
- Create: `src-tauri/src/agent/adapters/stdio_json_rpc.rs`
- Create: `src-tauri/src/agent/adapters/process.rs`
- Modify: `src-tauri/src/agent/mod.rs`
- Modify: `src-tauri/src/agent/session.rs`
- Modify: `src-tauri/src/agent/types.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Test: `src-tauri/src/agent/adapters/contract.rs`

**Change Map:**
- adapter contract: initialize/capabilities, Thread/Session lifecycle, Turn/prompt, Events, cancel, steer, Tool result, approval result, shutdown, and recovery
- stdio JSON-RPC: bounded framing, correlation ids, request timeouts, stderr redaction, malformed-message handling, and clean shutdown
- process supervision: exact executable/version policy, crash detection, restart bounds, AI-disable teardown, and no frontend-controlled arbitrary command execution
- contract harness: deterministic fake runtime servers and one shared observable acceptance suite

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml agent::adapters -- --nocapture`
- Cases: request/notification ordering; malformed JSON; timeout; crash; restart; cancellation; late events; version mismatch; redacted stderr; AI-disable shutdown.

- [x] Establish one runtime contract and supervised local stdio boundary.
- [x] Make protocol/version/process failures deterministic and safely diagnosable.
- [x] Prove all upstream types remain private to adapters.

## Task 2: Implement and Verify the Codex App-server Adapter

**Outcome:** Codex app-server demonstrates the complete editor Tool and rich interaction contract behind normalized Events.
**Files:**
- Create: `src-tauri/src/agent/adapters/codex_app_server.rs`
- Create: `src-tauri/src/agent/adapters/codex_schema.rs`
- Modify: `src-tauri/src/agent/adapters/mod.rs`
- Modify: `src-tauri/src/agent/provider.rs`
- Test: `src-tauri/src/agent/adapters/codex_app_server.rs`
- Modify: `tests/agentProtocol.test.mjs`

**Change Map:**
- pinned protocol: exact app-server version, generated/version-matched schema mapping, initialization, and compatibility rejection
- lifecycle mapping: Thread/Turn/Item, text/reasoning/plan deltas, approvals, cancellation, steering, history, and crash recovery
- editor Tools: client-owned dynamic Tool definitions and results route through the trusted Agent Editor Host with stable call ids
- safety: upstream built-in mutation capabilities cannot bypass IdeaNote Change Sets and explicit Apply

**Verification:**
- Shared offline runtime contract suite against a deterministic Codex JSON-RPC fake.
- Opt-in local app-server smoke when the pinned executable is available: create/resume/list Thread; Turn start/cancel/steer; text/reasoning/plan; dynamic read/proposal Tool; approval; shutdown/restart; incompatible version.

- [x] Map Codex rich lifecycle Events into the IdeaNote protocol.
- [x] Prove client-owned editor Tools remain proposal-only and idempotent.
- [x] Prove clean lifecycle, recovery, redaction, and version gating.

## Task 3: Implement and Gate the Grok Build ACP Adapter

**Outcome:** Grok Build ACP becomes a safely capability-gated adapter based on demonstrated host Tool behavior rather than assumptions.
**Files:**
- Create: `src-tauri/src/agent/adapters/grok_acp.rs`
- Create: `src-tauri/src/agent/adapters/acp_schema.rs`
- Modify: `src-tauri/src/agent/adapters/mod.rs`
- Modify: `src-tauri/src/agent/provider.rs`
- Test: `src-tauri/src/agent/adapters/grok_acp.rs`
- Modify: `tests/agentProtocol.test.mjs`

**Change Map:**
- pinned ACP path: `grok agent stdio`, auto-update disabled, protocol negotiation, authentication methods, Session lifecycle, prompt/update stream, cancellation, Plan/Tool updates, and process recovery
- configuration: custom model/Base URL capability without exposing credentials
- host Tool gate: initialize with `mcpServers: []`; test ACP host extension or a small upstream-compatible Tool router; measure and reject broad forks
- degradation: advertise no mutation Tools when safe host Tool injection is unavailable; never substitute MCP or unrestricted built-in writes

**Verification:**
- Shared offline runtime contract suite against a deterministic ACP fake.
- Opt-in local Grok smoke when installed/authenticated: initialize/authenticate; Session create/resume; prompt and incremental update; Plan/Tool event; cancellation; recovery; custom model; incompatible protocol.
- Mandatory gate: proposal Tool reaches IdeaNote's trusted Editor Host with `mcpServers: []`, or the adapter reports read-only/no-editor-Tools capability.

- [x] Map Grok ACP lifecycle and rich activity into normalized Events.
- [x] Resolve the host editor Tool question without MCP or unrestricted mutation.
- [x] Capability-limit Grok explicitly when the mandatory Tool gate does not pass.

## Task 4: Select Runtime Policy Through Equivalent Native Acceptance

**Outcome:** IdeaNote records an evidence-backed rich-runtime policy without weakening compatibility or editor safety.
**Files:**
- Modify: `src/lib/agent/agentRuntime.ts`
- Modify: `src-tauri/src/agent/provider.rs`
- Modify: `docs/rfcs/001-codex-style-generic-agent.md`
- Modify: `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-03-rich-runtime-comparison.md`
- Test: `tests/agentRuntimeSelection.test.mjs`

**Change Map:**
- selection policy: normalized capabilities and compatibility determine default/optional runtime behavior; UI does not branch on runtime brand
- comparison evidence: contract coverage, Tool safety, lifecycle, packaging, protocol stability, custom Provider support, and maintenance surface
- native acceptance: disposable unsaved IdeaSketch read/proposal/review/Apply/Undo for every mutation-capable adapter; read-only acceptance for capability-limited adapters
- fallback: compatibility adapter remains available when a rich process is missing, incompatible, or disabled

**Verification:**
- `node --test tests/agentRuntimeSelection.test.mjs tests/agentProtocol.test.mjs tests/agentChangeSet.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- Native matrix: fake, compatibility adapter, Codex, and Grok according to effective capabilities; verify no pre-Apply mutation, no MCP endpoint, no credential exposure, process teardown, and fallback.

- [x] Apply one evidence-backed runtime selection and degradation policy.
- [x] Pass equivalent editor lifecycle acceptance for each enabled rich adapter.
- [x] Preserve compatibility fallback, no-MCP policy, and AI lifecycle teardown.

## Delivery Evidence

- The native adapter layer now owns bounded JSONL/JSON-RPC framing, correlation ids, total request timeouts, redacted bounded stderr, exact Codex version checks, ACP protocol checks, bounded restart policy, crash detection, and kill-on-drop/explicit shutdown. A fake stdio child proves request correlation and teardown without using a network or user document.
- Codex is pinned to CLI/app-server `0.147.0`. Generated `--experimental` schemas confirmed `dynamicTools` and `item/tool/call`; the installed local app-server completed the real `initialize`/`initialized` handshake. Offline mappings cover Thread/Turn text, reasoning summaries, Plans, dynamic Tools, approvals, interruption, errors, and proposal-only Tool results while thread/Turn configuration remains read-only with automatic built-in mutation approval disabled.
- Grok is pinned to official source revision `3e620a76a5f374ce644dc7c87f7e990c68348218` and ACP protocol `1`. Official xAI ACP documentation confirmed `grok agent stdio`, authentication, `session/new`, `session/prompt`, incremental `session/update`, cancellation, and `mcpServers: []`. Offline mappings cover assistant chunks, summary-only reasoning when supplied, Plans, Tool activity, permission requests, completion, cancellation, and protocol mismatch. Grok is not installed locally, so no authenticated native Grok smoke was claimed; its editor Tool capability remains false and mutation-required selection degrades to Compatibility.
- Runtime discovery is native-owned and returns only normalized descriptors. Compatibility remains the default until experimental runtime use is explicitly enabled. Codex is preferred only when installed/version-compatible and the editor Tool gate is required; Grok may be selected only for read/research behavior while its host Tool gap remains unresolved. No runtime brand or upstream protocol type enters `src/lib/agent/protocol.ts`.
- `cargo test --manifest-path src-tauri/Cargo.toml agent::adapters -- --nocapture`: 18 focused adapter tests passed, including the installed Codex handshake, shared Codex/Grok contract, schema mapping, no-MCP gate, redaction, malformed/oversized frames, timeout/version behavior, bounded restart, process correlation, and shutdown.
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`: 102 Rust tests passed. `node --test tests/*.test.mjs`: 294 frontend and contract tests passed. `npm run build`, Rust format check, and Clippy all targets passed; only the existing Vite Excalidraw import and large-chunk warnings remain.
- `npm run tauri build -- --debug` built the current macOS application and DMG. No rich runtime is enabled in the product yet, so native editor proposal/Review/Apply/Undo remains on the already-verified compatibility path; F033-04 owns persistent runtime execution and equivalent disposable-editor acceptance before Codex can become an enabled rich runtime.

## References

- `docs/rfcs/001-codex-style-generic-agent.md`
- `docs/superplan/plans/features/F031-configurable-ai-agent/F031-03-remove-legacy-mcp.md`
- `src-tauri/src/agent/runtime.rs`
- `src-tauri/src/agent/provider.rs`
- `src-tauri/src/agent/session.rs`
- `https://learn.chatgpt.com/docs/app-server`
- `https://github.com/openai/codex/tree/main/codex-rs/app-server`
- `https://docs.x.ai/build/cli/headless-scripting#acp`
- `https://github.com/xai-org/grok-build`
