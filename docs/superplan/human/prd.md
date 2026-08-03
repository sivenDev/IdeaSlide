# IdeaNote Product Requirements Document

- status: draft
- document_version: 0.1
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

## 2. 背景与问题

现有 IdeaSlide 已经从传统 Slide 列表演进为包含 Folder 和 Canvas 的 Workspace Resource Explorer，但当前仍有以下限制：

1. `.is` 同时承担 Workspace、Canvas 内容、媒体和日常自动保存容器，修改少量内容也需要重新生成整个 ZIP。
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
7. 保留现有 IdeaSlide `.is` 文件的可迁移能力，避免已有内容丢失。

### 3.2 成功标准

第一阶段成功的核心闭环是：

> 用户在一个 Workspace 中对 AI Agent 说“创建一个产品发布流程图，并生成配套说明文档”。Agent 创建一个 IdeaSketch 资源和一个 Markdown 资源，界面显示每次工具调用与资源变更，用户可以检查结果并一次撤销这组操作。

完成该闭环时应满足：

- Workspace 自动保存不需要重新打包全部资源。
- Agent 不直接修改底层文件，而是调用公开、可测试的 Resource SDK。
- 一次 Agent 请求产生一个或多个可追踪的 ChangeSet。
- 用户能够查看 Agent 修改了哪些资源，并撤销修改。
- 关闭并重新打开应用后，Workspace 状态完整恢复。

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

Workspace 是持续编辑、自动保存、历史恢复和未来同步的主体。单个导出文件只是 Workspace 或 Resource 在某个时间点的快照。

### 5.2 Local-first

没有网络时，用户仍然可以创建、编辑、搜索和运行不依赖网络的功能。AI 模型和外部服务不可用时，不影响基础编辑能力。

### 5.3 Typed resources

每个资源具有明确的类型、Schema、编辑器、序列化器、迁移器和 SDK。Agent 不通过猜测 JSON 结构操作资源。

### 5.4 One command system

用户界面、AI Agent、Workflow 和 Script 通过统一 Command Bus 修改 Workspace，避免出现多套行为不一致的实现。

### 5.5 Reviewable automation

Agent 和自动化的行为必须可查看、可撤销、可重试，并保留运行记录。破坏性或超出既有权限范围的操作必须先确认。

### 5.6 Extensible without redesign

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

## 7. 资源类型与文件格式

### 7.1 IdeaSketch (`.is`)

IdeaSketch 是 Excalidraw Canvas 的包装格式，用于单个 Canvas 的导入、导出、分享和资源级备份。

它应包含：

- 明确的格式身份，例如 `format: "ideanote.sketch"`。
- IdeaSketch Schema 版本。
- Excalidraw 引擎名称和版本。
- Elements、必要的 AppState 和 Files。
- Camera 元素和演示顺序。
- 媒体索引与媒体内容。
- 可选的预览信息，但缩略图不属于第一阶段要求。

建议的格式头：

```json
{
  "format": "ideanote.sketch",
  "version": "1.0",
  "engine": {
    "name": "excalidraw",
    "version": "0.18"
  }
}
```

当前 IdeaSlide `.is 1.0/2.0` 表示完整 Workspace，与新 IdeaSketch 语义冲突。新版本必须通过格式身份或明确版本区分，不能静默按新格式解释旧文件。

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

当 `.is` 被重新定义为单个 IdeaSketch 后，需要新的 Workspace 级导入导出格式。暂以 `.inw`（IdeaNote Workspace）作为候选扩展名，最终名称属于待决事项。

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

## 10. AI Agent

### 10.1 定位

右侧 AI Agent 是 Workspace 操作界面，而不只是通用聊天框。它理解当前 Workspace、当前 Resource、编辑器选区和用户显式添加的上下文，并通过 Resource SDK 执行任务。

### 10.2 核心能力

第一阶段应支持：

- 回答与当前 Workspace 和选中资源有关的问题。
- 创建 Folder、IdeaSketch 和 Markdown。
- 读取和修改 IdeaSketch Elements。
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

### 13.2 自动保存

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

## 14. 导入、导出与兼容

### 14.1 旧 IdeaSlide 导入

系统必须能够识别现有 IdeaSlide `.is 1.0/2.0`：

- 旧 Workspace 中的 Folder 和 Canvas 被导入为新 IdeaNote Workspace Resource。
- Canvas 内容被转换为 IdeaSketch Resource。
- Resource 名称、层级、顺序、媒体和 Camera 顺序保持不变。
- 导入不覆盖原文件。
- 导入完成后明确提示原文件仍然存在。

### 14.2 Resource 导入

用户可以把 `.is`、`.md` 和未来支持的 `.it`、`.iwf` 导入当前 Workspace。导入产生新的 Resource ID，除非用户明确执行受支持的更新操作。

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
- New Workspace。
- Import Workspace。
- Import legacy IdeaSlide file。
- Workspace 名称、最近修改时间和可选预览。

首页不再以 Recent `.is` Files 作为唯一入口。

### 15.2 Workspace Shell

- 左侧：Workspace Explorer。
- 中间：当前 Resource Editor。
- 右侧：AI Agent。
- 左右面板均可折叠和调整宽度，并具有最小与最大值。
- 标题栏显示 Home、Workspace 名称、本地保存状态和全局操作。
- Resource 级操作放在对应编辑器上下文中。
- Workflow Run 等运行态信息不应挤入 Canvas 工具栏。

### 15.3 Resource Editor

Resource Editor Host 根据 Resource Type Registry 加载对应编辑器。未知或尚未安装编辑器的类型使用 Unsupported Resource 界面，允许查看元数据、导出原始内容或安装未来扩展，但不得丢弃内容。

## 16. 性能与可靠性要求

第一阶段应满足以下方向性要求，具体数字在技术设计和基准测试阶段确定：

- 修改单个 Resource 时，保存成本主要与该 Resource 的变化量相关，而不是整个 Workspace 大小。
- Agent 读取上下文不得默认序列化整个 Workspace。
- 大型媒体不通过重复 Base64 编解码成为常规保存路径。
- Resource 查询、查找和更新应使用索引结构，避免随着资源数量增长出现明显的 O(n²) 保存路径。
- AI 调用、导入导出和 Workflow 运行不得阻塞中心编辑器主要交互线程。
- Agent Tool Call 可以取消，失败后不能留下部分提交状态。
- Workspace 至少应支持数百个 Resource 的正常组织与增量保存；最终容量目标由基准测试确定。

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
2. Workspace 本地持久化与增量自动保存。
3. Workspace Explorer 延续现有 Folder/Resource 模型。
4. IdeaSketch Resource，保留现有 Excalidraw 和 Camera/Present 能力。
5. Markdown Resource 与基础编辑器。
6. Resource Type Registry 扩展。
7. Workspace、Sketch、Markdown SDK。
8. Command Bus、Revision、ChangeSet 和基础 Undo。
9. 右侧 Agent 面板。
10. Agent 创建和修改 Folder、IdeaSketch、Markdown。
11. 旧 IdeaSlide `.is` 导入。
12. 单个 IdeaSketch 导入导出。
13. Workspace 完整导出格式的最小可用版本。

### 18.2 延后范围

- IdeaTable 完整编辑器。
- IdeaWorkflow 编辑器和运行引擎。
- Script Runtime。
- 云同步和协作。
- Agent 多角色编排。
- 第三方 SDK 和插件发布。
- 全量版本历史界面。

## 19. MVP 验收标准

### Workspace

- 用户可以创建、打开、重命名和删除 Workspace。
- Workspace 中可以创建 Folder、IdeaSketch 和 Markdown。
- 资源可以移动、排序和重命名。
- 重启应用后层级、内容和当前选择能够恢复。
- 编辑单个资源不会重写整个 Workspace 导出包。

### IdeaSketch

- 现有 Excalidraw 编辑、Camera 和当前 Canvas Present 行为保持可用。
- 单个 IdeaSketch 可以导入和导出。
- 导出文件包含明确格式身份和版本。

### Markdown

- 用户和 Agent 都可以创建、读取和修改 Markdown。
- 导出的 Markdown 保持标准文本兼容。

### Agent

- Agent 能识别当前 Workspace、Resource 和显式引用上下文。
- Agent 可以创建一个 IdeaSketch 和一个 Markdown，并写入有效内容。
- Tool Call 和资源变化在 UI 中可见。
- Agent 的一组成功修改可以撤销。
- 失败的 Agent 操作不会产生部分提交。

### 兼容

- 现有 IdeaSlide `.is 1.0/2.0` 可以导入。
- Folder、Canvas、顺序、名称、媒体和 Camera 顺序不会丢失。
- 不支持的未来格式在读取内容前给出明确错误。

## 20. 发布阶段建议

### Phase 0：产品与架构定稿

- 评审并批准本 PRD。
- 确定命名、格式扩展名和兼容策略。
- 定义 Workspace Repository、Command Bus、Resource SDK 和 Agent Tool Protocol。
- 建立性能基线和旧 `.is` 测试样本。

### Phase 1：Workspace Core

- 本地 Workspace 生命周期。
- 增量持久化。
- Resource Revision、ChangeSet、Undo。
- IdeaSketch 拆分与旧格式导入。

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

### 21.2 `.is` 语义冲突

当前 `.is` 已经代表 IdeaSlide Workspace。重新定义为 IdeaSketch 时必须有明确格式身份、迁移测试和用户提示。

### 21.3 Agent 直接修改数据

如果 Agent 绕过 Command Bus，会破坏 Undo、验证、审计和未来同步。所有修改必须通过统一 SDK。

### 21.4 自动化安全

Workflow 和 Script 可能造成批量数据修改或外部信息泄露。权限和 Secret 模型不能推迟到 Workflow 完成后补做。

### 21.5 用户对本地数据位置不明确

Workspace 由应用管理后，用户可能担心数据是否真正保存。产品需要明确显示 `Saved locally`，并提供 Workspace 导出、备份和未来的 Show storage location 能力。

### 21.6 AI Provider 耦合

Agent Tool Protocol、Conversation 和 Workspace Context 不应绑定单一模型提供商。模型接入层需要可替换，但第一阶段可以只正式支持一个 Provider。

## 22. 待决事项

以下问题必须在进入开发计划前确定：

1. `IdeaNote` 是否为最终产品名称，是否需要新的应用标识、Bundle ID 和仓库名称。
2. `.is` 是否正式解释为 IdeaSketch，还是改用更明确的 `.ic` / `.isketch`。
3. Workspace 导出格式是否使用 `.inw`，或采用其他名称。
4. Workspace 第一版物理存储采用目录化 JSON、SQLite，还是混合方式。
5. Workspace 是否允许用户选择任意本地目录，还是完全由应用管理。
6. 打开旧 `.is` 时，是直接创建新 Workspace，还是提供只读预览后再导入。
7. 第一阶段 Markdown 编辑器采用源码、所见即所得，还是双模式。
8. Agent 第一阶段使用哪个模型 Provider，以及 API Key 的管理方式。
9. Agent 修改默认自动应用，还是先生成 Preview 再由用户 Apply；哪些操作必须确认。
10. ChangeSet 的历史保存周期和磁盘清理策略。
11. Workspace 导出是否包含 Agent 会话和 Workflow Run 历史。
12. 第一阶段是否支持多个 Resource Tab，还是保持单 Resource Editor。
13. IdeaTable 和 IdeaWorkflow 的首个真实业务场景分别是什么。
14. Script 第一阶段准备支持哪些语言和运行时。

## 23. 开发启动门槛

在开始实现 IdeaNote 重构前，必须满足：

- 本 PRD 状态由 `draft` 更新为明确批准状态。
- 第 22 节影响架构和兼容性的待决事项已经决策。
- 旧 `.is` 迁移策略和测试样本已经确认。
- MVP 范围和非目标获得确认。
- 根据最终 PRD 生成 Superplan 开发计划。
- 所有开发计划通过人工评审和批准。

在上述条件满足前，不进行 IdeaNote 重构开发。
