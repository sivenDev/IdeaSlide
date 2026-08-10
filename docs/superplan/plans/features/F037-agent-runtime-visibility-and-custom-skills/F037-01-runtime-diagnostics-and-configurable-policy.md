---
id: "F037-01"
title: "Add Runtime Diagnostics and Configurable Agent Policy"
type: "feature"
status: "complete"
summary: "Expose truthful per-Thread runtime, delivery, and context evidence while making user-meaningful Agent policy values configurable and enforceable."
source: "docs/superplan/human/features.md"
created: "2026-08-10"
order: 42
depends_on: ["B029", "F038-02"]
parent: "F037"
---

# Add Runtime Diagnostics and Configurable Agent Policy Plan

**Goal:** Let users understand the effective Agent runtime and memory state, tune meaningful safety and visibility policies, and receive guidance based only on authoritative evidence.
**Scope:** Add an IdeaNote-owned runtime-health, diagnostic, context, and effective-policy contract across Rust, normalized Events, frontend state, Settings, and local Thread persistence. Classify runtime discovery, startup, fallback, retry, Provider, cancellation, and terminal failures into bounded redacted diagnostic records; map Codex app-server token-usage and compaction notifications; opportunistically capture exact usage from compatible Responses or Chat Completions streams without requiring non-portable fields; distinguish local Compatibility replay truncation from upstream Runtime compaction; and retain source-delivery telemetry as a diagnostic instead of transcript noise. Add validated Agent settings for context warning percentage (default 75, range 50–90), new-Thread recommendation percentage (default 90, range 60–100, and strictly greater than the warning threshold), diagnostic retention count (default 20, range 5–100), Compatibility replay message limit (default 60, range 10–200, and explicitly not a model context limit), delivery-telemetry visibility (default on), and the existing maximum-step limit (default 8, range 1–20). Capture Turn-scoped values at Turn start and make the existing maximum-step control actually constrain Tool activity for every runtime and every registered editor extension without adding format branches.
**Non-Goals:** This plan does not display, request, infer, or persist hidden chain-of-thought; estimate token counts; hard-code model context windows; treat account-level ChatGPT usage as Thread context; expose credentials, executable paths, request headers, URLs with secrets, raw Provider/App-server payloads, prompts, answers, document snapshots, or presentation timers; expose low-level transport timeouts, retry backoff, streaming cadence, or animation constants as user settings; add manual Runtime selection; change automatic fallback or retry safety; restore MCP; add background agents; or make generic UI branch on Codex, Compatibility, IdeaSketch, or any future editor.
**Architecture:** Rust remains authoritative for runtime discovery and selection, adapter-private protocol parsing, failure classification, redaction, retry/fallback evidence, token/context provenance, compaction signals, and runtime-neutral enforcement of the Turn maximum-step policy. Versioned `AgentPolicySettings` owns normalized defaults and bounds. `maxSteps` and `compatibilityReplayMessageLimit` are copied into an immutable effective Turn policy at submission; diagnostic retention and display thresholds are applied through centralized selectors/repositories so a settings update cannot mutate an in-flight Turn. Rust emits normalized `runtimeUpdated`, `runtimeDiagnosticRecorded`, `contextUpdated`, and existing `telemetryUpdated` Events without leaking Provider or Codex wire types. The frontend reducer stores one configured bounded per-Thread diagnostic timeline and one latest context snapshot, while per-Turn source-delivery telemetry remains attached to the Turn. A pure selector derives health and guidance only when exact usage and an exact context window are present. The legacy `compactedBeforeTurnId` marker migrates to an explicitly named local Compatibility-history field.
**Baseline:** `AgentThreadRuntimeMetadata` currently contains runtime kind, label, model, upstream Thread id, one diagnostic string, a misleadingly named `compactedBeforeTurnId`, and degraded state. `agentRuntimeMessagesFromState` sends at most 60 messages and derives that marker locally. Source-delivery telemetry already records first Event/text timing, text span, total duration, delta and character counts, inter-delta percentiles, density, and `incremental`/`burst`/`atomic`/`unknown` behavior, but it has no detailed UI. Provider failures are classified and redacted, yet retry diagnostics are discarded and selection/fallback state is flattened into lifecycle text. Codex 0.147.0 supplies exact token-usage notifications plus current and legacy compaction signals, which the adapter ignores. Settings already expose `maxSteps`, but the value never reaches Rust or limits a Turn; other diagnostics/context thresholds are hard-coded or absent. F038-02 now proves the same generic Agent runtime, Tool Broker, activity UI, and store against both IdeaSketch and Markdown extensions, including direct mutations through Excalidraw and CodeMirror SDK transactions with editor-native Undo/Redo.
**Exit Criteria:** Every Thread exposes its effective runtime, model, capability snapshot, health state, latest safe diagnostics, last-Turn source-delivery telemetry when enabled, effective policy provenance, and context state. Codex usage notifications produce exact total/last input, cached-input, output, reasoning-output, and total counts plus an exact context percentage only when `modelContextWindow` is supplied; Compatibility captures exact usage only when upstream supplies it. Runtime compaction and local Compatibility replay truncation are visibly distinct. Defaults resolve to 75% warning, 90% new-Thread recommendation, 20 diagnostics, 60 Compatibility messages, visible delivery telemetry, and 8 maximum steps; the 50–90, 60–100, 5–100, 10–200, and 1–20 bounds are enforced respectively; invalid or conflicting values normalize safely; the recommendation remains above the warning; and Turn-scoped values do not change mid-run. The maximum-step limit is enforced for Codex and Compatibility Tool activity, including IdeaSketch and Markdown read/mutation sequences, without editor-specific runtime or UI branches. Runtime discovery, initialization, reroute, fallback, retry, Provider error, cancellation, and terminal failure records are classified, redacted, safely persisted, and actionable. Focused/full frontend, Rust, build, package, privacy, persistence, and native acceptance pass.

## Task 1: Define the Diagnostics, Context, and Effective-policy Contract

**Outcome:** Product documentation and shared types define one truthful runtime-health/context model and one validated policy model with explicit provenance and unsupported states.
**Files:**
- Modify: `docs/superplan/human/prd.md`
- Modify: `docs/rfcs/001-codex-style-generic-agent.md`
- Modify: `src/lib/settings.ts`
- Modify: `src/lib/agent/types.ts`
- Modify: `src/lib/agent/protocol.ts`
- Modify: `src-tauri/src/agent/types.rs`
- Modify: `tests/settings.test.mjs`
- Modify: `tests/agentProtocol.test.mjs`

**Change Map:**
- runtime health and diagnostics: effective Runtime/model/capabilities, safe classified records, recovery actions, and allowlisted metadata without executable paths or wire payloads
- context snapshot: exact total and last-Turn token breakdowns, nullable exact context limit, runtime compaction provenance, and explicit `available`/`unavailable`/`unknown` states
- policy schema: validated bounds for context thresholds, diagnostic retention, Compatibility replay, telemetry visibility, and maximum steps; the new-Thread threshold must remain greater than the warning threshold
- effective policy: immutable Turn snapshot for execution-affecting values and named live-display/persistence values for selectors and repositories
- local-history boundary: replace semantic use of `compactedBeforeTurnId` while retaining backward-compatible hydration

**Verification:**
- `node --test tests/settings.test.mjs tests/agentProtocol.test.mjs tests/agentStore.test.mjs`
- Rust serialization tests for exact, unavailable, unknown, legacy, redacted, malformed, and normalized policy values.
- Cases: defaults; lower/upper bounds; threshold collision; missing context window; invalid counts; legacy `compactedBeforeTurnId`; no hidden reasoning/raw payload fields.

- [x] Add failing contracts for diagnostics, exact-or-unavailable context, policy defaults/bounds/relationships, compaction provenance, and legacy migration.
- [x] Define matching Rust and TypeScript normalized types without Runtime- or editor-specific frontend unions.
- [x] Update the PRD and RFC with truthful availability, privacy, automatic-selection, effective-policy, and non-configurable transport rules.

## Task 2: Capture Authoritative Evidence and Enforce Turn Policy

**Outcome:** Codex and Compatibility feed the same normalized evidence pipeline and obey the same captured maximum-step and replay policies.
**Files:**
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src/lib/agent/agentRuntime.ts`
- Modify: `src/lib/agent/agentStore.ts`
- Modify: `src-tauri/src/agent/adapters/mod.rs`
- Modify: `src-tauri/src/agent/adapters/codex_app_server.rs`
- Modify: `src-tauri/src/agent/adapters/codex_schema.rs`
- Modify: `src-tauri/src/agent/provider.rs`
- Modify: `src-tauri/src/agent/tool_broker.rs`
- Modify: `src-tauri/src/agent/mod.rs`
- Test: relevant tests in the modified frontend and Rust modules

**Change Map:**
- Turn submission: capture normalized execution policy and use the configured Compatibility message limit instead of the hard-coded 60-message slice
- maximum steps: count accepted Tool calls in the Rust coordinator/broker across Codex and Compatibility, terminate safely at the configured bound, and never partially replay a mutation
- Codex usage/compaction: map `thread/tokenUsage/updated`, current `contextCompaction`, and legacy `thread/compacted` idempotently
- Compatibility usage: parse exact Responses terminal usage and optional Chat streaming usage when present; preserve `Unavailable` when omitted
- health evidence: retain classified discovery, version gate, initialization, reroute, crash, fallback, cancellation, retry, and Provider terminal diagnostics instead of flattening or discarding them
- ordering/lifecycle: evidence Events share the ordered Turn stream and cannot revive cancelled, failed, deleted, or switched Threads

**Verification:**
- `node --test tests/agentInteraction.test.mjs tests/agentStore.test.mjs tests/settings.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml agent::adapters -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml agent::provider -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml agent::tool_broker -- --nocapture`
- Fixtures: exact usage with/without context window; repeated usage; both compaction forms; replay limits; max-step boundaries for both runtimes; retry then success; fallback; terminal error; cancellation and late Events.

- [x] Add failing adapter, replay, and maximum-step fixtures before changing runtime behavior.
- [x] Emit one normalized context/health stream from Codex and Compatibility without adding brand logic to TypeScript.
- [x] Prove all diagnostics remain classified, redacted, configured-bounded, ordered, and lifecycle-safe.

## Task 3: Persist Safe Snapshots and Derive Configurable Guidance

**Outcome:** Restarted Threads retain useful settled evidence, while pure policy selectors provide guidance without guessing or conflating memory mechanisms.
**Files:**
- Modify: `src-tauri/src/agent/repository.rs`
- Modify: `src/lib/agent/protocol.ts`
- Modify: `src/lib/agent/agentStore.ts`
- Create: `src/lib/agent/agentDiagnostics.ts`
- Modify: `src/hooks/useAgentThread.ts`
- Modify: `tests/agentStore.test.mjs`
- Modify: `tests/agentThreadRepository.test.mjs`
- Test: `tests/agentDiagnostics.test.mjs`
- Test: `src-tauri/src/agent/repository.rs`

**Change Map:**
- repository schema: store latest normalized runtime/context/effective-policy snapshots and trim safe diagnostics to the configured retention count
- migration: project legacy compaction naming into a local Compatibility request-history boundary only
- reducer safety: apply ordered evidence idempotently, reject late/foreign updates, and keep terminal state authoritative
- guidance selector: derive healthy/degraded/approaching-limit/high-pressure/compacted/unavailable/unknown using current validated thresholds and exact evidence only
- lifecycle/privacy: new/resumed/deleted/AI-disabled behavior and rejection of credentials, raw headers/payloads, prompt/answer content, hidden reasoning, document Context, and presentation timers

**Verification:**
- `node --test tests/agentDiagnostics.test.mjs tests/agentStore.test.mjs tests/agentThreadRepository.test.mjs tests/agentInteraction.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml agent::repository -- --nocapture`
- Cases: default and custom threshold boundaries; unavailable numerator/denominator; compaction with/without usage; custom retention trimming; legacy migration; corrupt record; restart; delete race; AI disable; secret/raw-payload rejection.

- [x] Add failing persistence and selector tests for configurable pressure, unsupported states, retention, compaction, and local-history distinction.
- [x] Persist only bounded normalized snapshots and migrate legacy Thread records safely.
- [x] Centralize health and new-Thread guidance in a Runtime/editor-neutral selector.

## Task 4: Add Policy Controls, the Per-Thread Inspector, and Native Acceptance

**Outcome:** Users can configure meaningful Agent policy and inspect Runtime, memory, delivery, and recovery information without cluttering the transcript.
**Files:**
- Create: `src/components/agent/AgentRuntimeInspector.tsx`
- Modify: `src/components/agent/AgentThreadHeader.tsx`
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src/components/settings/AgentSettings.tsx`
- Modify: `src/index.css`
- Test: `tests/agentRuntimeInspector.test.mjs`
- Modify: `tests/agentPanel.test.mjs`
- Modify: `tests/settings.test.mjs`
- Modify: `tests/agentRuntimeSelection.test.mjs`
- Modify: `tests/agentSecondEditorReuse.test.mjs`
- Modify: `tests/markdownAgentExtension.test.mjs`
- Modify: `docs/superplan/plans/features/F037-agent-runtime-visibility-and-custom-skills/F037-01-runtime-diagnostics-and-configurable-policy.md`

**Change Map:**
- Settings: grouped numeric controls with defaults, ranges, relationship errors/reset, concise explanations, and a delivery-telemetry visibility toggle; retain Tool Activity separately
- header/inspector: non-color status, exact percentage only when available, effective runtime/model/capabilities/policy, local-history truncation, last-Turn delivery behavior, and classified diagnostics with recovery actions
- guidance: apply configured thresholds, explain Runtime compaction, and never claim unavailable data or hidden reasoning
- global discovery: expand safe installed/compatible/effective Runtime status while keeping per-Thread evidence out of global settings
- editor reuse: render the same runtime/context/policy evidence and enforce the same Turn limits for IdeaSketch and Markdown without inspecting editor ids or document formats
- interaction/accessibility: keyboard/focus support, narrow-column wrapping, reduced motion, no Canvas rerender dependency, and no transcript/presentation-clock contamination

**Verification:**
- `node --test tests/agentRuntimeInspector.test.mjs tests/agentPanel.test.mjs tests/settings.test.mjs tests/agentRuntimeSelection.test.mjs tests/agentInteraction.test.mjs tests/agentItems.test.mjs`
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `npm run tauri build -- --debug`
- `git diff --check`
- Native matrix: default/custom policy restart; max-step enforcement; Codex usage and compaction; Compatibility usage present/absent and replay truncation; fallback/retry/error/cancel; incremental/burst/atomic telemetry visible/hidden; Thread restart/new/delete; AI disable/enable; IdeaSketch and Markdown read/mutation sequences with Excalidraw/CodeMirror native Undo/Redo; unsupported-editor isolation; privacy inspection.

- [x] Build accessible policy controls and the generic inspector with truthful unavailable states.
- [x] Run focused failure/fix loops across settings, protocol, adapters, persistence, UI, and native Runtime scenarios until clean.
- [x] Complete F037-01 evidence and refresh Superplan progress without implementing F037-02 early.

## Delivery Evidence

- `node --test tests/*.test.mjs`: 347 passed, 0 failed. Focused diagnostics/settings/store/Inspector coverage also passed 28/28 after the final effective-policy and stale-context corrections.
- `cargo test --manifest-path src-tauri/Cargo.toml agent:: -- --nocapture`: 60 passed, 0 failed after the final Rust change. The complete Rust suite previously passed 139/139 against the same implementation, and the real pinned-Codex smoke passed 3/3 for handshake, dynamic read Tool execution, and prerequisite read-to-mutation ordering.
- `npm run build`, `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`, and `git diff --check`: passed. Rust reports only the existing unused future-adapter warnings; Vite reports the existing Excalidraw import and large-chunk warnings.
- `npm run tauri build -- --debug`: passed and produced `src-tauri/target/debug/bundle/macos/IdeaNote.app` and `src-tauri/target/debug/bundle/dmg/IdeaNote_0.1.0_aarch64.dmg`.
- Browser acceptance verified every Agent policy control and default, threshold-conflict normalization, reset behavior, and the Runtime Inspector layout. Warning 90 plus New Thread 60 normalized to 91; reset restored warning 75, New Thread 90, and maximum steps 8.
- Architecture/privacy inspection found no IdeaSketch or Markdown branch in the generic Runtime, Tool Broker, Agent Panel, protocol, store, selector, or Inspector. Context percentages remain exact-or-unavailable; unavailable updates clear stale exact values; Runtime compaction remains distinct from local Compatibility replay truncation; persisted diagnostics are typed, bounded, query/secret-redacted, and exclude raw payloads, hidden reasoning, credentials, and arbitrary metadata.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/rfcs/001-codex-style-generic-agent.md`
- `docs/rfcs/002-agent-perceived-streaming-optimization.md`
- `docs/superplan/plans/features/F031-configurable-ai-agent/F031-01-settings-and-ai-gating.md`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-04-persistent-threads-and-editor-tools.md`
- `docs/superplan/plans/features/F035-agent-history-codex-runtime-and-streaming-activity.md`
- `docs/superplan/plans/features/F038-markdown-editor-and-agent-extension/F038-02-markdown-agent-skill-and-tools.md`
- `docs/superplan/plans/bugs/B029-make-burst-agent-answers-visibly-progressive.md`
- `src/lib/settings.ts`
- `src/lib/agent/agentStore.ts`
- `src/lib/agent/extensions/markdownAgentExtension.ts`
- `src-tauri/src/agent/provider.rs`
- `src-tauri/src/agent/repository.rs`
- `src-tauri/src/agent/adapters/codex_app_server.rs`
- Official Codex app-server documentation: `https://learn.chatgpt.com/docs/app-server`
- Pinned schema evidence: `codex app-server generate-ts --out <temporary-directory>` using Codex `0.147.0`
