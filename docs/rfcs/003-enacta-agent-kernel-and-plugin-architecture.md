# RFC 003: Enacta Agent Kernel and Plugin Architecture

- Status: Proposed
- Date: 2026-08-14
- Source: F060
- Related: RFC 001, RFC Addendum 002, F033, F037, F050
- Audience: Enacta product and engineering

## 1. Decision summary

Enacta will evolve its existing Rust Agent Core into an Enacta-owned Agent Kernel. It will not replace the product runtime wholesale with Codex, jcode, Octos, or DeepSeek Harness.

The Kernel is the product-level authority for:

- Thread, Turn, Item, Job, Workflow, and child-Agent lifecycle;
- ordered event delivery and durable replay;
- Tool registration, validation, policy, approval, dispatch, and result normalization;
- cancellation, deadlines, retries, idempotency, and resource budgets;
- plugin discovery, compatibility, isolation, health, and revocation;
- local persistence, redaction, recovery, and observability;
- editor and Workspace capability routing;
- multi-Agent scheduling and human-gated orchestration.

Plugins contribute bounded capabilities. They do not become an alternative authority over Enacta files, editor state, approval policy, history, or user-visible lifecycle.

The architectural rule is:

> The Kernel decides how work runs safely. Plugins contribute capabilities. Models decide which capability to request. Editors remain authoritative for business mutations.

Enacta will borrow:

- DeepSeek Harness's composable service seams, reversible plugin effects, event waterfalls, and explicit Tool pipeline;
- Codex app-server's bidirectional host Tool flow, Thread/Turn/Item vocabulary, streaming lifecycle, steering, interruption, approvals, and generated version-specific schemas;
- jcode's provider catalog, diagnostics, efficient multi-session design, checkpoints, recovery, rewind, background tasks, and conflict-aware swarm ideas;
- Octos's API-first control plane, durable pipelines, human gates, triggers, cost-aware multi-Agent topologies, structured plugin progress, and bounded cancellation.

Enacta will not copy DeepSeek Harness's `node:vm` or worker-thread execution model as a security boundary. DeepSeek Harness's own documentation states that these mechanisms provide containment and API shaping, not isolation from malicious code. Enacta plugins that can execute code must run in an operating-system, WASM/WASI, container, or equivalent enforceable boundary appropriate to their trust tier.

## 2. Relationship to RFC 001 and RFC Addendum 002

This RFC extends RFC 001. It does not replace the following accepted and delivered contracts:

- the Enacta-owned normalized Agent Protocol;
- the Thread, Turn, Item, and ordered event model;
- the application-level right-side Agent surface;
- runtime-neutral frontend state and UI;
- registry-driven editor Agent Extensions;
- captured document bindings for each Turn;
- honest capability degradation;
- durable local Agent history;
- cancellation, steering, approvals, and stable Tool call identity;
- editor-owned transactions, external-change checks, and native Undo/Redo;
- the two-clock source-versus-presentation model from RFC Addendum 002;
- the rule that raw or hidden chain-of-thought is neither persisted nor displayed.

This RFC supersedes only the closed-set interpretation of RFC 001 Sections 9 and 16, where Codex, Grok Build, and the OpenAI-compatible path are treated as the principal runtime choices. They become implementations of versioned Kernel extension points:

- Codex and other complete harnesses become `SpecialistAgentPlugin` adapters;
- direct model APIs become `ModelProviderPlugin` implementations;
- managed Skills become instruction/context contributions rather than the general plugin security model;
- the current Runtime Adapter boundary becomes one part of a larger Plugin Protocol.

Existing behavior remains valid while the Kernel is extracted incrementally. RFC 003 authorizes no immediate runtime replacement.

## 3. Motivation

The Enacta product guide defines a local-first Agentic AI Workspace that turns user intent into durable knowledge, tasks, workflows, automation, and applications. That direction requires more than an interactive coding runtime:

- foreground conversations and editing;
- durable background Jobs;
- scheduled and event-triggered Workflows;
- multiple specialist Agents;
- external data connectors;
- model and provider choice;
- editor-specific business capabilities;
- explicit human gates for consequential actions;
- replay, recovery, audit, and cost attribution.

The current Agent Core already proves the most important product-specific foundations:

- normalized Thread/Turn/Item state;
- durable local history and resume;
- steering, cancellation, approvals, and retry;
- Codex and compatibility runtime adapters;
- a schema-validating Tool Broker with stable call ids, prerequisites, bounded results, duplicate suppression, and step limits;
- managed Skills that cannot widen Tool authority;
- dynamic editor Tools;
- Workspace read, search, patch, Diff, move, Trash, and bounded undo;
- active-document, revision, digest, read-only, and external-change protection;
- editor-native Excalidraw and CodeMirror transactions and Undo/Redo.

What is missing is a coherent platform boundary for adding provider adapters, specialist Agents, durable Workflows, and isolated plugins without turning each new capability into another special case inside the runtime.

Adopting an external runtime as Enacta's root authority would solve some generic Agent problems but create a more consequential mismatch: Enacta, not the external harness, owns real-file truth, editor transactions, document sessions, application history, product approvals, and the long-term intent-to-outcome model.

## 4. Goals

1. Define one Enacta-owned execution authority for interactive Turns, background Jobs, Workflows, and specialist Agents.
2. Turn existing runtime seams into stable, versioned plugin contracts.
3. Preserve the current Tool Broker and editor transaction safety model.
4. Support direct model providers and complete external Agent harnesses without coupling the UI to either.
5. Add durable orchestration, checkpoints, triggers, human gates, budgets, and recovery.
6. Permit third-party capability growth through explicit manifests and least-privilege grants.
7. Separate plugin extensibility from plugin trust and execution isolation.
8. Keep real files as the source of truth and Agent metadata in application-owned storage.
9. Make every consequential action visible, attributable, cancellable where possible, and recoverable or explicitly irreversible.
10. Provide a staged migration that keeps the current Agent usable throughout delivery.

## 5. Non-goals

- Rewriting the production Agent runtime in one release.
- Replacing the Enacta frontend SDK with Codex, ACP, Octos, jcode, or DeepSeek Harness wire types.
- Treating every component as replaceable; the minimal safety Kernel is intentionally privileged.
- Allowing plugins to write active editor files directly.
- Giving a Skill, prompt, model, or plugin new capabilities merely because it asks for them.
- Treating `node:vm`, JavaScript realms, worker threads, or language-level object facades as hostile-code isolation.
- Adding an unrestricted shell, network, process, filesystem, or deployment surface by default.
- Automatically approving deletion, sending, execution, deployment, purchases, or external-system writes.
- Persisting credentials, raw provider payloads, hidden reasoning, or unbounded document snapshots.
- Building a public marketplace before plugin signing, compatibility, revocation, isolation, and recovery are proven.
- Defining the implementation details of the future Task, Workflow, Automation, or Application editors.

## 6. Capability assessment

### 6.1 Evaluation dimensions

The projects are evaluated as possible Enacta runtime foundations, not only as coding assistants.

| Dimension | Enacta requirement |
| --- | --- |
| Product ownership | Enacta controls lifecycle, policy, history, recovery, and UI truth. |
| Editor integration | Business mutations use registry-selected editor transactions and native history. |
| Files and concurrency | Real files remain authoritative; stale or external changes fail closed. |
| Protocol | Bidirectional, versioned commands/events with correlation and replay. |
| Providers | Multiple direct model providers with honest capability negotiation and diagnostics. |
| Tools | Schema validation, prerequisites, approvals, budgets, idempotency, and immutable results. |
| Plugins | Discovery, manifest validation, lifecycle, compatibility, isolation, and revocation. |
| Background work | Durable Jobs with progress, cancellation, restart recovery, and result import. |
| Workflow | Versioned graphs/scripts, checkpoints, human gates, retries, triggers, and budgets. |
| Multi-Agent | Parent/child ownership, specialist delegation, bounded context, cost, and provenance. |
| Security | Capability-based least privilege plus enforceable execution isolation. |
| Product fit | Supports knowledge, tasks, automation, and applications, not only repository coding. |

### 6.2 Comparison matrix

The assessment is based on repository and official documentation inspected on 2026-08-14. Upstream projects can change rapidly.

| Capability | Current Enacta | DeepSeek Harness | Codex app-server | jcode | Octos |
| --- | --- | --- | --- | --- | --- |
| Product-owned normalized protocol | Strong | Internal Cordis/event vocabulary | Strong external client protocol | SDK/server surfaces | Strong UI/API protocols |
| Thread/session lifecycle | Delivered | Durable session event log, fork/resume | Strong Thread/Turn/Item APIs | Strong session resume/import/rewind | Strong sessions and cursor replay |
| Editor-native mutation authority | Strong and product-specific | Generic filesystem/tool model | Host Tools possible, coding-centric | Coding/file-centric | Coding/tool-centric |
| Explicit Tool pipeline | Strong Broker, currently concentrated | Excellent pre/guard/execute/post pipeline | Strong tool and approval lifecycle | Broad tool system | Strong tools, hooks, policy, approvals |
| Plugin composition | Managed Skills only; general plugins missing | Excellent; everything is a plugin | Plugin APIs are still under development | Self-development and broad modules, less stable plugin contract | Mature manifest/discovery/process plugin surface |
| Direct provider catalog | Limited compatibility path | Replaceable LLM adapters | Primarily Codex-supported providers/auth | Excellent provider breadth and profiles | Excellent provider routing and failover |
| Background Jobs | Not yet productized | Jobs seam and tools | Background terminals and scheduled surfaces exist, some experimental | Strong background task manager | Strong tasks, queues, scheduling, triggers |
| Workflow orchestration | Not yet productized | Model-written worker-thread workflow seam | Multi-agent and automation capabilities, partly experimental/product-specific | Swarm and coordination capabilities | Strong DAG pipelines, human gates, triggers, swarm |
| Multi-Agent | Not yet productized | Subagent seam and dynamic workflow children | Sub-agents and collaboration modes | Conflict-aware swarms | Sub-agents, peers, and swarm dispatcher |
| Isolation | Current Codex sandbox plus trusted hosts | Good process sandbox seam; dynamic JS is not a security boundary | Strong sandbox/approval model for coding work | Coding-runtime protections; broad self-dev authority can be high risk | Broad OS sandbox backends and process isolation |
| Maturity risk | Production baseline under Enacta control | Developer preview; breaking changes declared | Mature but upstream protocol/product evolution continues | Fast-moving and broad | Broad platform with substantial integration surface |
| Enacta replacement fit | Baseline to evolve | Low as a drop-in; high as architecture reference | Medium as coding specialist; low as product root | Medium as coding/provider specialist; low as product root | Medium technically; low-to-medium strategically due to duplicated platform scope |

### 6.3 DeepSeek Harness

DeepSeek Harness demonstrates the strongest composability model among the candidates:

- plugins contribute services, typed events, and reversible effects to a shared Cordis context;
- the model adapter, Tool Registry, session log, Agent loop, persistence, sandbox, and UI are configurable contributions;
- durable Session events are distinguished from live Agent and capability events;
- Tool execution is an explicit `pre-execute -> monotonic guards -> execute -> post-execute -> immutable result` pipeline;
- capability seams separate service definitions, providers, and consumers;
- workflows have explicit start/result handles, bounded cancellation, child attribution, lifecycle events, and durable records.

The ideas are highly reusable, but the complete architecture is not an appropriate Enacta root runtime:

- the project is explicitly a developer preview with compatibility-breaking changes expected;
- its “no privileged core” principle conflicts with Enacta's need for non-replaceable file, editor, policy, and audit authority;
- the dynamic extension and workflow paths use `node:vm` and worker threads as containment, while their own documentation explicitly says these are not security boundaries;
- a TypeScript/Node-centered runtime would duplicate the current Rust/Tauri lifecycle and complicate native file and editor safety integration.

Decision: adopt the compositional concepts and Tool pipeline shape, but retain a privileged Rust Kernel and use enforceable isolation for untrusted code.

### 6.4 Codex app-server

Official OpenAI documentation defines Codex app-server as a bidirectional JSON-RPC integration surface with:

- initialization and client capability negotiation;
- Thread start, resume, fork, read, list, archive, and delete;
- Turn start, steer, and interrupt;
- ordered `item/started`, item delta, `item/completed`, and `turn/completed` notifications;
- server-to-client approval and Tool requests;
- experimental client-owned dynamic Tools supplied at Thread start;
- generated TypeScript and JSON Schema artifacts tied to an exact Codex version.

This is the best reference for Enacta's interactive specialist-agent protocol. Codex is already the strongest coding specialist in the current product because it can work in a read-only sandbox while Enacta executes editor and Workspace effects through trusted Host Tools.

Codex should not become the Enacta root runtime:

- its primary semantics remain repository and coding work;
- product files, editor state, external connectors, Tasks, Automations, and application deployment remain Enacta concepts;
- some app-server and plugin surfaces are experimental or under development;
- direct exposure would couple Enacta UI and storage to upstream schema churn;
- Enacta must continue working with non-Codex providers and offline/local capabilities.

Decision: keep Codex as the first-class `SpecialistAgentPlugin` and protocol reference, behind Enacta-owned normalization and Tool authority.

### 6.5 jcode

jcode provides useful implementation evidence for a Rust-native, provider-rich, multi-session harness:

- a broad provider and OAuth catalog, including named OpenAI-compatible profiles;
- provider diagnostics and authentication testing;
- efficient persistent server/client and multi-session operation;
- background tasks with progress and cancellation;
- snapshot/journal persistence, shrink guards, recovery, and rewind;
- session import from other harnesses;
- swarms with coordinator/worker roles, messaging, persistence, and file-conflict notifications;
- semantic memory and progressive Skill activation.

jcode is optimized around coding-agent and self-development workflows. Its self-modification model deliberately grants broad authority and therefore cannot define Enacta's default trust posture. Its provider, session, background task, and swarm mechanisms are valuable references, but adopting the full harness would again place Enacta's product semantics behind a coding runtime.

Decision: borrow provider-profile, doctor, checkpoint, rewind, background-task, and conflict-awareness patterns. Optionally integrate jcode as a specialist coding Agent through a pinned adapter when its protocol and safety behavior meet the Kernel contract.

### 6.6 Octos

Octos is the closest candidate to a complete Agent platform:

- Rust-native Agent kernel, provider routing, Tool system, sandbox, memory, channels, and APIs;
- UI Protocol over WebSocket or stdio with session replay, Tool activity, approvals, background tasks, and rollback;
- DOT/DAG pipelines, conditional routing, bounded parallelism, retries, and human gates;
- sub-agents, peer Agents, and validator-gated swarms with cost rollup;
- manifest-based plugins, discovery, schema validation, structured progress/cost/artifact events, and graceful process cancellation;
- multiple OS sandbox backends and fail-closed policies;
- ACP and MCP integration directions.

Octos nevertheless duplicates most of the platform Enacta must own: profiles, sessions, memory, channels, control plane, plugins, UI protocol, approvals, and product runtime. Replacing Enacta's Agent Core with Octos would require adapting Enacta's editor transactions, protected document sessions, real-file semantics, history model, and UI lifecycle to a second platform's authority. Octos's README also records a current ACP gap where interactive Tool approval is not surfaced through the editor protocol.

Decision: use Octos as the strongest reference for durable orchestration, Agent topologies, process plugin protocol, cost attribution, and operational control. Do not adopt it as the root runtime. A future Octos specialist adapter may execute isolated long-running research or automation work and return reviewed Artifacts or ChangeSets.

### 6.7 Overall recommendation

| Option | Decision | Reason |
| --- | --- | --- |
| Keep adding special cases to the current Core | Reject | Preserves safety but does not create a scalable extension platform. |
| Replace Enacta with DeepSeek Harness | Reject | Excellent composability, but preview maturity, Node duplication, and insufficient hostile-code isolation. |
| Replace Enacta with Codex app-server | Reject | Excellent coding specialist, but does not own Enacta's broader product semantics. |
| Replace Enacta with jcode | Reject | Excellent provider/session/coding ideas, but still a coding harness with a different trust posture. |
| Replace Enacta with Octos | Reject | Most complete platform, but duplicates Enacta's control plane and creates product-authority inversion. |
| Build Enacta Agent Kernel and adapt specialists | Accept | Preserves product authority while reusing the strongest external capabilities behind stable contracts. |

## 7. Target architecture

```text
┌──────────────────────────────── Enacta UI ────────────────────────────────┐
│ Agent panel · Job center · Workflow views · approvals · diagnostics      │
└────────────────────────────────────┬──────────────────────────────────────┘
                                     │ Enacta Agent Protocol
┌────────────────────────────────────▼──────────────────────────────────────┐
│                         Enacta Agent Kernel                              │
│                                                                          │
│  Command Router       Session/Event Store       Scheduler                │
│  Thread/Turn State    Job/Workflow State        Budget/Deadline Manager  │
│  Tool Pipeline        Policy/Approval Engine    Plugin Supervisor        │
│  Context Builder      Recovery/Reconciler       Telemetry/Diagnostics    │
└───────────────┬────────────────────┬────────────────────┬─────────────────┘
                │                    │                    │
       Capability Protocol    Specialist Protocol   Provider Protocol
                │                    │                    │
┌───────────────▼──────────┐ ┌──────▼─────────────┐ ┌────▼────────────────┐
│ Enacta capability hosts │ │ Specialist Agents  │ │ Model providers     │
│                         │ │                    │ │                     │
│ Editor extensions       │ │ Codex app-server   │ │ OpenAI-compatible   │
│ Workspace host          │ │ jcode adapter      │ │ Anthropic-compatible│
│ Skills/context          │ │ Octos adapter      │ │ Local providers     │
│ Connectors              │ │ future specialists │ │ future providers    │
└─────────────────────────┘ └────────────────────┘ └─────────────────────┘
                │                    │                    │
       editor transaction      isolated worktree       remote/local model
       and safe file paths     or restricted process   service
```

### 7.1 Privileged Kernel boundary

The Kernel is intentionally small but privileged. The following responsibilities cannot be replaced by ordinary plugins:

- canonical identities, sequence allocation, and event ordering;
- capability issuance and revocation;
- Tool call correlation and idempotency ledger;
- policy evaluation and approval state;
- terminal lifecycle and late-result rejection;
- durable event commit and recovery markers;
- plugin process supervision and isolation selection;
- editor and Workspace Host routing;
- secret redaction and audit policy.

Implementations behind these responsibilities may be refactored internally, but a plugin cannot override the invariant itself.

### 7.2 Kernel components

#### Command Router

Accepts normalized commands from UI clients, automation triggers, specialist adapters, and internal schedulers. It validates schema version, actor identity, target state, and capability before dispatch.

#### Session and Event Store

Persists ordered facts for Threads, Turns, Items, Jobs, Workflows, approvals, Tool outcomes, plugin lifecycle, and recovery. It provides projections for the UI and context builder while keeping file content outside Agent history unless a bounded snapshot is explicitly authorized.

#### Native Agent Loop

Runs the Enacta root Agent through direct model providers. It owns step progression, context assembly, Tool requests, completion, and compaction boundaries. It is one runtime implementation, not the entire Kernel.

#### Scheduler

Runs foreground Turns and durable background Jobs under concurrency, deadline, token, cost, Tool-step, child-Agent, and output budgets. It applies fairness between Workspaces and prevents one Workflow from exhausting the process.

#### Tool Pipeline and Broker

Generalizes the existing `AgentToolBroker` into a composable pipeline while preserving its schema, prerequisite, duplicate, result-size, successful-dependency, and maximum-step protections.

#### Policy and Approval Engine

Maps declared effects to effective permissions, evaluates policy, creates human gates, records decisions, applies expiry/scope, and fails closed when an approver is absent.

#### Plugin Supervisor

Discovers manifests, resolves compatible versions, chooses isolation, starts and monitors processes, enforces quotas, handles cancellation, quarantines repeated failures, and supports rollback.

#### Recovery and Reconciler

Replays durable state, classifies orphaned in-flight work, reconciles plugin health, resumes safe Jobs, and converts uncertain side effects into explicit `needs_review` rather than replaying them blindly.

## 8. Domain model

### 8.1 Foreground conversation types

RFC 001's types remain authoritative:

- `AgentThread`: durable conversation and user-visible history container;
- `AgentTurn`: one user request and the work that follows;
- `AgentItem`: ordered user, assistant, activity, plan, Tool, approval, artifact, warning, error, and terminal units;
- `AgentEvent`: immutable lifecycle or delta fact used to update projections.

### 8.2 Background and orchestration types

```ts
type AgentJobStatus =
  | "queued"
  | "running"
  | "waiting_for_input"
  | "waiting_for_approval"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
  | "needs_review";

interface AgentJob {
  id: string;
  threadId?: string;
  originatingTurnId?: string;
  workspaceBinding?: WorkspaceBinding;
  workflowRunId?: string;
  status: AgentJobStatus;
  capabilityGrantId: string;
  budget: AgentBudget;
  checkpoint?: JobCheckpointRef;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowDefinition {
  id: string;
  version: string;
  inputSchema: JsonSchema;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  policy: WorkflowPolicy;
}

interface WorkflowRun {
  id: string;
  definitionId: string;
  definitionVersion: string;
  status: AgentJobStatus;
  nodeRuns: WorkflowNodeRun[];
  budget: AgentBudget;
}
```

Definitions are versioned immutable inputs. Runs bind to one exact version. Editing a Workflow creates a new version and does not silently alter an in-flight run.

### 8.3 Specialist Agent run

A specialist run is a child Job with:

- a parent Thread, Turn, Job, or Workflow node;
- a declared role and output contract;
- bounded context references rather than ambient access;
- a capability grant narrower than or equal to its parent;
- model, token, cost, duration, Tool-step, and child limits;
- a working-directory or sandbox binding;
- structured progress and terminal result;
- provenance linking its outputs to inputs and Tool calls.

Specialists cannot grant themselves capabilities or directly settle parent approvals.

## 9. Enacta Agent Protocol

### 9.1 Protocol shape

The protocol remains bidirectional and runtime-neutral. Transports may include the Tauri invoke/event bridge, stdio JSON-RPC, local sockets, or a future authenticated WebSocket. Transport choice does not change domain semantics.

Every durable or externally correlated envelope includes:

```ts
interface AgentEnvelope<T> {
  schemaVersion: string;
  id: string;
  sequence?: number;
  timestamp: string;
  method: string;
  threadId?: string;
  turnId?: string;
  jobId?: string;
  workflowRunId?: string;
  causationId?: string;
  correlationId?: string;
  actor: AgentActor;
  payload: T;
}
```

Rules:

- `id` is globally unique within the local installation;
- durable events receive a monotonic sequence within their aggregate;
- `correlationId` pairs requests and results;
- `causationId` records which command or event caused a new event;
- unknown optional fields are ignored within a compatible minor version;
- unknown required methods or incompatible major versions fail closed;
- schemas are generated and pinned per released protocol version.

### 9.2 Command families

- `thread/create`, `thread/resume`, `thread/fork`, `thread/archive`, `thread/delete`;
- `turn/start`, `turn/steer`, `turn/cancel`, `turn/retry`;
- `tool/result`, `approval/resolve`, `input/respond`;
- `job/create`, `job/pause`, `job/resume`, `job/cancel`, `job/retry`;
- `workflow/start`, `workflow/cancel`, `workflow/input`;
- `plugin/install`, `plugin/enable`, `plugin/disable`, `plugin/update`, `plugin/remove`;
- `diagnostics/read`, `capabilities/read`, `models/list`.

### 9.3 Event families

- `thread/*`, `turn/*`, and `item/*` lifecycle;
- `tool/requested`, `tool/running`, `tool/progress`, `tool/completed`, `tool/failed`;
- `approval/requested`, `approval/resolved`, `approval/expired`;
- `job/*` and `workflow/*` lifecycle, checkpoints, phases, and node state;
- `agent/child-started`, `agent/child-progress`, `agent/child-completed`;
- `plugin/discovered`, `plugin/started`, `plugin/health`, `plugin/stopped`, `plugin/quarantined`;
- `policy/denied`, `budget/warning`, `budget/exhausted`;
- `artifact/created`, `artifact/validated`, `artifact/imported`, `artifact/rejected`.

Events are facts. A presentation layer may aggregate them but must not rewrite source history.

### 9.4 Dynamic Host Tools

Codex's current dynamic Tool flow is the reference interaction:

```text
Thread start with Tool definitions
  -> runtime emits Tool Call Item
  -> runtime sends a correlated Tool request to Enacta
  -> Enacta Tool Pipeline executes or denies it
  -> Enacta returns structured content
  -> runtime completes the Tool Call Item
```

The Enacta protocol generalizes this flow across direct providers and specialist runtimes. Tool definitions are captured at Turn or Job start and identified by a capability-set digest. A capability change never silently widens an active run; the Kernel either rebinds through a declared protocol or starts a new runtime context while preserving the Enacta Thread.

## 10. Plugin model

### 10.1 Plugin types

| Plugin type | Contribution | Typical examples |
| --- | --- | --- |
| `ModelProviderPlugin` | Direct model catalog and generation stream | OpenAI-compatible, Anthropic-compatible, local model |
| `ToolPlugin` | Bounded Tool definitions and execution | search, export, connector action |
| `ContextProviderPlugin` | Bounded context descriptors and reads | active selection, task context, calendar summary |
| `SpecialistAgentPlugin` | Complete external Agent runtime | Codex, jcode, Octos specialist |
| `WorkflowPlugin` | Workflow node types, triggers, or engine | schedule, event trigger, validator node |
| `PersistencePlugin` | Optional storage implementation behind Kernel rules | alternative event or artifact store |
| `SandboxPlugin` | Enforceable process or workload isolation | Seatbelt, AppContainer, container, remote executor |

Editor Agent Extensions remain a first-class Enacta registry concept. They may be represented through internal plugin machinery, but third-party plugins cannot replace the active editor's mutation authority.

### 10.2 Manifest

```json
{
  "schemaVersion": "1.0",
  "id": "org.example.research-agent",
  "version": "2.1.0",
  "kind": "specialist-agent",
  "entrypoint": {
    "type": "process",
    "command": "bin/research-agent"
  },
  "protocol": {
    "name": "enacta-specialist",
    "range": ">=1.0 <2.0"
  },
  "capabilities": {
    "requires": ["model.invoke", "network.http"],
    "provides": ["agent.specialist.research"]
  },
  "limits": {
    "memoryMb": 512,
    "maxProcesses": 4,
    "maxOutputBytes": 1048576
  },
  "integrity": {
    "contentDigest": "sha256:...",
    "signature": "..."
  }
}
```

The manifest declares requests, not permissions. Installation validates identity and compatibility. Enablement creates a user/admin policy. Each run receives a narrower effective capability grant based on current context and risk.

### 10.3 Lifecycle

```text
discovered
  -> validated
  -> installed
  -> enabled
  -> starting
  -> ready
  -> running
  -> draining
  -> stopped

Any active state may become failed or quarantined.
Update creates a new installed version; it does not mutate a running version.
Rollback selects a previously retained compatible version.
```

Required lifecycle behavior:

- deterministic discovery precedence;
- schema and semantic validation before enablement;
- immutable installed versions addressed by digest;
- health and readiness checks before routing calls;
- bounded startup and shutdown;
- correlation-safe cancellation and late-result rejection;
- crash-loop detection and quarantine;
- explicit revocation of capability grants;
- no silent fallback from isolated to unisolated execution;
- upgrade and rollback records in the event store.

### 10.4 Trust and isolation tiers

| Tier | Execution | Intended use | Minimum controls |
| --- | --- | --- | --- |
| T0 trusted built-in | In-process Rust | Kernel-owned providers and capability hosts | code review, tests, explicit internal registration |
| T1 signed native | Out-of-process local binary | vetted provider, connector, specialist, sandbox | signature/digest, narrow env, stdio/socket protocol, OS sandbox, quotas |
| T2 portable restricted | WASM/WASI component | third-party pure computation or bounded transformation | explicit imports, memory/fuel/time limits, no ambient filesystem/network |
| T3 isolated specialist | Restricted subprocess, container, remote executor, or worktree | coding/research Agents with broader internal loops | root binding, process/network policy, budgets, artifact-only return |

In-process JavaScript or `node:vm` is not an accepted T2 or T3 isolation boundary. It may be used only as an implementation mechanism inside a trust tier that already has an enforceable outer boundary.

### 10.5 Capability grants

Capabilities are named, scoped, expiring authorities such as:

- `editor.context.read(documentId, revision)`;
- `editor.transaction.request(documentId)`;
- `workspace.files.read(rootId, patterns, byteBudget)`;
- `workspace.patch.request(rootId, paths)`;
- `connector.calendar.read(accountId, range)`;
- `connector.message.send(accountId, recipients)`;
- `process.execute(environmentId, profile)`;
- `network.http(origins, methods)`;
- `model.invoke(providerId, modelIds)`;
- `agent.spawn(pluginIds, maxChildren)`.

A grant is issued by the Kernel for one Turn, Job, Workflow run, or plugin process and is never inferred from prompt text. Child grants are subsets of the parent grant.

## 11. Tool Pipeline

The current Tool Broker becomes the non-bypassable effect pipeline:

```text
1. Receive correlated call
2. Resolve captured Tool definition
3. Validate name, schema, call id, and size
4. Verify capability grant and source/effect declaration
5. Verify prerequisites and successful dependencies
6. Resolve live context and target binding
7. Evaluate policy and request approval when required
8. Execute through the selected capability host/isolation tier
9. Normalize timeout, cancellation, denial, and provider errors
10. Validate effect proof or editor transaction result
11. Freeze the authoritative Tool outcome
12. Persist bounded facts and return the correlated result
```

Plugin hooks may observe or narrow a call. They cannot:

- change Tool identity after validation;
- widen a capability grant;
- convert a denial into approval;
- bypass mandatory prerequisites;
- suppress cancellation or terminal state;
- rewrite an applied mutation result without effect proof;
- cause a second execution for the same logical idempotency key.

### 11.1 Tool effect classes

| Effect | Examples | Default behavior |
| --- | --- | --- |
| `read` | bounded editor context, Workspace read, search | allowed within captured scope |
| `compute` | pure transform, parse, summarize | allowed within CPU/memory/time budget |
| `write` | editor transaction, non-destructive Workspace patch | policy-controlled; target revalidation required |
| `destructive` | delete, Trash, overwrite, external mutation | explicit approval and recovery disclosure |
| `execute` | script, build, browser action, automation | isolated environment and policy/approval |
| `external` | send message, deploy, purchase, modify SaaS data | explicit account scope, preview, approval, audit |

## 12. Editor and Workspace authority

### 12.1 Active editor mutations

The active editor remains the only owner of its in-memory document state and native history.

A plugin or model may request a mutation, but the Enacta Editor Capability Host must:

1. resolve the captured editor extension;
2. validate arguments through the extension schema;
3. verify document id, extension id, revision, source marker, fingerprint, read-only state, and external-change state;
4. create or validate a bounded ChangeSet or transaction request;
5. apply through the mounted editor SDK transaction;
6. enter the normal dirty, save, recovery, and native Undo/Redo lifecycle;
7. return an opaque, correlated result without exposing arbitrary editor internals.

No `ToolPlugin` or `SpecialistAgentPlugin` receives a raw mutable editor object.

### 12.2 Workspace file effects

Workspace capabilities continue through the Rust-owned Workspace Host:

- canonical root confinement;
- internal, secret, dependency, Symlink, binary, and size exclusions;
- exact digests for optimistic concurrency;
- protected/open-document rejection;
- all-or-nothing patch construction and commit;
- `.ideanote/tmp` staging and cleanup;
- watcher expected-write ownership;
- bounded Diff and session ledger;
- compare-and-undo when the after-state is unchanged;
- approval for delete, move, Trash, or other destructive effects.

Large coding specialists should normally work in an isolated Git worktree or disposable sandbox. They return a Diff, patch bundle, test evidence, and provenance. Enacta imports the reviewed result through its own Workspace or editor transaction path rather than allowing the specialist to modify the active editor's files directly.

## 13. Jobs, Workflows, and triggers

### 13.1 Turn versus Job

- A `Turn` is interactive work whose primary lifecycle is visible in one Thread.
- A `Job` is durable scheduled work that may outlive a UI connection or application foreground session.
- A Turn may create a Job after policy and user intent permit it.
- A Job may publish progress Items into a Thread without pretending the Thread itself is still generating.

### 13.2 Workflow execution

The initial Workflow model is a versioned DAG rather than unrestricted model-authored code. Nodes may be:

- model invocation;
- Tool call;
- specialist Agent;
- transformation;
- condition/router;
- parallel fan-out and gather;
- retry boundary;
- delay/schedule;
- human input or approval gate;
- artifact validation;
- editor or Workspace import.

Loops require an explicit maximum iteration count. Fan-out requires a concurrency and total-child cap. Every node declares input/output schemas, capability needs, timeout, retry policy, and persistence policy.

A later script engine may implement the same `WorkflowPlugin` contract, but untrusted workflow code must run in T2 or T3 isolation. It cannot rely on a Node VM alone.

### 13.3 Triggers

Supported trigger classes may include:

- explicit user action;
- schedule or recurring timer;
- Workspace file event;
- editor/document lifecycle event;
- external connector event;
- completion or failure of another Job;
- webhook received through an authenticated connector.

Triggers create Jobs through the same policy boundary as UI commands. A trigger never carries ambient user authority. Each configured trigger binds an explicit capability template and risk policy.

### 13.4 Human gates

A human gate records:

- the exact proposed action;
- target and affected resources;
- why the action is required;
- expected side effects and reversibility;
- relevant Diff or preview;
- requested permission scope and expiry;
- approve, reject, modify, or cancel outcome;
- actor and timestamp.

If the UI or approver is unavailable, the gate remains waiting or expires as denied. It never auto-approves because a background Job cannot prompt.

## 14. Multi-Agent orchestration

### 14.1 Topologies

The Kernel supports three explicit forms:

1. **Child specialist:** a parent delegates a bounded task and awaits a structured result.
2. **Peer handoff:** one sovereign Job transfers responsibility through a declared handoff contract while retaining provenance.
3. **Fan-out/gather:** the scheduler dispatches independent contracts to multiple workers and validates or synthesizes results.

The default Enacta product pattern is child specialist. Peer and swarm topologies are later capabilities because they introduce more complex authority, cost, conflict, and recovery behavior.

### 14.2 Delegation contract

Every delegation declares:

- objective and acceptance schema;
- allowed context references;
- granted capabilities;
- file/worktree ownership;
- maximum children, duration, steps, tokens, and cost;
- expected Artifacts or ChangeSets;
- validation and review policy;
- cancellation and failure propagation.

Agents exchange structured messages and immutable artifacts through the Kernel. They do not share mutable in-memory state or infer ownership from a common working directory.

### 14.3 Conflict handling

Borrowing from jcode's conflict-aware swarm model, the Kernel tracks which resources a child has read and which resources another execution changed. A potentially stale child receives an invalidation event and must re-read or terminate its proposal. This notification does not relax the final digest/revision check.

### 14.4 Result import

Specialist results enter one of four paths:

- informational answer;
- bounded Artifact stored in an Enacta-managed location;
- proposed ChangeSet requiring validation/import;
- validated Tool result already applied by an Enacta capability host.

Raw specialist filesystem changes outside an assigned sandbox are not accepted as proof of successful product mutation.

## 15. Persistence and recovery

### 15.1 Sources of truth

- user content: real Workspace or standalone files;
- live editor state: the mounted editor session;
- Agent lifecycle: Enacta application event store;
- Workflow definitions: real files when represented as user artifacts, plus bounded application indexes;
- credentials: authenticated encrypted application configuration;
- temporary plugin/runtime state: isolated application cache, never user content authority.

### 15.2 Event persistence

Persist only bounded, explicitly classified data:

- lifecycle and terminal status;
- final user-visible Items;
- Tool identity, safe arguments summary, outcome, and duration;
- approval request and result;
- plugin id/version/digest and capability grant id;
- budgets and safe usage/cost totals;
- checkpoints and artifact references;
- safe diagnostics and recovery markers.

Do not persist:

- API keys, auth headers, tokens, or Secret values;
- hidden reasoning or raw chain-of-thought;
- raw provider request/response bodies by default;
- unbounded Tool output, file bodies, or document snapshots;
- plugin environment variables;
- temporary presentation-queue state.

### 15.3 Checkpoints

Borrowing from jcode's snapshot/journal safeguards, a checkpoint must never replace a known non-empty durable history with an unexpectedly empty projection. Writes are atomic, schema-versioned, and guarded against destructive shrink. Corrupt journals are quarantined and repaired through a new verified checkpoint rather than silently discarded.

### 15.4 Recovery rules

After restart:

- completed facts replay normally;
- foreground Turns left running become interrupted unless the runtime proves resumability;
- Jobs may resume only from a committed checkpoint and exact plugin version;
- pending approvals remain pending only when target state and expiry remain valid;
- uncertain external or destructive effects become `needs_review`;
- Tool calls with committed outcomes are not executed again;
- uncommitted idempotent read/compute calls may retry under policy;
- plugin versions missing after restart prevent resume and surface an actionable error.

### 15.5 Rewind

Rewind changes model-visible and workflow execution history; it is not file Undo.

- Thread rewind creates a new branch or rollback marker and preserves the original audit trail.
- Job rewind resumes from an earlier checkpoint as a new attempt with a new run id.
- applied editor changes are reversed only through editor-native Undo/Redo or an explicit compare-and-revert Tool;
- external actions that are not reversible remain recorded and cannot be erased by conversation rewind.

## 16. Security model

### 16.1 Threat model

The system assumes models, prompts, retrieved content, external data, third-party plugins, and specialist outputs may be incorrect or adversarial. Trust is assigned to code and execution boundaries, not to natural-language intent.

### 16.2 Required controls

- least-privilege, run-scoped capability grants;
- explicit effect classification;
- schema validation before execution and result validation afterward;
- independent policy checks at the Tool boundary;
- user approval for consequential effects;
- OS/WASM/container isolation for executable plugins;
- canonical path and Symlink protection;
- network origin and method allowlists;
- Secret isolation and redaction;
- bounded input, output, runtime, memory, process, Tool-step, token, and cost budgets;
- immutable version/digest binding for active runs;
- cancellation propagation and process-tree termination;
- fail-closed behavior on missing sandbox, approver, capability, or protocol support;
- audit records for installation, capability grants, approvals, effects, and plugin updates.

### 16.3 Approval is not isolation

Approval answers whether a specific proposed effect may proceed. It does not make untrusted code safe. Conversely, a sandbox limits what code can do but does not replace product approval for deleting a file, sending a message, deploying an application, or spending money.

### 16.4 No silent downgrade

If a requested isolation backend is unavailable or reports partial enforcement below the capability's minimum requirement, the call fails. The Kernel must not silently run the same plugin with host privileges.

## 17. Provider and specialist strategy

### 17.1 Direct model providers

`ModelProviderPlugin` is preferred when Enacta needs its own root Agent loop. Its contract includes:

- model catalog and stable model identity;
- authentication requirements without exposing credentials to the frontend;
- streaming and Tool-call capability bounds;
- reasoning-summary/public-activity support without raw reasoning;
- context, input, output, and modality limits;
- retryable versus terminal error classification;
- health/auth diagnostics;
- usage and cost reporting;
- request cancellation.

jcode's named compatibility profiles and doctor behavior are useful references. The Kernel keeps one normalized capability model rather than parsing provider names in the UI.

### 17.2 Specialist Agent adapters

`SpecialistAgentPlugin` is preferred when an external harness supplies a valuable complete loop, such as advanced coding or research.

Required adapter operations:

- initialize and negotiate protocol/capabilities;
- create or resume an upstream session;
- start, steer, cancel, and observe a run;
- register Host Tools or equivalent capability calls;
- answer Tool and approval requests;
- normalize upstream Items and terminal state;
- report version, health, sandbox, and effective permissions;
- support bounded shutdown and late-message rejection.

Codex is the first conformance target. jcode and Octos are optional future targets, not committed dependencies.

## 18. Observability and operations

### 18.1 Required diagnostics

- Kernel and protocol versions;
- active plugin id, version, digest, trust tier, and process health;
- selected provider/model and effective capability flags;
- Thread, Turn, Job, Workflow, and child-Agent correlation ids;
- queue delay, first event, first text, duration, and terminal reason;
- Tool call count, duration, effect, approval outcome, and failure class;
- token and cost usage by provider, plugin, Job, and Workflow;
- retry, fallback, cancellation, late-result, crash, and quarantine counts;
- checkpoint age and recovery outcome;
- dropped/truncated output counts without storing the content itself.

### 18.2 User-visible truth

The UI distinguishes:

- source lifecycle from presentation pacing;
- running from waiting for input or approval;
- model output from Enacta Tool activity;
- proposed from applied changes;
- completed from completed-with-warnings or needs-review;
- provider failure from plugin failure, policy denial, sandbox failure, or target conflict.

### 18.3 Operational limits

Every plugin and Job has configured maximums. Repeated startup failure, protocol violations, output flooding, late results, or budget abuse causes automatic disablement or quarantine with a user-visible explanation.

## 19. Migration roadmap

### Phase 0: Protocol and conformance fixtures

- freeze Agent Protocol v1 terminology and envelope rules;
- create recorded fixtures for current Compatibility and Codex behavior;
- define plugin manifests, capability grants, Tool effects, and trust tiers;
- keep production behavior unchanged.

Exit gate: existing Thread, Turn, Tool, approval, cancellation, persistence, and editor transaction tests pass through the conformance fixtures.

### Phase 1: Extract the minimal Kernel

- rename and separate lifecycle authority from runtime implementation;
- move command routing, session state, event commit, cancellation, and recovery behind Kernel interfaces;
- retain the current Rust native and Codex paths unchanged behind adapters.

Current mapping:

| Existing boundary | Kernel destination |
| --- | --- |
| `AgentRuntimeAdapter` | `SpecialistAgentPlugin` adapter base plus runtime driver |
| `AgentSessionState` | live Turn correlation and cancellation coordinator |
| `AgentToolBroker` | Tool Pipeline core and idempotency ledger |
| Thread repository | Session/Event Store projection |
| `agentToolHost.ts` | Editor Capability Host bridge |
| `WorkspaceAgentHost` | built-in Workspace `ToolPlugin`/capability host |
| managed Skills | built-in instruction/context provider |

Exit gate: no user-visible behavior or stored-history incompatibility.

### Phase 2: Tool Pipeline and provider plugins

- introduce ordered pipeline stages and hook contracts;
- define `ModelProviderPlugin` and migrate the compatibility path;
- add provider catalog and doctor diagnostics;
- preserve Tool Broker invariants as mandatory guards.

Exit gate: Codex and direct-provider paths pass the same Tool, retry, cancellation, and editor-safety matrix.

### Phase 3: Out-of-process plugin host

- implement manifest discovery, digest/signature checks, process protocol, health, quotas, and quarantine;
- ship one read-only reference plugin;
- add platform sandbox integration and prove no silent downgrade;
- defer marketplace distribution.

Exit gate: hostile and malformed plugin fixtures cannot escape declared capabilities, corrupt history, or mutate files.

### Phase 4: Durable Jobs and Workflow DAG

- add Job store, scheduler, checkpoints, progress, pause/resume/cancel, and restart recovery;
- add versioned Workflow definitions, bounded DAG execution, retries, fan-out/gather, and human gates;
- add explicit schedule and user-action triggers first.

Exit gate: a multi-step background Workflow survives application restart without repeating a committed side effect.

### Phase 5: Specialist Agents and multi-Agent

- formalize Codex as the first `SpecialistAgentPlugin` conformance implementation;
- add isolated worktree execution and reviewed result import;
- add bounded child specialists and later fan-out/gather;
- evaluate jcode and Octos adapters against the same contract.

Exit gate: a root Enacta Turn can delegate a coding task, show progress/cost, cancel it, review its Diff and evidence, and import accepted changes through Enacta authority.

### Phase 6: Ecosystem readiness

- publish a stable SDK only after protocol, isolation, migration, and revocation are proven;
- add signing and update channels;
- define marketplace governance, permissions review, compatibility policy, and emergency revocation.

Exit gate: third-party plugins can be installed, inspected, disabled, updated, rolled back, and removed without compromising user files or Agent history.

## 20. Alternatives considered

### 20.1 Continue the current closed adapter set

This has the lowest near-term cost but would force Jobs, connectors, Workflow engines, and new specialists into ad hoc runtime branches. It is rejected as the long-term architecture, although the current implementation is the migration baseline.

### 20.2 Make everything a plugin

DeepSeek Harness proves that extremely broad composition is powerful. Enacta rejects the absence of a privileged safety core. Capability issuance, editor routing, policy, idempotency, terminal lifecycle, and durable commit must not be replaceable by the same plugins they govern.

### 20.3 Adopt Octos as the Kernel

This would deliver many desired features faster, but it would invert authority and duplicate the control plane. The cost of adapting and maintaining Enacta-specific file/editor semantics inside Octos is comparable to building the thinner Kernel layer while creating greater strategic coupling.

### 20.4 Use Codex as the only runtime

This provides excellent coding behavior and rich protocol support, but excludes provider independence and makes a coding runtime responsible for knowledge, tasks, connectors, and automation semantics it does not own.

### 20.5 Use only ACP or MCP as the plugin protocol

Both are useful adapters. Neither alone covers Enacta's full event persistence, editor transaction proof, Job checkpoints, plugin lifecycle, trust tiers, budgets, and recovery contract. The Kernel may expose ACP/MCP bridges without making either the internal authority.

### 20.6 Execute plugin code in Node VM contexts

Rejected for untrusted code. It may be convenient for dynamic composition, but it cannot enforce the security properties required by a local-first desktop product with real user files.

## 21. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Kernel becomes an oversized framework | Keep the privileged boundary limited to authority and invariants; capabilities remain plugins. |
| Protocol churn slows product delivery | Version schemas, generate bindings, use compatibility fixtures, and evolve additively within a major version. |
| Plugin ecosystem expands attack surface | Start with built-ins, then signed out-of-process plugins, then WASM; defer marketplace. |
| Duplicate side effects after retry/restart | Stable idempotency keys, committed Tool outcomes, checkpoints, and needs-review for uncertainty. |
| Multi-Agent causes file conflicts | Assigned worktrees/resources, read-set invalidation, final revision/digest validation, reviewed import. |
| Background Jobs surprise users | Explicit creation, visible Job center, bounded schedules, pause/cancel, notifications, and human gates. |
| External runtimes drift | Pin versions, generate schemas, run conformance suites, expose honest degradation, and keep direct-provider fallback. |
| Provider abstraction hides important differences | Capability negotiation and provider-specific diagnostics remain visible in normalized form. |
| Costs grow through delegation | Hierarchical token/cost/child budgets with warning and hard-stop events. |
| Event store duplicates user content | Persist references and bounded evidence, not file bodies as a second source of truth. |
| Approval fatigue leads to unsafe broad grants | Effect-specific prompts, scoped grants, expiry, reusable low-risk policy only, and no blanket default approval. |
| Sandboxes differ across platforms | Report enforcement level, test each backend, and fail when the required guarantee is unavailable. |

## 22. Acceptance criteria

The architecture is considered successfully delivered only when all applicable criteria pass:

1. Existing Threads and history remain readable without data loss.
2. Codex and direct-provider paths run behind the same normalized Kernel protocol.
3. The UI contains no provider-, specialist-, or plugin-specific wire types.
4. Every Tool call is schema-validated, capability-checked, policy-evaluated, correlated, bounded, and terminal exactly once.
5. Duplicate calls or late results cannot repeat or alter a committed effect.
6. Cancellation reaches the active provider, plugin process, Tool waiter, Workflow node, and child Agent within defined bounds.
7. Missing approval, sandbox, plugin version, or capability fails closed.
8. Active editor mutations still use the mounted editor transaction and native Undo/Redo.
9. Stale revision, digest, fingerprint, external change, read-only transition, document switch, or protected session prevents mutation.
10. Workspace multi-file writes remain atomic or roll back to the complete before-state.
11. A signed out-of-process reference plugin can start, stream progress, finish, cancel, crash, quarantine, update, and roll back.
12. An untrusted plugin cannot access filesystem, network, process, Secret, editor, or connector capabilities that were not granted.
13. A durable Job survives application restart from a committed checkpoint without repeating an applied effect.
14. A Workflow supports bounded fan-out/gather, retry, cancellation, and a human gate.
15. A specialist Agent receives bounded context and capability grants, reports progress and cost, and returns a reviewable Artifact or ChangeSet.
16. Specialist work in an isolated worktree cannot directly overwrite active editor files.
17. Agent history contains no credentials, raw hidden reasoning, unbounded file content, or plugin environment values.
18. Diagnostics distinguish provider, plugin, policy, approval, sandbox, target-conflict, budget, and protocol failures.
19. Protocol bindings and fixtures are generated and validated for every supported version.
20. Full frontend, Rust, native, recovery, privacy, and cross-platform sandbox verification passes before general plugin enablement.

## 23. Deferred decisions

- exact event-store implementation after the current repository is generalized;
- WASI Preview version and component-model tooling;
- plugin signature authority and marketplace governance;
- whether Workflow definitions use a dedicated file format or editor-owned representation;
- team/cloud synchronization of Jobs and Workflows;
- distributed execution and remote sandbox providers;
- automatic low-risk approval policy UX;
- jcode and Octos adapter priority after Codex conformance;
- standard connector protocol beyond initial built-ins;
- public SDK stability and semantic-version support window.

## 24. References

### Enacta product and implementation

- [Enacta product guide](../product/enacta-product-guide.md)
- [RFC 001: Codex-style Generic Agent](001-codex-style-generic-agent.md)
- [RFC Addendum 002: Agent Perceived Streaming Optimization](002-agent-perceived-streaming-optimization.md)
- [F032 delivery plan](../superplan/plans/features/F032-codex-style-generic-agent-rfc.md)
- [F033-04 persistent Threads and editor Tools](../superplan/plans/features/F033-codex-style-agent-implementation/F033-04-persistent-threads-and-editor-tools.md)
- [F037-02 managed custom Skills](../superplan/plans/features/F037-agent-runtime-visibility-and-custom-skills/F037-02-managed-custom-agent-skills.md)
- [F050 Workspace file operations](../superplan/plans/features/F050-codex-like-workspace-file-operations.md)
- `src-tauri/src/agent/adapters/mod.rs`
- `src-tauri/src/agent/session.rs`
- `src-tauri/src/agent/tool_broker.rs`
- `src-tauri/src/workspace_agent.rs`
- `src/lib/agent/agentRuntime.ts`
- `src/lib/agent/agentToolHost.ts`

### Upstream architecture evidence

- [DeepSeek Harness repository](https://github.com/deepseek-ai/deepseek-harness)
- [DeepSeek Harness architecture at inspected commit](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/architecture.md)
- [DeepSeek Harness Tool pipeline](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/tool-execution-pipeline.md)
- [DeepSeek Harness workflow trust boundary](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/workflow/workflow-worker-thread/README.md)
- [Official OpenAI Codex app-server documentation](https://learn.chatgpt.com/docs/app-server)
- [OpenAI Codex repository](https://github.com/openai/codex)
- [jcode repository](https://github.com/1jehuang/jcode)
- [jcode provider registry at inspected commit](https://github.com/1jehuang/jcode/blob/6057b9f0d3e03552206bf0c10ef56f1b0e6ccb60/crates/jcode-base/src/provider/registry.rs)
- [jcode session persistence at inspected commit](https://github.com/1jehuang/jcode/blob/6057b9f0d3e03552206bf0c10ef56f1b0e6ccb60/crates/jcode-base/src/session/persistence.rs)
- [Octos repository](https://github.com/octos-org/octos)
- [Octos plugin protocol v2 at inspected commit](https://github.com/octos-org/octos/blob/b0dc4e6193447023d1cc31710f48eb779f6aac98/crates/octos-plugin/docs/protocol-v2.md)
- [Octos human gate at inspected commit](https://github.com/octos-org/octos/blob/b0dc4e6193447023d1cc31710f48eb779f6aac98/crates/octos-pipeline/src/human_gate.rs)

### Licensing notes

- DeepSeek Harness: MIT License.
- jcode: MIT License.
- Octos: Apache License 2.0.
- Codex: consult the license and notices in the exact upstream components adopted.

Borrowing an architectural pattern does not require copying implementation. Any future code reuse must record the exact source commit, license, retained notices, modifications, and dependency obligations in the implementation plan.
