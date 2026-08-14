# RFC 003：Enacta Agent Kernel 与插件架构

- 状态：提议
- 日期：2026-08-14
- 来源：F060
- 相关文档：RFC 001、RFC Addendum 002、F033、F037、F050
- 读者：Enacta 产品与工程团队

## 1. 决策摘要

Enacta 将把现有 Rust Agent Core 演进为由 Enacta 自主拥有的 Agent Kernel，而不会使用 Codex、jcode、Octos 或 DeepSeek Harness 整体替换产品运行时。

Kernel 是以下能力在产品层面的最终权威：

- Thread、Turn、Item、Job、Workflow 与子 Agent 的生命周期；
- 有序事件投递与持久化重放；
- Tool 注册、校验、策略、审批、分派与结果归一化；
- 取消、截止时间、重试、幂等与资源预算；
- 插件发现、兼容性、隔离、健康状态与撤销；
- 本地持久化、脱敏、恢复与可观测性；
- 编辑器与 Workspace 能力路由；
- 多 Agent 调度与人工门控编排。

插件只贡献受限能力。插件不会成为 Enacta 文件、编辑器状态、审批策略、历史记录或用户可见生命周期的另一套权威。

本 RFC 的核心架构原则是：

> Kernel 决定工作如何安全运行；插件贡献能力；模型决定请求哪项能力；编辑器始终是业务变更的最终权威。

Enacta 将借鉴：

- DeepSeek Harness 的可组合服务接缝、可逆插件副作用、事件 waterfall 和显式 Tool Pipeline；
- Codex app-server 的双向 Host Tool 流程、Thread/Turn/Item 词汇、流式生命周期、steer、interrupt、审批和特定版本 Schema 生成；
- jcode 的 Provider 目录、诊断、高效多 Session 设计、checkpoint、恢复、rewind、后台任务和冲突感知 swarm；
- Octos 的 API-first 控制面、持久化 pipeline、人工门、trigger、成本感知多 Agent 拓扑、结构化插件进度和有界取消。

Enacta 不会把 DeepSeek Harness 的 `node:vm` 或 worker thread 执行模型当作安全边界。DeepSeek Harness 自身文档明确说明，这些机制只提供容纳和 API 形状约束，不能隔离恶意代码。能够执行代码的 Enacta 插件必须根据其信任等级，运行在操作系统沙箱、WASM/WASI、容器或其他可强制执行的隔离边界内。

## 2. 与 RFC 001 和 RFC Addendum 002 的关系

本 RFC 扩展 RFC 001，但不替换以下已经接受并交付的契约：

- Enacta 自主拥有的归一化 Agent Protocol；
- Thread、Turn、Item 和有序事件模型；
- 应用级右侧 Agent 工作区；
- 与运行时无关的前端状态和 UI；
- 注册表驱动的编辑器 Agent Extension；
- 每个 Turn 捕获固定文档绑定；
- 对能力降级进行真实呈现；
- 持久化本地 Agent 历史；
- 取消、steering、审批与稳定的 Tool call identity；
- 编辑器自有事务、外部变更检查和原生 Undo/Redo；
- RFC Addendum 002 定义的“来源时钟/呈现时钟”双时钟模型；
- 不持久化、不展示原始或隐藏 chain-of-thought 的规则。

本 RFC 只取代 RFC 001 第 9 节和第 16 节中对封闭运行时集合的理解。此前 Codex、Grok Build 和 OpenAI-compatible 路径被视为主要运行时选择；今后它们成为版本化 Kernel 扩展点的实现：

- Codex 等完整 Harness 成为 `SpecialistAgentPlugin` 适配器；
- 直接模型 API 成为 `ModelProviderPlugin` 实现；
- 受管 Skills 成为指令/上下文贡献，而不是通用插件安全模型；
- 当前 Runtime Adapter 边界成为更大 Plugin Protocol 的一部分。

在渐进提取 Kernel 的过程中，现有行为保持有效。RFC 003 不授权立即替换运行时。

## 3. 动机

Enacta 产品说明书定义了一个本地优先、由 Agent 驱动的 AI Workspace，目标是将用户意图转化为持久化的知识、任务、工作流、自动化和应用。这一方向需要的能力远超过交互式编码运行时：

- 前台对话和编辑；
- 持久化后台 Job；
- 定时或事件触发的 Workflow；
- 多个专业 Agent；
- 外部数据连接器；
- 模型和 Provider 选择；
- 编辑器特定的业务能力；
- 对重要行为进行显式人工审批；
- 重放、恢复、审计和成本归因。

当前 Agent Core 已经验证了最重要的产品基础：

- 归一化 Thread/Turn/Item 状态；
- 持久化本地历史和恢复；
- steering、取消、审批和重试；
- Codex 与 Compatibility Runtime Adapter；
- 具备稳定 call id、前置条件、结果大小限制、重复抑制和步骤上限的 Schema 校验 Tool Broker；
- 无法扩大 Tool 权限的受管 Skills；
- 动态编辑器 Tools；
- Workspace 读取、搜索、patch、Diff、移动、Trash 和有界 undo；
- 活动文档、revision、digest、只读状态和外部变更保护；
- Excalidraw 与 CodeMirror 原生事务和 Undo/Redo。

当前缺失的是一套一致的平台边界，使 Enacta 能够加入 Provider Adapter、专业 Agent、持久化 Workflow 和隔离插件，而不必继续在运行时中增加特例。

如果采用外部运行时作为 Enacta 的根权威，虽然可以解决部分通用 Agent 问题，却会引入更严重的不匹配：真实文件事实来源、编辑器事务、文档 Session、应用历史、产品审批和长期“意图到成果”模型都属于 Enacta，而不属于外部 Harness。

## 4. 目标

1. 为交互式 Turn、后台 Job、Workflow 和专业 Agent 定义唯一的 Enacta 执行权威。
2. 将现有运行时接缝演进为稳定、版本化的插件契约。
3. 保留当前 Tool Broker 和编辑器事务安全模型。
4. 同时支持直接模型 Provider 和完整外部 Agent Harness，且 UI 不与任一方耦合。
5. 增加持久化编排、checkpoint、trigger、人工门、预算和恢复。
6. 通过显式 manifest 与最小权限授权支持第三方能力扩展。
7. 将插件可扩展性与插件信任、执行隔离明确分离。
8. 保持真实文件为事实来源，Agent 元数据存放于应用自有存储。
9. 让所有重要行为在可能范围内可见、可归因、可取消，并且可恢复或明确标记为不可逆。
10. 提供渐进迁移路线，使现有 Agent 在整个交付过程中持续可用。

## 5. 非目标

- 在一个版本中重写生产 Agent Runtime。
- 使用 Codex、ACP、Octos、jcode 或 DeepSeek Harness 的 wire type 替换 Enacta 前端 SDK。
- 让所有组件都可替换；最小安全 Kernel 有意保留特权。
- 允许插件直接写入活动编辑器文件。
- 因为 Skill、prompt、模型或插件请求某项权限，就自动授予新能力。
- 将 `node:vm`、JavaScript realm、worker thread 或语言级对象 facade 当作恶意代码隔离。
- 默认加入无限制 shell、network、process、filesystem 或 deployment 能力。
- 自动批准删除、发送、执行、部署、购买或外部系统写入。
- 持久化 credential、原始 Provider payload、隐藏 reasoning 或无界文档快照。
- 在插件签名、兼容性、撤销、隔离和恢复尚未验证前建设公开 marketplace。
- 定义未来 Task、Workflow、Automation 或 Application 编辑器的具体实现。

## 6. 能力评估

### 6.1 评估维度

以下评估针对“是否适合作为 Enacta 运行时基础”，而不仅是编码助手能力。

| 维度 | Enacta 要求 |
| --- | --- |
| 产品权威 | Enacta 控制生命周期、策略、历史、恢复与 UI 事实。 |
| 编辑器集成 | 业务变更使用注册表选中的编辑器事务与原生历史。 |
| 文件与并发 | 真实文件保持权威；过期或外部变更必须 fail closed。 |
| 协议 | 双向、版本化的命令/事件，具备关联与重放能力。 |
| Provider | 支持多个直接模型 Provider，并真实协商能力和诊断。 |
| Tools | Schema 校验、前置条件、审批、预算、幂等和不可变结果。 |
| 插件 | 发现、manifest 校验、生命周期、兼容性、隔离与撤销。 |
| 后台工作 | 持久化 Job，具备进度、取消、重启恢复和结果导入。 |
| Workflow | 版本化图或脚本、checkpoint、人工门、重试、trigger 和预算。 |
| 多 Agent | 父子所有权、专业委派、有界上下文、成本与 provenance。 |
| 安全 | 基于 capability 的最小权限与可强制执行的运行隔离。 |
| 产品适配 | 支持知识、任务、自动化和应用，而不仅是代码仓库。 |

### 6.2 对比矩阵

本评估基于 2026-08-14 检查的仓库与官方文档。上游项目可能快速变化。

| 能力 | 当前 Enacta | DeepSeek Harness | Codex app-server | jcode | Octos |
| --- | --- | --- | --- | --- | --- |
| 产品自有归一化协议 | 强 | 内部 Cordis/事件词汇 | 强大的外部客户端协议 | SDK/server surface | 强大的 UI/API 协议 |
| Thread/Session 生命周期 | 已交付 | 持久化 Session event log、fork/resume | 完整 Thread/Turn/Item API | 强大的 resume/import/rewind | 强大的 Session 与 cursor replay |
| 编辑器原生变更权威 | 强且产品特有 | 通用 filesystem/Tool 模型 | 可使用 Host Tools，偏编码 | 偏编码和文件 | 偏编码和 Tool |
| 显式 Tool Pipeline | 强 Broker，但逻辑较集中 | 优秀的 pre/guard/execute/post pipeline | 强 Tool 与审批生命周期 | 广泛 Tool 系统 | 强 Tool、hook、policy、approval |
| 插件组合 | 仅受管 Skills，缺少通用插件 | 优秀；所有组件皆插件 | Plugin API 仍在开发 | 自开发与广泛模块，稳定插件契约较弱 | 成熟 manifest/discovery/process 插件面 |
| 直接 Provider 目录 | 有限 Compatibility 路径 | 可替换 LLM Adapter | 主要围绕 Codex Provider/Auth | Provider 与 profile 广度优秀 | Provider routing 和 failover 优秀 |
| 后台 Job | 尚未产品化 | Jobs seam 与 Tools | 存在后台终端和调度能力，部分仍实验性 | 强 Background Task Manager | 强 Task、queue、schedule、trigger |
| Workflow 编排 | 尚未产品化 | 模型编写的 worker-thread Workflow seam | 多 Agent 与自动化能力，部分实验性或产品特有 | Swarm 与协调能力 | 强 DAG pipeline、人工门、trigger、swarm |
| 多 Agent | 尚未产品化 | Subagent seam 与动态 Workflow child | Sub-agent 与 collaboration mode | 冲突感知 swarm | Sub-agent、peer 与 swarm dispatcher |
| 隔离 | 当前 Codex sandbox 与可信 Host | 进程沙箱 seam 较强；动态 JS 不是安全边界 | 编码工作中的 sandbox/approval 很强 | 编码运行时保护；self-dev 权限可能很高 | 广泛 OS sandbox backend 和进程隔离 |
| 成熟度风险 | Enacta 自控的生产基线 | Developer preview，明确会破坏兼容性 | 成熟，但上游协议与产品持续演进 | 变化快且范围广 | 平台范围广，集成面巨大 |
| 整体替换适配度 | 应继续演进的基线 | 直接替换低，架构参考高 | 编码专家中等，产品根运行时低 | 编码/Provider 专家中等，产品根运行时低 | 技术上中等；因平台范围重复，战略适配度低到中等 |

### 6.3 DeepSeek Harness

DeepSeek Harness 展示了候选项目中最强的可组合架构：

- 插件向共享 Cordis context 贡献 service、typed event 和可逆 effect；
- Model Adapter、Tool Registry、Session Log、Agent Loop、Persistence、Sandbox 和 UI 都是可配置贡献；
- 明确区分持久化 Session Event、实时 Agent Event 与 Capability Event；
- Tool 执行采用显式 `pre-execute -> monotonic guards -> execute -> post-execute -> immutable result` pipeline；
- capability seam 将 service definition、provider 与 consumer 分离；
- Workflow 具备显式 start/result handle、有界取消、子任务归属、生命周期事件和持久化记录。

这些思想非常值得复用，但完整架构不适合作为 Enacta 根运行时：

- 项目明确处于 developer preview，并预告会发生兼容性破坏；
- “没有特权 Core”的原则与 Enacta 不可替换的文件、编辑器、策略和审计权威冲突；
- 动态扩展与 Workflow 使用 `node:vm` 和 worker thread；其文档明确说明这些并非安全边界；
- 以 TypeScript/Node 为中心的运行时会重复当前 Rust/Tauri 生命周期，并增加原生文件与编辑器安全集成复杂度。

决策：采用其组合思想和 Tool Pipeline 形态，但保留特权 Rust Kernel，并为不可信代码使用可强制执行的隔离。

### 6.4 Codex app-server

OpenAI 官方文档将 Codex app-server 定义为双向 JSON-RPC 集成面，包含：

- initialize 和 client capability negotiation；
- Thread start、resume、fork、read、list、archive 与 delete；
- Turn start、steer 与 interrupt；
- 有序的 `item/started`、Item delta、`item/completed` 和 `turn/completed` notification；
- server-to-client approval 与 Tool request；
- 在 Thread start 时提供的实验性 client-owned dynamic Tools；
- 与具体 Codex 版本绑定的 TypeScript 和 JSON Schema 生成。

它是 Enacta 交互式专业 Agent 协议的最佳参考。Codex 也是当前产品中最强的编码专家：Codex 可在只读 sandbox 中工作，所有编辑器与 Workspace effect 仍通过 Enacta 可信 Host Tools 执行。

Codex 不应成为 Enacta 根运行时：

- 其核心语义仍然面向代码仓库与编码；
- 产品文件、编辑器状态、外部连接器、Task、Automation 和应用部署仍然属于 Enacta；
- 部分 app-server 与 plugin surface 仍是实验性或开发中；
- 直接暴露会使 Enacta UI 和存储耦合上游 Schema 变化；
- Enacta 必须继续支持非 Codex Provider 和离线/本地能力。

决策：继续把 Codex 作为一等 `SpecialistAgentPlugin` 和协议参考，置于 Enacta 归一化与 Tool 权威之后。

### 6.5 jcode

jcode 为 Rust-native、Provider 丰富、多 Session Harness 提供了有价值的实现证据：

- 广泛的 Provider/OAuth 目录，包括命名 OpenAI-compatible profile；
- Provider 诊断与认证测试；
- 高效的 persistent server/client 和多 Session 运行；
- 带进度与取消的后台任务；
- snapshot/journal 持久化、缩减保护、恢复与 rewind；
- 从其他 Harness 导入 Session；
- 带 coordinator/worker、消息、持久化和文件冲突通知的 swarm；
- 语义 memory 与渐进 Skill 激活。

jcode 针对编码 Agent 与 self-development 工作流优化。其自修改模型有意授予广泛权限，不能定义 Enacta 默认信任姿态。Provider、Session、后台任务与 swarm 机制值得借鉴，但整体采用仍会让 Enacta 产品语义从属于编码运行时。

决策：借鉴 Provider profile、doctor、checkpoint、rewind、background task 与 conflict awareness。未来可在协议和安全行为满足 Kernel 契约时，将 jcode 作为固定版本的专业编码 Agent 接入。

### 6.6 Octos

Octos 是最接近完整 Agent 平台的候选者：

- Rust-native Agent Kernel、Provider routing、Tool system、sandbox、memory、channel 与 API；
- 基于 WebSocket 或 stdio 的 UI Protocol，支持 Session replay、Tool activity、approval、background task 与 rollback；
- DOT/DAG pipeline、条件路由、有界并行、retry 与 human gate；
- sub-agent、peer Agent 和带 validator 与成本汇总的 swarm；
- 基于 manifest 的插件、发现、Schema 校验、结构化 progress/cost/artifact event 与优雅进程取消；
- 多种 OS sandbox backend 与 fail-closed policy；
- ACP 与 MCP 集成方向。

但 Octos 也重复了 Enacta 必须拥有的大部分平台：profile、Session、memory、channel、控制面、plugin、UI Protocol、approval 和产品 runtime。使用 Octos 替换 Enacta Agent Core，需要把 Enacta 编辑器事务、受保护文档 Session、真实文件语义、历史模型和 UI 生命周期适配到另一套平台权威。Octos README 还记录了一个当前 ACP 缺口：交互式 Tool approval 尚未通过编辑器协议呈现。

决策：将 Octos 作为持久化编排、Agent 拓扑、进程插件协议、成本归因和运行控制的最强参考，但不将其作为根运行时。未来 Octos Adapter 可以执行隔离的长时研究或自动化任务，并返回待审查 Artifact 或 ChangeSet。

### 6.7 总体建议

| 方案 | 决策 | 原因 |
| --- | --- | --- |
| 继续向当前 Core 添加特例 | 拒绝 | 保留安全性，但无法形成可扩展平台。 |
| 使用 DeepSeek Harness 替换 Enacta | 拒绝 | 可组合性优秀，但成熟度、Node 重复和恶意代码隔离不足。 |
| 使用 Codex app-server 替换 Enacta | 拒绝 | 编码专家优秀，但不拥有 Enacta 更广泛的产品语义。 |
| 使用 jcode 替换 Enacta | 拒绝 | Provider/Session/编码思路优秀，但仍是信任姿态不同的编码 Harness。 |
| 使用 Octos 替换 Enacta | 拒绝 | 平台最完整，但重复控制面并造成产品权威倒置。 |
| 自研 Enacta Agent Kernel，并适配专业 Agent | 接受 | 保留产品权威，同时通过稳定契约复用最强外部能力。 |

## 7. 目标架构

```text
┌──────────────────────────────── Enacta UI ────────────────────────────────┐
│ Agent 面板 · Job 中心 · Workflow 视图 · 审批 · 诊断                     │
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

### 7.1 特权 Kernel 边界

Kernel 有意保持精简，但拥有特权。以下职责不能由普通插件替换：

- 规范身份、sequence 分配和事件顺序；
- capability 发放与撤销；
- Tool call 关联和幂等 ledger；
- 策略评估与审批状态；
- terminal lifecycle 与 late-result rejection；
- 持久化事件提交与恢复标记；
- 插件进程监督与隔离选择；
- 编辑器与 Workspace Host 路由；
- Secret 脱敏与审计策略。

这些职责背后的实现可以内部重构，但插件不能覆盖相应不变量。

### 7.2 Kernel 组件

#### Command Router

接收来自 UI Client、Automation Trigger、Specialist Adapter 和内部 Scheduler 的归一化命令。分派前校验 Schema 版本、actor identity、目标状态与 capability。

#### Session and Event Store

持久化 Thread、Turn、Item、Job、Workflow、approval、Tool outcome、plugin lifecycle 和 recovery 的有序事实。为 UI 与 Context Builder 提供 projection；除非明确授权有界快照，否则文件内容不会进入 Agent 历史。

#### Native Agent Loop

通过直接模型 Provider 运行 Enacta 根 Agent，负责 step progression、context assembly、Tool request、completion 和 compaction boundary。它是一种 Runtime 实现，而不是整个 Kernel。

#### Scheduler

在 concurrency、deadline、token、cost、Tool step、child Agent 与 output budget 下运行前台 Turn 和持久化后台 Job。Scheduler 应在 Workspace 之间保持公平，防止单个 Workflow 耗尽进程资源。

#### Tool Pipeline and Broker

将现有 `AgentToolBroker` 泛化为可组合 Pipeline，同时保留其 Schema、prerequisite、duplicate、result-size、successful-dependency 和 maximum-step 保护。

#### Policy and Approval Engine

把声明的 effect 映射到有效权限，评估 policy，创建人工门，记录决策，应用 scope/expiry，并在 approver 缺失时 fail closed。

#### Plugin Supervisor

发现 manifest、解析兼容版本、选择隔离、启动并监控进程、执行 quota、处理取消、隔离重复失败插件并支持 rollback。

#### Recovery and Reconciler

重放持久化状态，分类孤立的 in-flight 工作，协调插件健康状态，恢复安全 Job，并将不确定副作用转为显式 `needs_review`，而不是盲目重放。

## 8. 领域模型

### 8.1 前台会话类型

RFC 001 定义的类型继续有效：

- `AgentThread`：持久化对话和用户可见历史容器；
- `AgentTurn`：一次用户请求及其后续 Agent 工作；
- `AgentItem`：有序的用户、助手、activity、plan、Tool、approval、artifact、warning、error 和 terminal 单元；
- `AgentEvent`：用于更新 projection 的不可变生命周期或 delta 事实。

### 8.2 后台与编排类型

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

Definition 是版本化不可变输入。Run 绑定一个精确版本。编辑 Workflow 会创建新版本，不会静默改变正在运行的 Run。

### 8.3 专业 Agent Run

专业 Run 是一个子 Job，包含：

- 父 Thread、Turn、Job 或 Workflow node；
- 声明的 role 和 output contract；
- 有界 context reference，而非 ambient access；
- 不宽于父级的 capability grant；
- model、token、cost、duration、Tool step 与 child 上限；
- working directory 或 sandbox binding；
- 结构化 progress 与 terminal result；
- 将输出关联至输入与 Tool call 的 provenance。

专业 Agent 不能为自己授予 capability，也不能直接处理父级 approval。

## 9. Enacta Agent Protocol

### 9.1 协议形态

协议保持双向且与 Runtime 无关。Transport 可以是 Tauri invoke/event bridge、stdio JSON-RPC、本地 socket 或未来经过认证的 WebSocket。Transport 选择不改变领域语义。

每个持久化或需要外部关联的 envelope 包含：

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

规则：

- `id` 在本地安装范围内全局唯一；
- 持久化事件在其 aggregate 内取得单调 sequence；
- `correlationId` 配对 request 与 result；
- `causationId` 记录产生新事件的 command 或 event；
- 兼容 minor version 中的未知 optional field 可忽略；
- 未知 required method 或不兼容 major version 必须 fail closed；
- 每个已发布协议版本都生成并固定 Schema。

### 9.2 命令族

- `thread/create`、`thread/resume`、`thread/fork`、`thread/archive`、`thread/delete`；
- `turn/start`、`turn/steer`、`turn/cancel`、`turn/retry`；
- `tool/result`、`approval/resolve`、`input/respond`；
- `job/create`、`job/pause`、`job/resume`、`job/cancel`、`job/retry`；
- `workflow/start`、`workflow/cancel`、`workflow/input`；
- `plugin/install`、`plugin/enable`、`plugin/disable`、`plugin/update`、`plugin/remove`；
- `diagnostics/read`、`capabilities/read`、`models/list`。

### 9.3 事件族

- `thread/*`、`turn/*` 和 `item/*` 生命周期；
- `tool/requested`、`tool/running`、`tool/progress`、`tool/completed`、`tool/failed`；
- `approval/requested`、`approval/resolved`、`approval/expired`；
- `job/*` 与 `workflow/*` 生命周期、checkpoint、phase 与 node state；
- `agent/child-started`、`agent/child-progress`、`agent/child-completed`；
- `plugin/discovered`、`plugin/started`、`plugin/health`、`plugin/stopped`、`plugin/quarantined`；
- `policy/denied`、`budget/warning`、`budget/exhausted`；
- `artifact/created`、`artifact/validated`、`artifact/imported`、`artifact/rejected`。

事件是事实。Presentation Layer 可以聚合事件，但不能改写来源历史。

### 9.4 动态 Host Tools

Codex 当前 Dynamic Tool 流程是交互参考：

```text
使用 Tool Definition 启动 Thread
  -> Runtime 产生 Tool Call Item
  -> Runtime 向 Enacta 发送相关联的 Tool Request
  -> Enacta Tool Pipeline 执行或拒绝请求
  -> Enacta 返回结构化内容
  -> Runtime 完成 Tool Call Item
```

Enacta Protocol 将这一流程泛化到直接 Provider 和专业 Runtime。Tool Definition 在 Turn 或 Job 启动时捕获，并以 capability-set digest 标识。能力变化绝不静默扩大正在运行的 Run；Kernel 要么通过已声明协议重新绑定，要么启动新的 Runtime context，同时保留 Enacta Thread。

## 10. 插件模型

### 10.1 插件类型

| 插件类型 | 贡献 | 典型示例 |
| --- | --- | --- |
| `ModelProviderPlugin` | 直接模型目录与 generation stream | OpenAI-compatible、Anthropic-compatible、本地模型 |
| `ToolPlugin` | 有界 Tool Definition 与执行 | 搜索、导出、connector action |
| `ContextProviderPlugin` | 有界 context descriptor 与读取 | 活动 selection、task context、calendar summary |
| `SpecialistAgentPlugin` | 完整外部 Agent Runtime | Codex、jcode、Octos specialist |
| `WorkflowPlugin` | Workflow node type、trigger 或 engine | schedule、event trigger、validator node |
| `PersistencePlugin` | Kernel 规则背后的可选存储实现 | 替代 event 或 artifact store |
| `SandboxPlugin` | 可强制执行的 process/workload isolation | Seatbelt、AppContainer、container、remote executor |

Editor Agent Extension 仍是 Enacta 注册表中的一等概念。它们可以通过内部插件机制表示，但第三方插件不能替换活动编辑器的变更权威。

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

Manifest 声明的是请求，而不是权限。安装阶段校验 identity 与 compatibility；启用阶段创建用户或管理员 policy；每次 Run 根据当前 context 与 risk 获得更窄的有效 capability grant。

### 10.3 生命周期

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

任一活动状态都可能转为 failed 或 quarantined。
Update 创建新的 installed version，不修改正在运行的 version。
Rollback 选择此前保留且兼容的 version。
```

必须满足：

- 确定性的 discovery precedence；
- enable 前执行 Schema 与语义校验；
- 以 digest 标识不可变 installed version；
- 路由请求前完成 health/readiness check；
- 有界启动与关闭；
- correlation-safe cancellation 和 late-result rejection；
- crash-loop detection 与 quarantine；
- 显式撤销 capability grant；
- 不得从隔离执行静默降级为非隔离执行；
- Event Store 记录 upgrade 与 rollback。

### 10.4 信任与隔离等级

| 等级 | 执行方式 | 用途 | 最低控制要求 |
| --- | --- | --- | --- |
| T0 可信内置 | 进程内 Rust | Kernel 自有 Provider 与 Capability Host | code review、test、显式内部注册 |
| T1 签名原生插件 | 进程外本地二进制 | 审核过的 Provider、Connector、Specialist、Sandbox | signature/digest、窄环境变量、stdio/socket protocol、OS sandbox、quota |
| T2 可移植受限插件 | WASM/WASI component | 第三方纯计算或有界转换 | 显式 import、memory/fuel/time limit、无 ambient filesystem/network |
| T3 隔离专业 Agent | 受限 subprocess、container、remote executor 或 worktree | 内部 loop 权限较广的编码/研究 Agent | root binding、process/network policy、budget、仅返回 artifact |

进程内 JavaScript 或 `node:vm` 不属于可接受的 T2/T3 隔离边界。它们只能作为已有可强制执行外层边界内部的实现机制。

### 10.5 Capability Grant

Capability 是具名、有作用域、可过期的权限，例如：

- `editor.context.read(documentId, revision)`；
- `editor.transaction.request(documentId)`；
- `workspace.files.read(rootId, patterns, byteBudget)`；
- `workspace.patch.request(rootId, paths)`；
- `connector.calendar.read(accountId, range)`；
- `connector.message.send(accountId, recipients)`；
- `process.execute(environmentId, profile)`；
- `network.http(origins, methods)`；
- `model.invoke(providerId, modelIds)`；
- `agent.spawn(pluginIds, maxChildren)`。

Grant 由 Kernel 针对单个 Turn、Job、Workflow Run 或插件进程发放，绝不根据 prompt 文本推断。子级 Grant 必须是父级 Grant 的子集。

## 11. Tool Pipeline

当前 Tool Broker 将成为不可绕过的 Effect Pipeline：

```text
1. 接收有关联标识的 call
2. 解析已捕获的 Tool Definition
3. 校验 name、Schema、call id 和大小
4. 校验 capability grant 与 source/effect 声明
5. 校验 prerequisite 与成功 dependency
6. 解析实时 context 与 target binding
7. 评估 policy，必要时请求 approval
8. 通过选定 Capability Host/隔离等级执行
9. 归一化 timeout、cancellation、denial 和 Provider error
10. 校验 effect proof 或 editor transaction result
11. 冻结权威 Tool outcome
12. 持久化有界事实并返回相关联结果
```

Plugin hook 可以观察或收窄 call，但不能：

- 在校验后修改 Tool identity；
- 扩大 capability grant；
- 将 denial 转换为 approval；
- 绕过强制 prerequisite；
- 抑制 cancellation 或 terminal state；
- 在没有 effect proof 时改写已应用 mutation result；
- 使用相同逻辑 idempotency key 触发第二次执行。

### 11.1 Tool Effect 分类

| Effect | 示例 | 默认行为 |
| --- | --- | --- |
| `read` | 有界编辑器 context、Workspace read、search | 在捕获 scope 内允许 |
| `compute` | 纯 transform、parse、summarize | 在 CPU/memory/time budget 内允许 |
| `write` | editor transaction、非破坏性 Workspace patch | policy 控制，必须重新校验 target |
| `destructive` | delete、Trash、overwrite、external mutation | 显式 approval 和 recovery 说明 |
| `execute` | script、build、browser action、automation | 隔离环境与 policy/approval |
| `external` | send message、deploy、purchase、修改 SaaS data | 显式 account scope、preview、approval、audit |

## 12. 编辑器与 Workspace 权威

### 12.1 活动编辑器变更

活动编辑器始终是其内存文档状态与原生历史的唯一拥有者。

插件或模型可以请求变更，但 Enacta Editor Capability Host 必须：

1. 解析已捕获的 Editor Extension；
2. 通过 Extension Schema 校验参数；
3. 校验 document id、extension id、revision、source marker、fingerprint、read-only state 与 external-change state；
4. 创建或校验有界 ChangeSet/transaction request；
5. 通过已挂载 editor SDK transaction 应用；
6. 进入正常 dirty、save、recovery 与 native Undo/Redo 生命周期；
7. 返回不暴露任意编辑器内部状态的不透明关联结果。

任何 `ToolPlugin` 或 `SpecialistAgentPlugin` 都不能获得原始可变 editor object。

### 12.2 Workspace 文件 Effect

Workspace capability 继续通过 Rust 自有 Workspace Host：

- 规范 root confinement；
- internal、secret、dependency、Symlink、binary 与 size exclusion；
- 使用精确 digest 实现 optimistic concurrency；
- 拒绝 protected/open document；
- all-or-nothing patch 构建与提交；
- `.ideanote/tmp` staging 与清理；
- watcher expected-write ownership；
- 有界 Diff 与 session ledger；
- after-state 未变化时支持 compare-and-undo；
- delete、move、Trash 或其他 destructive effect 必须 approval。

大型编码 Specialist 通常应在隔离 Git worktree 或一次性 sandbox 中运行，并返回 Diff、patch bundle、test evidence 与 provenance。Enacta 通过自身 Workspace 或 editor transaction path 导入审查后的结果，而不是允许 Specialist 直接修改活动编辑器文件。

## 13. Job、Workflow 与 Trigger

### 13.1 Turn 与 Job

- `Turn` 是主要生命周期显示在一个 Thread 中的交互式工作。
- `Job` 是可跨越 UI connection 或应用前台 Session 的持久化调度工作。
- 在 policy 和用户意图允许后，Turn 可以创建 Job。
- Job 可以向 Thread 发布 progress Item，但不能伪装成 Thread 仍在生成。

### 13.2 Workflow 执行

初始 Workflow 模型采用版本化 DAG，而不是无限制的模型生成代码。Node 可以是：

- model invocation；
- Tool call；
- specialist Agent；
- transformation；
- condition/router；
- parallel fan-out 与 gather；
- retry boundary；
- delay/schedule；
- human input 或 approval gate；
- artifact validation；
- editor 或 Workspace import。

Loop 必须有显式最大 iteration 数。Fan-out 必须有 concurrency 与 total-child cap。每个 node 声明 input/output Schema、capability need、timeout、retry policy 与 persistence policy。

未来 script engine 可以实现相同 `WorkflowPlugin` 契约，但不可信 Workflow code 必须运行在 T2 或 T3 隔离中，不能只依赖 Node VM。

### 13.3 Trigger

可支持的 Trigger 类型包括：

- 显式用户操作；
- schedule 或 recurring timer；
- Workspace file event；
- editor/document lifecycle event；
- external connector event；
- 另一 Job 的 completion 或 failure；
- 通过已认证 Connector 接收的 webhook。

Trigger 通过与 UI Command 相同的 Policy Boundary 创建 Job。Trigger 不携带 ambient user authority；每个已配置 Trigger 绑定显式 capability template 与 risk policy。

### 13.4 人工门

人工门记录：

- 精确 proposed action；
- target 与受影响 resource；
- 执行动作的原因；
- 预期副作用与可逆性；
- 相关 Diff 或 preview；
- 请求的 permission scope 与 expiry；
- approve、reject、modify 或 cancel outcome；
- actor 与 timestamp。

如果 UI 或 approver 不可用，人工门保持等待或过期为拒绝。后台 Job 无法弹出提示时绝不能自动批准。

## 14. 多 Agent 编排

### 14.1 拓扑

Kernel 支持三种显式形式：

1. **Child Specialist**：父任务委派一个有界任务并等待结构化结果。
2. **Peer Handoff**：一个独立 Job 通过声明的 handoff contract 转移责任，同时保留 provenance。
3. **Fan-out/Gather**：Scheduler 把独立 contract 分派给多个 worker，然后校验或综合结果。

Enacta 默认产品模式是 Child Specialist。Peer 和 Swarm 拓扑属于后续能力，因为它们带来更复杂的权限、成本、冲突和恢复行为。

### 14.2 委派契约

每次委派声明：

- objective 与 acceptance Schema；
- 允许的 context reference；
- 授予的 capability；
- file/worktree ownership；
- 最大 child、duration、step、token 与 cost；
- 预期 Artifact 或 ChangeSet；
- validation 与 review policy；
- cancellation 与 failure propagation。

Agent 通过 Kernel 交换结构化消息与不可变 Artifact。它们不共享可变内存状态，也不从共同 working directory 推断所有权。

### 14.3 冲突处理

借鉴 jcode 的 conflict-aware swarm，Kernel 跟踪子 Agent 读取过的 resource，以及其他执行对这些 resource 的修改。可能已过期的子 Agent 收到 invalidation event，并必须重新读取或终止 proposal。该通知不能取代最终 revision/digest 校验。

### 14.4 结果导入

Specialist Result 进入以下四类路径之一：

- informational answer；
- 存储在 Enacta 管理位置的有界 Artifact；
- 需要校验/导入的 proposed ChangeSet；
- 已由 Enacta Capability Host 应用并校验的 Tool Result。

Specialist 在分配 sandbox 之外产生的原始 filesystem change，不能作为产品变更成功的证明。

## 15. 持久化与恢复

### 15.1 事实来源

- 用户内容：真实 Workspace 或 standalone file；
- 实时编辑器状态：已挂载 editor session；
- Agent 生命周期：Enacta 应用 Event Store；
- Workflow Definition：作为用户 Artifact 时使用真实文件，辅以有界应用索引；
- credential：已认证、加密的应用配置；
- 临时插件/Runtime 状态：隔离的应用 cache，永不成为用户内容权威。

### 15.2 事件持久化

只持久化有界且明确分类的数据：

- lifecycle 与 terminal status；
- 最终用户可见 Item；
- Tool identity、安全参数摘要、outcome 与 duration；
- approval request 与 result；
- plugin id/version/digest 与 capability grant id；
- budget 与安全的 usage/cost total；
- checkpoint 与 artifact reference；
- 安全 diagnostics 与 recovery marker。

禁止持久化：

- API key、auth header、token 或 Secret value；
- hidden reasoning 或 raw chain-of-thought；
- 默认情况下的原始 Provider request/response body；
- 无界 Tool output、file body 或 document snapshot；
- plugin environment variable；
- 临时 presentation queue state。

### 15.3 Checkpoint

借鉴 jcode 的 snapshot/journal 保护，checkpoint 绝不能使用意外为空的 projection 替换已知非空持久化历史。写入必须原子化、Schema versioned，并防止破坏性 shrink。损坏 journal 应隔离，并通过新的已验证 checkpoint 修复，而不是静默丢弃。

### 15.4 恢复规则

重启后：

- 已完成事实正常重放；
- 仍显示 running 的前台 Turn 转为 interrupted，除非 Runtime 能证明可恢复；
- Job 只能从已提交 checkpoint 和精确 plugin version 恢复；
- pending approval 仅在 target state 与 expiry 仍有效时继续 pending；
- 不确定 external/destructive effect 转为 `needs_review`；
- 已提交 outcome 的 Tool call 不再执行；
- 未提交且幂等的 read/compute call 可在 policy 下重试；
- 重启后缺失所需 plugin version 时阻止恢复并显示可操作错误。

### 15.5 Rewind

Rewind 改变 model-visible 与 Workflow execution history，但不是文件 Undo。

- Thread rewind 创建新 branch 或 rollback marker，并保留原始 audit trail；
- Job rewind 从较早 checkpoint 以新 run id 创建新 attempt；
- 已应用编辑器变更只能通过 editor-native Undo/Redo 或显式 compare-and-revert Tool 撤销；
- 不可逆 external action 保留记录，不能通过 conversation rewind 擦除。

## 16. 安全模型

### 16.1 威胁模型

系统假设模型、prompt、retrieved content、external data、第三方 plugin 与 specialist output 都可能错误或具有对抗性。信任分配给代码和执行边界，而不是自然语言意图。

### 16.2 必需控制

- 最小权限、Run-scoped capability grant；
- 显式 effect classification；
- 执行前 Schema 校验，执行后 result 校验；
- Tool Boundary 上的独立 policy check；
- 重要 effect 的用户 approval；
- executable plugin 使用 OS/WASM/container isolation；
- canonical path 与 Symlink protection；
- network origin 与 method allowlist；
- Secret isolation 与 redaction；
- 有界 input、output、runtime、memory、process、Tool step、token 与 cost budget；
- active run 绑定不可变 version/digest；
- cancellation propagation 与 process-tree termination；
- sandbox、approver、capability 或 protocol support 缺失时 fail closed；
- installation、capability grant、approval、effect 与 plugin update 的 audit record。

### 16.3 Approval 不是隔离

Approval 回答某个具体 proposed effect 是否可以继续，但不能使不可信代码变安全。反过来，Sandbox 限制代码可以执行什么，但不能替代删除文件、发送消息、部署应用或产生费用时的产品审批。

### 16.4 禁止静默降级

如果请求的 Isolation Backend 不可用，或报告的 enforcement level 低于该 Capability 的最低要求，则调用失败。Kernel 不能静默改用 Host 权限运行同一插件。

## 17. Provider 与 Specialist 策略

### 17.1 直接模型 Provider

当 Enacta 需要运行自己的根 Agent Loop 时，优先使用 `ModelProviderPlugin`。其契约包括：

- Model Catalog 与稳定 Model Identity；
- 不向前端暴露 credential 的认证要求；
- Streaming 与 Tool-call capability boundary；
- reasoning-summary/public-activity 支持，但不包含 raw reasoning；
- context、input、output 与 modality limit；
- retryable 与 terminal error classification；
- health/auth diagnostics；
- usage 与 cost reporting；
- request cancellation。

jcode 的命名 compatibility profile 与 doctor 行为是有用参考。Kernel 保持一套归一化 Capability Model，而不是在 UI 中解析 Provider 名称。

### 17.2 专业 Agent Adapter

当外部 Harness 提供有价值的完整 Loop，例如高级编码或研究时，优先使用 `SpecialistAgentPlugin`。

必需 Adapter 操作：

- initialize 并协商 protocol/capability；
- 创建或恢复 upstream session；
- start、steer、cancel 并观察 run；
- 注册 Host Tool 或等价 capability call；
- 响应 Tool 与 approval request；
- 归一化 upstream Item 与 terminal state；
- 报告 version、health、sandbox 与 effective permission；
- 支持有界 shutdown 与 late-message rejection。

Codex 是首个 conformance target。jcode 与 Octos 是可选的未来 target，不是已承诺 dependency。

## 18. 可观测性与运行

### 18.1 必需诊断信息

- Kernel 与 Protocol version；
- active plugin id、version、digest、trust tier 与 process health；
- selected provider/model 与 effective capability flag；
- Thread、Turn、Job、Workflow 与 child-Agent correlation id；
- queue delay、first event、first text、duration 与 terminal reason；
- Tool call count、duration、effect、approval outcome 与 failure class；
- 按 Provider、Plugin、Job 与 Workflow 统计的 token/cost usage；
- retry、fallback、cancellation、late-result、crash 与 quarantine count；
- checkpoint age 与 recovery outcome；
- dropped/truncated output count，但不存储内容本身。

### 18.2 用户可见事实

UI 必须区分：

- source lifecycle 与 presentation pacing；
- running 与 waiting for input/approval；
- model output 与 Enacta Tool activity；
- proposed change 与 applied change；
- completed、completed-with-warnings 与 needs-review；
- Provider failure、plugin failure、policy denial、sandbox failure、target conflict、budget 或 protocol failure。

### 18.3 运行限制

每个 Plugin 与 Job 都有最大限制。重复启动失败、协议违规、输出洪泛、late result 或 budget abuse 将触发自动 disable/quarantine，并提供用户可见说明。

## 19. 迁移路线

### 阶段 0：协议与 Conformance Fixture

- 固化 Agent Protocol v1 术语与 Envelope 规则；
- 为当前 Compatibility 与 Codex 行为创建 recorded fixture；
- 定义 plugin manifest、capability grant、Tool effect 与 trust tier；
- 保持生产行为不变。

退出条件：现有 Thread、Turn、Tool、approval、cancellation、persistence 与 editor transaction 测试通过 conformance fixture。

### 阶段 1：提取最小 Kernel

- 重命名并分离生命周期权威与 Runtime 实现；
- 将 command routing、session state、event commit、cancellation 与 recovery 放到 Kernel Interface 后；
- 保留当前 Rust Native 与 Codex 路径，通过 Adapter 原样运行。

当前映射：

| 现有边界 | Kernel 目标 |
| --- | --- |
| `AgentRuntimeAdapter` | `SpecialistAgentPlugin` Adapter Base 与 Runtime Driver |
| `AgentSessionState` | 实时 Turn 关联与 Cancellation Coordinator |
| `AgentToolBroker` | Tool Pipeline Core 与 Idempotency Ledger |
| Thread Repository | Session/Event Store Projection |
| `agentToolHost.ts` | Editor Capability Host Bridge |
| `WorkspaceAgentHost` | 内置 Workspace `ToolPlugin`/Capability Host |
| Managed Skills | 内置 Instruction/Context Provider |

退出条件：用户可见行为与已存历史均无不兼容变化。

### 阶段 2：Tool Pipeline 与 Provider Plugin

- 引入有序 Pipeline Stage 与 Hook Contract；
- 定义 `ModelProviderPlugin` 并迁移 Compatibility 路径；
- 增加 Provider Catalog 与 Doctor Diagnostics；
- 保留 Tool Broker 不变量作为强制 Guard。

退出条件：Codex 与 Direct Provider 路径通过同一 Tool、Retry、Cancellation 与 Editor Safety Matrix。

### 阶段 3：进程外 Plugin Host

- 实现 Manifest Discovery、Digest/Signature Check、Process Protocol、Health、Quota 与 Quarantine；
- 交付一个只读参考插件；
- 加入平台 Sandbox Integration，证明不存在静默降级；
- 推迟 Marketplace Distribution。

退出条件：恶意或错误插件 Fixture 无法逃逸已声明 Capability、破坏历史或修改文件。

### 阶段 4：持久化 Job 与 Workflow DAG

- 增加 Job Store、Scheduler、Checkpoint、Progress、Pause/Resume/Cancel 与 Restart Recovery；
- 增加版本化 Workflow Definition、有界 DAG Execution、Retry、Fan-out/Gather 与 Human Gate；
- 首先支持显式 Schedule 和 User-action Trigger。

退出条件：多步骤后台 Workflow 能跨应用重启恢复，且不会重复已提交副作用。

### 阶段 5：专业 Agent 与多 Agent

- 将 Codex 正式作为首个 `SpecialistAgentPlugin` Conformance 实现；
- 增加隔离 Worktree Execution 与 Reviewed Result Import；
- 增加有界 Child Specialist，之后再加入 Fan-out/Gather；
- 使用同一契约评估 jcode 与 Octos Adapter。

退出条件：Enacta 根 Turn 可以委派编码任务，显示其 Progress/Cost，取消任务，审查 Diff 和 Evidence，并通过 Enacta 权威导入接受的变更。

### 阶段 6：生态准备

- 仅在 Protocol、Isolation、Migration 与 Revocation 得到验证后发布稳定 SDK；
- 增加 Signing 与 Update Channel；
- 定义 Marketplace Governance、Permission Review、Compatibility Policy 与 Emergency Revocation。

退出条件：第三方插件能够安装、检查、禁用、更新、回滚和移除，且不危害用户文件或 Agent 历史。

## 20. 备选方案

### 20.1 继续使用当前封闭 Adapter 集合

这是近期成本最低的方案，但会迫使 Job、Connector、Workflow Engine 与新 Specialist 继续进入临时 Runtime Branch。它不适合作为长期架构，但当前实现仍是迁移基线。

### 20.2 一切皆插件

DeepSeek Harness 证明了广泛组合的强大能力。Enacta 拒绝没有特权安全 Core 的做法。Capability Issuance、Editor Routing、Policy、Idempotency、Terminal Lifecycle 与 Durable Commit 不能由其所治理的同一插件替换。

### 20.3 使用 Octos 作为 Kernel

这可以更快获得很多目标能力，但会倒置权威并重复控制面。在 Octos 内适配和维护 Enacta 特有文件/编辑器语义的成本，与建设更薄的 Kernel Layer 相近，同时战略耦合更大。

### 20.4 只使用 Codex Runtime

这会提供优秀编码能力和丰富协议，但失去 Provider Independent，并使编码 Runtime 负责其不拥有的知识、Task、Connector 与 Automation 语义。

### 20.5 只使用 ACP 或 MCP 作为 Plugin Protocol

两者都是有用的 Adapter，但单独使用都无法覆盖 Enacta 的完整 Event Persistence、Editor Transaction Proof、Job Checkpoint、Plugin Lifecycle、Trust Tier、Budget 与 Recovery Contract。Kernel 可以提供 ACP/MCP Bridge，但不会让它们成为内部权威。

### 20.6 在 Node VM 中执行插件代码

对于不可信代码予以拒绝。它适合动态组合，但无法强制保障一个持有真实用户文件的本地优先桌面产品所需的安全属性。

## 21. 风险与缓解措施

| 风险 | 缓解措施 |
| --- | --- |
| Kernel 变成过大的 Framework | 将特权边界限制在权威与不变量；具体能力保留为 Plugin。 |
| Protocol 变化拖慢产品交付 | 版本化 Schema、生成 Binding、使用 Compatibility Fixture，并在 major version 内增量演进。 |
| Plugin 生态扩大攻击面 | 从 Built-in 开始，然后是签名进程外插件，再到 WASM；推迟 Marketplace。 |
| Retry/Restart 后重复副作用 | 稳定 Idempotency Key、已提交 Tool Outcome、Checkpoint，以及对不确定状态使用 needs-review。 |
| 多 Agent 引发文件冲突 | 分配 Worktree/Resource、Read-set Invalidation、最终 Revision/Digest 校验与 Reviewed Import。 |
| 后台 Job 令用户意外 | 显式创建、可见 Job Center、有界 Schedule、Pause/Cancel、Notification 与 Human Gate。 |
| 外部 Runtime 漂移 | 固定版本、生成 Schema、运行 Conformance Suite、真实显示降级并保留 Direct-provider Fallback。 |
| Provider 抽象掩盖重要差异 | 通过 Capability Negotiation 和归一化 Provider-specific Diagnostics 保留差异。 |
| 委派导致成本增长 | 分层 Token/Cost/Child Budget，提供 Warning 与 Hard Stop Event。 |
| Event Store 重复用户内容 | 持久化 Reference 与有界 Evidence，而不是把 File Body 作为第二事实来源。 |
| Approval Fatigue 导致过度授权 | Effect-specific Prompt、Scoped Grant、Expiry、仅对低风险 Policy 复用，默认不提供 Blanket Approval。 |
| 不同平台 Sandbox 能力不同 | 报告 Enforcement Level，测试每个 Backend，在无法满足最低保证时失败。 |

## 22. 验收标准

只有在所有适用条件通过后，架构才视为成功交付：

1. 现有 Thread 与历史仍可读取且无数据丢失。
2. Codex 与 Direct-provider 路径运行在同一归一化 Kernel Protocol 后。
3. UI 不包含 Provider、Specialist 或 Plugin 特有 wire type。
4. 每个 Tool call 都经过 Schema、Capability、Policy、Correlation 与 Budget 校验，并且只终止一次。
5. Duplicate call 或 Late Result 无法重复或改变已提交 Effect。
6. Cancellation 在定义时间内到达 Active Provider、Plugin Process、Tool Waiter、Workflow Node 与 Child Agent。
7. Approval、Sandbox、Plugin Version 或 Capability 缺失时 fail closed。
8. 活动编辑器变更继续使用 Mounted Editor Transaction 与 Native Undo/Redo。
9. Stale Revision、Digest、Fingerprint、External Change、Read-only Transition、Document Switch 或 Protected Session 阻止变更。
10. Workspace 多文件写入保持原子性，或回滚到完整 Before-state。
11. 签名进程外参考插件可以 Start、Stream Progress、Finish、Cancel、Crash、Quarantine、Update 与 Rollback。
12. 不可信插件无法访问未授予的 Filesystem、Network、Process、Secret、Editor 或 Connector Capability。
13. 持久化 Job 能在应用重启后从已提交 Checkpoint 恢复，且不会重复已应用 Effect。
14. Workflow 支持有界 Fan-out/Gather、Retry、Cancellation 与 Human Gate。
15. Specialist Agent 获得有界 Context 与 Capability Grant，报告 Progress/Cost，并返回可审查 Artifact 或 ChangeSet。
16. 隔离 Worktree 中的 Specialist 工作无法直接覆盖活动编辑器文件。
17. Agent 历史不包含 Credential、Raw Hidden Reasoning、无界文件内容或 Plugin Environment Value。
18. Diagnostics 能区分 Provider、Plugin、Policy、Approval、Sandbox、Target-conflict、Budget 与 Protocol Failure。
19. 每个受支持 Protocol Version 都生成并校验 Binding 与 Fixture。
20. 在通用 Plugin Enablement 前，通过完整 Frontend、Rust、Native、Recovery、Privacy 与跨平台 Sandbox 验证。

## 23. 延后决策

- 当前 Repository 泛化后的具体 Event Store 实现；
- WASI Preview 版本与 Component Model 工具链；
- Plugin Signature Authority 与 Marketplace Governance；
- Workflow Definition 使用专用文件格式还是编辑器自有表示；
- Job 与 Workflow 的团队/云同步；
- 分布式执行与 Remote Sandbox Provider；
- 自动低风险 Approval Policy UX；
- Codex Conformance 后 jcode 与 Octos Adapter 的优先级；
- 初始 Built-in 之外的标准 Connector Protocol；
- Public SDK 稳定性与 Semantic-version Support Window。

## 24. 参考资料

### Enacta 产品与实现

- [Enacta 产品说明书](../product/enacta-product-guide.md)
- [RFC 001：Codex-style Generic Agent](001-codex-style-generic-agent.md)
- [RFC Addendum 002：Agent Perceived Streaming Optimization](002-agent-perceived-streaming-optimization.md)
- [F032 交付计划](../superplan/plans/features/F032-codex-style-generic-agent-rfc.md)
- [F033-04 持久化 Thread 与编辑器 Tool](../superplan/plans/features/F033-codex-style-agent-implementation/F033-04-persistent-threads-and-editor-tools.md)
- [F037-02 受管自定义 Skill](../superplan/plans/features/F037-agent-runtime-visibility-and-custom-skills/F037-02-managed-custom-agent-skills.md)
- [F050 Workspace 文件操作](../superplan/plans/features/F050-codex-like-workspace-file-operations.md)
- `src-tauri/src/agent/adapters/mod.rs`
- `src-tauri/src/agent/session.rs`
- `src-tauri/src/agent/tool_broker.rs`
- `src-tauri/src/workspace_agent.rs`
- `src/lib/agent/agentRuntime.ts`
- `src/lib/agent/agentToolHost.ts`

### 上游架构证据

- [DeepSeek Harness 仓库](https://github.com/deepseek-ai/deepseek-harness)
- [检查提交中的 DeepSeek Harness 架构](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/architecture.md)
- [DeepSeek Harness Tool Pipeline](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/tool-execution-pipeline.md)
- [DeepSeek Harness Workflow 信任边界](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/workflow/workflow-worker-thread/README.md)
- [OpenAI 官方 Codex app-server 文档](https://learn.chatgpt.com/docs/app-server)
- [OpenAI Codex 仓库](https://github.com/openai/codex)
- [jcode 仓库](https://github.com/1jehuang/jcode)
- [检查提交中的 jcode Provider Registry](https://github.com/1jehuang/jcode/blob/6057b9f0d3e03552206bf0c10ef56f1b0e6ccb60/crates/jcode-base/src/provider/registry.rs)
- [检查提交中的 jcode Session Persistence](https://github.com/1jehuang/jcode/blob/6057b9f0d3e03552206bf0c10ef56f1b0e6ccb60/crates/jcode-base/src/session/persistence.rs)
- [Octos 仓库](https://github.com/octos-org/octos)
- [检查提交中的 Octos Plugin Protocol v2](https://github.com/octos-org/octos/blob/b0dc4e6193447023d1cc31710f48eb779f6aac98/crates/octos-plugin/docs/protocol-v2.md)
- [检查提交中的 Octos Human Gate](https://github.com/octos-org/octos/blob/b0dc4e6193447023d1cc31710f48eb779f6aac98/crates/octos-pipeline/src/human_gate.rs)

### License 说明

- DeepSeek Harness：MIT License。
- jcode：MIT License。
- Octos：Apache License 2.0。
- Codex：采用具体上游组件时，应检查其精确 License 与 Notice。

借鉴架构模式不等于复制实现。未来如复用代码，实施计划必须记录精确 Source Commit、License、保留 Notice、修改内容与 Dependency Obligation。
