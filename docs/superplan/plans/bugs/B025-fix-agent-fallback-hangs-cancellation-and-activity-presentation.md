---
id: "B025"
title: "Fix Agent Fallback Hangs, Cancellation, and Activity Presentation"
type: "bugfix"
status: "complete"
summary: "Make Codex fallback and cancellation terminate reliably, and replace reasoning-summary cards with a Teable-style public activity stream."
source: "docs/superplan/human/bugs.md"
created: "2026-08-09"
order: 25
depends_on: ["F035"]
parent: ""
---

# Fix Agent Fallback Hangs, Cancellation, and Activity Presentation Plan

**Goal:** Make every Agent Turn visibly progress and reach one reliable terminal state, with an effective Stop action and a Teable-style activity presentation.
**Scope:** Separate Codex JSON-RPC handshake timing from active-Turn event timing; preserve immediate cancellation while allowing legitimate multi-minute model and Tool work; make cancellation deterministic across Codex, Compatibility, retry/backoff, and pending editor Tool waits; guarantee that every started Turn completes, fails, or cancels exactly once across the Rust coordinator and frontend reducer; repair Tool call-id correlation; and replace the dedicated Reasoning summary card with a continuous public activity sequence containing lifecycle, concise runtime narration, Plans, Tools, and final Markdown output. Existing hidden/private reasoning remains discarded.
**Non-Goals:** This bugfix does not expose hidden chain-of-thought, label private reasoning as activity, fabricate process narration or token streaming, remove Compatibility fallback, add direct document mutation, change the editor-extension contract, restore MCP, alter AI credentials or Provider retry configuration, redesign Thread history, add a new editor, or replace the pinned Codex app-server runtime.
**Architecture:** Rust remains the authority for runtime selection, timeout policy, Turn lifecycle, Tool correlation, cancellation, fallback, and terminal persistence. `RuntimeCommandSpec` separates short request/handshake deadlines from a bounded multi-minute active-Turn event inactivity deadline; cancellation races those waits directly and is never delayed by the inactivity budget. The session state signals cancellation without prematurely destroying pending Tool-result channels, and one coordinator-owned terminal boundary retires the run and its Tool waiters. The TypeScript runtime bridge and reducer consume that authoritative lifecycle but defensively reconcile a settled native command that omitted a terminal Event, using the normalized active Turn id rather than an independent ref as the Stop authority. Public runtime summaries/narration map into the existing generic activity stream; the product no longer renders a Reasoning summary Item or card, and private/raw reasoning remains ignored.
**Baseline:** F035 enabled the installed Codex app-server, Compatibility fallback, native Tool bridging, streaming activity, and cancellation. The current Codex command spec uses a 30-second `request_timeout`, and `LocalRuntimeProcess::next_message` applies the same deadline while waiting for every active-Turn event. `AgentSessionState::cancel_run` both signals cancellation and immediately clears pending Tool-result senders. `AgentPanel` renders running state from `state.activeTurnId` but sends Stop only through `activeRunId.current`, which is always cleared when `startTurn` settles. The transcript still has a dedicated `AgentReasoningSummary` renderer and normalized `reasoningSummary` Items.
**Reproduction:** In the native app, start a Codex Turn that reads the active Page and then spends more than 30 seconds before its next event. Codex first produces valid activity and completes the editor read Tool, then IdeaNote reports `Local Agent runtime timed out.` A subsequent Turn may show `Codex stopped before producing output; using Compatibility.`, complete Compatibility Tool activity, remain `Working` indefinitely, and ignore Stop. The persisted failed Turn duration and event order match a 30-second post-Tool event wait, not a Provider authentication or gateway connection failure.
**Root Cause:** One timeout field is incorrectly shared by short JSON-RPC request/initialization work and long-lived Turn event streaming, so a healthy but temporarily quiet Codex Turn is classified as a runtime failure and can trigger fallback. Cancellation then races Tool waiter deletion, allowing a closed result channel to win over the cancellation signal. Independently, the frontend keeps two active-run identities: reducer state controls `Working`, while a mutable ref controls Stop and is cleared whenever the native promise settles, even if no terminal Event reached the reducer. This permits a permanently running UI with no cancellable id. The Reasoning summary card is a separate presentation mismatch, and inconsistent Tool event correlation can leave activity rows unmatched.
**Exit Criteria:** A deterministic Codex fake can pause longer than the request timeout after a Tool result and still continue because active-Turn waiting uses its separate inactivity policy; a truly inactive/crashed runtime fails once with a classified terminal error; cancellation interrupts Codex, Compatibility, retry/backoff, fallback, and pending Tool waits promptly without reporting a closed Tool channel. Every started Turn produces exactly one completed, failed, or cancelled boundary in persisted and frontend state, including native settlement without a terminal Event and cancellation returning false; no Turn remains indefinitely `Working`, and Stop always targets the normalized active Turn. The transcript follows a Teable-like sequence of preparing/working state, elapsed time, concise public activity, Plans, expandable Tool rows, and final streamed Markdown, with no Reasoning summary card or hidden chain-of-thought. Tool start/completion/result/review events share one stable call id. Focused asynchronous regressions, full frontend and Rust suites, production build/package checks, and native Codex plus configured-Provider acceptance pass.

## Task 1: Separate Codex Request and Active-Turn Timeout Policies

**Outcome:** Healthy Codex Turns can remain temporarily quiet during legitimate model or Tool work without being misclassified as a stopped runtime.
**Files:**
- Modify: `src-tauri/src/agent/adapters/mod.rs`
- Modify: `src-tauri/src/agent/adapters/process.rs`
- Modify: `src-tauri/src/agent/adapters/codex_app_server.rs`
- Modify: `src-tauri/src/agent/adapters/contract.rs`
- Test: `src-tauri/src/agent/adapters/process.rs`
- Test: `src-tauri/src/agent/adapters/codex_app_server.rs`

**Change Map:**
- runtime command policy: retain a short bounded deadline for spawn/initialize/request-response work and add a distinct bounded multi-minute inactivity deadline for active Turn events
- event wait: reset the inactivity deadline only on actual runtime messages, race cancellation independently, and classify process exit, malformed output, request timeout, and Turn inactivity distinctly
- fallback policy: preserve pre-progress Compatibility fallback, but never describe a healthy quiet Turn as stopped and never replay automatically after visible text or Tool progress
- deterministic fake: pause beyond the request deadline after a completed dynamic Tool call, then emit more activity and a terminal answer; separately prove true inactivity terminates once

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml agent::adapters -- --nocapture`
- Cases: delayed post-Tool event succeeds; request handshake timeout; active-Turn inactivity timeout; process exit; cancellation during each wait; visible/Tool progress prevents unsafe automatic fallback.

- [x] Add focused failing regressions for the current 30-second active-Turn timeout reuse.
- [x] Introduce separate request and Turn-event timing policies without weakening cancellation or fallback safety.
- [x] Re-run the delayed-event, inactivity, crash, and fallback contract matrix.

## Task 2: Make Cancellation and Terminal Lifecycle Deterministic

**Outcome:** Every Turn and pending editor Tool wait reaches exactly one terminal boundary, and Stop remains effective even when transport and UI state settle in an unexpected order.
**Files:**
- Modify: `src-tauri/src/agent/session.rs`
- Modify: `src-tauri/src/agent/tool_broker.rs`
- Modify: `src-tauri/src/agent/mod.rs`
- Modify: `src-tauri/src/agent/types.rs`
- Modify: `src/lib/agent/agentClient.ts`
- Modify: `src/lib/agent/agentRuntime.ts`
- Modify: `src/lib/agent/agentStore.ts`
- Modify: `src/components/AgentPanel.tsx`
- Modify: `tests/agentProtocol.test.mjs`
- Modify: `tests/agentStore.test.mjs`
- Modify: `tests/agentPanel.test.mjs`
- Modify: `tests/agentToolHost.test.mjs`

**Change Map:**
- native cancellation: signal the active run first, let the awaiting runtime/Tool branch observe cancellation, and retire Tool-result senders only at the coordinator-owned finish boundary
- terminal contract: emit and persist one idempotent completed/failed/cancelled Event for every accepted Turn, including fallback errors, channel closure, Tool failure, and AI teardown
- frontend authority: derive Stop from normalized `activeTurnId`, remove/refactor competing run identity, check the native cancellation result, and reconcile native settlement without a terminal Event into an explicit safe terminal state
- late-event safety: reject stale generations, duplicate terminals, late Tool results, and late completion after cancellation without reviving the Turn

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml agent -- --nocapture`
- `node --test tests/agentProtocol.test.mjs tests/agentStore.test.mjs tests/agentPanel.test.mjs tests/agentToolHost.test.mjs tests/agentInteraction.test.mjs`
- Cases: cancel during Codex wait, Compatibility stream, retry backoff, fallback transition, and pending Tool; cancel command returns false; native start settles without terminal Event; duplicate/late terminal; AI disable; no indefinite `Working` state.

- [x] Add behavior-level regressions for the Tool-channel cancellation race and frontend active-id divergence.
- [x] Centralize native run retirement and exactly-once terminal emission.
- [x] Make Stop target the normalized active Turn and reconcile every non-terminal settlement safely.

## Task 3: Replace Reasoning Summary Cards with Continuous Public Activity

**Outcome:** The transcript matches the requested Teable interaction rhythm without exposing or implying hidden model reasoning.
**Files:**
- Modify: `src-tauri/src/agent/adapters/codex_schema.rs`
- Modify: `src-tauri/src/agent/mod.rs`
- Modify: `src-tauri/src/agent/provider.rs`
- Modify: `src-tauri/src/agent/repository.rs`
- Modify: `src-tauri/src/agent/types.rs`
- Modify: `src/lib/agent/protocol.ts`
- Modify: `src/lib/agent/agentStore.ts`
- Modify: `src/components/agent/AgentItem.tsx`
- Delete: `src/components/agent/AgentReasoningSummary.tsx`
- Modify: `src/components/agent/AgentTranscript.tsx`
- Modify: `src/components/agent/AgentToolActivity.tsx`
- Modify: `src/index.css`
- Modify: `tests/agentItems.test.mjs`
- Modify: `tests/agentProtocol.test.mjs`
- Modify: `tests/agentStore.test.mjs`

**Change Map:**
- presentation protocol: stop creating/rendering a dedicated `reasoningSummary` card and map only explicitly public runtime narration into generic ordered activity
- Teable sequence: keep preparing/working and elapsed time compact, render public activity as continuous transcript text, preserve Plans and expandable Tool disclosures, then transition naturally to the final Markdown answer
- privacy and persistence: continue dropping raw/private reasoning; sanitize or migrate legacy persisted summary Items without reviving the removed card
- activity wording: remove `Reasoning summary` labels and unsupported-summary messaging while retaining truthful runtime/fallback diagnostics

**Verification:**
- `node --test tests/agentItems.test.mjs tests/agentProtocol.test.mjs tests/agentStore.test.mjs tests/agentPanel.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml agent -- --nocapture`
- Cases: public narration present/absent; private reasoning ignored; legacy Thread load; ordered Plan/Tool activity; streamed Markdown; no Reasoning summary heading or card.

- [x] Capture the current card rendering as a failing interaction contract.
- [x] Remove the dedicated summary Item/card and reuse the generic public activity stream.
- [x] Verify the Teable-like transcript order, accessibility, persistence compatibility, and hidden-reasoning boundary.

## Task 4: Normalize Tool Identity and Complete Native Regression

**Outcome:** Tool activity, Change Review, cancellation, fallback, and final answers remain correlated and reliable in real desktop use.
**Files:**
- Modify: `src-tauri/src/agent/tool_broker.rs`
- Modify: `src-tauri/src/agent/mod.rs`
- Modify: `src-tauri/src/agent/types.rs`
- Modify: `src/lib/agent/agentRuntime.ts`
- Modify: `src/lib/agent/agentStore.ts`
- Modify: `tests/agentProtocol.test.mjs`
- Modify: `tests/agentToolHost.test.mjs`
- Modify: `tests/agentInteraction.test.mjs`
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/bugs/B025-fix-agent-fallback-hangs-cancellation-and-activity-presentation.md`

**Change Map:**
- Tool identity: normalize one non-empty stable call id at ingestion and reuse it for start, delta, completion, result, persistence, and Change Review; reject `undefined`, mismatched, duplicate, and late ids
- end-to-end native proof: exercise installed Codex with a delayed post-read continuation, configured Compatibility Provider fallback, streamed answer content, proposal-only editor Tool, Stop during runtime and Tool wait, and terminal Thread persistence on a disposable unsaved `.is`
- delivery evidence: record focused failures, final regression/build/package results, native UI behavior, and completed B025 lifecycle without reading or logging credentials or prompt contents

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `npm run tauri build -- --debug`
- `git diff --check`
- Native disposable-document matrix: Codex delayed continuation, legitimate fallback, public activity, streamed Markdown, Tool correlation, proposal/Review/Apply/Undo, Stop during runtime and Tool wait, restart with no running Turn, AI disable teardown, no MCP, no direct write.

- [x] Add correlation regressions that reject missing or divergent Tool ids across all lifecycle Events.
- [x] Run the full automated and native matrix against disposable data and the configured runtimes.
- [x] Complete B025, refresh Superplan state, inspect the final diff, and create a separate `fix(B025)` commit.

## Task 5: Validate the Complete Agent Product Loop

**Outcome:** Every shipped Agent capability is exercised individually and end to end; any discovered regression is fixed and reverified before B025 completes.
**Files:**
- Test: `src/components/AgentPanel.tsx`
- Test: `src/components/agent/AgentThreadHistory.tsx`
- Test: `src/components/settings/AgentSettings.tsx`
- Test: `src/lib/agent/agentRuntime.ts`
- Test: `src/lib/agent/agentStore.ts`
- Test: `src/lib/agent/agentToolHost.ts`
- Test: `src-tauri/src/agent/mod.rs`
- Test: `src-tauri/src/agent/provider.rs`
- Test: `src-tauri/src/agent/repository.rs`
- Test: `src-tauri/src/agent/adapters/codex_app_server.rs`
- Modify: directly affected implementation and focused regression files when validation exposes a defect
- Modify: `docs/superplan/plans/bugs/B025-fix-agent-fallback-hangs-cancellation-and-activity-presentation.md`

**Change Map:**
- configuration: default-on AI gate, encrypted token, password visibility, retry settings, configuration-required state, and AI disable teardown
- conversation: new/resume/rename/archive/delete Thread, restart persistence, Markdown streaming, Teable-style public activity, elapsed lifecycle, Plans, Tool disclosures, retry, and no hidden reasoning
- runtime: automatic pinned Codex selection, valid Compatibility fallback, configured Provider operation, classified errors, cancellation during runtime/Tool/retry, terminal recovery, and no indefinite Working state
- editor integration: IdeaSketch Context/read/proposal Tools, stable call ids, Change Review, explicit Apply, Undo, stale-target rejection, second-editor reuse contract, no MCP, and no direct write
- repair loop: reproduce each newly discovered failure, add the smallest focused regression, fix its first incorrect source, rerun the affected slice, then repeat the complete matrix until clean

**Verification:**
- Focused frontend and Rust checks for each capability group, followed by the complete automated/build/package matrix from Task 4.
- Native desktop checklist on disposable Threads and an unsaved disposable `.is`, including app restart and AI disable/enable.
- Final evidence table records every capability as passed with its automated or native proof; unresolved failures keep B025 in progress.

- [x] Execute the Agent capability checklist one item at a time and retain evidence for each result.
- [x] Add regressions and repair every failure discovered by the validation loop.
- [x] Repeat the full matrix until all Agent capabilities pass without known unresolved defects.

## Completion Evidence

| Capability | Result | Evidence |
| --- | --- | --- |
| Timeout separation and fallback safety | Passed | The delayed-event regression failed against the former shared timeout, then passed with separate 30-second request and 300-second Turn-inactivity policies. Full Rust suite: 120 passed. |
| Cancellation and terminal lifecycle | Passed | Tool-wait cancellation regression and frontend settlement reconciliation pass. Native Stop changed a live Codex Turn to `Agent run cancelled` immediately, restored the composer, and left no `Working` state. |
| Teable-style public activity | Passed | Dedicated Reasoning Summary rendering was removed. Native Codex activity appeared inline as `Using Codex app-server`, concise public narration, and expandable Tool rows; no hidden/raw reasoning surface appeared. |
| Markdown and streaming contract | Passed | Frontend regressions prove genuine deltas render before completion without duplication. Native Codex produced ordered public activity followed by rendered Markdown; no fabricated token smoothing was introduced when upstream delivery was buffered. |
| Runtime and Tool bridge | Passed | Explicit installed-Codex smoke completed one dynamic editor Tool round trip. Native reads and a proposal Tool completed with stable `exec-*` call ids and no `undefined` identity. |
| Change Review safety | Passed | Native mutation request created a pending Change Review only. Apply changed the disposable Page only after explicit review, and Undo restored it. No direct Agent write or MCP path was used. |
| Configuration | Passed | Native Settings showed the encrypted configured credential state, password visibility control, retry toggle and attempt bound, AI default-on gate, and automatic pinned-Codex selection. AI off unmounted the Agent column; AI on restored it. |
| Thread lifecycle and persistence | Passed | Native create, resume, rename, archive, archived filtering, restart persistence, and delete-confirmation flow passed. Permanent delete execution remains covered by repository/frontend automated tests; the native irreversible confirmation was intentionally cancelled. |
| Persistence integrity | Passed | All three persisted Thread records contained zero running Turns, zero `reasoningSummary` Items, zero empty/`undefined` Tool call ids, and zero credential-like keys. The B025 validation Thread persisted three completed Turns and one cancelled Turn. |
| Complete regression/build/package matrix | Passed | Frontend: 310 passed. Rust: 120 passed. `cargo fmt --check`, `cargo clippy --all-targets`, `npm run build`, explicit installed-Codex Tool smoke, `npm run tauri build -- --debug`, and `git diff --check` passed. Debug `.app` and `.dmg` bundles were produced. |

Native validation used a disposable IdeaSketch document and disposable Threads. The saved document was moved to macOS Trash after validation; the archived `B025 Validation` Thread remains available for inspection because permanent deletion requires an explicit irreversible confirmation.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/features/F035-agent-history-codex-runtime-and-streaming-activity.md`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-02-harden-openai-compatible-adapter.md`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-03-rich-runtime-comparison.md`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-04-persistent-threads-and-editor-tools.md`
- `src-tauri/src/agent/adapters/process.rs`
- `src-tauri/src/agent/session.rs`
- `src-tauri/src/agent/mod.rs`
- `src/components/AgentPanel.tsx`
- `src/components/agent/AgentReasoningSummary.tsx`
- `src/lib/agent/agentRuntime.ts`
- `src/lib/agent/agentStore.ts`
