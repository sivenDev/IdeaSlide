# IdeaNote Product Requirements Document

- status: accepted
- document_version: 1.0
- created: 2026-08-03
- last_updated: 2026-08-08
- product: IdeaNote
- predecessor: IdeaSlide
- implementation_authorized: true

> 本文档定义 IdeaSlide 向 IdeaNote 演进后的产品结构和分阶段范围。产品方向与当前 MVP 已获得实施授权；具体业务代码仍须依据通过人工评审的 Superplan 主线计划执行。

## 1. 产品概述

IdeaNote 是一个 Local-first、多文件、多编辑器的桌面 Workspace。用户可以选择任意本地目录作为 Workspace，在真实目录中创建和编辑 IdeaSketch、IdeaTable、IdeaWorkflow 和 Markdown 文件；中间区域始终聚焦当前文件，只显示一个前台编辑器。

IdeaNote 同时支持：

- Workspace Mode：选择一个真实目录，以文件树导航多个文件，并在单一前台编辑器中处理当前文件。
- Single File Mode：直接打开单个受支持文件，不要求创建或导入 Workspace。

两种模式共享同一套文件模型、编辑器、格式解析与保存逻辑，即：

> 双模式、单内核。

长期产品布局为左、中、右三栏：

- 左侧：Workspace Explorer。
- 中间：当前文件的单一 Editor。
- 右侧：AI Agent。

当前阶段已实现左侧 Workspace Explorer、中间单一 Editor、IdeaSketch 与 Markdown 编辑器、全局 Settings Center 和可配置的通用 AI Agent。IdeaTable、IdeaWorkflow 以及 Workspace 导入导出在后续阶段开发；新增编辑器复用同一 Agent Runtime，并通过注册表注入自己的 Skill、Tools 和 Context。

## 2. 已确认产品决定

1. 产品名称从 IdeaSlide 调整为 IdeaNote。
2. Open Workspace 表示选择一个真实本地目录，而不是打开一个 Workspace 压缩文件。
3. Workspace 中的用户文件就是目录中的真实文件，不复制到应用私有数据库作为主要内容源。
4. Workspace 元数据保存在根目录的 `.ideanote/` 子目录中。
5. 打开或浏览一个没有 `.ideanote/` 的目录时，不立即修改该目录。
6. 第一次在 Workspace Mode 中成功创建或保存文件时，才生成 `.ideanote/`。
7. Workspace Mode 和 Single File Mode 使用同一套 Editor、Parser、Serializer 和 Save Pipeline。
8. 中间编辑区不显示文件 Tabs，同时只呈现一个当前文件编辑器；文件切换由 Workspace Explorer 驱动。
9. 从左侧新建文件后，新文件立即成为当前文件并在中间编辑器打开。
10. 应用 Shell 使用左、中、右三栏：左侧 Workspace Explorer，中间为当前编辑器及其内部 Navigator，右侧为编辑器无关、可折叠且可调整宽度的 AI Agent；Agent 不嵌入任何具体编辑器的导航区域。
11. 当前支持 IdeaSketch (`.is v1`) 和 Markdown (`.md`) 两个编辑器。
12. 未来文件格式为 `.it`（IdeaTable）和 `.iwf`（IdeaWorkflow）。
13. 当前阶段实现一个编辑器无关的 AI Agent 架构：Rust Agent Core 负责 Runtime 选择、Turn 编排、流式输出、取消、重试、持久化和 Tool Broker；TypeScript 只负责活动编辑器的 Tool 执行、格式感知 ChangeSet、编辑器 SDK 直连事务和 UI。两侧通用层都不包含 `.is`、Markdown、IdeaTable 或 IdeaWorkflow 业务逻辑。
14. 当前阶段不实现 Workspace 导入导出。
15. 新编辑器不需要等待 Agent 重构：它们通过 File Type Registry 关联自己的 Agent Extension，直接复用 Rust Agent Core、Settings、Provider、会话、Tool Bridge 和通用 Tool Activity 界面。
16. Workspace Explorer 始终显示可导航的真实目录，但文件只显示当前 File Type Registry 明确支持打开的类型；当前阶段显示 `.is` 和 `.md`。
17. Workspace Mode 产生的临时写入文件和其他应用内部临时产物统一放在 Workspace Root 的 `.ideanote/` 子目录中，不在用户文件旁生成 `.is.tmp` 等临时文件。
18. Settings Center 同时从 Home 和编辑器打开，配置 General、AI Provider、Agent 和编辑器贡献的设置区段。
19. AI 默认开启；关闭后不挂载 Agent UI、不初始化 Runtime、不发现 Skill、不暴露 Tool、不访问 Provider，也不保留后台 Agent 生命周期。
20. AI 开启但 Provider Credential 未配置时，只显示配置引导，不发起模型请求。
21. API Key 由 Rust 使用 AES-256-GCM 保存在应用配置目录的版本化加密凭据文件中，随机密钥单独保存并限制为当前用户访问；不读取、迁移或删除旧 Keychain 数据，也不触发 Keychain 授权。该边界防止明文落盘和仅复制凭据文件造成泄露，但不能抵御可同时读取密钥与密文的同一操作系统用户进程。
22. 已保存 API Key 不返回前端；Settings 的显示/隐藏按钮只影响当前输入内容。自动重试默认开启、默认最多三次总尝试、可关闭并限制在一至五次，只允许发生在可重试错误且尚无文本、公开 Runtime Summary 或 Tool 进度时。
23. API Key、密钥和明文不得进入 `.ideanote/`、文档、Recovery、日志、前端持久化设置或对话历史。
24. 所有 Agent 修改都先形成绑定文档 revision、source fingerprint 和外部状态的 ChangeSet；用户明确批准后才通过现有 Editor/Document Session 应用，并提供一步 Undo。
25. 旧 MCP stdio Server、`--mcp` 启动模式、隐藏 MCP Renderer 和前端 MCP Bridge 已退休；当前 AI 自动化只通过应用内 Agent Extension 架构提供。
26. Rust 自动选择通过版本和编辑器 Tool 安全检查的 Codex `0.147.0` app-server；缺失、不兼容、初始化失败或尚未产生可见进度时崩溃，透明回退到 OpenAI-compatible Compatibility Runtime。已经产生文本、公开活动、Plan 或 Tool 进度后崩溃则明确失败并要求显式重试，避免重复副作用。Grok 继续作为已评估候选，不进入当前生产选择。
27. Agent 保留真实增量答案、确定性的 Preparing/Working/elapsed 活动，以及 Runtime 明确标记为公开的过程信息。对于上游在极短时间内突发或原子交付的 assistant answer，可以使用有界的展示节奏让内容可感知地逐步出现，但必须保留并区分真实来源时序，不得把展示节奏描述为模型仍在生成、token 直播或隐藏思考；不得展示或推断 hidden chain-of-thought。

## 3. 产品目标

### 3.1 当前阶段目标

1. 建立真实目录驱动的 Workspace Mode。
2. 建立 Single File Mode，并与 Workspace Mode 共用 IdeaSketch 编辑器。
3. 建立可扩展的 File Type Registry 和 Editor Host。
4. 建立左侧真实文件树和中间单一前台编辑器。
5. 实现 `.ideanote/` 延迟创建与 Workspace 状态恢复。
6. 将 `.is` Writer/Reader 回退并固定为既有 v1 结构。
7. 保留现有 Excalidraw、Pages、Cameras 和 Present 核心能力。
8. 为后续 `.md`、`.it`、`.iwf` 编辑器预留稳定扩展点。
9. 提供可版本化的全局 Settings、原生 Credential 存储和默认开启的 AI Gate。
10. 提供编辑器无关的 Agent Runtime、应用级右侧 Agent 栏和 IdeaSketch 的首个 Agent Extension。

### 3.2 长期目标

1. 支持 Markdown、IdeaTable 和 IdeaWorkflow 编辑器。
2. 为各文件类型提供稳定 SDK。
3. 扩展右侧 AI Agent，使未来编辑器按注册表注入受限能力，并在需要时增加经过授权的 Workspace 上下文。
4. 支持 Workspace 的便携导入、导出、备份和迁移。
5. 在编辑器和 SDK 稳定后增加自动化执行、审计、权限和 Secret 管理。

### 3.3 当前阶段成功标准

用户能够完成以下闭环：

```text
Open Workspace
  → 选择一个本地目录
  → 在左侧新建 drawing.is
  → drawing.is 成为当前文件并在中间打开
  → 使用 Excalidraw 编辑
  → 保存为真实 .is v1 文件
  → 首次保存后生成 .ideanote/
  → 再打开 Workspace 时恢复文件树和最后活动文件
```

同时，用户可以双击或通过 Open File 直接打开一个 `.is v1` 文件，在 Single File Mode 中使用同一个编辑器并保存回原路径。

## 4. 非目标

以下内容不属于当前阶段：

- Markdown、IdeaTable 和 IdeaWorkflow 的专用 Agent Extension。
- 后台自治任务、多 Agent 编排和自动批准写入。
- 任意 Shell、脚本、网络或未授权 Workspace 索引工具。
- Markdown 编辑器。
- IdeaTable 编辑器。
- IdeaWorkflow 编辑器与运行引擎。
- Workspace 导入导出包。
- Workspace 云同步。
- 多人实时协作。
- Script Runtime。
- 第三方插件市场。
- 任意本地文件执行。
- `.is v2` Workspace 自动迁移。
- 完整版本历史与 Timeline 界面。

## 5. 核心原则

### 5.1 Real directory workspace

Workspace 是用户选择的真实目录。左侧文件树反映真实文件系统，文件的创建、重命名、移动和删除对应真实磁盘操作。

### 5.2 Dual mode, single core

Workspace Mode 与 Single File Mode 不能维护两套编辑器和格式实现。差异只由 Document Session 和 Persistence Adapter 表达。

### 5.3 Lazy metadata

打开一个目录不应产生副作用。只有第一次成功创建或保存用户文件时，才生成 `.ideanote/` 并保存 Workspace 元数据。

### 5.4 Files are the source of truth

用户文件内容以真实文件为真相源。`.ideanote/` 只保存 Workspace 状态、恢复数据和缓存，不保存另一份用户文件正文作为主要内容源。

### 5.5 Extensible editors

增加新文件类型时，不应重新设计 Workspace Explorer、Document Session、保存流程或 Editor Host。

文件编辑器必须在前端和后端同时模块化：前端通过 File Type Registry、Document Model、Parser、Serializer 和 Editor 组件注册；后端通过 Document Format Registry 和独立格式模块注册文件识别、验证、读取、写入与安全策略。通用 Commands 不直接包含某一种编辑器的格式实现。

### 5.6 Local-first and safe

基础文件操作不依赖网络。文件写入应原子化，外部修改不能被静默覆盖，应用异常退出后应尽可能恢复未保存内容。

## 6. Workspace Mode

### 6.1 打开 Workspace

流程：

```text
用户点击 Open Workspace
  → 系统显示目录选择器
  → 用户选择目录
  → IdeaNote 扫描并显示真实文件树
  → 如果存在 .ideanote/，加载 Workspace 状态
  → 如果不存在，使用内存状态打开且不修改目录
```

要求：

- 打开 Workspace 只接受目录路径。
- `.ideanote/` 不显示在 Workspace Explorer 中。
- 打开目录时不得自动创建 `.ideanote/`、示例文件或根目录配置。
- 不自动执行目录中的 `.iwf`、脚本或其他可执行内容。
- 目录不可写时允许以只读方式浏览和打开文件，并在保存前明确提示。
- Workspace Root 发生移动或删除时，显示明确错误并允许重新定位。

### 6.2 Workspace Explorer

左侧 Workspace Explorer 展示真实目录层级。

当前阶段支持：

- 展开和收起目录。
- 选择文件或目录。
- 新建 Folder。
- 新建 IdeaSketch (`.is`) 和 Markdown (`.md`)。
- Rename。
- Move。
- Delete，并提供明确确认。
- Refresh。
- 监听外部文件创建、修改、移动和删除。
- 保留真实目录层级，包括暂时没有受支持文件的空目录。
- 文件只显示当前 File Type Registry 中 `openable` 的受支持类型；当前阶段显示 `.is` 和 `.md`。
- 隐藏 `.ideanote/`、不受支持的文件和应用内部临时文件。

新建流程：

```text
选中目标目录
  → New IdeaSketch
  → 输入文件名
  → 创建有效的空 .is v1 文件
  → 生成 .ideanote/（如果尚不存在）
  → 成为当前文件并在中间打开
  → 进入重命名或编辑状态
```

未来 New File 菜单由 File Type Registry 生成：

```text
New IdeaSketch (.is)
New Markdown (.md)
New IdeaTable (.it)
New IdeaWorkflow (.iwf)
New Folder
```

当前阶段可创建 IdeaSketch、Markdown 和 Folder。

### 6.3 Workspace 与真实文件

- Workspace Explorer 中的路径是相对 Workspace Root 的真实路径。
- 文件改名或移动后，对应 Document Session 必须更新路径和标题。
- 同一个真实文件只能存在一个 Document Session。
- 真实目录始终可以显示和导航，即使目录中没有当前支持的文件。
- 不支持的文件不显示在 Workspace Explorer 中，也不能被扫描流程错误解析、修改或删除。
- 新文件类型注册为 `openable` 后，其扩展名自动进入 Explorer 可见文件白名单，不为每一种类型单独实现树过滤逻辑。
- 用户通过 Workspace Explorer 之外的显式入口尝试打开不支持的文件时，显示 Unsupported File 提示，并提供安全的下一步操作；该文件不会因此出现在 Workspace Explorer 中。
- Symlink 的遍历策略必须明确，不能无限递归或越过授权边界。

## 7. `.ideanote/` 元数据目录

### 7.1 创建时机

`.ideanote/` 只在 Workspace Mode 中延迟创建。

触发条件：

- 第一次成功创建受支持文件。
- 第一次成功保存已打开文件。
- 第一次需要持久化 Workspace 设置且该操作由用户明确触发。

不触发的行为：

- 选择并打开目录。
- 浏览文件树。
- 打开一个文件但没有产生保存。
- 仅调整尚未要求持久化的临时界面状态。

### 7.2 逻辑结构

第一版建议结构：

```text
.ideanote/
├── workspace.json
├── state.json
├── recovery/
├── tmp/
├── cache/
└── .gitignore
```

职责：

- `workspace.json`：Workspace ID、Schema Version 和 Workspace 级设置。
- `state.json`：最后活动文件、Explorer 展开状态和面板状态。
- `recovery/`：未保存内容的恢复数据。
- `tmp/`：Workspace Mode 中用户文件保存、元数据原子替换及其他应用内部操作产生的短期临时文件。
- `cache/`：可重新生成的索引、预览和临时数据。
- `.gitignore`：在 `.ideanote/` 内忽略易变的 `state.json`、`recovery/`、`tmp/` 和 `cache/`；不得自动修改用户根目录的 `.gitignore`。

具体字段在技术设计阶段确定，但所有文件必须包含可识别的 Schema Version。

`tmp/` 中的文件必须使用无冲突的内部名称，并记录或编码最终目标的 Workspace 相对路径。成功替换、失败回滚和应用启动清理都不得把临时文件暴露到 Workspace Explorer；清理无法确认归属的临时文件时应保守处理，避免删除仍可能用于恢复的数据。

### 7.3 保存优先级与失败行为

用户文件保存优先于 Workspace 元数据：

```text
原子保存用户文件
  → 确认文件保存成功
  → 创建或更新 .ideanote/
  → 更新当前 Document Session 和 Workspace 状态
```

- 用户文件保存成功但 `.ideanote/` 更新失败时，文件保存仍视为成功。
- 应单独提示 Workspace state could not be saved。
- `.ideanote/` 失败不能回滚或删除已成功保存的用户文件。
- `.ideanote/` 写入必须使用临时文件或等价原子替换。
- Workspace Mode 的用户文件和元数据写入所需临时文件统一创建在 `.ideanote/tmp/`，不得在目标文件旁生成 `.is.tmp`、`.tmp` 或类似应用内部文件。
- 从 `.ideanote/tmp/` 提交到目标路径时必须保持原文件失败安全；如果平台或文件系统不能提供安全替换，则保留原文件、报告保存失败并清理可确认无用的临时产物。
- 损坏的元数据不能阻止用户浏览真实目录和打开文件。
- 无法解析元数据时，应保留原文件、使用安全默认状态，并显示诊断提示。

## 8. Single Active Editor

### 8.1 基本行为

中间区域同时只显示一个当前文件编辑器：

- 单击 Workspace Explorer 中受支持的文件，使其成为当前文件并在中间打开。
- 新建文件后立即成为当前文件。
- 标题栏显示当前文件名、文件类型和保存状态。
- 切换文件前，当前 Editor 必须先把尚未提交的编辑器草稿写回对应 Document Session。
- Workspace 中可写文件继续使用防抖自动保存；保存失败、冲突、只读、丢失或 Recovery 状态保留在 Document Session，并在文件树和当前编辑器中显示。
- 干净的非活动 Session 可以被释放或降级为轻量描述符；Dirty、冲突、丢失和恢复中的 Session 不能因切换文件而丢失。
- 支持 Save、Save As 和 Save All，但不提供关闭其他、关闭右侧、重新打开最近关闭文件、前进/后退历史或快速打开等 Tab/导航功能。
- 当前文件在外部被删除或移动时，编辑器显示明确状态并允许重新定位、Save As 或关闭。

### 8.2 Session 恢复

当 `.ideanote/` 已存在时，Workspace 重新打开后恢复：

- 最后活动文件的相对路径。
- Explorer 展开状态。
- 可安全恢复的当前编辑器视图状态。

恢复要求：

- 最后活动文件不存在时保持空编辑区并显示非阻塞提示。
- Workspace 打开时最多按需加载最后活动文件，不预加载其他文件正文。
- 旧版 `state.json` 中的 `openTabs` 只用于推导一个兼容的活动文件，不恢复标签集合。
- 恢复失败不能阻止 Workspace 打开。

### 8.3 目标布局

AI 关闭或 Agent 栏折叠时：

```text
┌──────────────────┬────────────────────────────────────────┐
│ Workspace        │ Current File Editor                    │
│ Explorer         │                                        │
│                  │ drawing.is                             │
│ Folders          │                                        │
│ Files            │                                        │
└──────────────────┴────────────────────────────────────────┘
```

AI 开启并打开应用级 Agent 栏时：

```text
┌──────────────────┬──────────────────────────────────────┬──────────────────┐
│ Workspace        │ Current File Editor                  │ AI Agent         │
│ Explorer         │                                      │                  │
│                  │ Canvas / editor-owned Navigator      │ Conversation     │
│                  │                                      │ Tool Activity    │
└──────────────────┴──────────────────────────────────────┴──────────────────┘
```

AI 关闭时不挂载 Agent 入口或生命周期。AI 开启时，Agent 作为应用 Shell 的独立最右栏挂载，支持折叠和有界调整宽度；Pages、Cameras 等编辑器 Navigator 仍属于中间编辑器区域，并可独立折叠或调整，不与 Agent 切换或共享容器。

## 9. Single File Mode

### 9.1 打开文件

用户可以通过以下方式直接打开受支持文件：

- Home 中的 Open File。
- 系统文件关联。
- 双击文件。
- Recent Files。

Single File Mode：

- 不要求选择 Workspace。
- 不创建 `.ideanote/`。
- 直接读取和保存用户选择的真实文件。
- 使用与 Workspace Mode 相同的 File Type Registry、Editor Host、Parser 和 Serializer。
- 当前阶段正式支持 `.is v1` 和 `.md`。

### 9.2 保存

- Save 写回当前真实路径。
- Save As 写入新路径并更新当前 Session。
- 未保存关闭时提示 Save、Discard 或 Cancel。
- 已有真实路径且可写的文件使用防抖自动保存；未命名、只读、丢失、冲突或检测到外部修改的文件仍要求用户显式处理。
- 检测到外部修改时，不得直接覆盖；至少提供 Reload、Save As 或 Cancel。

### 9.3 双模式、单内核

建议接口：

```ts
interface DocumentSession {
  mode: "workspace" | "standalone";
  filePath: string;
  fileType: string;
  persistence: PersistenceAdapter;
}
```

```text
Workspace Session
  → Workspace File Adapter
  → 真实 Workspace Root 中的文件
  → .ideanote 保存 Workspace 状态

Standalone Session
  → Standalone File Adapter
  → 用户直接打开的真实文件
```

Editor 不应包含 Workspace/Standalone 分支逻辑。Editor 只处理文档模型、编辑操作和保存请求。

## 10. File Type Registry 与 Editor Host

每种文件类型通过统一注册表声明：

```ts
interface FileTypeDefinition {
  type: string;
  displayName: string;
  extensions: string[];
  icon: string;
  creatable: boolean;
  openable: boolean;
  createEmpty(): Promise<DocumentModel>;
  parse(bytes: Uint8Array): Promise<DocumentModel>;
  serialize(model: DocumentModel): Promise<Uint8Array>;
  editor: ResourceEditor;
  settingsSectionId?: string;
  agentExtensionId?: string;
}
```

注册表服务于：

- Workspace Explorer 的 New File 菜单。
- Workspace Explorer 的可见文件类型白名单。
- Open File 格式过滤。
- 文件图标。
- Editor Host 路由。
- Empty File 创建。
- Parser、Serializer 和格式验证。
- Unsupported File 回退。
- 编辑器 Settings 区段和 Agent Extension 注册。

当前注册类型为 IdeaSketch 和 Markdown。

## 11. IdeaSketch (`.is v1`)

### 11.1 定位

`.is` 是 Excalidraw 的包装格式，可以在 Workspace Mode 中作为真实文件存在，也可以在 Single File Mode 中直接打开。

一个 `.is` 可以包含一个或多个按顺序排列的 Excalidraw Page。为了兼容既有 v1，内部字段继续使用 `slides`，用户界面可使用 Pages。

### 11.2 文件结构

```text
example.is
├── manifest.json
└── slides/
    ├── {slide-id-1}.json
    └── {slide-id-2}.json
```

Manifest：

```json
{
  "version": "1.0",
  "created": "2026-08-03T00:00:00Z",
  "modified": "2026-08-03T01:00:00Z",
  "slides": [
    {
      "id": "slide-1",
      "title": "Overview"
    }
  ]
}
```

每个 `slides/{id}.json` 保存 Excalidraw Scene：

```json
{
  "type": "excalidraw",
  "version": 2,
  "elements": [],
  "appState": {},
  "files": {}
}
```

### 11.3 行为要求

- Page 顺序由 `manifest.slides` 数组顺序决定。
- Page 名称由 `slides[].title` 保存。
- Cameras 保存在对应 Page 的 Excalidraw `elements` 中。
- Camera 顺序由 `customData.order` 决定。
- Present 只播放当前 Page 中按顺序排列的 Cameras。
- Workspace Mode 与 Single File Mode 使用同一个 Reader、Writer 和 Editor。
- Writer 只写 `version: "1.0"`。
- Workspace Mode 保存先在 `<workspace>/.ideanote/tmp/` 生成临时归档，再安全替换目标 `.is`；不在目标文件旁生成 `.is.tmp`，也不额外生成 `.is.bak` 备份文件。
- Single File Mode 不创建 `.ideanote/`；其保存临时数据使用应用本地临时存储或平台安全替换机制，并在失败时保留原文件。
- `.is v2` 必须被识别为不受当前 Editor 支持的 Legacy Workspace，不能按 v1 覆盖。

## 12. 其他文件类型

### 12.1 Markdown (`.md`)

标准 UTF-8 Markdown 文档，使用 CodeMirror 6 作为唯一编辑状态与原生 Undo/Redo 历史。支持 Edit、Split、Preview、GFM 安全预览、Outline、标题跳转、同文档锚点、受限相对文档链接和文档目录内的安全本地图片。保留 UTF-8 BOM 与 LF/CRLF；未编辑的 mixed line endings 原样保留，编辑后保存前必须选择 LF 或 CRLF。Markdown 与 IdeaSketch 共用打开、保存、自动保存、Recovery、只读和外部修改保护生命周期。

### 12.2 IdeaTable (`.it`)

应用表格格式。未来支持字段、记录、视图、过滤、排序、公式和自动化触发。

### 12.3 IdeaWorkflow (`.iwf`)

自动化工作流格式。未来支持 Trigger、Node、Edge、Condition、File Operation、AI Operation、运行历史和权限。

`.iwf` 是已确认扩展名。

### 12.4 扩展顺序

建议开发顺序：

```text
IdeaSketch (.is)
  → Generic AI Agent Runtime + IdeaSketch Extension
  → Markdown (.md) + Markdown Agent Extension
  → IdeaTable (.it)
  → IdeaWorkflow (.iwf)
  → Workspace Import/Export
```

每个新编辑器必须完成 File Type Definition、Parser、Serializer、Editor 和保存验证；其 Agent 能力通过可选 Extension 注入，不修改通用 Runtime 或 Agent Panel。

## 13. AI Agent 与 Settings

AI Agent 是当前产品能力，但必须保持编辑器无关。Rust Agent Core 负责 Runtime 发现与自动选择、Turn 顺序、Provider/Codex 流式输出、取消、重试、Thread 持久化、Tool Broker 和安全边界；TypeScript 负责规范化事件投影、活动编辑器的实时模型 Tool 执行、格式感知 ChangeSet 构造、编辑器 SDK 直连事务和 UI。文件类型 Extension 只负责本格式的业务语义。

每个 Agent Extension 可贡献：

- open Agent Skills `SKILL.md`。
- 有界的当前文档、活动 Page/Selection 等 Context。
- 只读 Tool 描述和前置读取约束的 Mutation Tool。
- 格式感知的目标复核、编辑器 SDK 直连事务与原生 Undo/Redo Adapter。

通用规则：

- AI 默认开启，用户可在 Settings 中关闭；关闭后完整移除 Agent 生命周期。
- Provider 使用 OpenAI-compatible Endpoint、Model 和 Rust 管理的本地加密 API Key；未配置时不请求，旧 Keychain 数据不自动读取或迁移。
- Settings 只允许查看当前正在输入的 API Key，不返回已保存值；自动重试可关闭，总尝试次数限制为一至五次并在 Turn 开始时捕获。
- Settings 显示自动 Runtime 选择状态；通过安全门的已安装 Codex `0.147.0` 优先，缺失、不兼容、初始化失败或 pre-progress crash 时回退 Compatibility，并显示有界诊断原因。
- Agent Settings 提供最大 Tool step（默认 8，范围 1–20）、context warning（默认 75%，范围 50–90%）、New Thread 建议（默认 90%，范围 60–100% 且严格高于 warning）、每 Thread 诊断保留数（默认 20，范围 5–100）、Compatibility replay message 数（默认 60，范围 10–200）和 source-delivery telemetry 可见性。执行相关值在 Turn 开始时捕获，活动 Turn 不受后续 Settings 修改影响。
- 本地 Thread 支持创建、恢复、重命名、归档和确认后的永久删除；运行中的 Thread 不允许删除，删除当前 Thread 前必须先建立有效替代 Thread。
- Codex upstream Thread id 与有效 Runtime/model/fallback metadata 随本地 Thread 持久化，用于后续 Turn 恢复和历史解释。
- 每个 Thread 的 Runtime Inspector 显示有效 Runtime、Model、能力、健康状态、有效 Turn policy、source-delivery telemetry、最新安全诊断与 context 状态；Tool Activity 仍保留在对话时间线中，不与 Inspector 混合。
- Context 使用量仅在 Runtime 或 Provider 提供精确 token 数时记录；只有同时提供精确 `modelContextWindow` 时才计算百分比并应用 warning/New Thread 阈值。不得估算 token、硬编码模型 context window，或把账户用量当作 Thread context。
- Codex 的 `thread/tokenUsage/updated`、当前 `contextCompaction` Item 和 legacy `thread/compacted` 归一化为应用事件。Runtime upstream compaction 与本地 Compatibility replay 截断是两个独立状态，二者都不删除可见 Thread 历史。
- Runtime discovery、startup、selection、reroute、fallback、retry、Provider failure、cancellation、compaction 和 terminal failure 进入有界、分类、脱敏的诊断记录；凭据、隐藏 reasoning、原始 payload、prompt/answer、文档快照、可执行路径和 presentation timer 不进入诊断。
- 真正的文本 delta 必须立即进入规范化事件链；若上游增量交付，则在有界渲染延迟内直接显示；若上游缓冲、突发或原子交付，则允许只对 assistant answer 使用有界展示节奏，同时保留来源时序诊断，且不得将其表述为实时 token 生成或 reasoning。
- 可展开 Tool Activity 只显示经过 Rust Tool Broker 限界和脱敏的参数/结果；call id、schema、重复调用、超时和结果大小由 Rust 统一治理。
- 只显示 Runtime 明确分类为公开的过程摘要；隐藏 chain-of-thought 不进入事件、UI 或持久化。缺少公开过程信息时不显示误导性提示。
- Skill 先发现 metadata，只有活动编辑器 Extension 才加载完整指令和 Tool。
- Runtime、Panel、Settings 不直接包含 `.is` 或未来编辑器的解析、验证、读写逻辑。
- Rust 不从磁盘重建活动编辑器状态，也不直接写用户文件；TypeScript Tool executor 返回读取结果或目标绑定的 ChangeSet，并只允许可信活动编辑器通过其前端 SDK 应用。
- Mutation 不直接写磁盘或先改 reducer 模型；应用前复核文档 id、revision、source fingerprint、状态、外部修改标记、取消状态和编辑器挂载状态。
- 有效修改通过一次编辑器原生事务进入 Document Session、Dirty、Auto-save、Recovery 和外部冲突保护；Undo/Redo 使用编辑器自身历史，不由 Agent 实现。
- 不提供任意本地文件、Shell、脚本、网络或自动执行工具。
- 旧 MCP Runtime 不再作为并行自动化入口。

## 14. Workspace Import/Export（未来阶段）

当前 Workspace 是真实目录，不需要通过导入才能打开。

未来的 Workspace Import/Export 主要用于：

- 打包整个目录 Workspace。
- 跨设备迁移。
- 备份和恢复。
- 分享完整 Workspace。
- 导入旧 `.is v2` IdeaSlide Workspace。

当前阶段：

- 不定义最终 Workspace 包扩展名。
- 不实现 Workspace 打包和解包。
- 不实现 `.is v2` 自动迁移。
- 遇到 `.is v2` 时必须识别并阻止覆盖，提供明确的 Legacy format 提示。

## 15. 保存、恢复与外部修改

### 15.1 文件保存

- 用户文件使用对应 File Type Serializer 保存。
- Workspace Mode 的写入临时文件统一存放在 Workspace Root 的 `.ideanote/tmp/`，提交阶段使用平台支持的安全替换机制，失败时保留原文件。
- Single File Mode 不创建 `.ideanote/`，临时写入由应用本地临时存储或平台安全替换机制管理。
- 保存失败保留 Dirty 状态。
- 一个文件保存失败不能阻止其他文件保存。
- Save All 应汇总每个文件的结果。
- 不因保存一个文件而序列化整个 Workspace。

### 15.2 Recovery

- Dirty Document Session 应有 Recovery Draft。
- Workspace Mode 的 Recovery 存放在 `.ideanote/recovery/`。
- Single File Mode 的 Recovery 存放在应用本地恢复目录，不能在原文件旁静默创建未知文件。
- Recovery Draft 成功恢复后，由用户决定是否覆盖原文件。

### 15.3 外部修改

- 文件监听必须完全忽略 `.ideanote/` 内部事件，并识别应用自己的最终替换事件，避免保存循环。
- 外部内容变化时，未 Dirty 的 Document Session 可以提示 Reload。
- 外部内容变化且 Document Session Dirty 时，不得静默合并或覆盖。
- 文件被删除时保留内存内容，并提供 Save As 或 Close。
- 文件移动或重命名时尽可能更新 Document Session；无法确认时提示重新定位。

## 16. 性能与可靠性

- 打开 Workspace 时只扫描必要的目录元数据，不解析全部文件内容。
- 目录扫描保留真实目录节点，但只向 Explorer 投影 File Type Registry 当前支持的文件；不受支持文件不进入前端树模型。
- 文件内容只在成为当前文件时按需加载。
- 恢复 Workspace 时最多加载最后活动文件，不得批量解析历史文件。
- 干净的非活动 Session 应允许释放其重型编辑器模型；受保护的 Dirty、冲突或 Recovery Session 继续保留。
- 文件树需要为大量文件预留虚拟化和增量更新能力。
- 保存一个文件的成本只与该文件相关。
- `.ideanote/cache/` 中的数据必须可删除并重新生成。
- Workspace 元数据损坏不能阻止真实文件访问。
- `.is` ZIP 解析和写入不能长期阻塞编辑器主线程。
- 路径处理必须防止越过 Workspace Root 或产生目录递归循环。

## 17. UI 与交互要求

- 所有用户可见文案使用 English。
- Workspace Mode 明确显示 Workspace Root 名称。
- Single File Mode 明确显示真实文件名和保存状态。
- 当前文件 Dirty 状态必须在标题栏清晰显示；非活动受保护 Session 的状态必须在 Workspace Explorer 中可识别。
- 左侧 Explorer 和中间 Editor 之间支持有最小、最大宽度限制的拖动调整。
- 左侧 Explorer 可以折叠。
- AI 关闭时不显示 Agent 栏或空占位；AI 开启但未配置 Provider 时，独立 Agent 栏显示可进入 Settings 的配置状态。
- 应用级右侧 Agent 栏可折叠、可调整宽度；编辑器内部 Navigator 与 Agent 分属不同布局区域并可独立控制。
- 从显式打开入口触发的 Unsupported File 页面必须说明当前不支持编辑，并提供安全的下一步操作；Workspace Explorer 本身不列出不支持的文件。

## 18. 当前阶段 MVP 范围

### 18.1 包含

1. IdeaNote 产品术语和基础 Shell。
2. Open Workspace 目录选择。
3. 真实目录 Workspace Explorer。
4. `.ideanote/` 延迟生成。
5. Workspace 状态和最后活动文件恢复。
6. 单一前台 Editor 与多文档 Session 内核。
7. New Folder 和 New IdeaSketch。
8. Rename、Move、Delete、Refresh。
9. File Watcher 和基础外部修改提示。
10. Single File Mode。
11. File Type Registry。
12. Editor Host。
13. `.is v1` Reader、Writer 和空文件创建。
14. Excalidraw Editor。
15. Pages、Cameras 和 Present 现有能力适配。
16. Save、Save As、Save All 和 Recovery。
17. 受支持文件白名单过滤，以及显式打开入口的 Unsupported File 回退。
18. Home/Editor 共用的 Settings Center、版本化非秘密设置和 Rust 管理的本地加密凭据。
19. 默认开启但可完整关闭的 AI Gate。
20. 编辑器无关的流式 Agent Runtime、取消、对话历史和应用级右侧 Agent 栏。
21. IdeaSketch 与 Markdown 各自的 Skill、受限 Context、只读 Tool 和格式感知 Mutation Tool。
22. 前置读取、目标/外部状态复核、编辑器 SDK 单事务直连应用和原生一步 Undo/Redo。

### 18.2 不包含

1. IdeaTable Editor。
2. IdeaWorkflow Editor。
3. Workspace Import/Export。
4. `.is v2` 自动迁移。
5. Cloud Sync。
6. Collaboration。
7. Script Runtime。
8. 后台自治、多 Agent 编排和不受限 Agent 工具集。

## 19. MVP 验收标准

### Workspace

- 选择任意可访问目录后可以打开 Workspace。
- 仅打开和浏览目录不会生成 `.ideanote/`。
- 第一次成功创建或保存文件后生成合法 `.ideanote/`。
- `.ideanote/` 不出现在左侧文件树中。
- 真实目录外部变化可以被检测并更新文件树。

### Files and Editor

- 用户可以在左侧创建 Folder、`.is` 和 `.md`。
- 新建 `.is` 是磁盘上的有效 v1 文件，并立即成为当前文件。
- 点击另一个受支持文件后，中间区域切换到该文件，且始终只有一个前台 Editor。
- 同一个真实路径不会出现重复 Document Session。
- 文件切换前会提交当前编辑器草稿；Dirty、冲突和 Recovery Session 不会被静默丢弃。
- 已存在 `.ideanote/` 时，重新打开 Workspace 可以恢复最后活动文件；旧版 Tab 状态不会恢复为标签栏。
- Workspace Explorer 保留目录层级，但只显示当前支持的 `.is` 和 `.md`；不显示 `.it`、`.iwf` 或其他不支持文件。
- 被过滤的不支持文件不会被解析、修改或删除。
- `.ideanote/` 和其中的 `tmp/`、`recovery/`、`cache/` 永不出现在 Workspace Explorer 中。

### Dual mode, single core

- `.is v1` 可以在 Workspace Mode 打开。
- `.is v1` 可以在 Single File Mode 直接打开。
- `.md` 可以在 Workspace Mode 和 Single File Mode 打开、编辑、保存和恢复。
- 两种模式使用同一个 Reader、Writer 和 Excalidraw Editor。
- Single File Mode 不创建 `.ideanote/`。
- Save 写回当前真实文件，Save As 更新当前 Session。

### IdeaSketch

- Writer 输出 `version: "1.0"`、`slides[]` 和 `slides/{id}.json`。
- Workspace Mode 保存时，临时归档只出现在 `.ideanote/tmp/`，目标文件目录中不出现 `.is.tmp` 或 `.is.bak`。
- Page 名称和顺序保存后重新打开保持不变。
- Excalidraw Elements、Files 和必要 AppState 保持不变。
- Camera 顺序保持不变。
- Present 只播放当前 Page 的 Cameras。
- `.is v2` 不会被 v1 Writer 静默覆盖。

### Scope

- AI 默认开启；关闭后不显示 Agent UI，也不初始化任何 Agent 生命周期。
- 未配置 Provider 时只显示配置引导，不发起请求。
- 已安装且兼容的 Codex `0.147.0` 自动用于支持编辑器 Tool 的 Turn；不可用时回退 Compatibility，并在 Agent/Settings 显示有效 Runtime、Model、能力和诊断。
- Runtime Inspector 对精确 usage、不可用 usage、Runtime compaction 和本地 Compatibility replay 截断作不同说明；只有精确 context window 达到配置阈值时才提示压力或建议 New Thread。
- Agent policy 默认值为 8 maximum steps、75% warning、90% New Thread、20 diagnostics、60 Compatibility messages 和显示 source delivery；边界与阈值关系在 TypeScript 和 Rust 两侧归一化，maximum steps 对 Codex 与 Compatibility 的所有编辑器 Tool 生效。
- Agent 答案在上游提供增量时于完成前持续增长；上游缓冲、突发或原子交付时，Preparing、Working 和 elapsed activity 仍由真实生命周期驱动，assistant answer 可使用有界展示节奏逐步出现，但 UI 与诊断不得声称这是实时 token 生成或模型思考。
- 本地 Thread 历史支持恢复、重命名、归档和确认永久删除；运行中的 Thread 不可删除，删除不会触及文档、Workspace、Recovery、凭据或其他 Thread。
- Tool 请求通过 Rust ledger 与 TypeScript 活动编辑器 executor 往返；所有修改生成目标绑定 ChangeSet，经活动编辑器复核后直接作为一次原生事务应用，并可通过编辑器原生历史一步 Undo/Redo。
- Hidden reasoning 不显示、不推断、不持久化；只有 Runtime 明确标记为公开的过程信息才可流式呈现。
- IdeaSketch 与 Markdown Agent 修改都不直接写磁盘；陈旧、只读、冲突、外部修改、已切换或未挂载目标拒绝应用。
- 当前构建不提供 Workspace Import/Export。
- New File 菜单当前提供 IdeaSketch、Markdown 和 Folder。
- `.it`、`.iwf` 在对应编辑器注册为可打开之前不显示在 Workspace Explorer 中；从其他入口显式打开时安全拒绝，且不宣称可编辑。

## 20. 推荐开发阶段

### Phase 0：PRD 与架构定稿

- 评审并批准本 PRD。
- 确定 `.ideanote/` 字段和状态持久化策略。
- 确定文件监听、原子写入和 Recovery 方案。
- 建立 `.is v1` 兼容样本和 `.is v2` 防覆盖样本。

### Phase 1：Workspace Shell

- Open Workspace。
- Workspace Explorer。
- 基于 File Type Registry 的 Explorer 文件可见性白名单。
- `.ideanote/` 延迟生成。
- Workspace 临时写入集中到 `.ideanote/tmp/`。
- Single Active Editor。
- File Type Registry 和 Editor Host。
- File Watcher 和 Session Restore。

### Phase 2：IdeaSketch

- `.is v1` Reader/Writer。
- Excalidraw Editor。
- Pages、Cameras、Present。
- Workspace/Standalone 共用编辑器。
- Save、Recovery 和外部修改处理。

### Phase 3：Settings 与 Generic AI Agent

- Home/Editor 共用 Settings Center。
- OpenAI-compatible Provider 配置、本地加密凭据与可配置安全重试。
- 默认开启/完整关闭 AI Gate。
- 通用 Agent Runtime、流式输出、取消和会话历史。
- 独立的应用级右侧 Agent 栏。
- IdeaSketch Skill、Tools、Context、编辑器 SDK 直连事务和原生 Undo。

### Phase 4：Markdown

- `.md` Editor。
- Markdown Parser/Serializer。
- Markdown Skill、受限读取 Tool、精确范围替换 Tool 和 CodeMirror 原生 Undo/Redo。

### Phase 5：IdeaTable

- `.it` Schema。
- Table Editor。
- 基本命令接口。

### Phase 6：IdeaWorkflow

- `.iwf` Schema。
- Workflow Editor。
- 基本命令接口。
- 暂不自动运行不受信任流程。

### Phase 7：Workspace Import/Export

- Workspace Package 格式。
- 完整目录打包与恢复。
- 旧 `.is v2` Workspace 导入。
- 备份和跨设备迁移。

## 21. 风险

### 21.1 `.ideanote/` 污染用户目录

如果打开目录就自动生成元数据，会给用户造成不透明副作用。因此必须延迟到第一次成功创建或保存文件。

### 21.2 真实文件与应用状态不一致

外部程序可以修改、移动或删除文件。必须通过 File Watcher、Dirty 检测和明确冲突提示避免覆盖用户数据。

### 21.3 后台 Document Session 导致内存增长

即使界面只显示一个 Editor，切换大量 Excalidraw 文件仍可能累积文档模型。必须只挂载当前 Editor，允许释放干净的非活动模型，并始终保留 Dirty、冲突和 Recovery Session 的安全状态。

### 21.4 两套模式产生分叉

如果 Workspace 和 Single File 分别实现 Reader、Writer 或 Editor，行为会快速不一致。必须通过 Document Session 和 Persistence Adapter 共享内核。

### 21.5 Agent 与编辑器耦合

如果通用 Runtime 或 Panel 直接包含某一种格式的业务逻辑，后续编辑器会迫使 Agent 重构。必须由 File Type Registry 关联 Agent Extension，并让 Extension 独立注入 Skill、Tools、Context 和编辑器 SDK Mutation Adapter；通用层只维护 Provider、会话、安全和 UI 生命周期。

### 21.6 `.is v1/v2` 冲突

当前 `.is v2` 曾表示旧 Workspace，而新 Writer 只写 v1。读取时必须先检查版本，v2 必须阻止覆盖并留待未来迁移。

## 22. 当前 MVP 的实施默认

以下决定作为当前主线计划的实施基线；后续可以通过新的 PRD 或 Feature Request 调整：

1. 用户可见产品名称改为 `IdeaNote`；当前 MVP 不迁移仓库名、Cargo/npm package name、Bundle ID 或用户数据目录，避免把产品重构与安装迁移混在一起。
2. `.ideanote/workspace.json` 使用 `schemaVersion: 1`，保存稳定的 `workspaceId`、创建/更新时间和 Workspace 级设置；新的 `.ideanote/state.json` 使用 `schemaVersion: 2`，保存相对路径形式的最后活动文件和 Explorer 状态。读取器继续兼容旧 `schemaVersion: 1` 的 `openTabs`/`activePath`，但只恢复一个活动文件，且仅打开 Workspace 不触发元数据重写。
3. 第一版使用单个 `state.json`，并由 `.ideanote/.gitignore` 忽略 `state.json`、`recovery/`、`tmp/` 和 `cache/`；不修改 Workspace 根目录的 `.gitignore`。
4. Workspace Mode 和 Single File Mode 都为已有真实路径且可写的文件提供显式 Save 与防抖自动保存；未命名或受保护的 Single File 仍只允许显式保存，并使用 Recovery Draft 防止意外丢失。
5. 新建 IdeaSketch 默认名为 `Untitled.is`，冲突时使用递增后缀，并立即进入内联重命名。
6. 单击受支持文件即使其成为唯一前台文件；目录单击只选择，展开/收起由目录箭头和键盘操作负责。
7. 只挂载当前活动 Editor；干净的非活动 Session 可以释放，Dirty、冲突、丢失和 Recovery Session 保留必要模型与状态。当前阶段不增加文件前进/后退历史、快速打开、最近关闭文件或其他 Tab 替代导航。
8. 默认不跟随 Symlink；Symlink 作为不可递归的特殊条目显示，不能借此越过 Workspace Root。
9. Delete 默认移动到系统 Trash；不能安全移动到 Trash 时不执行永久删除，并显示错误。
10. `.is` 覆盖不生成 `.is.bak`；Workspace Mode 只使用 `.ideanote/tmp/` 中的临时文件并安全替换目标文件，失败时保留原文件并清理可确认无用的临时文件。Single File Mode 使用应用本地临时存储或平台安全替换机制，且不创建 `.ideanote/`。
11. `.is v2` 自动迁移延后到 Workspace Import/Export 阶段；当前版本只识别、说明并阻止覆盖。
12. Markdown、IdeaTable 和 IdeaWorkflow 在各自启动前分别编写和批准详细 PRD；本阶段只保留注册表和 Editor Host 扩展边界。
13. 文件类型扩展采用前后端对称模块化：IdeaSketch 前端模块与 Rust 后端格式模块只通过稳定注册表和通用命令边界接入。
14. Workspace Explorer 始终显示真实目录节点，但文件只显示 File Type Registry 中当前 `openable` 的类型；当前阶段只有 `.is`。不支持文件不进入前端树模型，显式打开时走安全的 Unsupported File 回退。
15. Workspace Mode 的用户文件、Workspace 元数据及其他应用内部操作所需临时文件统一位于 `<workspace>/.ideanote/tmp/`；目标文件旁不得出现 `.is.tmp` 等应用临时文件。Single File Mode 不创建 `.ideanote/`，使用应用本地临时存储或平台安全替换机制。
16. 全局 Settings 和 AI Credential 位于应用配置目录；Credential 使用独立受限密钥和认证加密，不写入 `.ideanote/`，未来若增加 Workspace Override，必须使用独立版本字段且不得包含 Secret。
17. AI 默认开启；关闭是完整生命周期 Gate，未配置 Credential 是独立的配置状态。
18. Agent Runtime 使用 IdeaNote 自有接口包装维护中的开源框架；编辑器只通过 Agent Extension Contract 接入。
19. 每个 Agent Mutation 都先生成一次性 ChangeSet，直接应用前复核文档 revision、source fingerprint、Document Status、source modified marker、活动绑定和编辑器挂载状态，并通过现有 Editor SDK 的一次原生事务应用。
20. MCP stdio Runtime、`--mcp`/`--visible`、隐藏 MCP Renderer、`rmcp` dependency 和前端 MCP Bridge 已退休；`preview-renderer` 作为缩略图/预览基础设施继续保留。

## 23. 开发启动门槛

在开始 IdeaNote 重构前，必须满足：

- 本 PRD 状态由 `draft` 更新为明确批准状态。
- 当前阶段 MVP 和非目标获得确认。
- `.ideanote/` 延迟创建、Schema 和失败行为获得确认。
- Workspace/Standalone Session 边界获得确认。
- `.is v1` 写入和 `.is v2` 防覆盖策略获得确认。
- 根据最终 PRD 生成 Superplan 开发计划。
- 所有开发计划通过人工评审和批准。

在上述条件满足前，不进行 IdeaNote 重构开发。
