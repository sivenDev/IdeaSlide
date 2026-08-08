---
id: "F033-01"
title: "Normalize the Agent SDK and Codex-style Interaction UI"
type: "feature"
status: "complete"
summary: "Replace the flattened Agent chat state with an IdeaNote-owned Thread, Turn, Item, Event, and capability SDK plus safe Markdown and first-class activity UI."
source: "docs/superplan/human/features.md"
created: "2026-08-08"
order: 35
depends_on: ["F032"]
parent: "F033"
---

# Normalize the Agent SDK and Codex-style Interaction UI Plan

**Goal:** Give IdeaNote one editor-agnostic frontend Agent contract and a Codex-style right-column experience that can represent real runtime activity without provider-specific UI branches.
**Scope:** Introduce IdeaNote-owned Thread, Turn, Item, Event, Error, Capability, and runtime interfaces; replace `AgentPanel` component-local message/activity state with a deterministic store; render safe Markdown, reasoning summaries, plans, Tool calls/results, approvals, Change Reviews, and classified errors as distinct Items; support Stop, explicit retry, capability-gated steering controls, stable scroll anchoring, and long-transcript virtualization; preserve the independent right Agent column and the existing File Type Registry binding. This phase keeps the current native runtime behind a compatibility adapter and does not add durable history.
**Non-Goals:** This plan does not select Codex or Grok as the default runtime, persist Threads across launches, add background or multi-agent work, expose hidden chain-of-thought, add arbitrary filesystem/shell/network Tools, implement a Markdown editor, change Provider credentials, restore MCP, or weaken review-before-Apply mutation safety.
**Architecture:** React components depend only on `src/lib/agent/` protocol and runtime interfaces. Provider, Rig, Tauri transport, assistant-ui, Codex, and ACP types remain private adapters. An ordered reducer projects normalized Events into Threads, Turns, and Items using stable correlation ids and sequence numbers; duplicate or late events are diagnosed and ignored safely. The active editor binding is captured when a Turn starts, so editor switching cannot retarget an in-flight proposal. Markdown uses a maintained renderer with raw HTML disabled or sanitized. Reasoning UI renders only runtime-supplied summaries, while deterministic activity remains separate.
**Baseline:** `AgentPanel.tsx` currently owns a flat `AgentMessage[]`, one activity string, one error string, and one optional Change Set. Assistant content uses `MessagePrimitive.Content` without a Markdown renderer. The Tauri client emits only `textDelta`, and plans, reasoning summaries, Tool activity, approvals, lifecycle status, retry metadata, and persistent Thread identity are not first-class frontend state. B023 already establishes the correct left Explorer, center editor, right Agent layout.
**Exit Criteria:** The right Agent column displays safe Markdown and distinct message, reasoning-summary, plan, Tool, approval, Change Review, lifecycle, and error Items from normalized fake Events. A real-stream fake visibly updates incrementally; a buffered fake shows an honest waiting state. Stop and retry have explicit state transitions, steering appears only when advertised, duplicate/late deltas do not corrupt the transcript, editor switching does not retarget a Turn, long transcripts remain usable, AI disable tears down the store/runtime subscription, and IdeaSketch Apply/Undo safety remains unchanged. Focused frontend tests, accessibility/layout browser checks, the full Node suite, and `npm run build` pass.

## Task 1: Define the Public Frontend Agent Contract

**Outcome:** Thread, Turn, Item, Event, Error, Capability, and runtime interfaces become the only contract consumed by generic Agent UI and editor extensions.
**Files:**
- Create: `src/lib/agent/protocol.ts`
- Create: `src/lib/agent/agentRuntime.ts`
- Create: `src/lib/agent/agentStore.ts`
- Modify: `src/lib/agent/types.ts`
- Modify: `src/lib/agent/agentClient.ts`
- Modify: `src/lib/agent/assistantUiAdapter.ts`
- Test: `tests/agentProtocol.test.mjs`
- Test: `tests/agentStore.test.mjs`

**Change Map:**
- normalized protocol: Thread/Turn/Item/Event variants, lifecycle status, correlation/sequence ids, retry linkage, persistence flags, and effective capabilities
- Agent runtime interface: create/start/cancel/steer/retry/subscribe methods with no transport or provider types
- deterministic reducer: ordered deltas, final replacement, duplicate suppression, late-event rejection, and capability degradation
- compatibility bridge: map the existing run/textDelta/completion transport into normalized Events without changing native behavior

**Verification:**
- `node --test tests/agentProtocol.test.mjs tests/agentStore.test.mjs tests/agentExtensionRegistry.test.mjs tests/agentChangeSet.test.mjs`
- Cases: ordered/out-of-order deltas; duplicate event ids; missing sequence diagnostics; cancellation; late completion; retry linkage; unsupported reasoning/steering; editor binding captured at Turn start.

- [x] Add the normalized public SDK without leaking Tauri, Rig, assistant-ui, Codex, ACP, or provider types.
- [x] Project deterministic Events into stable Thread, Turn, and Item state.
- [x] Wrap the current runtime as a capability-limited compatibility adapter.

## Task 2: Render Safe Markdown and First-class Agent Activity

**Outcome:** The right column presents Codex-style task activity from structured Items rather than flattening it into prose or one status line.
**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/components/AgentPanel.tsx`
- Create: `src/components/agent/AgentTranscript.tsx`
- Create: `src/components/agent/AgentItem.tsx`
- Create: `src/components/agent/AgentMarkdown.tsx`
- Create: `src/components/agent/AgentReasoningSummary.tsx`
- Create: `src/components/agent/AgentPlan.tsx`
- Create: `src/components/agent/AgentErrorCard.tsx`
- Modify: `src/components/agent/AgentToolActivity.tsx`
- Modify: `src/components/agent/IdeaSketchChangeReview.tsx`
- Test: `tests/agentMarkdown.test.mjs`
- Test: `tests/agentItems.test.mjs`
- Modify: `tests/agentPanel.test.mjs`

**Change Map:**
- Markdown renderer: maintained open-source integration, GitHub-style lists/fences, safe links, code wrapping/copy, and raw HTML disabled or sanitized
- Item renderer: text, reasoning summary, plan, Skill, Tool call/result, approval, Change Review, warning, error, and lifecycle boundaries
- presentation truthfulness: no fabricated reasoning or token streaming; deterministic activity remains visibly distinct from model-provided summaries
- framework isolation: assistant-ui primitives remain an implementation detail beneath IdeaNote Item components

**Verification:**
- `node --test tests/agentMarkdown.test.mjs tests/agentItems.test.mjs tests/agentPanel.test.mjs tests/agentChangeSet.test.mjs`
- Browser cases: heading, list, emphasis, link, fenced code; reasoning disclosure; plan/tool timeline; approval and Change Review cards; configuration/error states; keyboard and screen-reader labels.

- [x] Render assistant content as safe Markdown in the narrow Agent column.
- [x] Render reasoning, plan, Tool, approval, review, and error Items from structured state.
- [x] Preserve proposal-only Change Sets and editor-owned review/apply behavior.

## Task 3: Complete Interaction, Performance, and Layout Acceptance

**Outcome:** Streaming, cancellation, retry, steering degradation, focus, scrolling, and long transcripts behave predictably without disturbing the editor.
**Files:**
- Create: `src/hooks/useAgentThread.ts`
- Create: `src/components/agent/AgentThreadHeader.tsx`
- Modify: `src/components/agent/AgentComposer.tsx`
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/index.css`
- Modify: `tests/agentPanel.test.mjs`
- Modify: `tests/agentShellLayout.test.mjs`
- Test: `tests/agentInteraction.test.mjs`

**Change Map:**
- interaction lifecycle: Send, Stop, explicit retry, queued/steered input, disabled/configuration states, and predictable focus restoration
- streaming UX: frame-batched deltas, first-output waiting state, buffered-stream message, scroll anchoring, and Jump to latest
- transcript performance: bounded Item rendering or virtualization using the existing maintained virtualizer
- layout isolation: Agent transcript updates and column resize do not rerender or misalign the editor Canvas

**Verification:**
- `node --test tests/agentInteraction.test.mjs tests/agentPanel.test.mjs tests/agentShellLayout.test.mjs tests/panelDividerWiring.test.mjs`
- `node --test tests/*.test.mjs`
- `npm run build`
- Browser cases: real-stream fake; buffered fake; Stop; retry; steering hidden/visible by capability; scroll anchoring; 1,000-Item transcript; AI disable; Workspace and Single File layouts; Canvas pointer stability.

- [x] Deliver observable lifecycle transitions for Send, Stop, retry, and capability-gated steering.
- [x] Keep long and streaming transcripts responsive and accessible.
- [x] Verify the independent Agent column and current editor safety regressions end to end.

## Completion Evidence

- Public SDK and reducer: `protocol.ts`, `agentRuntime.ts`, and `agentStore.ts` now define the IdeaNote-owned Thread/Turn/Item/Event/Error/Capability boundary. Focused tests prove ordered and buffered deltas, duplicate suppression, foreign-thread diagnostics, terminal cancellation, ignored late completion, explicit retry linkage, post-completion Change Review updates, and Turn-start editor binding capture without transport or provider types in the public protocol.
- Runtime truthfulness and performance: the existing native text stream is isolated behind a compatibility adapter that advertises text streaming, cancellation, and retry only. Delta events are frame-batched, lifecycle events flush immediately, buffered output says `Waiting for the model`, cancellation cannot be overwritten by a late completion, and unsupported reasoning, plans, approvals, steering, and persistence are not fabricated.
- UI and safety: `react-markdown` 10.1.0 plus `remark-gfm` 4.0.1 render GFM with raw HTML disabled, safe external links, wrapped code, and Copy. Structured Item components render messages, reasoning summaries, plans, Tool activity, approvals, editor-owned Change Reviews, classified errors, and lifecycle boundaries. Apply still requires the captured document/extension, current revision/status/source marker, and the existing proposal-only Change Set path.
- Interaction and visual acceptance: the independent left Explorer, center editor, and right Agent layout was exercised in a temporary browser harness using the production components and normalized fake Items. Complete, waiting, Stop, failed, explicit Retry, Markdown, Tool, plan, reasoning-summary, Change Review, and capability-degraded states rendered correctly; retry visibly returned to `Waiting for the model`. The harness was removed after inspection.
- Verification: focused Agent tests passed 20/20 in the final full run; `node --test tests/*.test.mjs` passed 289/289; `npm run build` passed; dependency inspection confirmed only the intended Markdown packages; and `git diff --check` passed. The build retains only the existing Excalidraw dynamic/static import overlap and large-chunk informational warnings.

## References

- `docs/rfcs/001-codex-style-generic-agent.md`
- `docs/superplan/plans/features/F031-configurable-ai-agent/F031-02-generic-agent-runtime.md`
- `docs/superplan/plans/bugs/B023-separate-agent-right-column.md`
- `src/components/AgentPanel.tsx`
- `src/components/EditorLayout.tsx`
- `src/lib/agent/types.ts`
- `src/lib/agent/agentClient.ts`
- `src/lib/agent/agentExtensionRegistry.ts`
