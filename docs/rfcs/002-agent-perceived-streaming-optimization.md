# RFC Addendum 002: Agent Perceived Streaming Optimization

- Status: Proposed
- Date: 2026-08-09
- Related: RFC 001, B029, F035, B025, B028
- Scope: Diagnosis and optimization design only; no runtime or UI implementation is included

## 1. Decision summary

IdeaNote's Agent pipeline is structurally capable of forwarding text deltas, but the production Codex path does not currently provide a visibly progressive answer. The installed Codex app-server emitted many small deltas in a single narrow burst, and the frontend correctly combined that burst into one animation-frame render. The result is transport-level streaming without user-perceived streaming.

To provide the Teable-like interaction requested for IdeaNote, adopt a two-clock design:

1. **Source clock:** preserve the exact runtime event order, timestamps, lifecycle, cancellation, Tool activity, completion, and error state.
2. **Presentation clock:** render assistant answer text directly when delivery is genuinely incremental, but pace burst or atomic delivery through a bounded, Markdown-aware presentation queue.

Presentation pacing is a UI behavior, not evidence that the model is still generating. It must never be labelled as token streaming, reasoning, or hidden thought. Tool and lifecycle events bypass the queue and remain immediate.

## 2. Reproduction evidence

### 2.1 IdeaNote production runtime boundary

A direct read-only trace against the installed pinned Codex `0.147.0` app-server used the same model and app-server protocol shape as IdeaNote.

| Signal | Observation |
| --- | --- |
| First assistant delta | approximately 8,378 ms after request start |
| Delta count | 149 `item/agentMessage/delta` events |
| Delta burst span | approximately 4 ms, from 8,378 ms to 8,382 ms |
| Turn completion | approximately 8,445 ms |
| Visible implication | all answer deltas are available inside one browser paint interval and appear as one block |

The deltas themselves were small, often one word or punctuation fragment. Their size was not the problem; their arrival cadence was.

Current code then preserves this burst:

- `CodexAppServerAdapter::map_message` maps every `item/agentMessage/delta` to `RuntimeEvent::TextDelta`.
- `run_codex_driver` immediately forwards each delta through `NativeTurnEmitter::append_assistant_delta`.
- the Tauri event contains only that delta and does not wait for Turn completion;
- `useAgentThread` queues `itemDelta` events and flushes them once per animation frame;
- `AgentMarkdown` renders the latest accumulated message.

Therefore the native bridge is not intentionally holding the final answer. The visible atomic result is caused by the upstream burst plus correct frame batching. The current evidence locates the batching at or before the Codex app-server output boundary; it does not yet distinguish whether the configured gateway, Codex provider transport, or app-server internals created the burst.

### 2.2 Teable comparison

A read-only Teable Agent request was sampled every 200 ms in the user's existing Chrome session.

| Signal | Observation |
| --- | --- |
| Immediate activity | `Preparing`, elapsed time, then `Working` |
| First visible answer text | approximately 8,105 ms |
| Last progressive answer update | approximately 13,430 ms |
| Visible growth interval | approximately 5.3 seconds |
| Update rhythm | repeated small additions, commonly observable every 200–450 ms |
| Tool/lifecycle model | activity and Tool rows remain distinct from final answer text |

This proves the target perceptual behavior: the user can read the answer while it grows. Browser observation alone does not prove whether Teable uses provider cadence, a presentation queue, or both, so IdeaNote should copy the observable contract rather than assume Teable's internal implementation.

## 3. Streaming terminology

IdeaNote must use these terms consistently:

| Term | Meaning |
| --- | --- |
| Transport streaming | Multiple runtime or provider events cross the process boundary before completion. |
| Semantic event streaming | Plans, Tools, public activity, errors, and lifecycle changes arrive as ordered typed events. |
| Render streaming | The user can see answer content grow across multiple browser paints. |
| Incremental source delivery | Text arrives over a meaningful time span and can be rendered directly. |
| Burst delivery | Multiple deltas arrive, but most characters arrive inside one narrow time window. |
| Atomic delivery | One text event contains the whole answer. |
| Presentation pacing | Already-received assistant answer text is revealed over multiple paints for readability. |

`textStreaming: true` is insufficient by itself. Runtime diagnostics need both source delivery classification and presentation mode.

## 4. Root cause

The defect is a contract gap rather than a missing `stream: true` flag.

```text
Model / gateway / Codex provider path
              │
              │ 149 deltas in ~4 ms
              ▼
Codex app-server stdout
              │ immediate normalized TextDelta events
              ▼
Rust Agent Core + Tauri channel
              │ immediate itemDelta events
              ▼
requestAnimationFrame event batch
              │ one browser paint
              ▼
ReactMarkdown renders a complete-looking answer
```

Removing animation-frame batching alone is not sufficient. Browsers cannot paint 149 updates received within roughly 4 ms as a readable five-second sequence, and React may still coalesce synchronous work. A presentation policy is required when the source cadence is burst or atomic.

## 5. Proposed architecture

### 5.1 Delivery telemetry at every runtime boundary

Add one runtime-neutral telemetry collector before UI pacing. For each assistant segment, record bounded metrics only:

- runtime kind and model label;
- request start, first event, first text, last text, and completion times;
- text delta count and character count;
- first-to-last delta span;
- p50 and p95 inter-delta gaps when enough samples exist;
- percentage of characters delivered in the densest 100 ms window;
- source classification: `incremental`, `burst`, `atomic`, or `unknown`.

Do not persist raw prompts, answer payloads, credentials, headers, or provider frames as telemetry.

Initial classification thresholds should be testable configuration constants, not protocol semantics:

- `atomic`: one non-empty text delta;
- `burst`: at least two deltas and at least 90% of characters arrive within 120 ms;
- `incremental`: at least three visible text groups span at least 400 ms and do not satisfy the burst rule;
- `unknown`: insufficient or contradictory evidence.

Codex and Compatibility must produce the same normalized telemetry. The current Codex path advertises streaming but does not emit delivery timing, so that gap is part of B029.

### 5.2 Assistant answer presentation queue

Introduce an editor-agnostic `AgentTextPresentationQueue` between normalized answer deltas and rendered assistant content.

The queue owns only display projection. The normalized source Item remains authoritative and complete.

Rules:

1. Lifecycle, Tool, Plan, approval, cancellation, and error events bypass the queue.
2. Genuine incremental delivery renders directly with at most one frame of batching.
3. Burst or atomic answer text enters a paced queue as soon as it is received.
4. Chunk boundaries use Unicode grapheme segmentation and prefer whitespace, punctuation, paragraph, and Markdown block boundaries.
5. A Tool event is a chronological barrier: pending pre-Tool assistant text is flushed before the Tool row is shown.
6. Terminal source state is stored immediately. The UI may have a short independent `revealing` presentation state, but must not keep showing `Working` after the source Turn completed.
7. Final reconciliation replaces the display projection with the authoritative source value exactly once and never duplicates content.
8. Reduced-motion preference disables character-like animation and uses immediate or coarse paragraph batches.

Recommended initial pacing envelope:

- first visible paced chunk within 100 ms of the first burst/atomic text event;
- one visible update every 40–100 ms while the queue is non-empty;
- adaptive chunks of roughly 12–48 graphemes, preferring readable boundaries;
- typical reveal duration of 0.8–2.5 seconds;
- long answers accelerate to a maximum bounded duration rather than delaying completion proportionally to length;
- a user action to reveal the remainder immediately can be added if testing shows the pacing feels slow.

This intentionally does not reproduce Teable's observed five-second duration literally. IdeaNote should target readable progressive feedback without making a completed answer unnecessarily slow.

### 5.3 Source state and presentation state remain separate

The store should expose both concepts without duplicating the Thread model:

```ts
interface AgentTextDeliveryState {
  sourceContent: string;
  displayedContent: string;
  sourceDelivery: "incremental" | "burst" | "atomic" | "unknown";
  presentationMode: "direct" | "paced";
  presentationStatus: "idle" | "revealing" | "settled";
}
```

Persist only final source content and safe delivery telemetry. Do not persist partially revealed display state. Resuming history renders final content immediately.

### 5.4 Markdown behavior

Continue using the maintained Markdown renderer. The queue must not invent a second Markdown parser.

- preserve exact source bytes in the authoritative Item;
- split display chunks on grapheme-safe boundaries;
- prefer completing Markdown delimiters and fenced-code markers in the same chunk where practical;
- tolerate temporarily incomplete Markdown during direct genuine streaming;
- ensure the final rendered DOM matches rendering the final source content from scratch;
- keep code-copy actions disabled or stable until the relevant code block is syntactically present.

### 5.5 Activity and reasoning boundary

Reasoning Summary is not part of the target product interaction. Codex reasoning-summary and raw reasoning events remain ignored at the adapter boundary.

The transcript may show only:

- deterministic IdeaNote lifecycle activity;
- real Tool and Plan events;
- runtime text explicitly classified as public activity;
- assistant answer text.

Presentation pacing applies only to assistant answer text and must not generate fake activity or simulated thinking.

## 6. Failure and cancellation behavior

- Cancellation while the source Turn is running stops the runtime, clears undisplayed queued answer text that was not yet committed to the authoritative source Item, and renders the normalized cancelled boundary.
- If the source already completed, Stop is no longer offered; any remaining presentation queue can settle immediately or finish its bounded reveal.
- A failure after partial source text keeps the received authoritative text, drains or flushes its display queue, and shows the error after that assistant segment.
- Late deltas after a terminal source event remain invalid protocol events and never enter the presentation queue.
- Runtime fallback rules remain unchanged: no automatic fallback or retry after visible text or Tool progress.

## 7. Acceptance matrix

| Scenario | Required evidence |
| --- | --- |
| Incremental fake runtime | Each spaced source delta is visible within 100 ms without presentation re-chunking. |
| Installed Codex burst | Raw trace is classified `burst`; the answer appears in at least six visible updates over 0.8–2.5 seconds without duplication. |
| Atomic provider response | One large delta is classified `atomic` and uses the same bounded presentation queue. |
| Tool between assistant segments | Pre-Tool text is fully visible before Tool Running; post-Tool text begins after Tool completion in chronological order. |
| Completion during reveal | Source completion is recorded immediately; `Working` ends; display settles to the exact final source content. |
| Cancellation | Stop interrupts the live source promptly; no queued text appears after the cancelled boundary. |
| Failure after partial text | Partial content remains readable and the classified error appears once. |
| Markdown | Lists, links, emphasis, and fenced code finish with the same final DOM as non-streamed rendering. |
| Reduced motion | Content appears immediately or in coarse batches without character-like animation. |
| Scroll anchoring | End anchoring works only when the user is already at the end; `Jump to latest` remains available otherwise. |
| Performance | Transcript pacing does not rerender the editor Canvas and stays responsive on long answers. |
| Persistence | Reloaded history contains only settled final content and safe telemetry, never presentation queue state. |

## 8. Delivery phases

### Phase A: Instrument and classify

- add Codex delivery telemetry equivalent to Compatibility telemetry;
- retain bounded raw timestamps in tests, not production transcript payloads;
- add deterministic incremental, burst, and atomic fixtures;
- expose a diagnostic classification without changing visible pacing yet.

### Phase B: Add the presentation queue

- implement the generic queue in the frontend Agent SDK/store layer;
- keep editor extensions and runtime adapters unchanged;
- add chronological barriers for Tool and terminal events;
- add reduced-motion behavior and exact final reconciliation.

### Phase C: Tune against native evidence

- repeat the installed Codex trace;
- verify the configured gateway separately through Compatibility;
- compare screen recordings and DOM samples with the observed Teable cadence;
- tune chunk size and duration from user testing rather than copying Teable timing blindly.

### Phase D: Product verification

- exercise text-only, Tool-using, cancelled, failed, retried, and persisted Turns;
- verify IdeaSketch Tool execution and native editor Undo/Redo remain unchanged;
- run the complete frontend, Rust, build, package, and disposable saved-file Agent matrix.

## 9. Rejected alternatives

### Remove animation-frame batching

Rejected as the sole fix. It increases React work but cannot make a 4 ms upstream burst perceptible across multiple browser paints.

### Insert delays in Rust or the Tauri bridge

Rejected. Transport and lifecycle must remain authoritative and low latency. Presentation belongs in the frontend projection layer.

### Generate fake reasoning or progress prose

Rejected. It would misrepresent hidden model state and repeat the removed Reasoning Summary problem.

### Always pace every response

Rejected. Genuine incremental sources should preserve their real cadence, and reduced-motion users should not receive unnecessary animation.

### Replace Codex solely to obtain prettier streaming

Rejected at this stage. Codex provides the required rich runtime and editor Tool path. First separate delivery truth from presentation quality, then use telemetry to decide whether gateway or runtime configuration needs independent work.

## 10. Open-source reuse

No new framework is required for the first implementation:

- keep React, the current normalized Agent store, and ReactMarkdown;
- use `Intl.Segmenter` for Unicode grapheme-safe chunking with a small tested fallback;
- keep assistant-ui as an internal UI primitive where already used;
- keep Codex app-server and provider wire types private to Rust adapters.

Adopt an additional dependency only if measurement proves the small presentation scheduler cannot be implemented reliably with browser animation/timer primitives.

## 11. Outcome required before implementation is complete

IdeaNote should no longer treat `textStreaming: true` as proof of a streamed experience. Completion requires evidence for all four layers: source delivery, normalized event delivery, browser-paint cadence, and final content reconciliation. The product target is Teable-like readability with Codex-like Tool capability, while preserving truthful lifecycle, no hidden reasoning, and editor-agnostic architecture.
