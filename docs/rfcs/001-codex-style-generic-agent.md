# RFC 001: Codex-style Generic Agent for IdeaNote

- Status: Accepted
- Date: 2026-08-08
- Source: F032
- Audience: IdeaNote product and engineering

## 1. Summary

IdeaNote will evolve its current editor-agnostic Agent into a Codex-style task surface while preserving the existing product boundary: the Agent is an application-level right column, and every editor contributes only its own Skill, Tools, Context, Change Review, Apply, and Undo behavior.

The frontend will depend on an IdeaNote-owned Agent SDK and normalized Agent Protocol. It will not depend directly on Codex app-server JSON-RPC types, a model provider SDK, Rig types, or assistant-ui runtime types. Runtime implementations translate their native events into the same Thread, Turn, Item, Delta, Approval, and Error model.

The recommended runtime direction is a hybrid adapter architecture:

1. Build the normalized IdeaNote frontend SDK and interaction model first.
2. Retain the current OpenAI-compatible runtime as a capability-limited adapter.
3. Evaluate both the open-source Codex app-server and the open-source Grok Build ACP agent behind pinned adapters.
4. Prefer Codex app-server for the first editor-tool spike because it documents a client-owned dynamic Tool flow; retain Grok Build as a serious ACP-based alternative because it provides a standardized embedding protocol, persistent Sessions, permissions, Plans, Skills, background work, and custom models.
5. Select runtime behavior through capability negotiation rather than provider-specific UI branches.

The result should feel similar to Codex in interaction quality and task visibility, but it is not a visual clone and does not adopt Codex branding. IdeaNote continues to own editor safety, document mutation, persistence, recovery, and external-change protection.

## 2. Motivation

The current Agent proves the editor-extension boundary and reviewed mutation workflow, but it remains a minimal chat implementation.

Confirmed baseline gaps:

- Assistant Markdown is rendered as plain text.
- The runtime uses Chat Completions and emits only text deltas.
- There is no reasoning-summary event or UI model.
- Plans, tool calls, results, approvals, and errors are flattened into message text or one activity string.
- Conversations are component-local rather than persistent Threads and Turns.
- A running request can be cancelled but cannot be steered.
- Provider errors are not classified or presented with actionable recovery.
- Safe automatic retry is not implemented.
- The configured gateway has shown intermittent TLS failures.
- The configured gateway may buffer hundreds of SSE chunks until generation is complete, producing no meaningful visible streaming despite using a streaming protocol.

The current architecture remains valuable:

- AI enablement is a complete lifecycle gate.
- Credentials stay in the native credential vault.
- The Agent occupies an independent application-level right column.
- The Agent runtime is editor-agnostic.
- File Type Registry selects an Agent Extension.
- IdeaSketch contributes its own Skill, bounded Context, Tools, Change Review, Apply, and Undo.
- Mutation Tools produce reviewable Change Sets and never write directly.
- Apply reuses the normal document session, dirty, save, recovery, and external-change boundaries.

This RFC keeps those strengths and replaces the flattened chat model with a task-oriented Agent protocol.

## 3. Goals

1. Provide a Codex-style right-column task experience with first-class activity items.
2. Render safe Markdown, lists, links, and fenced code blocks.
3. Stream agent messages, reasoning summaries, plans, tool activity, approvals, and errors independently.
4. Support persistent local Threads containing ordered Turns and Items.
5. Support cancellation, explicit retry, and in-flight steering when the runtime supports it.
6. Normalize provider and runtime capabilities behind one frontend SDK.
7. Reuse maintained open-source foundations behind IdeaNote-owned interfaces.
8. Keep all editor semantics outside the generic runtime and UI.
9. Preserve proposal-first mutation and explicit human Apply.
10. Allow Markdown and future editors to reuse the same Agent without runtime changes.

## 4. Non-goals

- Exact reproduction of Codex visuals, branding, or internal implementation.
- Displaying hidden chain-of-thought or claiming a status indicator is model reasoning.
- Direct model writes to documents or the filesystem.
- Automatic approval of editor mutations.
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

Changing the active document does not silently retarget an in-flight Turn. A proposal remains bound to the original target and must pass the normal stale checks before Apply.

### 5.4 Activity is data, not formatted prose

A tool call is a Tool Call Item. A plan is a Plan Item. A reasoning summary is a Reasoning Summary Item. An approval is an Approval Item. The model must not encode these as Markdown conventions for the UI to guess.

### 5.5 Capability degradation is honest

If a runtime cannot provide reasoning summaries, the UI does not show a fake reasoning stream. If a gateway buffers output, the UI reports that it is waiting for the provider rather than claiming tokens are streaming.

## 6. Target interaction

### 6.1 Right-column structure

```text
┌──────────────────────────────────────┐
│ Agent                         [···]  │
│ Thread title             [History]  │
├──────────────────────────────────────┤
│ User message                         │
│                                      │
│ ▸ Reasoning summary                  │
│ ✓ Read active page                   │
│ ▸ Plan                               │
│ ✓ Proposed 1 document change         │
│                                      │
│ Assistant Markdown response          │
│                                      │
│ ┌ Change Review ───────────────────┐ │
│ │ Add Page: Architecture           │ │
│ │ [Reject] [Revise] [Apply]        │ │
│ └──────────────────────────────────┘ │
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
- rename and archive;
- current runtime/model summary;
- capability or degraded-mode indicator when useful;
- access to Agent settings.

Deleting history is outside the first implementation unless a recoverable confirmation flow is defined.

### 6.3 Transcript

The transcript is an ordered projection of Turns and Items. It supports:

- user messages;
- Markdown agent messages;
- collapsible reasoning summaries;
- plans and plan updates;
- Skill activation;
- tool calls, progress, and results;
- approval requests;
- editor Change Reviews;
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

### 6.6 Reasoning presentation

IdeaNote distinguishes three concepts:

1. **Reasoning summary:** readable model-provided summary events, displayed when supported.
2. **Agent activity:** deterministic application events such as loading a Skill, calling a Tool, waiting for approval, or validating a Change Set.
3. **Hidden reasoning:** not available to the UI and never claimed to be displayed.

Reasoning summaries are collapsed by default after Turn completion. They must not be persisted if the selected runtime or policy marks them non-persistable.

## 7. Frontend SDK architecture

The frontend SDK is initially an internal TypeScript module under `src/lib/agent/`. It can become a package only after a second editor proves the public boundary.

```text
Agent React UI
      │
IdeaNote Agent React SDK
      │
IdeaNote Agent Protocol + Store
      │
AgentRuntime interface
      ├── CodexAppServerRuntime adapter
      ├── GrokBuildAcpRuntime adapter
      └── OpenAICompatibleRuntime adapter
      │
AgentEditorHost
      ├── IdeaSketch Agent Extension
      ├── Markdown Agent Extension
      └── Future editor extensions
```

### 7.1 Proposed module boundaries

```text
src/lib/agent/
  protocol.ts
  capabilities.ts
  runtime.ts
  runtimeStore.ts
  eventReducer.ts
  threadRepository.ts
  errors.ts
  retryPolicy.ts
  tools.ts
  approvals.ts
  changeSet.ts
  editorExtension.ts
  editorHost.ts
  adapters/
    codexAppServerAdapter.ts
    grokBuildAcpAdapter.ts
    openAiCompatibleAdapter.ts
  react/
    AgentProvider.tsx
    useAgentThread.ts
    useAgentComposer.ts
    useAgentCapabilities.ts
    useAgentApproval.ts
    useAgentChangeReview.ts
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
  reasoningSummary: boolean;
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
  | AgentReasoningSummaryItem
  | AgentPlanItem
  | AgentSkillItem
  | AgentToolCallItem
  | AgentToolResultItem
  | AgentApprovalItem
  | AgentChangeReviewItem
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

The final Item value is authoritative. Deltas are transport updates and may not concatenate into an identical final value.

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

- Thread started, updated, archived.
- Turn started, status changed, completed.
- Item started, replaced, completed.
- Agent message delta.
- Reasoning summary part added and text delta.
- Plan delta and final Plan Item.
- Tool call requested, progress, result, failure.
- Approval requested and resolved.
- Change Review created, stale, applied, rejected.
- Runtime warning and classified error.

The reducer rejects duplicate event ids, ignores stale sequence numbers, and records protocol gaps for diagnostics.

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
- `useAgentChangeReview`
- `useAgentHistory`

assistant-ui remains an internal rendering primitive. React components consume normalized SDK state and do not parse provider events.

## 8. Editor Agent Extension SDK

### 8.1 Extension contract

```ts
export interface AgentEditorExtension<TDocument, TChangeSet> {
  id: string;
  fileType: string;
  skillId: string;

  buildContext(input: BuildAgentContextInput<TDocument>): AgentContext;
  getTools(input: AgentToolAvailabilityInput<TDocument>): AgentToolDefinition[];

  executeReadTool(
    call: AgentToolCall,
    input: AgentToolExecutionInput<TDocument>,
  ): Promise<AgentToolResult>;

  createChangeProposal(
    call: AgentToolCall,
    input: AgentToolExecutionInput<TDocument>,
  ): Promise<TChangeSet>;

  reviewChangeSet(changeSet: TChangeSet): AgentChangeReview;
  applyChangeSet(changeSet: TChangeSet): Promise<AgentApplyResult>;
  undoLastAgentChange(): Promise<AgentUndoResult>;
}
```

The generic SDK never imports `IdeaSketchDocument`, Markdown AST types, or future editor types.

### 8.2 Tool categories

Tools are declared as:

- `read`: returns bounded editor data and cannot mutate.
- `propose`: creates an opaque Change Set and cannot Apply it.
- `host`: application-owned non-editor operations, introduced only through a separate policy review.

There is no model-callable `applyChangeSet` Tool. Apply is a human UI action handled by the trusted editor host.

### 8.3 Dynamic tool routing

```text
Runtime requests tool
        │
IdeaNote Agent Protocol
        │
AgentEditorHost validates call id, schema, target, and policy
        │
Active AgentEditorExtension executes read or proposal
        │
Structured result returns to runtime
```

Tool calls use stable call ids. Repeated delivery of the same call id returns the recorded result and does not execute again.

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
- one-use Apply identity;
- lifecycle state.

Apply revalidates all target fields. A stale, read-only, missing, externally changed, or already-applied Change Set is rejected.

## 9. Runtime adapters

### 9.1 Codex app-server adapter

The open-source Codex app-server is the preferred rich-runtime candidate because official OpenAI documentation describes it as the interface used to power rich clients and exposes authentication, conversation history, approvals, streamed Agent events, Threads, Turns, Items, steering, interruption, reasoning-summary deltas, and dynamic tool calls.

The adapter must:

- launch and supervise a pinned local app-server process;
- use local stdio by default rather than experimental remote WebSocket transport;
- perform initialize/initialized handshake;
- generate or vendor version-matched TypeScript/JSON schemas;
- translate app-server Thread, Turn, Item, delta, approval, and error events;
- map IdeaNote editor Tools to app-server dynamic Tools when supported;
- keep experimental APIs behind an IdeaNote feature capability;
- redact credentials and sensitive command details;
- restart safely without losing persisted completed Thread history;
- never expose app-server wire types outside the adapter.

Codex app-server support for MCP does not restore IdeaNote's retired MCP product surface. IdeaNote does not publish its editor as an MCP server. Editor capabilities are client-owned dynamic Tools routed through the Agent Editor Host.

### 9.2 OpenAI-compatible adapter

The compatibility adapter preserves the existing user-configurable Base URL, Model, and native Credential Vault path.

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

Runtime selection is configuration and capability based, not editor based.

```text
Editor Extension
      │
IdeaNote Agent SDK
      │
Runtime configured for account/provider
      ├── Codex app-server
      ├── Grok Build ACP
      └── OpenAI-compatible provider
```

Switching editors does not switch runtime implementations.

## 10. Runtime capability comparison

| Capability | Codex app-server | Grok Build ACP | Responses-capable provider | Chat Completions fallback |
| --- | --- | --- | --- | --- |
| Source/license | Open source | Apache-2.0 open source | Provider implementation | Provider implementation |
| Embedding protocol | Product JSON-RPC | Standard ACP JSON-RPC | IdeaNote adapter | IdeaNote adapter |
| Markdown agent message | Yes | Yes | Yes | Yes |
| Text delta | Yes | ACP Session updates | Expected | Provider dependent |
| Reasoning summary | Documented Item deltas when supported | Stable ACP representation must be verified | When provider supports it | No by default |
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

The installed Codex `0.147.0` app-server completed the real `initialize`/`initialized` handshake. Its documented experimental `dynamicTools` flow maps IdeaNote editor Tool definitions to client-owned calls while the upstream runtime remains `read-only` with automatic built-in mutation approval disabled. Codex is therefore the preferred optional rich runtime for mutation-capable Turns after F033-04 wires persistent execution and completes native proposal/Apply/Undo acceptance.

Grok ACP v1 maps incremental assistant messages, Plans, Tool activity, permissions, cancellation, Session creation/resume, and custom model configuration. Sessions are created with `mcpServers: []`, filesystem write capability disabled, and terminal capability disabled. Neither the official ACP documentation nor the inspected open-source surface establishes a stable client-owned dynamic Tool equivalent. Grok therefore advertises no editor Tool capability and remains optional for read/research Turns; mutation-required selection degrades to the compatibility adapter rather than restoring MCP or allowing built-in writes.

Runtime discovery is native-owned. Compatibility remains the default unless an experimental rich runtime is explicitly enabled, installed, version-compatible, and satisfies the active editor Tool safety gate. The frontend consumes normalized capabilities and never branches on Codex or Grok protocol types.

## 11. Streaming behavior

### 11.1 Real streaming

The runtime reports:

- request start;
- connection established;
- first event time;
- first text delta time;
- last delta time;
- completion time.

The frontend batches high-frequency deltas over a small frame-aligned interval to avoid excessive React renders while preserving visible incremental output.

### 11.2 Buffered gateways

A stream is considered effectively buffered when a long first-token delay is followed by nearly all content arriving in one narrow burst. This classification is diagnostic, not a correctness failure.

While waiting, UI may show deterministic statuses such as:

- `Connecting to provider`;
- `Waiting for the model`;
- `Provider is buffering the response` when sufficient evidence exists.

IdeaNote must not fabricate a token stream. A cosmetic reveal animation, if ever added, must be labelled and implemented independently from transport metrics.

### 11.3 Scroll anchoring

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

- no assistant text or reasoning summary has been delivered;
- no Tool call has begun;
- the failure is classified as transient;
- the user has not cancelled;
- the configured attempt limit is not exceeded.

Use exponential backoff with jitter. Retry metadata remains part of the same visible Turn.

### 12.3 Retry after partial progress

After any visible output or Tool call, retry is explicit. It creates a new Turn that references the failed Turn. The runtime must not silently replay a partially executed Tool sequence.

### 12.4 Tool idempotency

Every Tool call has a stable call id and an execution ledger. Duplicate delivery returns the prior result. Proposal Tools must not create duplicate Change Sets for the same call id.

## 13. Persistence

### 13.1 Storage location

Agent Threads are stored in the application data directory, not inside the user's document or Workspace. No `.ideanote/` directory is created merely because a conversation exists.

### 13.2 Stored data

Persist:

- Thread metadata and title;
- completed Turns and final Items;
- bounded Tool summaries and results approved for persistence;
- Change Review state without duplicating full document data;
- runtime/model/capability metadata needed to explain history;
- diagnostic ids and safe timing metrics.

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

Long-running Threads may compact older model context while retaining the user-visible transcript. Compaction is a runtime concern; it cannot delete user-visible history without an explicit history-management action.

## 14. Security and approval

- Credentials remain exclusively in Rust/native secure storage.
- The frontend never receives provider API keys.
- Tool schemas and arguments are validated at the trusted host boundary.
- Only the active registered editor extension can receive editor Tool calls.
- Read Tools return bounded data with truncation markers.
- Proposal Tools create Change Sets only.
- Apply is a user action, not a model Tool.
- Apply performs revision, fingerprint, status, and external-change validation.
- Undo uses the existing editor/session boundary.
- AI disabled means no runtime process, Thread subscription, Skill discovery, Tool registration, or provider request.
- Unsupported editors contribute no mutation Tools.
- Codex app-server experimental capabilities are disabled unless explicitly enabled by the adapter after compatibility checks.
- Grok Build ACP capabilities are version-negotiated and remain adapter-private; `mcpServers` stays empty unless a future RFC explicitly changes the no-MCP product decision.
- App-server is local-only in the initial implementation; remote transports are not required.

## 15. Accessibility and performance

### 15.1 Accessibility

- Transcript Items retain semantic chronological order.
- Reasoning, plan, and tool disclosures use accessible expanded state.
- Running status uses a polite live region without announcing every token.
- Approval buttons name the target and consequence.
- Focus returns predictably after Send, Stop, Apply, Reject, and retry.
- Keyboard navigation reaches Thread history, transcript actions, disclosures, and composer.
- Color is not the only error, success, or running indicator.

### 15.2 Performance

- Batch text deltas before React state updates.
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
- capability policy;
- retry policy;
- approval and Change Set safety;
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
- built-in coding Tools and filesystem mutation are broader than IdeaNote's proposal-only editor contract;
- unstable ACP features and Grok-specific extensions require adapter/version testing;
- adopting it directly could force IdeaNote toward MCP or a maintained fork.

Decision: retain as a first-class spike and optional adapter candidate, but do not make it the only runtime until dynamic editor Tool injection and proposal-only safety are proven.

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

Decision: recommended.

## 18. Delivery roadmap

### Phase 1: Normalize the current frontend

- Add the Thread, Turn, Item, Event, Error, and Capability types.
- Replace component-local transcript state with the normalized reducer/store.
- Add safe Markdown rendering.
- Render text, deterministic activity, Change Review, and errors as distinct Items.
- Preserve the existing runtime behind an adapter.

### Phase 2: Harden the OpenAI-compatible adapter

- Add provider capability negotiation.
- Add Responses API support where available.
- Classify network, TLS, timeout, HTTP, and model failures.
- Add safe pre-output retry.
- Record streaming timing and buffered-gateway diagnostics.
- Add first-class Tool and reasoning-summary events when supported.

### Phase 3: Rich-runtime comparison spike

Run equivalent offline and native acceptance against both rich-runtime candidates rather than choosing from feature lists alone.

#### Codex app-server

- Pin one app-server version.
- Launch over local stdio from Tauri/Rust.
- Generate schemas and map core Thread/Turn/Item events.
- Prove create/resume/list Thread, start/cancel/steer Turn, Markdown text, reasoning summary, Tool call, and approval events.
- Prove clean shutdown, crash recovery, redaction, and version mismatch handling.

#### Grok Build ACP

- Pin one Grok Build release and ACP protocol version.
- Launch `grok agent stdio` locally with auto-update disabled.
- Prove initialize/authenticate, Session creation/resume, prompt, incremental Session updates, Tool updates, Plan updates, cancellation, and process recovery.
- Prove custom Base URL/model configuration without exposing credentials.
- Determine whether IdeaNote editor Tools can be injected without MCP and without enabling unrestricted filesystem/shell mutation.
- Measure the maintenance surface of a Tool-router bridge if standard ACP is insufficient.

Neither candidate replaces the default runtime until the same editor proposal/Apply/Undo and lifecycle checks pass.

### Phase 4: Editor dynamic Tools

- Map the existing IdeaSketch Extension to the normalized Tool host.
- Map to app-server dynamic Tools where supported.
- Prove duplicate call id handling.
- Prove no mutation before Change Review Apply.
- Prove document switch and stale Change Set behavior.

### Phase 5: Persistent Codex-style interaction

- Add local Thread history and resume.
- Add plan, reasoning-summary, Tool, approval, and error Items.
- Add steering and explicit retry.
- Add model/effort controls based on capabilities.
- Complete accessibility and transcript performance work.

### Phase 6: Second-editor proof

- Register the Markdown Agent Extension without changing the Agent Runtime, Protocol, React SDK, or generic UI.
- Use the result to decide whether the internal frontend SDK is ready to become a separately versioned package.

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
- reasoning summary when supported;
- Tool request/result;
- approval request/result;
- classified failures;
- retry before first output;
- no automatic retry after partial progress.

### 19.3 Editor extension tests

- correct extension activation;
- bounded Context;
- schema validation;
- duplicate Tool call id;
- proposal-only mutation;
- stale Apply rejection;
- external-change rejection;
- Apply and Undo through the current document session;
- unsupported editor exposes no mutation Tools.

### 19.4 UI acceptance

- Markdown heading, list, emphasis, link, and code block;
- visible incremental text with a real streaming fake;
- honest waiting state with a buffered fake;
- reasoning-summary disclosure;
- plan and Tool timeline;
- approval and Change Review cards;
- Stop, retry, and steering;
- Thread history and resume;
- keyboard and screen-reader behavior;
- long-transcript performance;
- independent Agent and editor Navigator layout.

### 19.5 Native acceptance

Use a disposable unsaved document. Prove a complete read, proposal, review, Apply, and Undo flow without saving or touching a real user file. Test the fully capable fake, every enabled rich-runtime adapter selected by the comparison spike, and the configured compatibility adapter without exposing credentials. Codex and Grok must pass the same observable lifecycle contract before either becomes a default rich runtime.

## 20. Acceptance criteria

1. UI components depend only on the IdeaNote Agent SDK.
2. No Codex app-server, Grok Build ACP, provider SDK, Rig, or assistant-ui runtime type crosses the public SDK boundary.
3. Assistant messages render safe Markdown.
4. Reasoning summaries appear only when the runtime supplies them.
5. Tool calls, plans, approvals, Change Reviews, and errors are first-class Items.
6. Persistent local Threads can be created, resumed, listed, renamed, and archived.
7. Cancellation works; steering appears only when supported.
8. Transient failures retry automatically only before visible output or Tool execution.
9. Buffered gateways are diagnosed without fabricating token streaming.
10. Editor Tools are selected through File Type Registry Agent Extensions.
11. Mutation Tools cannot Apply or write directly.
12. Apply and Undo preserve all current document safety checks.
13. AI disabled tears down the complete Agent lifecycle.
14. Codex app-server experimental APIs remain adapter-private and capability-gated.
15. Grok Build and ACP types remain adapter-private, exactly versioned, and capability-gated.
16. Runtime selection cannot weaken proposal-only mutation, bypass explicit Apply, enable unrestricted filesystem/shell mutation, or restore MCP as an IdeaNote product surface.
17. A future Markdown extension can reuse the runtime and frontend without generic code changes.

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

Mitigation: stable call ids, execution ledger, no automatic retry after Tool execution, and proposal-only mutations.

### 21.7 Conversation privacy

Mitigation: local application-data storage, bounded persisted Context, explicit persistence flags, redaction, and no credentials or hidden reasoning in history.

## 22. Open questions for implementation planning

F033-03 resolves the runtime questions as follows:

1. Discover Codex app-server as an optional installed runtime; do not bundle it until packaging and update ownership are separately approved.
2. Treat Grok ACP as lacking editor Tool capability until a stable non-MCP host Tool extension is proven upstream.
3. Prefer Codex for mutation-capable rich Turns; allow Grok for read/research Turns when explicitly enabled and protocol-compatible.
4. Select automatically through normalized capabilities and application policy rather than exposing provider-branded UI branches in the first release.

The remaining persistence questions are:

5. Which local storage implementation best supports paginated Threads without adding unnecessary infrastructure?
6. Should reasoning summaries be persisted by default or only within the active session?
7. Should Thread history associate primarily with a Workspace, a document, or remain globally searchable with optional filters?

These questions do not change the frontend SDK boundary and can be resolved during the app-server spike and implementation plans.

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
