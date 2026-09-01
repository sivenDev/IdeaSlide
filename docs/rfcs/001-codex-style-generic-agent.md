# RFC 001: Codex-style Generic Agent for IdeaNote

- Status: Accepted
- Date: 2026-08-08
- Amended: 2026-08-09 by RFC Addendum 002
- Source: F032
- Delivered through: F035, F036, B027, B028, B029, F038
- Audience: IdeaNote product and engineering

## 1. Summary

IdeaNote will evolve its current editor-agnostic Agent into a Codex-style task surface while preserving the existing product boundary: the Agent is an application-level right column, and every editor contributes only its own Skill, Tools, Context, direct editor-SDK mutation adapter, and native history behavior.

The frontend depends on an IdeaNote-owned Agent SDK and normalized Agent Protocol. It does not depend directly on Codex app-server JSON-RPC types, a model provider SDK, Rig types, or assistant-ui runtime types. The Rust Agent Core owns runtime selection, Turn orchestration, streaming, cancellation, retry, persistence, and runtime-facing Tool governance. TypeScript is limited to the application UI, normalized state projection, live editor Tool execution, and editor-owned direct SDK transactions.

The delivered runtime architecture is a native hybrid adapter architecture:

1. Keep the normalized IdeaNote protocol and editor extension contract stable across runtimes.
2. Run the pinned Codex app-server from Rust when it is installed, version-compatible, and passes the editor Tool safety gate.
3. Fall back automatically to the Rust OpenAI-compatible adapter when Codex is unavailable or cannot initialize.
4. Keep Grok Build ACP behind a pinned, adapter-private evaluation boundary until it supports client-owned editor Tools without MCP or unrestricted mutation.
5. Expose only effective capabilities that the current product UI and native bridge actually implement.

The result should feel similar to Codex in interaction quality and task visibility, but it is not a visual clone and does not adopt Codex branding. IdeaNote continues to own editor safety, document mutation, persistence, recovery, and external-change protection.

The streaming amendment adds a two-clock answer contract. Source events and terminal lifecycle remain authoritative, while the frontend may pace burst or atomic assistant-answer delivery over a bounded interval so the user can perceive progressive output. This presentation behavior is not model reasoning or proof that generation is still running.

## 2. Motivation

The original Agent baseline proved the editor-extension boundary and reviewed mutation workflow but remained a minimal chat implementation.

The F035 delivery closes the following previously confirmed gaps:

- Assistant messages render safe Markdown.
- Genuine provider and Codex text deltas reach the reducer before Turn completion, but the installed Codex path can deliver many small deltas inside one browser paint and therefore still look atomic.
- Deterministic Preparing/Working state, elapsed time, Plans, public runtime activity, and expandable bounded Tool rows are first-class Items.
- Conversations are persistent local Threads and Turns with create, resume, rename, archive, and confirmed permanent deletion.
- A running request can be cancelled; steering and approval controls remain hidden until their end-to-end commands exist.
- Provider errors are classified and presented with actionable recovery.
- Safe pre-progress automatic retry exists and is controlled by versioned Settings with a one-to-five total-attempt bound.
- The configured gateway has shown intermittent TLS failures.
- A configured gateway or rich runtime may buffer or burst text until generation is nearly complete. IdeaNote preserves that source truth while using bounded answer-only presentation pacing when required for readable progressive output.

The current architecture remains valuable:

- AI enablement is a complete lifecycle gate.
- Credentials stay in Rust-owned authenticated-encrypted application configuration and never enter frontend settings or Agent history.
- The Agent occupies an independent application-level right column.
- The Agent runtime is editor-agnostic.
- File Type Registry selects an Agent Extension.
- IdeaSketch and Markdown contribute independent Skills, bounded Context, Tools, direct-apply adapters, and native history behavior.
- Mutation Tools produce opaque, target-bound Change Sets which the trusted active editor validates and applies immediately; they never write files directly.
- Direct editor transactions reuse the normal document session, dirty, save, recovery, and external-change boundaries.

This RFC keeps those strengths and replaces the flattened chat model with a task-oriented Agent protocol.

## 3. Goals

1. Provide a Codex-style right-column task experience with first-class activity items.
2. Render safe Markdown, lists, links, and fenced code blocks.
3. Stream agent messages, public runtime activity, plans, tool activity, approvals, and errors independently when the selected runtime supplies them, and provide bounded progressive answer presentation when text arrives as a burst or atomic value.
4. Support persistent local Threads containing ordered Turns and Items.
5. Support cancellation, explicit retry, and in-flight steering when the runtime supports it.
6. Normalize provider and runtime capabilities behind one Rust Agent Core and one frontend SDK.
7. Reuse maintained open-source foundations behind IdeaNote-owned interfaces.
8. Keep all editor semantics outside the generic runtime and UI.
9. Apply supported Agent edits immediately through the active editor SDK after prerequisite reads and fail-closed target revalidation.
10. Allow Markdown and future editors to reuse the same Agent without runtime changes.

## 4. Non-goals

- Exact reproduction of Codex visuals, branding, or internal implementation.
- Displaying hidden chain-of-thought, claiming a status indicator is model reasoning, or describing presentation pacing as live model-token generation.
- Direct model writes to documents or the filesystem.
- Direct filesystem or model-first mutation that bypasses the active editor SDK.
- Arbitrary shell, script, filesystem, or network access.
- Reintroducing IdeaNote's retired MCP server or MCP product surface.
- Multi-agent orchestration in the first implementation.
- Background autonomous tasks in the first implementation.
- Cloud synchronization of IdeaNote Agent history.
- Implementing Markdown, IdeaTable, or IdeaWorkflow business tools in the generic SDK.

## 5. Product principles

### 5.1 The Agent belongs to the application

The long-term layout remains:

```text
┌──────────────────┬──────────────────────────────────────┬─────────────────────┐
│ Workspace        │ Current File Editor                  │ Agent               │
│ Explorer         │                                      │                     │
│                  │ Canvas / editor-owned Navigator      │ Thread + Turns      │
│                  │                                      │ Items + Composer    │
└──────────────────┴──────────────────────────────────────┴─────────────────────┘
```

IdeaSketch Pages and Cameras remain part of the center editor. The Agent is always a sibling of the editor, never a tab inside an editor navigator.

### 5.2 The runtime does not know file formats

The runtime understands Threads, Turns, Items, Skills, tool schemas, tool results, approvals, and errors. It does not understand `.is`, Markdown AST, IdeaTable records, or IdeaWorkflow nodes.

### 5.3 Every Turn captures an editor binding

At Turn start, the host captures:

- active document/session identity;
- editor extension identity;
- document revision and source fingerprint;
- bounded editor Context;
- available Tool definitions;
- active Skill identity;
- read-only and external-change state.

Changing the active document does not silently retarget an in-flight Turn. A mutation remains bound to the original target and must pass document, revision, status, source-marker, source-fingerprint, and editor-availability checks before the editor SDK transaction.

### 5.4 Activity is data, not formatted prose

A tool call is a Tool Call Item. A plan is a Plan Item. Explicitly public runtime narration is a separate Activity Item. An approval is an Approval Item. The model must not encode these as Markdown conventions for the UI to guess.

### 5.5 Capability degradation is honest

If a runtime cannot provide public process text, the UI does not show a fake reasoning stream or an unsupported-summary banner. If a gateway or runtime bursts output, deterministic lifecycle stays authoritative and answer presentation may be paced independently; the UI does not claim that pacing is live generation.

## 6. Target interaction

### 6.1 Right-column structure

```text
┌──────────────────────────────────────┐
│ Agent                         [···]  │
│ Thread title             [History]  │
├──────────────────────────────────────┤
│ User message                         │
│                                      │
│ Preparing · 0:02                     │
│ Working                              │
│ ▸ Read active page                   │
│ ▸ Plan                               │
│ ✓ Applied 1 editor transaction       │
│                                      │
│ Assistant Markdown response          │
├──────────────────────────────────────┤
│ Ask about this file…                 │
│ [Model / effort]          [Send/Stop]│
└──────────────────────────────────────┘
```

### 6.2 Thread header

The header provides:

- current Thread title;
- create new Thread;
- open local history;
- rename, archive, and permanently delete after confirmation;
- current runtime/model summary;
- capability or degraded-mode indicator when useful;
- access to Agent settings.

Permanent deletion is available for non-running Threads. Deleting the current Thread first establishes a valid replacement, removes only the selected local history record, and restores focus predictably.

### 6.3 Transcript

The transcript is an ordered projection of Turns and Items. It supports:

- user messages;
- Markdown agent messages;
- optional collapsible public runtime summaries when explicitly supplied;
- deterministic Preparing/Working activity and elapsed time;
- plans and plan updates;
- Skill activation;
- tool calls, progress, and results;
- approval requests;
- directly applied editor mutation results;
- warnings and errors;
- completed, cancelled, and failed Turn boundaries.

Long transcripts must be virtualized or incrementally paginated without losing keyboard navigation or screen-reader order.

### 6.4 Composer

The composer supports:

- Enter to send;
- Shift+Enter for a new line;
- Stop while a Turn is running;
- steering input while a runtime supports it;
- retry from a failed or interrupted Turn;
- optional model and reasoning-effort controls driven by capabilities;
- a visible active-document target.

Queued or steered messages must be visibly distinct from a new Turn.

### 6.5 Markdown

Use a maintained open-source Markdown renderer compatible with the current assistant-ui integration, preferably `@assistant-ui/react-markdown` with the smallest required remark/rehype surface.

Requirements:

- GitHub-style lists and fenced code blocks;
- safe links with explicit external navigation behavior;
- sanitized HTML or raw HTML disabled;
- code wrapping appropriate for the narrow Agent column;
- copy action for code blocks;
- no editor mutation triggered from rendered Markdown.

### 6.6 Process and reasoning presentation

IdeaNote distinguishes three concepts:

1. **Public runtime activity:** readable runtime-provided process events explicitly classified as user-visible, displayed only when supported.
2. **Agent activity:** deterministic application events such as loading a Skill, calling a Tool, waiting for a runtime approval, or validating and applying a Change Set through the editor SDK.
3. **Hidden reasoning:** not available to the UI and never claimed to be displayed.

There is no dedicated Reasoning Summary product surface. Public activity is optional, appears in chronological transcript order, and is persisted only when the runtime and policy mark it safe. Codex reasoning-summary events and raw/private reasoning are discarded at the adapter boundary.

## 7. Native Agent Core and frontend SDK architecture

The frontend SDK is an internal TypeScript module under `src/lib/agent/`. It can become a package only after a second editor proves the public boundary. It is not the Agent runtime: it projects normalized native Events, forwards cancellation, and executes editor-specific Tool requests against the captured live editor model.

```text
Agent React UI
      │
IdeaNote TypeScript Agent SDK + Store
      │
Tauri normalized Event / Tool bridge
      │
Rust Agent Core
      ├── Turn coordinator + persistence
      ├── Tool Broker + call ledger
      ├── Codex app-server adapter
      ├── Grok Build ACP adapter gate
      └── OpenAI-compatible adapter
      │
TypeScript editor Tool executor
      ├── IdeaSketch Agent Extension
      ├── Markdown Agent Extension
      └── Future editor extensions
```

### 7.1 Proposed module boundaries

```text
src-tauri/src/agent/
  mod.rs               # native Turn coordinator and Tauri commands
  runtime.rs           # OpenAI-compatible completion path
  repository.rs        # local Thread persistence
  session.rs           # active runs, cancellation, and Tool waiters
  tool_broker.rs       # schema, call-id, idempotency, timeout, and result policy
  adapters/            # pinned Codex and evaluated Grok protocol adapters

src/lib/agent/
  protocol.ts          # IdeaNote-owned Events and capabilities
  agentClient.ts       # thin Tauri command/channel bridge
  agentRuntime.ts      # native-core facade and editor Tool dispatch
  agentStore.ts        # ordered Event projection
  agentToolHost.ts     # live editor execution and fail-closed direct application
  agentExtension*.ts   # registry-selected editor contracts
```

The exact filenames may change during implementation, but the ownership boundaries are normative.

### 7.2 Runtime interface

```ts
export interface AgentRuntime {
  getCapabilities(): Promise<AgentCapabilities>;

  createThread(input: CreateThreadInput): Promise<AgentThread>;
  resumeThread(threadId: string): Promise<AgentThread>;
  listThreads(input?: ListThreadsInput): Promise<AgentThreadPage>;
  renameThread(threadId: string, title: string): Promise<void>;
  archiveThread(threadId: string): Promise<void>;
  deleteThread(threadId: string): Promise<void>;

  startTurn(
    input: StartTurnInput,
    onEvent: (event: AgentEvent) => void,
  ): Promise<AgentTurn>;

  steerTurn(turnId: string, input: AgentUserInput): Promise<void>;
  cancelTurn(turnId: string): Promise<void>;
  retryTurn(input: RetryTurnInput): Promise<AgentTurn>;
}
```

No provider SDK, Codex JSON-RPC, Rig, or assistant-ui type may appear in this interface.

### 7.3 Capabilities

```ts
export interface AgentCapabilities {
  markdown: boolean;
  textStreaming: boolean;
  publicActivity: boolean;
  planItems: boolean;
  toolCalls: boolean;
  dynamicEditorTools: boolean;
  approvals: boolean;
  persistentThreads: boolean;
  steering: boolean;
  cancellation: boolean;
  modelSelection: boolean;
  reasoningEffort: readonly string[];
}
```

Capabilities are resolved from the runtime, provider, model, application policy, and active editor. The UI uses the effective intersection.

### 7.4 Thread and Turn types

```ts
export interface AgentThread {
  id: string;
  title: string;
  status: "idle" | "running" | "waitingForApproval" | "error";
  createdAt: number;
  updatedAt: number;
  activeTurnId?: string;
  contextScope?: AgentContextScope;
}

export interface AgentTurn {
  id: string;
  threadId: string;
  status:
    | "queued"
    | "running"
    | "waitingForTool"
    | "waitingForApproval"
    | "completed"
    | "cancelled"
    | "failed";
  target: AgentTurnTarget;
  startedAt: number;
  completedAt?: number;
}
```

### 7.5 Item model

```ts
export type AgentItem =
  | AgentUserMessageItem
  | AgentMessageItem
  | AgentActivityItem
  | AgentPlanItem
  | AgentSkillItem
  | AgentToolCallItem
  | AgentToolResultItem
  | AgentApprovalItem
  | AgentWarningItem
  | AgentErrorItem;
```

Every Item has:

```ts
export interface AgentItemBase {
  id: string;
  threadId: string;
  turnId: string;
  status: "pending" | "inProgress" | "completed" | "failed" | "cancelled";
  createdAt: number;
  completedAt?: number;
}
```

The final Item value is authoritative. Deltas are transport updates and may not concatenate into an identical final value. The legacy `changeReview` Item remains readable only for old persisted data and is filtered from the current transcript.

### 7.6 Event model

```ts
export interface AgentEvent<T = unknown> {
  eventId: string;
  threadId: string;
  turnId: string;
  itemId?: string;
  sequence: number;
  type: AgentEventType;
  payload: T;
  occurredAt: number;
}
```

Required event classes:

- Thread started, updated, archived, and deleted.
- Turn started, status changed, completed.
- Item started, replaced, completed.
- Agent message delta.
- Public activity part added and text delta when explicitly supplied.
- Plan delta and final Plan Item.
- Tool call requested, progress, result, failure.
- Approval requested and resolved.
- Editor mutation requested, applied, rejected as stale/unsafe, or cancelled.
- Runtime warning and classified error.

The reducer rejects duplicate event ids, ignores stale sequence numbers, and records protocol gaps for diagnostics. Runtime selection changes are delivered as normalized `runtimeUpdated` Events; persisted metadata records the effective runtime, model, degradation reason, and upstream Thread id used for Codex resume.

### 7.7 React SDK

```ts
const {
  thread,
  turns,
  items,
  send,
  steer,
  cancel,
  retry,
} = useAgentThread(threadId);
```

Expected hooks:

- `useAgentThread`
- `useAgentComposer`
- `useAgentCapabilities`
- `useAgentApproval`
- `useAgentHistory`

assistant-ui remains an internal rendering primitive. React components consume normalized SDK state and do not parse provider events.

## 8. Editor Agent Extension SDK

### 8.1 Extension contract

```ts
export interface AgentExtension<TModel, TOperation> {
  id: string;
  fileType: string;
  skillId: string;
  tools: AgentToolDescriptor[];

  buildContext(
    model: TModel,
    activeContextId: string | undefined,
    revision: number,
  ): Record<string, unknown>;
  executeTool(
    call: AgentToolCall,
    context: AgentToolExecutionContext<TModel>,
  ): Promise<AgentToolResult<TOperation>> | AgentToolResult<TOperation>;
  describeChangeSet(changeSet: AgentChangeSet<TOperation>): string[];
}
```

The generic SDK never imports `IdeaSketchDocument`, Markdown AST types, or future editor types.

### 8.2 Tool categories

Tools return either a bounded `read`, a target-bound `mutation`, or a normalized `failure`. A mutation Tool returns an opaque proposed Change Set to the trusted host; the host immediately revalidates the captured active binding and calls the editor-owned `applyChangeSet` callback. The callback is not exposed as a model-callable Tool. It must use the mounted editor SDK and must not mutate the reducer model or filesystem first.

### 8.3 Dynamic tool routing

```text
Runtime requests tool
        │
Rust Agent Core Tool Broker validates name, schema, call id, target policy, and ledger
        │
Typed Tauri request/result bridge
        │
Active TypeScript AgentExtension executes a live-model read or creates a target-bound mutation
        │
Trusted host revalidates and applies a valid mutation through the mounted editor SDK
        │
Rust bounds/redacts the correlated applied result and returns it to the runtime
```

Tool calls use stable call ids. The Rust ledger is authoritative: repeated delivery of the same call id returns the recorded result and does not execute again. TypeScript retains defensive extension and target checks but does not own runtime sequencing or idempotency.

### 8.4 Change Set contract

Every editor Change Set contains or references:

- unique Change Set id;
- extension id;
- document/session id;
- base revision;
- source fingerprint;
- source-modified marker;
- optional editor context identity such as Page id;
- opaque extension-owned operations;
- bounded human-readable summary;
- one-use mutation identity;
- lifecycle state.

Direct application revalidates all target fields. A stale, read-only, missing, unmounted, externally changed, cancelled, duplicate, late, or already-applied Change Set is rejected without model or disk mutation. Undo and Redo belong to the editor SDK, not to the Agent.

### 8.5 Markdown production second-editor proof

F038 registers Markdown through the same File Type Registry and Agent Extension Registry as IdeaSketch. Turn-start Context contains counts, line-ending policy, a bounded heading summary, and UTF-16 selection coordinates, never the full source. `read_markdown_outline`, `read_markdown_document`, and `read_markdown_range` disclose bounded source; `replace_markdown_range` requires the range read and carries exact positions, range hash, document revision, source fingerprint, status, and source-modified evidence.

The Markdown editor revalidates the live CodeMirror source and dispatches exactly one `EditorView.dispatch({ changes })` transaction. The CodeMirror update listener remains the only path into the document model, preview, dirty state, autosave, Recovery, and Save. Native Undo restores the prior source and Redo reapplies it. No Markdown branch was added to the Rust Tool Broker, runtime adapters, Agent Panel, store, or activity projection; switching between IdeaSketch, Markdown, and unsupported files changes only the injected binding.

## 9. Runtime adapters

### 9.1 Codex app-server adapter

The open-source Codex app-server is the preferred rich-runtime candidate because official OpenAI documentation describes it as the interface used to power rich clients and exposes authentication, conversation history, approvals, streamed Agent events, Threads, Turns, Items, steering, interruption, reasoning-summary deltas, and dynamic tool calls.

The adapter must:

- launch and supervise a pinned local app-server process;
- use local stdio by default rather than experimental remote WebSocket transport;
- perform initialize/initialized handshake;
- generate or vendor version-matched Rust/JSON schemas;
- translate app-server Thread, Turn, Item, delta, approval, and error events;
- map IdeaNote editor Tools to app-server dynamic Tools through the Rust Tool Broker and typed editor bridge;
- keep experimental APIs behind an IdeaNote feature capability;
- redact credentials and sensitive command details;
- restart safely without losing persisted completed Thread history;
- never expose app-server wire types outside the adapter.

Codex app-server support for MCP does not restore IdeaNote's retired MCP product surface. IdeaNote does not publish its editor as an MCP server. Editor capabilities are client-owned dynamic Tools routed through the Rust Tool Broker; built-in mutation approvals are declined and direct file mutation remains disabled.

### 9.2 OpenAI-compatible adapter

The compatibility adapter preserves the user-configurable Base URL and Model while reading the API key only through the Rust encrypted credential repository. Existing Keychain data is neither read nor removed automatically; users save the token once into the new repository.

It should migrate from the current text-only Chat Completions loop toward a provider abstraction that can support:

- Responses API when available;
- Chat Completions fallback;
- normal text streaming;
- function or tool calling;
- reasoning summaries when explicitly supported;
- model and capability discovery where available;
- classified transport and provider errors.

The delivered compatibility adapter uses a private Rust `reqwest` transport with Responses-first execution and Chat Completions fallback. Provider transport types remain private.

### 9.3 Grok Build ACP adapter

Grok Build is an Apache-2.0 open-source Rust coding-agent runtime and TUI. Its official documentation supports interactive use, headless JSON or streaming-JSON execution, and embedding in other applications through the Agent Client Protocol (ACP). The released CLI exposes `grok agent stdio`, which runs a JSON-RPC ACP agent over stdin/stdout.

Relevant confirmed capabilities include:

- persistent Sessions shared across TUI, headless mode, and ACP;
- resume and fork behavior;
- incremental `session/update` events;
- structured Tool call updates and Plan updates in the open-source implementation;
- Plan mode with explicit approval;
- permission rules and sandbox separation;
- Skills, plugins, hooks, subagents, and project rules;
- background commands, prompt queues, scheduled prompts, and monitors;
- custom model configuration through model id, Base URL, and environment credential;
- an open Rust source tree with separate Agent Runtime, Tool, Workspace, and ACP modules.

Grok Build uses the standard `agent-client-protocol` Rust crate and currently enables unstable protocol features. This makes it more interoperable than a product-specific protocol, but it also requires exact version negotiation and an adapter boundary.

The primary unresolved issue is host-provided editor Tools. Official Grok Build documentation demonstrates ACP client filesystem and terminal capabilities and accepts MCP servers during Session creation, but it does not currently document a stable equivalent to Codex app-server's client-owned `dynamicTools` flow. IdeaNote must not solve this by restoring its retired MCP product surface.

The Grok adapter spike must therefore prove one of these paths:

1. ACP supports a safe host Tool extension that can carry IdeaNote dynamic editor Tools.
2. Grok Build's open Tool router can accept a small upstream-compatible IdeaNote host-tool bridge without forking broad runtime behavior.
3. Grok Build remains an optional read/research runtime while editor mutation Turns use another adapter.

If none is viable without MCP or a high-maintenance fork, Grok Build remains useful as an architectural reference and optional Provider/Agent integration, but not the default editor-mutation runtime.

### 9.4 Adapter selection

Runtime selection is automatic, native-owned, and capability based, not editor-format based.

```text
Editor Extension
      │
TypeScript editor Tool executor
      │
Rust Agent Core
      ├── Codex app-server
      ├── Grok Build ACP
      └── OpenAI-compatible provider
```

Switching editors changes only the injected Skill, Context, and Tool definitions. For editor-capable Turns, Rust prefers the pinned compatible Codex app-server and falls back to Compatibility; Grok is not production-selected until it satisfies the same non-MCP editor Tool gate.

## 10. Runtime capability comparison

| Capability | Codex app-server | Grok Build ACP | Responses-capable provider | Chat Completions fallback |
| --- | --- | --- | --- | --- |
| Source/license | Open source | Apache-2.0 open source | Provider implementation | Provider implementation |
| Embedding protocol | Product JSON-RPC | Standard ACP JSON-RPC | IdeaNote adapter | IdeaNote adapter |
| Markdown agent message | Yes | Yes | Yes | Yes |
| Text delta | Yes | ACP Session updates | Expected | Provider dependent |
| Public activity | Adapter accepts only events explicitly classified as public; reasoning-summary events are ignored | Stable ACP public-activity representation must be verified | When explicitly supported | No by default |
| Plans as first-class items | Yes | ACP Plan updates and Grok Plan mode | IdeaNote synthesis/adapter | No by default |
| Tool calls | Yes | ACP Tool call updates | When supported | When supported |
| Host-injected editor Tools | Documented experimental dynamic Tools | Not confirmed without MCP or Tool-router extension | IdeaNote Tool loop | IdeaNote Tool loop |
| Persistent Sessions | Runtime supplied | Runtime supplied under `~/.grok/sessions` | IdeaNote repository | IdeaNote repository |
| Steering/interjection | Yes | Product supports queues/interjection; ACP contract must be verified | Adapter dependent | Usually unavailable |
| Cancellation | Yes | ACP/runtime support must be verified in the spike | Yes | Yes |
| Permissions/sandbox | Rich runtime policy | Rich permissions and sandbox | IdeaNote policy | IdeaNote policy |
| Custom models/Base URL | Provider configuration dependent | Explicitly documented | Yes | Yes |
| Main risk | Experimental dynamic Tools and protocol churn | Host dynamic Tool gap and unstable ACP features | IdeaNote owns more Agent mechanics | Weakest capability set |

The effective capability set is recorded at Turn start so a mid-Turn provider change cannot alter UI semantics.

### 10.1 F033-03 executable comparison outcome

The comparison spike pins Codex CLI/app-server `0.147.0`, Grok Build source revision `3e620a76a5f374ce644dc7c87f7e990c68348218`, and ACP protocol version `1`. Both adapters use the same bounded stdio JSON-RPC codec, process supervisor, redaction rules, lifecycle contract, and normalized Event mapping.

The installed Codex `0.147.0` app-server completed the real `initialize`/`initialized` handshake. Its documented experimental `dynamicTools` flow maps IdeaNote editor Tool definitions to client-owned calls while the upstream runtime remains `read-only` with automatic built-in mutation approval disabled. Codex is therefore the preferred optional rich runtime for mutation-capable Turns after the native read/direct-editor-transaction/Undo acceptance passes.

Grok ACP v1 maps incremental assistant messages, Plans, Tool activity, permissions, cancellation, Session creation/resume, and custom model configuration. Sessions are created with `mcpServers: []`, filesystem write capability disabled, and terminal capability disabled. Neither the official ACP documentation nor the inspected open-source surface establishes a stable client-owned dynamic Tool equivalent. Grok therefore advertises no editor Tool capability and remains optional for read/research Turns; mutation-required selection degrades to the compatibility adapter rather than restoring MCP or allowing built-in writes.

Runtime discovery and selection are native-owned. The installed Codex `0.147.0` app-server is selected automatically when its version and dynamic editor Tool safety gates pass. Its upstream Thread id is persisted and reused for later Turns. Missing, incompatible, initialization-failing, or pre-progress crashed Codex transparently falls back to Compatibility with a normalized diagnostic. A crash after visible text, public activity, Plan, or Tool execution ends the Turn with an explicit retryable error instead of replaying partial work. Grok remains evaluated but is not production-selected. The frontend consumes normalized runtime metadata and effective capabilities and never branches on Codex or Grok protocol types.

### 10.1 Runtime evidence and configurable policy

IdeaNote owns one runtime-neutral evidence contract. Rust emits normalized `runtimeUpdated`, `runtimeDiagnosticRecorded`, `contextUpdated`, and `telemetryUpdated` Events. The frontend stores the latest context snapshot and a bounded per-Thread diagnostic timeline, then derives UI guidance through a pure selector. Provider and Codex wire payloads never cross this boundary.

Context evidence is exact-or-unavailable. Codex `thread/tokenUsage/updated` maps exact total and last-Turn input, cached-input, cache-write-input, output, reasoning-output, and total token counts. Compatibility opportunistically accepts exact Responses terminal usage and Chat streaming usage when a compatible gateway supplies it. IdeaNote calculates `usedPercent` only when the same authoritative event supplies a positive `modelContextWindow`; it never estimates tokens, hard-codes model windows, or treats account usage as Thread context.

Current `contextCompaction` Items and legacy `thread/compacted` notifications map to one upstream Runtime compaction signal. The local Compatibility request replay boundary is stored separately as `localReplayTruncatedBeforeTurnId`. Neither mechanism deletes the visible Thread transcript.

Runtime diagnostics classify discovery, startup, automatic selection, model reroute, fallback, retry, Provider failure, cancellation, compaction, and terminal failure. Records contain only bounded ids, category, severity, code, message, optional recovery, retryability, and timestamps. Credentials, authorization data, URLs with secret query values, executable paths, raw Provider/App-server payloads, prompts, answers, document snapshots, hidden reasoning, and presentation timers are excluded and redacted again by the repository.

Versioned Agent policy defaults to:

- 8 maximum Tool steps, range 1–100;
- 75% context warning, range 50–90%;
- 90% New Thread recommendation, range 60–100% and strictly above warning;
- 20 retained diagnostics, range 5–100;
- 60 Compatibility replay messages, range 10–200;
- source-delivery telemetry visible.

The policy is normalized in TypeScript and Rust. A Turn captures its effective values at submission, and the Rust Tool Broker enforces the maximum-step bound for Codex and Compatibility without editor-specific branches. The Compatibility replay count is a request-history bound, not a model context-window setting. Low-level transport timeouts, retry backoff, animation cadence, and presentation timing remain implementation constants rather than user settings.

The right-column Runtime Inspector keeps this evidence out of the transcript. It shows effective Runtime, model, capabilities, health, exact usage or an explicit unavailable state, upstream compaction, local replay truncation, effective Turn policy, optional source-delivery telemetry, and classified diagnostics. Warning and New Thread guidance appear only at configured thresholds backed by an exact context window. Tool Activity remains a separate chronological transcript surface. Hidden chain-of-thought is neither requested nor displayed.

### 10.2 Managed custom Skills

IdeaNote owns one normalized Skill registry with origin-qualified identities. Bundled editor Skills remain read-only, mandatory, and selected by the active editor extension. Imported Skills use stable `custom:<slug>` ids and are additive instructions only. They cannot replace the editor Skill, register Tool descriptors, declare MCP, install dependencies, execute scripts, or gain shell, filesystem, network, browser, process, or editor permissions.

Settings imports a standard `SKILL.md` directory into an application-data managed copy. The native repository validates required YAML frontmatter, reserved and duplicate names, sensitive declarations, canonical relative paths, symbolic links, scripts and dependency manifests, UTF-8 references, and all size/depth/count limits before using a staging-directory plus rename transaction. The source directory is never watched or modified. Current bounds are 64 managed Skills, 64 files per Skill, four directory levels, 256 KiB per file, 2 MiB total, 64 KiB for `SKILL.md`, and 32 KiB per readable text reference. Restart hydration revalidates the manifest id, normalized metadata, exact file set, SHA-256 digest, resource paths, and managed-directory symlink boundary; corruption becomes a disabled diagnostic entry rather than executable state.

Skill disclosure is progressive:

1. A Turn captures a compatible metadata catalog bounded to 32 entries and 8 KiB. Omitted entries produce a normalized diagnostic and remain available for explicit selection only through a new Turn.
2. Composer-selected Skills load immutable instructions before model work and record `explicit` provenance alongside the mandatory editor Skill.
3. An eligible implicit Skill loads only after the model calls the host-owned `activate_skill` Tool. The captured digest must still match; a refresh between catalog capture and activation is rejected with new-Turn guidance.
4. The host-owned `read_skill_reference` Tool accepts only an activated Skill id and opaque `ref-N` handle. It returns bounded captured UTF-8 text and never exposes an absolute or relative filesystem path.

Host Skill Tools are separate from editor Tools but share the Rust Tool Broker's schema, call-id, replay, maximum-step, cancellation, chronology, and result-size rules. Codex receives them as client-owned dynamic Tools. Compatibility processes Skill host calls in a bounded follow-up loop; when one provider response mixes Skill host calls and editor calls, IdeaNote executes only the host calls, injects the newly activated instructions or reference results, and asks the model again before any editor mutation. This prevents an editor Tool generated under stale instructions from being applied.

Turn history and the Runtime Inspector persist only safe provenance: Skill id, name, origin, digest, activation mode, and editor scope. Full instructions and reference bodies use ephemeral non-persistable Tool results. Disabling AI prevents Turn discovery, activation, reference service, and model injection, while Settings may still manage already imported files without starting a Runtime.

## 11. Streaming behavior

### 11.1 Source delivery

The runtime reports:

- request start;
- connection established;
- first event time;
- first text delta time;
- last delta time;
- completion time.

Native provider/Codex deltas cross the Tauri Channel immediately and append to one authoritative running assistant Item in sequence. The frontend may frame-batch high-frequency renders. Partial Markdown must become observable before completion when the upstream transport is genuinely incremental. The terminal value reconciles without duplication or a final-text replacement flash.

Runtime telemetry classifies answer delivery as `incremental`, `burst`, `atomic`, or `unknown`. The classification uses arrival timing and character distribution, not the mere presence of multiple delta events.

### 11.2 Burst and buffered delivery

A stream is considered effectively burst-delivered when a long first-text delay is followed by nearly all content arriving inside one browser paint window. This classification is diagnostic, not a runtime correctness failure, but it is a product-experience failure when the user sees one complete block.

While waiting, the UI shows deterministic statuses such as:

- `Preparing`;
- `Working` with elapsed time.

IdeaNote does not synthesize source events or claim that a paced display is token generation. For burst or atomic assistant answers, the frontend uses the bounded presentation controller defined by RFC Addendum 002. Source completion, Tool activity, cancellation, errors, and telemetry remain immediate and authoritative.

### 11.3 Presentation pacing

The frontend maintains separate source and display projections for the currently running assistant segment:

- genuinely incremental source delivery renders directly within one frame;
- burst or atomic delivery is revealed in Markdown-safe, grapheme-safe chunks over a bounded interval;
- Tool, Plan, lifecycle, approval, cancellation, and error events bypass the queue;
- a Tool event flushes earlier assistant text before the Tool row is rendered;
- source `Working` ends when the runtime completes even if a short `revealing` display state remains;
- reduced-motion preference disables character-like pacing;
- persisted history stores only final authoritative content and safe source telemetry.

The default pacing target is a visible update every 40–100 ms and a typical total reveal time of 0.8–2.5 seconds, adapting chunk size so long answers do not become artificially slow.

### 11.4 Scroll anchoring

When the user is at the transcript end, streamed Items keep the end anchored. If the user scrolls up, new deltas do not force the viewport down; a `Jump to latest` action appears.

## 12. Retry and error handling

### 12.1 Error taxonomy

```ts
type AgentErrorCode =
  | "configurationRequired"
  | "authenticationFailed"
  | "permissionDenied"
  | "rateLimited"
  | "networkUnavailable"
  | "tlsFailure"
  | "requestTimeout"
  | "providerUnavailable"
  | "providerProtocolError"
  | "modelUnavailable"
  | "contextLimit"
  | "toolValidationFailed"
  | "toolExecutionFailed"
  | "changeSetStale"
  | "runtimeUnavailable"
  | "cancelled"
  | "unknown";
```

User-facing errors contain a concise explanation, recovery action, and copyable diagnostic id. URLs, keys, raw headers, and secret-bearing payloads are removed.

### 12.2 Safe automatic retry

Automatic retry is allowed only when all are true:

- no assistant text or public runtime summary has been delivered;
- no Tool call has begun;
- the failure is classified as transient;
- the user has not cancelled;
- the configured attempt limit is not exceeded.

Versioned Settings default automatic retry to enabled with three total attempts. Users may disable it or choose one to five total attempts. A Turn captures the effective policy when it starts, so later Settings changes do not alter an in-flight request. Use cancellable exponential backoff. Retry metadata remains part of the same visible Turn.

### 12.3 Retry after partial progress

After any visible output or Tool call, retry is explicit. It creates a new Turn that references the failed Turn. The runtime must not silently replay a partially executed Tool sequence.

### 12.4 Tool idempotency

Every Tool call has a stable call id and an execution ledger. Duplicate delivery returns the prior result. Mutation Tools must not apply duplicate Change Sets for the same call id.

## 13. Persistence

### 13.1 Storage location

Agent Threads are stored in the application data directory, not inside the user's document or Workspace. No `.ideanote/` directory is created merely because a conversation exists.

### 13.2 Stored data

Persist:

- Thread metadata and title;
- completed Turns and final Items;
- bounded Tool summaries and results approved for persistence;
- bounded mutation summaries and terminal Tool state without duplicating full document data;
- runtime/model/capability metadata needed to explain history;
- the upstream runtime Thread id needed to resume a compatible Codex conversation;
- latest exact-or-unavailable context state, effective Turn policy, bounded classified diagnostics, and safe timing metrics.

Do not persist:

- API keys or authentication tokens;
- raw authorization headers;
- unbounded document snapshots;
- hidden chain-of-thought;
- raw provider payloads by default;
- sensitive Tool results not explicitly marked persistable.

### 13.3 Document association

Threads may store a local association with Workspace and document identity for navigation. A Turn always stores its captured target identity. Renames or moves are resolved through current Workspace services where possible and otherwise shown as a missing target without silent retargeting.

### 13.4 Compaction

Long-running Threads may compact older upstream Runtime context while retaining the user-visible transcript. Runtime compaction is persisted separately from local Compatibility replay truncation; neither can delete user-visible history without an explicit history-management action.

### 13.5 Permanent deletion

Users may permanently delete a non-running local Thread after confirmation. Deleting the current Thread first creates or selects a valid replacement. The repository removes only the exact Thread record; documents, Workspace metadata, Recovery data, credentials, and sibling Threads are out of scope.

## 14. Security and approval

- Credentials remain exclusively in a Rust-owned AES-256-GCM repository under the platform application configuration directory. The random application key is stored separately with current-user-only permissions where the platform supports them.
- The encrypted repository prevents plaintext-at-rest disclosure and prevents the credential envelope alone from revealing the token. It is not an OS-vault boundary: a process running as the same operating-system user that can read both files can decrypt the token.
- The frontend never receives saved provider API keys. The Settings visibility control reveals only the value currently typed by the user and resets to hidden after save or removal.
- Credentials, key material, and plaintext never enter Workspace files, `.ideanote/`, Recovery, caches, logs, persisted Threads, or serialized frontend Settings.
- Tool definitions, schemas, arguments, call ids, duplicate delivery, timeouts, and result bounds are validated by the Rust Tool Broker.
- Only the active registered editor extension can receive editor Tool calls.
- Read Tools return bounded data with truncation markers.
- Mutation Tools create target-bound Change Sets; only the trusted active editor binding can apply them.
- Direct application performs revision, fingerprint, status, source-marker, range/hash, cancellation, and mounted-editor validation.
- The editor SDK performs one native transaction; the Agent owns no Undo stack.
- AI disabled means no runtime process, Thread subscription, Skill discovery, Tool registration, or provider request.
- Unsupported editors contribute no mutation Tools.
- Codex app-server experimental capabilities are disabled unless explicitly enabled by the adapter after compatibility checks.
- Grok Build ACP capabilities are version-negotiated and remain adapter-private; `mcpServers` stays empty unless a future RFC explicitly changes the no-MCP product decision.
- App-server is local-only in the initial implementation; remote transports are not required.

## 15. Accessibility and performance

### 15.1 Accessibility

- Transcript Items retain semantic chronological order.
- Public-summary, plan, and Tool disclosures use accessible expanded state.
- Running status uses a polite live region without announcing every token.
- Approval buttons name the target and consequence.
- Focus returns predictably after Send, Stop, native Undo/Redo, and retry.
- Keyboard navigation reaches Thread history, transcript actions, disclosures, and composer.
- Color is not the only error, success, or running indicator.

### 15.2 Performance

- Batch text deltas before React state updates.
- Keep source content and display projection separate so pacing never mutates persisted Thread state.
- Bypass pacing for Tool and lifecycle events and for reduced-motion users.
- Normalize events through one reducer rather than local component state.
- Paginate or virtualize long history.
- Avoid rerendering the editor Canvas for Agent transcript changes.
- Keep Tool results bounded and lazy-render large previews.
- Preserve independent Agent and editor Navigator resizing.

## 16. Open-source adoption

### 16.1 Recommended components

- `openai/codex` app-server: rich Agent kernel candidate.
- `xai-org/grok-build`: ACP-based rich Agent kernel candidate and architectural reference.
- `agent-client-protocol`: standardized client/agent protocol evaluated only behind the Grok adapter.
- `assistant-ui`: composable conversation primitives already used by IdeaNote.
- `@assistant-ui/react-markdown`: preferred Markdown integration candidate.
- open Agent Skills `SKILL.md`: editor Skill packaging.
- Rig: retained privately for the OpenAI-compatible adapter until the replacement path proves equivalent behavior.

### 16.2 Ownership rule

Open-source libraries implement mechanics. IdeaNote owns:

- the public frontend SDK;
- normalized protocol and event semantics;
- editor extension contract;
- native Turn orchestration and capability policy;
- the runtime-facing Tool Broker and editor bridge contract;
- retry policy;
- runtime approval and direct editor-mutation safety;
- persistence policy;
- product UI and accessibility behavior.

### 16.3 Versioning rule

Pin every rich-runtime executable and wire protocol used by IdeaNote. Generate matching Codex app-server schemas during controlled dependency updates, and pin the Grok Build release plus ACP protocol version and negotiated capabilities. Adapter tests must fail when an upstream schema or capability change is not normalized.

## 17. Alternatives considered

### 17.1 Extend only the current Rig runtime

Advantages:

- smallest process and dependency change;
- preserves the current provider configuration;
- full control over the editor Tool loop.

Disadvantages:

- IdeaNote must build Thread persistence, approvals, reasoning events, steering, plan items, protocol evolution, and diagnostics itself;
- higher long-term maintenance for Codex-style behavior.

Decision: retain as the compatibility adapter, not the sole rich-runtime strategy.

### 17.2 Expose Codex app-server directly to React

Advantages:

- fastest access to app-server features;
- minimal translation code initially.

Disadvantages:

- couples UI, tests, editor extensions, and persisted state to upstream JSON-RPC;
- experimental dynamic Tools could leak across the product;
- replacing or supplementing the runtime becomes expensive.

Decision: rejected.

### 17.3 Replace every provider path with Codex app-server

Advantages:

- one rich runtime.

Disadvantages:

- may not preserve every OpenAI-compatible gateway or local provider;
- increases migration risk before compatibility is proven.

Decision: rejected for the initial migration.

### 17.4 Adopt Grok Build ACP as the only runtime

Advantages:

- Apache-2.0 open-source Rust runtime;
- standardized ACP embedding rather than a product-specific client protocol;
- persistent Sessions, Plans, permissions, Skills, background work, and custom models are already present;
- architecture is close to the desired local-first Agent host.

Disadvantages:

- the documented ACP path does not yet establish a stable client-owned dynamic editor Tool mechanism;
- built-in coding Tools and filesystem mutation are broader than IdeaNote's editor-SDK-only mutation contract;
- unstable ACP features and Grok-specific extensions require adapter/version testing;
- adopting it directly could force IdeaNote toward MCP or a maintained fork.

Decision: retain as a first-class spike and optional adapter candidate, but do not make it the only runtime until dynamic editor Tool injection and editor-SDK-only safety are proven.

### 17.5 Hybrid IdeaNote-owned adapter architecture

Advantages:

- stable frontend/editor SDK;
- rich Codex capabilities when available;
- ACP-based Grok capabilities when they satisfy the editor Tool contract;
- current provider compatibility remains available;
- experimental upstream APIs remain isolated;
- future runtime replacement stays possible.

Disadvantages:

- requires normalization and cross-adapter tests;
- some features degrade on compatibility providers.

Decision: adopted. F035 moves Turn orchestration and Tool governance into Rust while preserving the TypeScript editor execution boundary.

## 18. Delivery state and roadmap

### Phase 1: Normalize the frontend — delivered

- Add the Thread, Turn, Item, Event, Error, and Capability types.
- Replace component-local transcript state with the normalized reducer/store.
- Add safe Markdown rendering.
- Render text, deterministic activity, Tool mutation results, and errors as distinct Items.
- Preserve the existing runtime behind an adapter.

### Phase 2: Harden the OpenAI-compatible adapter — delivered

- Add provider capability negotiation.
- Add Responses API support where available.
- Classify network, TLS, timeout, HTTP, and model failures.
- Add safe pre-output retry.
- Record streaming timing and buffered-gateway diagnostics.
- Add first-class Tool and explicitly public runtime-summary events when supported.

### Phase 3: Rich-runtime comparison spike — delivered

Run equivalent offline and native acceptance against both rich-runtime candidates rather than choosing from feature lists alone.

#### Codex app-server

- Pin one app-server version.
- Launch over local stdio from Tauri/Rust.
- Generate schemas and map core Thread/Turn/Item events.
- Prove create/resume/list Thread, start/cancel/steer Turn, Markdown text, public activity, Tool call, and approval events while confirming reasoning-summary events remain non-product data.
- Prove clean shutdown, crash recovery, redaction, and version mismatch handling.

#### Grok Build ACP

- Pin one Grok Build release and ACP protocol version.
- Launch `grok agent stdio` locally with auto-update disabled.
- Prove initialize/authenticate, Session creation/resume, prompt, incremental Session updates, Tool updates, Plan updates, cancellation, and process recovery.
- Prove custom Base URL/model configuration without exposing credentials.
- Determine whether IdeaNote editor Tools can be injected without MCP and without enabling unrestricted filesystem/shell mutation.
- Measure the maintenance surface of a Tool-router bridge if standard ACP is insufficient.

The comparison selected Codex for production editor-capable Turns after its dynamic Tool bridge passed the same read/direct-editor-transaction/native-Undo boundary. Grok remains adapter-private and non-production until it can pass that boundary without MCP.

### Phase 4: Editor dynamic Tools — delivered

- Map the existing IdeaSketch Extension to the normalized Tool host.
- Map to app-server dynamic Tools where supported.
- Prove duplicate call id handling.
- Prove no mutation before prerequisite reads and trusted active-editor revalidation.
- Prove document switch and stale Change Set behavior.

### Phase 5: Persistent Codex-style interaction — delivered through F035

- Add local Thread history, upstream Codex resume, archive, and confirmed permanent deletion.
- Add genuine answer deltas, deterministic lifecycle/elapsed activity, optional public runtime summaries, Plans, Tool rows, and errors.
- Advertise cancellation now; advertise steering and approval controls only after their native commands and UI are implemented.
- Expose automatic runtime selection, effective model/capabilities, and fallback diagnostics.
- Continue accessibility and long-transcript performance work as the history surface grows.

### Phase 6: Second-editor proof — delivered through F038

- Register the Markdown Agent Extension without changing the Agent Runtime, Protocol, React SDK, or generic UI.
- Use the result to decide whether the internal frontend SDK is ready to become a separately versioned package.

### Phase 7: Perceived streaming optimization — delivered through B029

- Instrument Codex and Compatibility with the same delivery telemetry.
- Classify incremental, burst, atomic, and unknown source delivery.
- Add an editor-agnostic assistant-answer presentation queue for burst and atomic delivery.
- Preserve immediate Tool/lifecycle chronology, exact final reconciliation, cancellation, reduced-motion behavior, and persisted source truth.
- Tune the bounded cadence against native Codex evidence and the observed Teable interaction.

## 19. Verification strategy

### 19.1 Protocol tests

- ordered and out-of-order deltas;
- duplicate event ids;
- missing sequence diagnostics;
- final Item replacement after streamed deltas;
- cancellation and late-event rejection;
- capability degradation.

### 19.2 Runtime contract tests

Run the same contract suite against offline fake implementations of every adapter:

- create/resume/list Thread;
- start and complete Turn;
- cancel Turn;
- steer when supported;
- text stream;
- explicitly public activity when supported;
- Tool request/result;
- approval request/result;
- classified failures;
- retry before first output;
- no automatic retry after partial progress.

### 19.3 Editor extension tests

- correct IdeaSketch/Markdown extension activation and switching;
- bounded Context;
- schema validation;
- duplicate Tool call id;
- prerequisite-bound mutation;
- stale direct-application rejection;
- external-change rejection;
- one mounted editor transaction and native Undo/Redo through the current document session;
- unsupported editor exposes no mutation Tools.

### 19.4 UI acceptance

- Markdown heading, list, emphasis, link, and code block;
- visible incremental text with a real streaming fake;
- honest waiting state with a buffered fake;
- progressive answer presentation with burst and atomic fakes;
- source-completed/display-revealing reconciliation without a false Working state;
- optional public-activity presentation;
- plan and Tool timeline;
- runtime approval and ordered Tool activity when supported;
- Stop, retry, and steering;
- Thread history and resume;
- keyboard and screen-reader behavior;
- long-transcript performance;
- independent Agent and editor Navigator layout.

### 19.5 Native acceptance

Use disposable saved and unsaved documents. Prove complete read, direct editor transaction, native Undo/Redo, dirty/autosave/Recovery/save/reopen, cancellation, stale rejection, and extension switching without direct Agent file writes. Test the fully capable fake, the production-selected pinned Codex adapter, and the configured Compatibility adapter without exposing credentials. Any future Grok production selection must first pass the same observable lifecycle and dynamic editor Tool contract without MCP.

## 20. Acceptance criteria

1. UI components depend only on the IdeaNote Agent SDK.
2. No Codex app-server, Grok Build ACP, provider SDK, Rig, or assistant-ui runtime type crosses the public SDK boundary.
3. Assistant messages render safe Markdown.
4. Public runtime summaries appear only when explicitly supplied; hidden reasoning is never displayed or persisted.
5. Tool calls, plans, runtime approvals, direct mutation results, and errors are first-class Items.
6. Persistent local Threads can be created, resumed, listed, renamed, archived, and permanently deleted after confirmation.
7. Cancellation works; steering and approvals appear only when their complete product commands are supported.
8. Transient failures retry automatically only before visible output or Tool execution.
9. Buffered, burst, and atomic delivery are diagnosed from source timing; bounded answer presentation may be paced without claiming live token generation or reasoning.
10. Editor Tools are selected through File Type Registry Agent Extensions.
11. Mutation Tools cannot write files or mutate an unmounted/reducer-only model; only the trusted active editor binding can apply them.
12. Direct editor transactions and native Undo/Redo preserve all current document safety checks.
13. AI disabled tears down the complete Agent lifecycle.
14. Rust automatically selects the pinned compatible Codex app-server for editor-capable Turns, persists its upstream Thread id, and falls back transparently to Compatibility.
15. Grok Build and ACP types remain adapter-private, exactly versioned, and capability-gated.
16. Runtime selection cannot weaken prerequisite-bound editor mutation, bypass the trusted active-editor SDK, enable unrestricted filesystem/shell mutation, or restore MCP as an IdeaNote product surface.
17. The production Markdown extension reuses the Rust runtime, TypeScript editor Tool executor, and frontend without generic runtime or UI branches.
18. Rust owns Turn sequencing and Tool governance; TypeScript owns live editor execution, format-specific mutation construction, direct SDK application, and UI.
19. Incremental upstream text is visible before completion; burst or atomic upstream text becomes visibly progressive through the bounded answer-only presentation queue while source timing and terminal lifecycle remain truthful.

## 21. Risks

### 21.1 App-server protocol churn

Mitigation: exact pinning, generated schemas, adapter-only types, compatibility tests, and explicit dependency upgrade work.

### 21.2 Experimental dynamic Tools

Mitigation: capability flag, feature-gated adapter, compatibility Tool loop fallback, and no public SDK dependency on the experimental wire format.

### 21.3 Bundled process size and lifecycle

Mitigation: prototype packaging early; local stdio only; health supervision; controlled shutdown; clear fallback when the process cannot start.

### 21.4 Grok ACP host-Tool gap

Mitigation: make host Tool injection a mandatory spike gate; keep `mcpServers` empty; measure an upstream-compatible Tool-router bridge; retain Grok as optional/read-only or architectural reference if editor Tools require MCP, unrestricted mutation, or a high-maintenance fork.

### 21.5 Provider mismatch

Mitigation: retain the OpenAI-compatible adapter and drive UI from effective capabilities.

### 21.6 Duplicate Tool effects during retry

Mitigation: stable call ids, execution ledger, no automatic retry after Tool execution, prerequisite reads, and fail-closed direct editor mutations.

### 21.7 Conversation privacy

Mitigation: local application-data storage, bounded persisted Context, explicit persistence flags, redaction, and no credentials or hidden reasoning in history.

### 21.8 Presentation/source divergence

Mitigation: keep authoritative source content and terminal state separate from ephemeral displayed content, cap reveal duration, flush at chronological barriers, disable character-like pacing for reduced motion, and reconcile final content exactly once.

## 22. Resolved implementation decisions

F033-03 resolves the runtime questions as follows:

1. Discover Codex app-server as an installed runtime; do not bundle it until packaging and update ownership are separately approved.
2. Treat Grok ACP as lacking editor Tool capability until a stable non-MCP host Tool extension is proven upstream.
3. Prefer Codex automatically for mutation-capable rich Turns; do not production-select Grok until its editor Tool gap is resolved.
4. Select automatically through normalized capabilities and application policy rather than exposing a manual runtime switch.
5. Store paginated local Threads in the Rust application-data repository, separately from Workspace files.
6. Persist only explicitly public, bounded runtime summaries allowed by policy; never persist hidden reasoning.
7. Keep local Thread identity stable and store optional document/Workspace association without silently retargeting a Turn.
8. Persist Codex upstream Thread ids so later local Turns can resume the same compatible upstream conversation.
9. Treat Reasoning Summary as non-product data, retain only explicitly public activity, and use RFC Addendum 002's two-clock contract for burst-safe perceived streaming.

## 23. References

- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F031-configurable-ai-agent/F031-02-generic-agent-runtime.md`
- `docs/superplan/plans/bugs/B023-separate-agent-right-column.md`
- `docs/superplan/plans/bugs/B024-align-tauri-versions-and-verify-agent-editing.md`
- `src/components/AgentPanel.tsx`
- `src/lib/agent/agentClient.ts`
- `src/lib/agent/agentExtensionRegistry.ts`
- `src-tauri/src/agent/runtime.rs`
- `src-tauri/src/agent/provider.rs`
- Official OpenAI documentation: <https://learn.chatgpt.com/docs/app-server>
- Codex app-server source: <https://github.com/openai/codex/tree/main/codex-rs/app-server>
- Official xAI Grok Build overview: <https://docs.x.ai/build/overview>
- Official xAI Grok Build headless and ACP documentation: <https://docs.x.ai/build/cli/headless-scripting#acp>
- Official xAI Grok Build Sessions documentation: <https://docs.x.ai/build/features/sessions>
- Official xAI Grok Build Plan Mode documentation: <https://docs.x.ai/build/features/plan-mode>
- Official xAI Grok Build Permissions documentation: <https://docs.x.ai/build/features/permissions>
- Grok Build source: <https://github.com/xai-org/grok-build>
- assistant-ui: <https://github.com/assistant-ui/assistant-ui>
- Rig: <https://github.com/0xPlaygrounds/rig>
- Streaming optimization: `docs/rfcs/002-agent-perceived-streaming-optimization.md`
