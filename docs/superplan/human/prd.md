# IdeaNote Product Requirements Document

- status: draft
- document_version: 0.3
- created: 2026-08-03
- last_updated: 2026-08-03
- product: IdeaNote
- predecessor: IdeaSlide
- implementation_authorized: false

> 本文档定义 IdeaSlide 向 IdeaNote 演进的产品方向、核心模型和第一阶段范围。当前状态为草案，仅用于评审和持续完善；在本文档明确批准并据此生成、评审开发计划之前，不进入实现阶段。

## 1. 产品概述

IdeaNote 是一个 AI 原生、可编程、Local-first 的 Workspace。用户可以在一个工作区中创建和组织无限画布、Markdown 文档、应用表格、自动化工作流和脚本，并通过右侧 AI Agent 以自然语言读取、创建、修改和关联这些内容。

IdeaNote 不以“传统幻灯片”或“单一笔记文件”为核心，而以可组合的 Workspace Resource 为核心。用户既可以直接操作不同类型的编辑器，也可以让 AI Agent 和 Workflow 通过统一 SDK 完成相同操作。

产品定位：

> IdeaNote — AI workspace for ideas that work.

中文解释：

> 将想法组织成内容、数据和可运行流程的 AI Workspace。

### 1.1 已确认设计决定

- `.is` 保留并回退到既有 IdeaSlide v1 ZIP 结构。
- `.is` 是 Workspace 中的一种资源文件，不再承担整个 Workspace 的持久化职责。
- 一个 `.is` 可以包含一个或多个按顺序排列的 Excalidraw Slide。
- `.is` v1 的 Manifest 和 `slides/{id}.json` 路径保持兼容，不引入新的必填格式头。
- 当前 `.is` v2 Resource Tree 结构只作为旧 IdeaSlide Workspace 的导入来源，不作为 IdeaNote 新 `.is` 的写入格式。
- IdeaNote 同时支持 Workspace Mode 和 Single File Mode。
- 两种模式使用同一套 Resource Model、Editor、SDK、Command Bus、Undo 和 Agent Tools，只切换 Session Scope 与 Persistence Adapter，即“双模式、单内核”。
- Single File Mode 直接打开和保存用户原文件，不静默导入 Workspace。

## 2. 背景与问题

现有 IdeaSlide 已经从传统 Slide 列表演进为包含 Folder 和 Canvas 的 Workspace Resource Explorer，但当前仍有以下限制：

1. 当前 `.is v2` 同时承担 Workspace、Canvas 内容、媒体和日常自动保存容器，修改少量内容也需要重新生成整个 ZIP。
2. 产品和代码仍保留较强的 Slide/Presentation 心智，无法完整表达未来的 Markdown、Table、Workflow 和 Script。
3. 当前不同功能直接围绕 Canvas 构建，缺少供 UI、AI Agent 和 Workflow 共同调用的统一操作层。
4. 当前没有 Workspace 级 AI Agent，用户无法通过对话跨资源创建内容或编排自动化。
5. Workflow 和 Script 未来可以修改其他文件、访问网络或使用 Secret，如果不提前建立权限、事务和审计模型，会产生数据安全和可恢复性风险。

## 3. 产品目标

### 3.1 核心目标

1. 将产品从 IdeaSlide 重构为 IdeaNote，并以 Workspace 作为核心产品对象。
2. 支持可扩展的资源类型系统，第一阶段覆盖 IdeaSketch 和 Markdown，后续增加 IdeaTable、IdeaWorkflow 和 Script。
3. 将日常编辑存储与导入导出文件格式解耦，实现增量自动保存。
4. 提供 Workspace 级 AI Agent，使用户能够通过自然语言创建、读取、修改和关联资源。
5. 为每种资源类型提供类型化 SDK，并让 UI、Agent 和 Workflow 复用同一套命令和验证逻辑。
6. 为 Agent、Workflow 和 Script 提供可审计、可撤销、受权限控制的执行模型。
7. 直接兼容既有 `.is v1`，并为现有 `.is v2` Workspace 提供无损导入，避免已有内容丢失。
8. 同时支持长期多资源工作的 Workspace Mode，以及快速打开真实文件的 Single File Mode，并保证两种模式的编辑行为一致。

### 3.2 成功标准

第一阶段成功的核心闭环是：

> 用户在一个 Workspace 中对 AI Agent 说“创建一个产品发布流程图，并生成配套说明文档”。Agent 创建一个 IdeaSketch 资源和一个 Markdown 资源，界面显示每次工具调用与资源变更，用户可以检查结果并一次撤销这组操作。

完成该闭环时应满足：

- Workspace 自动保存不需要重新打包全部资源。
- Agent 不直接修改底层文件，而是调用公开、可测试的 Resource SDK。
- 一次 Agent 请求产生一个或多个可追踪的 ChangeSet。
- 用户能够查看 Agent 修改了哪些资源，并撤销修改。
- 关闭并重新打开应用后，Workspace 状态完整恢复。
- 用户可以双击或通过 Open File 直接编辑受支持文件，并使用 Save 写回原路径。
- 同一种 Resource 在 Workspace Mode 和 Single File Mode 中使用相同编辑器和 SDK 行为。

## 4. 非目标

以下内容不属于第一阶段：

- 多人实时协作。
- 云端 Workspace 同步。
- 插件市场和第三方插件安装。
- 完整通用 IDE 或任意语言开发环境。
- 无限制、无确认的本地系统访问。
- 移动端编辑器。
- 一次性完成所有资源类型。
- 第一阶段实现复杂 Workflow 调度、分布式执行或长时间后台任务。
- 以 AI 自动生成结果替代用户确认、Undo 和审计能力。

## 5. 产品原则

### 5.1 Workspace-first

Workspace 是长期组织、多资源协作、自动保存、历史恢复和未来同步的主体。Single File Mode 中，用户打开的真实文件本身是持久化真相源；Workspace-first 不表示强制导入，而表示 Workspace 是使用 Agent、Workflow 和跨资源能力时的主要产品形态。

### 5.2 Dual mode, single core

IdeaNote 同时提供 Workspace Mode 和 Single File Mode，但不能形成两套产品内核：

- Workspace Mode 面向长期组织、多资源 Agent 和 Workflow。
- Single File Mode 面向双击打开、快速编辑、Save/Save As 和分享。
- 两种模式共享 Resource Model、Resource Editor、Resource SDK、Command Bus、Schema Validator、Undo/Redo 和 Agent Tool Registry。
- 差异只由 Document Session 的模式、持久化适配器和 Capability Scope 表达。

### 5.3 Local-first

没有网络时，用户仍然可以创建、编辑、搜索和运行不依赖网络的功能。AI 模型和外部服务不可用时，不影响基础编辑能力。

### 5.4 Typed resources

每个资源具有明确的类型、Schema、编辑器、序列化器、迁移器和 SDK。Agent 不通过猜测 JSON 结构操作资源。

### 5.5 One command system

用户界面、AI Agent、Workflow 和 Script 通过统一 Command Bus 修改当前 Document Session，避免 Workspace 和 Standalone 出现多套行为不一致的实现。

### 5.6 Reviewable automation

Agent 和自动化的行为必须可查看、可撤销、可重试，并保留运行记录。破坏性或超出既有权限范围的操作必须先确认。

### 5.7 Extensible without redesign

增加新资源类型时，不应重新设计 Workspace Explorer、存储模型、Agent 工具协议或基础编辑器宿主。

## 6. 核心概念

### 6.1 Workspace

Workspace 是 IdeaNote 中的顶层对象，至少包含：

- 稳定的 `workspaceId`。
- 名称、创建时间、修改时间和 Schema 版本。
- Folder 与 Resource 组成的层级树。
- 当前活动资源与编辑器状态。
- 媒体和附件索引。
- Revision、ChangeSet 和恢复信息。
- Agent 会话和 Workflow 运行记录的引用。

Workspace 由应用管理并增量保存。用户可以导入和导出 Workspace，但日常编辑不依赖不断重写一个压缩包。

本节只描述 Workspace Mode。Single File Mode 的顶层运行对象是 Document Session，真实文件由 FileRepository 管理。

### 6.2 Resource

Resource 是 Workspace 中可选择、移动、重命名、编辑和被 Agent 引用的对象。

基础字段：

```ts
interface WorkspaceResource {
  id: string;
  type: string;
  name: string;
  parentId: string | null;
  order: number;
  schemaVersion: string;
  revision: number;
}
```

内部引用必须使用稳定的 Resource ID。用户可见路径只用于导航和展示，不能作为 Workflow 或 Agent 长期引用的唯一标识。

### 6.3 ChangeSet

所有修改 Workspace 的操作都应产生统一 ChangeSet：

```ts
interface ChangeSet {
  transactionId: string;
  source: "user" | "agent" | "workflow" | "script";
  summary: string;
  changedResourceIds: string[];
  beforeRevision: number;
  afterRevision: number;
  createdAt: string;
  undoable: boolean;
}
```

一个 Agent 请求可以调用多个工具，但应尽可能以一个可撤销事务提交。

### 6.4 Document Session

Document Session 表示当前编辑上下文，并把编辑器与具体存储方式解耦：

```ts
interface DocumentSession {
  mode: "workspace" | "standalone";
  resourceType: string;
  resourceId: string;
  persistence: PersistenceAdapter;
  capabilityScope: CapabilityScope;
}
```

两种 Session：

```text
Workspace Session
  → WorkspaceRepository
  → Resource 级增量保存

Standalone Session
  → FileRepository
  → 读取和保存真实的 .is/.md/.it/.iwf 文件
```

Resource Editor 不判断文件来自 Workspace 还是本地路径，而是通过 Document Session 读取内容、提交 Command 和获取保存状态。

## 7. 资源类型与文件格式

### 7.1 IdeaSketch (`.is`)

IdeaSketch 是 Excalidraw 的包装格式，也是 Workspace 中的一种 Resource。`.is` 回退并保持既有 IdeaSlide v1 ZIP 结构，而不是继续使用 v2 Resource Tree，也不重新定义为新的单 Canvas 格式。

一个 `.is` 可以包含一个或多个按顺序排列的 Excalidraw Slide：

```text
example.is
├── manifest.json
├── slides/
│   ├── {slide-id-1}.json
│   └── {slide-id-2}.json
├── media/          # v1 兼容下可选或预留
└── thumbnails/     # 预留，不属于第一阶段
```

`manifest.json` 保持 v1 字段：

```json
{
  "version": "1.0",
  "created": "2026-08-03T00:00:00Z",
  "modified": "2026-08-03T01:00:00Z",
  "slides": [
    {
      "id": "slide-1",
      "title": "Overview"
    },
    {
      "id": "slide-2",
      "title": "Architecture"
    }
  ]
}
```

每个 `slides/{id}.json` 保存一个 Excalidraw Scene：

```json
{
  "type": "excalidraw",
  "version": 2,
  "elements": [],
  "appState": {},
  "files": {}
}
```

格式规则：

- Slide 顺序由 Manifest 中 `slides` 数组顺序决定。
- Slide 名称由 `slides[].title` 保存。
- Camera 继续作为对应 Slide `elements` 中带有 `customData.type = "camera"` 的 Excalidraw Rectangle 保存。
- Camera 的播放顺序由 Camera Element 的 `customData.order` 决定。
- Excalidraw 图片文件继续通过 Scene `files` 保持 v1 兼容；未来如需把媒体独立到 `media/`，必须通过新的格式版本设计，不能改变 v1 读取语义。
- Folder、Workspace Resource Tree、Agent History 和 Workflow Run 不写入 `.is`，这些属于外层 Workspace。
- IdeaNote 写出的 `.is` 使用 `version: "1.0"`，并接受现有兼容 v1 文件。
- 当前 `.is v2` 不由新的 IdeaSketch Writer 写出，只通过 Legacy Workspace Import 读取。

### 7.2 IdeaTable (`.it`)

IdeaTable 是应用表格格式，目标不是复制传统电子表格，而是提供结构化数据、字段类型、视图和自动化能力。

预期能力：

- Table、Field、Record 的稳定 ID。
- 文本、数字、日期、布尔、单选、多选、文件、引用和公式字段。
- 多视图，包括 Grid、Kanban、Gallery 等未来能力。
- 过滤、排序和分组。
- Resource 间引用。
- Agent 可通过 Table SDK 增删字段、写入记录和创建视图。
- Workflow 可监听记录创建或状态变化。

IdeaTable 不纳入第一阶段 MVP 实现，但 SDK 和 Resource Type Registry 必须为它预留边界。

### 7.3 Markdown (`.md`)

Markdown 保持标准文本格式，优先兼容通用 Markdown 工具。

IdeaNote 专有元数据应优先使用可选 Front Matter 或 Workspace Sidecar Metadata，避免破坏标准 Markdown 内容。

预期能力：

- 文本编辑和预览。
- 标题、列表、代码块、表格和链接。
- 通过 Resource ID 建立稳定的 Workspace 内部引用。
- Agent 支持创建、读取、追加和范围 Patch。
- 修改时尽量使用结构化 Patch，避免每次整体重写全文。

### 7.4 IdeaWorkflow (`.iwf`)

IdeaWorkflow 是声明式自动化流程格式，表示 Trigger、Node、Edge、权限、输入输出和运行策略。

基础节点类型预计包括：

- Trigger
- Condition
- Workspace/File Operation
- IdeaSketch Operation
- Markdown Operation
- IdeaTable Operation
- AI Prompt
- Script
- HTTP Request
- Notification
- Human Approval

Workflow 编辑器采用可缩放节点画布，右侧 Agent 可以帮助创建、解释和修改流程。Workflow 运行历史与编辑历史分离。

IdeaWorkflow 不属于第一阶段 MVP，但其命令和权限模型必须与 Agent 共用。

### 7.5 Script

脚本用于表达 Resource SDK 无法覆盖的自定义逻辑。优先使用标准扩展名，例如 `.js`、`.ts` 或未来支持的 `.py`，不在第一阶段定义新的专有脚本格式。

脚本必须运行在受控环境中，并具有：

- 明确的文件读写范围。
- 网络访问权限。
- Secret 引用权限。
- 超时、内存和输出限制。
- 运行日志。
- 可取消能力。

### 7.6 Workspace 导出格式

由于 `.is` 只表示使用 v1 结构的 IdeaSketch Resource，需要独立的 Workspace 级导入导出格式。暂以 `.inw`（IdeaNote Workspace）作为候选扩展名，最终名称属于待决事项。

Workspace 导出包应包含完整资源树、所有资源内容、媒体、格式版本和必要元数据，但不默认包含本地缓存、完整 Agent 对话、Secret 明文或不必要的运行临时文件。

## 8. Resource Type Registry

每种资源类型必须通过统一注册表声明能力：

```ts
interface ResourceTypeDefinition {
  type: string;
  displayName: string;
  extensions: string[];
  icon: string;
  editor: string;
  schemaVersion: string;
  creatable: boolean;
  importable: boolean;
  exportable: boolean;
  serializer: string;
  migrator: string;
  sdkNamespace: string;
}
```

注册表至少服务于：

- Workspace Explorer 的 New Resource 菜单。
- 文件图标和类型名称。
- 中央编辑器路由。
- 导入导出。
- Schema 校验和迁移。
- Agent Tool Registry。
- Workflow Node Registry。
- Unsupported Resource 回退界面。

## 9. Resource SDK 与 Command Bus

### 9.1 SDK 命名空间

建议第一阶段定义：

```text
workspace.*
sketch.*
markdown.*
```

后续增加：

```text
table.*
workflow.*
run.*
```

示例操作：

```text
workspace.listResources
workspace.createFolder
workspace.moveResource
workspace.renameResource

sketch.create
sketch.createSlide
sketch.renameSlide
sketch.reorderSlides
sketch.addElements
sketch.updateElements
sketch.createCamera
sketch.reorderCameras

markdown.create
markdown.read
markdown.patch
```

### 9.2 操作要求

每个写操作必须：

- 校验参数和目标资源类型。
- 校验调用者权限。
- 支持幂等键或明确处理重试。
- 在事务中提交。
- 生成 ChangeSet。
- 更新资源 Revision。
- 可被 UI、Agent 和 Workflow 共同调用。
- 返回结构化结果和用户可理解的摘要。

Agent 不得直接绕过 SDK 修改 Workspace 数据库或底层文件。

同一 SDK 必须能够在两种 Session 中运行：

- Workspace Session 根据 Workspace Permission 修改一个或多个 Resource。
- Standalone Session 默认只允许修改当前文件对应的 Resource。
- 当前请求超出 Standalone Capability Scope 时，应提示用户将文件加入或转换为 Workspace，而不是静默扩大本地文件访问范围。

## 10. AI Agent

### 10.1 定位

右侧 AI Agent 是 Workspace 操作界面，而不只是通用聊天框。它理解当前 Workspace、当前 Resource、编辑器选区和用户显式添加的上下文，并通过 Resource SDK 执行任务。

### 10.2 核心能力

第一阶段应支持：

- 回答与当前 Workspace 和选中资源有关的问题。
- 创建 Folder、IdeaSketch 和 Markdown。
- 创建、重命名、排序和修改 IdeaSketch Slides。
- 读取和修改指定 Slide 中的 IdeaSketch Elements。
- 创建和调整 Camera。
- 创建、读取和 Patch Markdown。
- 移动、重命名和关联资源。
- 展示 Tool Call、执行状态和错误。
- 展示本轮创建或修改的资源。
- 撤销 Agent 产生的 ChangeSet。
- 引用当前文件、当前选区或用户通过 `@resource` 指定的资源。

### 10.3 Agent 面板

桌面端基本布局：

```text
┌──────────────┬──────────────────────────────┬────────────────────┐
│ Workspace    │ Resource Editor              │ Agent              │
│ Explorer     │                              │                    │
│              │ IdeaSketch / Markdown /      │ Context            │
│ Folder       │ IdeaTable / IdeaWorkflow     │ Conversation       │
│ Resources    │                              │ Tool activity      │
│              │                              │ Change review      │
│              │                              │ Composer           │
└──────────────┴──────────────────────────────┴────────────────────┘
```

Agent 面板要求：

- 默认可折叠，并支持有限范围拖动调整宽度。
- Header 显示 Agent 名称、当前作用域和运行状态。
- 支持 Agent、Runs 等未来页签，但第一阶段可以只交付 Agent。
- Tool Call 使用可展开活动卡片，而不是把内部日志直接混入回复正文。
- 资源修改以 Change Card 展示，例如 Created、Modified、Moved。
- Change Card 支持定位资源、查看摘要和 Undo。
- 输入框支持 `@resource`、添加文件和引用当前选区。
- 空状态提供与当前资源类型相关的示例，而不是固定通用提示。
- 所有用户可见界面文案使用 English。

### 10.4 上下文策略

Agent 默认获得最小必要上下文：

- 当前 Workspace 基本信息。
- 当前 Resource 元数据。
- 当前编辑器选区或可视区域摘要。
- 用户主动引用的资源。

Agent 不应默认读取整个 Workspace 的所有内容。跨目录或大量读取应通过工具调用完成，并在活动记录中可见。

Agent Header 必须明确显示当前作用域：

```text
Context: Current page
Context: Current file
Context: Current workspace
```

- Standalone Session 默认只有 Current File Scope，不得静默读取相邻文件。
- Workspace Session 可以在已授权范围内使用 Current Resource 或 Workspace Scope。
- 用户在 Standalone Session 中要求创建多个关联文件时，Agent 应提供 Create Workspace from this file 或 Add to Workspace，而不是自行创建隐藏 Workspace。

## 11. Workflow Engine

Workflow 和 Agent 必须复用 Resource SDK、Command Bus、权限系统和 ChangeSet 模型。

Workflow 基础执行过程：

```text
Trigger
  → Validate permissions
  → Create run
  → Execute nodes
  → Commit resource changes
  → Record outputs and logs
  → Complete / Fail / Cancel
```

每次运行至少记录：

- Run ID 和 Workflow Revision。
- Trigger 和输入。
- 调用的节点及耗时。
- Resource Tool Calls。
- 创建的 ChangeSet。
- 输出、错误和最终状态。

第一阶段仅建立可兼容的 SDK 和数据边界，不实现完整 Workflow Engine。

## 12. 权限、Secret 与安全

Agent、Workflow 和 Script 的权限至少分为：

- Workspace 资源读取。
- 指定 Folder 或 Resource 写入。
- 创建和删除资源。
- 本地文件系统访问。
- 网络访问和允许的 Host。
- Secret 使用。
- Script 执行。
- 外部应用或通知操作。

安全要求：

- Secret 由独立 Vault 管理，资源文件只保存 `secretRef`。
- Secret 明文不得写入 `.is`、`.it`、`.iwf`、Workspace 导出包或 Agent 历史。
- 删除、批量覆盖、外部发送等高影响操作必须确认。
- 工具调用记录参数时必须脱敏。
- Script 必须有超时、取消和资源限制。
- 导入文件必须验证格式、版本、路径和资源引用，防止路径穿越。

## 13. Workspace 存储与自动保存

### 13.1 存储原则

Workspace 使用应用管理的本地存储作为持续编辑真相源。第一阶段可以采用目录化 JSON 与媒体文件，未来可以在不改变上层接口的前提下迁移到 SQLite 或混合存储。

建议的逻辑结构：

```text
workspaces/{workspaceId}/
├── workspace.json
├── resources/
├── media/
├── recovery/
└── runtime/
```

具体物理结构属于技术设计阶段决定，不应暴露给 UI 和 Agent。

Workspace 中显示为 `diagram.is` 的 IdeaSketch Resource 可以使用内部规范化结构按 Slide 增量保存，不要求每次自动保存都生成 `.is v1` ZIP。只有 Resource Export、Share 或显式保存到外部文件时，才序列化为真实 `.is v1`。

### 13.2 Workspace 自动保存

- 仅保存发生变化的 Resource 和必要的 Workspace Metadata。
- 不因修改一个 Resource 而重新压缩全部 Workspace。
- 单 Resource 写入必须使用临时文件或数据库事务。
- 应合并高频编辑产生的保存请求。
- 保存失败不能丢弃内存中的 Dirty 状态。
- 界面区分 `Saved locally`、`Saving` 和 `Save failed`。
- Workspace 导出状态与本地保存状态分离。

### 13.3 恢复

- 应用异常退出后，能够恢复最近成功自动保存的状态。
- 未完成事务不能产生半写入 Resource。
- 恢复失败时保留原始文件并提供诊断信息。
- 第一阶段不要求完整版本历史，但数据模型必须允许后续增加 Snapshot 或 Operation Log。

### 13.4 Single File 保存

- Single File Mode 打开真实文件路径，不自动复制或导入 Workspace。
- Save 写回当前文件，Save As 写入用户选择的新路径。
- Workspace 的 `Saved locally` 与 Single File 的 `Saved` 必须使用不同的保存语义和状态来源。
- `.is v1` 保存允许重写当前 `.is` ZIP，但影响范围只能是该文件，不能触发其他 Workspace Resource 的序列化。
- Standalone 文件发生未保存修改时，应用应保留 Recovery Draft，但不能在用户未启用自动保存的情况下静默覆盖原文件。
- 检测到文件被外部程序修改时，必须提示 Reload、Compare 或 Save As，不能直接覆盖外部修改。

## 14. 导入、导出与兼容

### 14.1 IdeaSlide 文件打开与迁移

系统必须分别处理现有 IdeaSlide `.is v1` 和 `.is v2`：

#### `.is v1`

- 结构已经是新的 IdeaSketch Resource 格式，无需改写内部 Manifest 和 Slide 路径。
- 双击文件或使用 Open File 时，以 Single File Mode 直接打开原文件。
- Save 写回原 `.is v1` 文件。
- 用户执行 Add to Workspace 时，才在 Workspace 中创建对应的 IdeaSketch Resource。
- 原有 Slide 名称、顺序、Excalidraw 内容、Files 和 Camera 顺序保持不变。
- Add to Workspace 默认不覆盖原文件。

#### `.is v2`

- v2 被识别为旧 IdeaSlide Workspace，而不是 IdeaSketch Resource。
- 导入时创建一个新的 IdeaNote Workspace。
- 原 Folder 转换为新 Workspace Folder。
- 每个 Canvas 转换为一个只含一个 Slide 的 `.is v1` Resource。
- v2 中未来或未知的 Resource Type 必须作为 Unsupported Resource 保留原始元数据和内容，不得静默丢弃。
- Resource 名称、层级、顺序、媒体和 Camera 顺序保持不变。
- 当前活动 Canvas 映射为导入后活动的 `.is` Resource。
- 导入不覆盖原文件，完成后明确提示原文件仍然存在。

### 14.2 Resource 打开与加入 Workspace

- 用户可以通过 Open File 或系统文件关联直接打开 `.is v1`、`.md` 和未来支持的 `.it`、`.iwf`。
- 直接打开进入 Single File Mode，并保留真实文件路径。
- 直接打开不能静默创建 Workspace 或改变文件位置。
- Add to Workspace 是显式操作，第一阶段至少支持 Copy into Workspace。
- Move into Workspace 和 Link external file 是否进入第一阶段属于待决事项。
- 加入 Workspace 后产生新的 Resource ID，外部原文件与 Workspace Resource 不默认保持双向同步。

### 14.3 导出

- Resource Export：导出单个 Resource 的公开格式。
- Workspace Export：导出整个 Workspace 的便携快照。
- Export 是显式动作，不等同于自动保存。
- 导出包必须包含明确格式标识和版本。
- 未知未来版本必须在读取 Payload 前被拒绝或进入受限兼容模式。

## 15. 信息架构与主要界面

### 15.1 Home

Home 展示：

- Recent Workspaces。
- Recent Files。
- New Workspace。
- Open File。
- Import Workspace。
- Import legacy IdeaSlide Workspace (`.is v2`)。
- Workspace 名称、最近修改时间和可选预览。

Recent Workspaces 和 Recent Files 必须分区展示，避免用户混淆 Workspace 自动保存与真实文件保存。

### 15.2 Workspace Shell

- 左侧：Workspace Explorer。
- 中间：当前 Resource Editor。
- 右侧：AI Agent。
- 左右面板均可折叠和调整宽度，并具有最小与最大值。
- 标题栏显示 Home、Workspace 名称、本地保存状态和全局操作。
- Resource 级操作放在对应编辑器上下文中。
- Workflow Run 等运行态信息不应挤入 Canvas 工具栏。

Workspace Mode 标题栏建议提供：

```text
Home | New resource | Import | Export | Saved locally
```

### 15.3 Single File Shell

Single File Mode 不显示 Workspace Explorer，除非当前文件类型自身需要内部导航：

- `.is v1`：左侧显示该文件内部的 Pages，中心显示 Excalidraw，右侧显示 Agent。
- `.md`、`.it`、`.iwf`：中心显示 Resource Editor，右侧显示 Agent；没有必要保留空白左侧栏。
- 左右可见区域沿用同一套折叠、拖动和视觉规范。

Single File Mode 标题栏建议提供：

```text
Home | Open | Save | Save As | Add to Workspace | filename
```

界面必须明确当前为 File Session，并显示真实文件名、保存状态和必要时的文件路径提示。

### 15.4 Resource Editor

Resource Editor Host 根据 Resource Type Registry 加载对应编辑器。未知或尚未安装编辑器的类型使用 Unsupported Resource 界面，允许查看元数据、导出原始内容或安装未来扩展，但不得丢弃内容。

Workspace Mode 和 Single File Mode 必须加载相同的 Resource Editor 实现。不得为同一种格式维护两套编辑器或两套序列化逻辑。

## 16. 性能与可靠性要求

第一阶段应满足以下方向性要求，具体数字在技术设计和基准测试阶段确定：

- 修改单个 Resource 时，保存成本主要与该 Resource 的变化量相关，而不是整个 Workspace 大小。
- Agent 读取上下文不得默认序列化整个 Workspace。
- 大型媒体不通过重复 Base64 编解码成为常规保存路径。
- Resource 查询、查找和更新应使用索引结构，避免随着资源数量增长出现明显的 O(n²) 保存路径。
- AI 调用、导入导出和 Workflow 运行不得阻塞中心编辑器主要交互线程。
- Agent Tool Call 可以取消，失败后不能留下部分提交状态。
- Workspace 至少应支持数百个 Resource 的正常组织与增量保存；最终容量目标由基准测试确定。
- Single File Mode 保存只处理当前文件；Workspace Mode 保存只处理 Dirty Resource，两者都不得无关地序列化其他已打开内容。

## 17. 可观测性与审计

系统应记录：

- 自动保存失败和恢复结果。
- 导入导出结果和版本迁移。
- Agent Tool Call 的名称、状态、耗时和脱敏参数摘要。
- Workflow Run 和 Script Run。
- ChangeSet 与来源。

日志不得包含 Secret、完整用户文件内容或不必要的模型上下文。

## 18. 第一阶段 MVP

### 18.1 包含范围

1. 产品术语从 IdeaSlide 转向 IdeaNote。
2. Document Session 与 Workspace/Standalone Persistence Adapter。
3. Workspace 本地持久化与增量自动保存。
4. Single File Mode 的 Open、Save、Save As 和 Add to Workspace。
5. Workspace Explorer 延续现有 Folder/Resource 模型。
6. IdeaSketch Resource，保留现有 Excalidraw 和 Camera/Present 能力。
7. Markdown Resource 与基础编辑器。
8. Resource Type Registry 扩展。
9. Workspace、Sketch、Markdown SDK。
10. Command Bus、Revision、ChangeSet 和基础 Undo。
11. 右侧 Agent 面板，同时支持 Workspace Scope 和 Current File Scope。
12. Agent 创建和修改 Folder、IdeaSketch、Markdown。
13. `.is v1` Standalone 直接打开，以及旧 `.is v2` Workspace 导入。
14. IdeaSketch Resource 导入导出。
15. Workspace 完整导出格式的最小可用版本。

### 18.2 延后范围

- IdeaTable 完整编辑器。
- IdeaWorkflow 编辑器和运行引擎。
- Script Runtime。
- 云同步和协作。
- Agent 多角色编排。
- 第三方 SDK 和插件发布。
- 全量版本历史界面。

## 19. MVP 验收标准

### 双模式与单内核

- 用户可以从 Home、系统文件关联或双击文件进入 Single File Mode。
- `.is v1` 和 `.md` 至少支持直接打开，未来 `.it`、`.iwf` 使用相同 Session 边界。
- Single File Mode 直接编辑原文件，Save 写回原路径，且不会静默导入 Workspace。
- 用户可以通过 Add to Workspace 显式复制当前文件为 Workspace Resource。
- Workspace Mode 与 Single File Mode 对同一 Resource Type 使用相同 Editor、SDK、Command Bus 和 Schema Validator。
- 两种模式的 Undo、Agent Tool Call 和格式校验行为一致。
- UI 能明确区分 Workspace Session 与 File Session，以及 `Saved locally` 与文件 `Saved`。

### Workspace

- 用户可以创建、打开、重命名和删除 Workspace。
- Workspace 中可以创建 Folder、IdeaSketch 和 Markdown。
- 资源可以移动、排序和重命名。
- 重启应用后层级、内容和当前选择能够恢复。
- 编辑单个资源不会重写整个 Workspace 导出包。

### IdeaSketch

- 现有 Excalidraw 编辑、Camera 和当前 Canvas Present 行为保持可用。
- 一个 IdeaSketch Resource 可以包含、重命名和排序多个 Slide。
- IdeaSketch 可以按既有 `.is v1` 结构导入和导出。
- 导出的 Manifest 使用 `version: "1.0"`、`slides[]` 和 `slides/{id}.json`。

### Markdown

- 用户和 Agent 都可以创建、读取和修改 Markdown。
- 导出的 Markdown 保持标准文本兼容。

### Agent

- Agent 能识别当前 Workspace、Resource 和显式引用上下文。
- Agent 在 Standalone Session 中默认只操作当前文件。
- Agent 在 Workspace Session 中可以按授权范围操作多个 Resource。
- Agent 可以创建一个 IdeaSketch 和一个 Markdown，并写入有效内容。
- Tool Call 和资源变化在 UI 中可见。
- Agent 的一组成功修改可以撤销。
- 失败的 Agent 操作不会产生部分提交。

### 兼容

- 现有 IdeaSlide `.is v1` 可以在 Single File Mode 直接打开，并可通过 Add to Workspace 显式创建 IdeaSketch Resource。
- 现有 IdeaSlide `.is v2` 可以作为旧 Workspace 导入并拆分为 Folder 和 `.is v1` Resource。
- Folder、Canvas/Slide、顺序、名称、媒体和 Camera 顺序不会丢失。
- 不支持的未来格式在读取内容前给出明确错误。

## 20. 发布阶段建议

### Phase 0：产品与架构定稿

- 评审并批准本 PRD。
- 确定命名、格式扩展名和兼容策略。
- 定义 Workspace Repository、Command Bus、Resource SDK 和 Agent Tool Protocol。
- 建立性能基线以及 `.is v1/v2` 兼容测试样本。

### Phase 1：Workspace Core

- Document Session 和 Persistence Adapter。
- 本地 Workspace 生命周期。
- 增量持久化。
- Single File Open/Save/Save As。
- Resource Revision、ChangeSet、Undo。
- `.is v1` Writer/Reader 恢复，以及 `.is v2` Legacy Workspace Import。

### Phase 2：Multi-resource Editor

- Markdown Resource。
- Resource Editor Host 完善。
- Workspace 导入导出。

### Phase 3：Agent MVP

- 右侧 Agent 面板。
- Context、Tool Activity 和 Change Review。
- Workspace、Sketch、Markdown Tools。

### Phase 4：IdeaTable

- `.it` Schema、编辑器和 SDK。
- Agent Table Tools。

### Phase 5：IdeaWorkflow

- `.iwf` Schema 和节点编辑器。
- Workflow Engine、Runs、权限和 Secret。
- Script Runtime。

## 21. 风险

### 21.1 产品范围过大

同时开发 Canvas、Markdown、Table、Workflow、Script 和 Agent 会降低每个能力的完成度。必须坚持先完成 Workspace + IdeaSketch + Markdown + Agent 的最小闭环。

### 21.2 `.is v1/v2` 双重语义

`.is v1` 将作为 IdeaSketch Resource 的正式格式，而 `.is v2` 曾被用作 IdeaSlide Workspace。Importer 必须先读取 Manifest Version，再决定按 Resource 或 Legacy Workspace 处理；Writer 只能写 v1，避免继续扩大双重语义。

### 21.3 双模式保存语义混淆

Workspace 自动保存和 Single File Save 面向不同持久化目标。如果标题栏、状态文案或打开行为不明确，用户可能误以为文件已经写回磁盘或误以为文件被导入 Workspace。界面必须持续显示 Session Mode，并禁止静默模式切换。

### 21.4 Agent 直接修改数据

如果 Agent 绕过 Command Bus，会破坏 Undo、验证、审计和未来同步。所有修改必须通过统一 SDK。

### 21.5 自动化安全

Workflow 和 Script 可能造成批量数据修改或外部信息泄露。权限和 Secret 模型不能推迟到 Workflow 完成后补做。

### 21.6 用户对本地数据位置不明确

Workspace 由应用管理后，用户可能担心数据是否真正保存。产品需要明确显示 `Saved locally`，并提供 Workspace 导出、备份和未来的 Show storage location 能力。

### 21.7 AI Provider 耦合

Agent Tool Protocol、Conversation 和 Workspace Context 不应绑定单一模型提供商。模型接入层需要可替换，但第一阶段可以只正式支持一个 Provider。

## 22. 待决事项

以下问题必须在进入开发计划前确定：

1. `IdeaNote` 是否为最终产品名称，是否需要新的应用标识、Bundle ID 和仓库名称。
2. Workspace 导出格式是否使用 `.inw`，或采用其他名称。
3. Workspace 第一版物理存储采用目录化 JSON、SQLite，还是混合方式。
4. Workspace 是否允许用户选择任意本地目录，还是完全由应用管理。
5. 打开 `.is v2` 时，是直接创建新 Workspace，还是提供只读预览后再导入。
6. Add to Workspace 第一阶段是否只支持 Copy，还是同时支持 Move 或 Link external file。
7. Single File Mode 是否默认只使用手动 Save，还是提供可选自动保存。
8. 外部文件修改冲突的 Compare 和 Merge 能力第一阶段做到什么程度。
9. 第一阶段 Markdown 编辑器采用源码、所见即所得，还是双模式。
10. Agent 第一阶段使用哪个模型 Provider，以及 API Key 的管理方式。
11. Agent 修改默认自动应用，还是先生成 Preview 再由用户 Apply；哪些操作必须确认。
12. ChangeSet 的历史保存周期和磁盘清理策略。
13. Workspace 导出是否包含 Agent 会话和 Workflow Run 历史。
14. 第一阶段是否支持多个 Resource Tab 和多个 Standalone File Session。
15. IdeaTable 和 IdeaWorkflow 的首个真实业务场景分别是什么。
16. Script 第一阶段准备支持哪些语言和运行时。

## 23. 开发启动门槛

在开始实现 IdeaNote 重构前，必须满足：

- 本 PRD 状态由 `draft` 更新为明确批准状态。
- 第 22 节影响架构和兼容性的待决事项已经决策。
- `.is v1` 兼容写入、`.is v2` Workspace 导入策略和测试样本已经确认。
- Workspace/Standalone Document Session、保存语义和模式切换规则已经确认。
- MVP 范围和非目标获得确认。
- 根据最终 PRD 生成 Superplan 开发计划。
- 所有开发计划通过人工评审和批准。

在上述条件满足前，不进行 IdeaNote 重构开发。
