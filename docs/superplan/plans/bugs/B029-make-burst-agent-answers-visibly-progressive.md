---
id: "B029"
title: "Make Burst Agent Answers Visibly Progressive"
type: "bugfix"
status: "complete"
summary: "Separate authoritative Agent delivery from an ephemeral presentation clock so burst and atomic answers grow visibly without delaying Tools or terminal state."
source: "docs/superplan/human/bugs.md"
created: "2026-08-09"
order: 29
depends_on: ["B028"]
parent: ""
---

# Make Burst Agent Answers Visibly Progressive Plan

**Goal:** Give every supported Agent runtime a truthful, Teable-like visibly progressive answer while preserving exact source events, Tool chronology, cancellation, persistence, and editor independence.
**Scope:** Add one runtime-neutral text-delivery telemetry collector used by Compatibility and Codex; classify answer delivery as `incremental`, `burst`, `atomic`, or `unknown`; keep normalized Thread state authoritative; add an editor- and runtime-agnostic frontend presentation controller with an injected scheduler, Unicode-safe adaptive chunking, Tool/event barriers, reduced-motion behavior, and exact final reconciliation; project its ephemeral display state into the existing Markdown transcript; and verify text-only and Tool-using Turns, cancellation, failure, persistence, native Codex, and IdeaSketch editor mutation/Undo behavior. Source completion remains immediate even when a short answer reveal is still draining.
**Non-Goals:** This fix does not expose hidden chain-of-thought or reasoning summaries, generate fake activity prose, claim paced text is live model-token generation, delay or reorder native/Tauri source events, pace Tool/Plan/lifecycle/approval/error events, persist partially revealed content or timer state, branch generic UI on Codex/Compatibility or editor format, replace Codex or the configured gateway, restore MCP, change editor Tool semantics, or add a new editor.
**Architecture:** The Agent pipeline is split into three explicit planes. The Rust source plane keeps adapter-private protocols and immediately emits normalized authoritative Events; a shared bounded `TextDeliveryTelemetryCollector` observes normalized assistant text groups and produces only safe aggregate cadence metrics. The frontend state plane continues to reduce and persist exact source Items, terminal state, Tool order, and telemetry. A separate ephemeral presentation plane synchronizes from normalized source state, owns per-assistant-Item displayed prefixes and timers, and never mutates or serializes Thread Items. Genuine incremental delivery is projected directly; burst or atomic answer text is paced within a bounded 0.8–2.5 second envelope using grapheme-safe, readable chunks. Semantic Items bypass pacing; when one follows pending assistant text, it acts as a barrier that atomically flushes the preceding display prefix before the semantic Item is rendered. Running/Stop state always follows the source Turn, while a separate presentation-only `revealing` signal may remain briefly after completion. Hydration, Thread switches, deletion, AI disable, cancellation, and unmount reset the presentation controller deterministically. No runtime kind or editor extension participates in presentation policy.
**Baseline:** The installed Codex `0.147.0` app-server produced 149 real `item/agentMessage/delta` events in approximately 4 ms, with Turn completion approximately 63 ms later. Rust maps and emits every delta immediately. `useAgentThread` frame-batches `itemDelta` Events, so the whole burst reaches ReactMarkdown inside one browser paint. Compatibility has coarse Provider telemetry, Codex has placeholder timing, and current telemetry counts general stream Events rather than assistant text delivery. `agentStore.ts` appends deltas directly into persisted authoritative Items and also creates visible delivery-diagnostic lifecycle rows. `AgentTranscript` renders those source Items directly and anchors scrolling from source content length. There is no separate display projection, presentation status, barrier controller, or deterministic presentation scheduler.
**Reproduction:** Start a text-only Turn through the installed pinned Codex app-server and observe the normalized Channel trace and rendered transcript. The trace contains 149 ordered assistant deltas, but they arrive within about 4 ms and the Markdown answer appears as one complete block. A Teable comparison under the same visible conditions showed Preparing/Working followed by answer growth over about 5.3 seconds in repeated visible updates. Removing frontend animation-frame batching cannot make a 4 ms source burst readable across browser paints.
**Root Cause:** The normalized protocol models transport streaming but not source-delivery shape or display projection. Codex advertises text streaming without recording cadence, and the frontend uses the authoritative persisted Item as the rendered Item. Consequently synchronous/burst deltas are correctly coalesced by the browser into one paint. The missing boundary is an ephemeral presentation clock that can pace only already-received assistant answer text while leaving source order and semantic lifecycle immediate.
**Exit Criteria:** Compatibility and Codex emit the same bounded text-delivery metrics, and deterministic fixtures classify one large delta as `atomic`, a dense multi-delta window as `burst`, spaced groups as `incremental`, and insufficient evidence as `unknown`. Incremental source text is visible within 100 ms without re-chunking. Burst and atomic answers produce at least six visible updates for a representative long response, normally complete in 0.8–2.5 seconds, and finish byte-identical to authoritative content. Tool/Plan/lifecycle/approval/error events remain immediate; any preceding paced assistant segment is complete before a later Tool row becomes visible. Source completion immediately ends Working and disables Stop even if display state is briefly `revealing`. Cancellation emits no later queued text, failure retains received partial text and one error, reduced-motion avoids character-like pacing, scroll anchoring follows displayed content, and resumed history renders final content immediately with no persisted presentation state. Installed Codex text and Tool Turns, Compatibility streaming, IdeaSketch read/mutation Tools, native editor Undo/Redo, save/reopen, AI disable, full frontend/Rust/build/package checks, and Superplan validation pass.

## Task 1: Normalize Source Text-delivery Telemetry

**Outcome:** Every runtime reports truthful, comparable answer-delivery shape without storing content or coupling UI behavior to runtime brands.
**Files:**
- Create: `src-tauri/src/agent/telemetry.rs`
- Modify: `src-tauri/src/agent/mod.rs`
- Modify: `src-tauri/src/agent/provider.rs`
- Modify: `src-tauri/src/agent/types.rs`
- Modify: `src/lib/agent/types.ts`
- Modify: `src/lib/agent/protocol.ts`
- Modify: `src/lib/agent/agentStore.ts`
- Test: `src-tauri/src/agent/telemetry.rs`
- Test: `src-tauri/src/agent/provider.rs`
- Test: relevant tests in `src-tauri/src/agent/mod.rs`
- Modify: `tests/agentProtocol.test.mjs`
- Modify: `tests/agentStore.test.mjs`
- Modify: `tests/agentThreadRepository.test.mjs`

**Change Map:**
- `TextDeliveryTelemetryCollector`: bounded ephemeral text samples, monotonic timings, text-delta and character counts, p50/p95 inter-delta gaps, densest 100 ms character percentage, and no payload/credential capture
- classification contract: configurable/testable thresholds for `atomic`, `burst`, `incremental`, and `unknown`, based only on non-empty assistant answer deltas
- Compatibility integration: replace Provider-local all-event classification with the shared collector while retaining request strategy, attempts, request timing, retry, and cancellation semantics
- Codex integration: observe normalized `RuntimeEvent::TextDelta` delivery and emit real telemetry before the terminal Event instead of placeholder timing
- protocol/history compatibility: normalize legacy `buffered`/`indeterminate` telemetry during hydration or deserialization, persist new safe aggregates only, and stop converting diagnostic telemetry into transcript lifecycle Items

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml agent::telemetry -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml agent::provider -- --nocapture`
- `node --test tests/agentProtocol.test.mjs tests/agentStore.test.mjs tests/agentThreadRepository.test.mjs`
- Cases: 149-delta 4 ms burst; one large atomic delta; three or more spaced text groups; non-text Events excluded; empty deltas excluded; bounded sample storage; legacy telemetry hydration; no raw prompt, answer, credential, header, or Provider-frame persistence.

- [x] Add focused failing telemetry and compatibility regressions for current Codex placeholders and all-event classification.
- [x] Implement the shared runtime-neutral collector and migrate Compatibility and Codex to it.
- [x] Normalize the public/persisted telemetry contract without adding runtime-specific UI branches or transcript noise.

## Task 2: Build the Ephemeral Agent Text Presentation Controller

**Outcome:** Authoritative Thread state and displayed assistant text have independent clocks behind one generic, deterministically testable SDK boundary.
**Files:**
- Create: `src/lib/agent/agentTextPresentation.ts`
- Create: `src/hooks/useAgentPresentation.ts`
- Modify: `src/hooks/useAgentThread.ts`
- Test: `tests/agentTextPresentation.test.mjs`
- Modify: `tests/agentInteraction.test.mjs`

**Change Map:**
- presentation model: per-Item source content, displayed content, source-delivery classification, `direct`/`paced` mode, and `idle`/`revealing`/`settled` status, keyed outside `AgentThreadState`
- deterministic scheduler: injected clock/timer interface, one owned active timer, bounded cleanup, and no dependency on React rendering or browser globals in core tests
- chunker: `Intl.Segmenter` grapheme boundaries with a tested fallback, adaptive 40–100 ms updates, readable whitespace/punctuation/paragraph/Markdown-boundary preference, and a bounded total reveal duration
- source synchronization: direct projection for genuinely incremental delivery, paced backlog for burst/atomic delivery, exact prefix/reconciliation invariants, and immediate settled display for hydration/resume
- lifecycle cleanup: reset or dispose on Thread switch, deletion, AI disable, cancellation, and unmount; no queued display state crosses Thread or Turn identities

**Verification:**
- `node --test tests/agentTextPresentation.test.mjs tests/agentInteraction.test.mjs`
- Deterministic fake-clock cases: incremental direct delivery; burst and atomic multi-update pacing; short answer immediate path; Unicode emoji/combining marks; Markdown delimiters/fences; exact final bytes; maximum duration; reduced motion; cancellation; failure; reset/dispose; no timers or presentation data after hydration/thread switch.

- [x] Capture the one-paint burst as a failing deterministic presentation contract.
- [x] Implement the generic controller, scheduler, and grapheme-safe adaptive chunker.
- [x] Prove exact reconciliation, bounded pacing, accessibility preference, and complete lifecycle cleanup.

## Task 3: Integrate Chronological Presentation with the Transcript

**Outcome:** The Agent transcript visibly grows like Teable while semantic Events, source lifecycle, scrolling, and Markdown remain truthful and immediate.
**Files:**
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src/components/agent/AgentTranscript.tsx`
- Modify: `src/components/agent/AgentItem.tsx`
- Modify: `src/components/agent/AgentMarkdown.tsx`
- Modify: `src/index.css`
- Modify: `tests/agentItems.test.mjs`
- Modify: `tests/agentPanel.test.mjs`
- Modify: `tests/agentInteraction.test.mjs`
- Modify: `tests/agentMarkdown.test.mjs`
- Modify: `tests/agentStore.test.mjs`

**Change Map:**
- transcript projection: render assistant content from the presentation overlay while all other Item data and persistence remain sourced from authoritative state
- chronological barriers: flush pending earlier assistant display in the same update before exposing a later Tool, Plan, approval, lifecycle, cancellation, or error Item; later assistant segments retain independent pacing
- terminal separation: composer Running/Stop and lifecycle labels use source Turn state only; optional `revealing` styling describes display animation without implying model work
- cancellation/failure: cancel undisplayed queued text at a cancelled boundary; preserve and settle received partial source text before one failed boundary; reject late terminal/delta Events through the existing reducer
- Markdown/scroll/accessibility: keep one ReactMarkdown path, guarantee final DOM equivalence, stabilize code actions during incomplete fences, anchor from displayed length, preserve Jump to latest, and honor reduced motion without rerendering the editor Canvas

**Verification:**
- `node --test tests/agentTextPresentation.test.mjs tests/agentItems.test.mjs tests/agentPanel.test.mjs tests/agentInteraction.test.mjs tests/agentMarkdown.test.mjs tests/agentStore.test.mjs`
- Browser/Tauri cases: text-only incremental/burst/atomic Turns; assistant → read Tool → assistant → mutation Tool → final assistant; completion while revealing; Stop during live source; failure after partial text; user scrolled away; long Markdown; reduced motion; Thread resume/delete/switch; AI disable/enable.

- [x] Add failing UI contracts for visible cadence, Tool barriers, source-versus-presentation terminal state, cancellation, and displayed-content scroll anchoring.
- [x] Wire the presentation overlay into the generic transcript without changing runtime or editor extension contracts.
- [x] Verify Teable-like visible growth, truthful lifecycle, exact Markdown, accessibility, and editor render isolation.

## Task 4: Complete Native Agent and Editor Regression Acceptance

**Outcome:** The refactored two-clock architecture is proven against installed Codex, Compatibility, persisted history, and real IdeaSketch editing before B029 is delivered.
**Files:**
- Modify: directly affected implementation and focused regression files discovered during validation
- Modify: `docs/rfcs/001-codex-style-generic-agent.md`
- Modify: `docs/rfcs/002-agent-perceived-streaming-optimization.md`
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/bugs/B029-make-burst-agent-answers-visibly-progressive.md`

**Change Map:**
- native cadence evidence: installed pinned-Codex text-only Turn records source telemetry and at least six browser-visible answer updates inside the bounded presentation envelope
- semantic ordering: installed Codex Tool Turn preserves assistant/read/mutation/final order with Tool rows immediate and no reasoning-summary surface
- lifecycle and recovery: Stop, failure, retry/fallback, completion-while-revealing, Thread save/restart/resume/delete, and AI disable/enable leave no timers, running Turns, duplicate content, or resurrected Threads
- editor safety: IdeaSketch live read and direct mutation still use the frontend editor SDK, Excalidraw native Undo/Redo, normal autosave/reopen, and stale/read-only/external-change/switched-document/cancellation guards
- architecture record: mark the RFC addendum implemented and record the measured source/presentation cadence, final contract, and any tuned constants without claiming paced text is model generation

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `npm run tauri build -- --debug`
- `git diff --check`
- Installed-Codex and configured-Compatibility native matrix with timestamped source Events and browser-visible presentation samples, followed by a disposable saved `.is` read/mutation/Undo/Redo/autosave/reopen verification.

- [x] Run focused failure/fix loops until every source, presentation, lifecycle, and editor scenario passes.
- [x] Run the complete frontend, Rust, formatting, lint, production, package, privacy, persistence, and native acceptance matrix once on the stabilized implementation.
- [x] Complete B029, refresh Superplan state, inspect the final diff, and create the separate `fix(B029)` commit.

## Completion Evidence

- Frontend: `node --test tests/*.test.mjs` passed 327/327; focused presentation/store/interaction/Markdown/panel matrices also passed.
- Rust: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture` passed 129/129; the focused Agent matrix passed 56/56, including Compatibility delivery fixtures and editor Tool safety regressions.
- Quality and packaging: Rust formatting and Clippy checks passed with only pre-existing dead-code warnings; `npm run build` and `npm run tauri build -- --debug` completed, producing the Debug application and DMG.
- Installed Codex: the pinned handshake and dynamic editor Tool smoke tests passed with `IDEANOTE_CODEX_SMOKE=1`.
- Native cadence: a real text-only Codex Turn exposed seven distinct visible answer sizes over approximately 1.8 seconds before settling exactly; Source Working/Stop followed the runtime Turn rather than the presentation clock.
- Native lifecycle: Stop cancelled immediately, exposed `Agent run cancelled`, and produced no queued answer text during the following 5.9 seconds. A real `read active page` Tool row appeared in chronological order before the final answer.
- Persistence: closing and reopening the IdeaSketch file restored the settled final answer and Tool row immediately with no active Stop state or persisted presentation timer.
- Editor safety: the unchanged B027/B028 native evidence and current full regression suite continue to prove direct IdeaSketch frontend-SDK mutation, Excalidraw native Undo/Redo, autosave/reopen, and stale/read-only/external-change/switched-document/cancellation guards.
- Architecture review: telemetry stores bounded timing/count aggregates only; presentation state remains outside `AgentThreadState`; no Codex, Compatibility, IdeaSketch, or file-format branch exists in the presentation subsystem; RFC 001 and RFC Addendum 002 record the implemented contract and native measurements.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/human/prd.md`
- `docs/rfcs/001-codex-style-generic-agent.md`
- `docs/rfcs/002-agent-perceived-streaming-optimization.md`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-01-normalized-agent-sdk-and-ui.md`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-02-harden-openai-compatible-adapter.md`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-03-rich-runtime-comparison.md`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-04-persistent-threads-and-editor-tools.md`
- `docs/superplan/plans/features/F035-agent-history-codex-runtime-and-streaming-activity.md`
- `docs/superplan/plans/bugs/B025-fix-agent-fallback-hangs-cancellation-and-activity-presentation.md`
- `docs/superplan/plans/bugs/B028-show-real-agent-read-tools-in-execution-order.md`
- `src/hooks/useAgentThread.ts`
- `src/lib/agent/agentStore.ts`
- `src/lib/agent/protocol.ts`
- `src-tauri/src/agent/provider.rs`
- `src-tauri/src/agent/adapters/codex_app_server.rs`
