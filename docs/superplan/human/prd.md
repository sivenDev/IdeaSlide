# IdeaNote Product Requirements Document

- status: accepted
- document_version: 0.7
- created: 2026-08-03
- last_updated: 2026-08-03
- product: IdeaNote
- predecessor: IdeaSlide
- implementation_authorized: true

> 本文档定义 IdeaSlide 向 IdeaNote 演进后的产品结构和分阶段范围。产品方向与当前 MVP 已获得实施授权；具体业务代码仍须依据通过人工评审的 Superplan 主线计划执行。

## 1. 产品概述

IdeaNote 是一个 Local-first、多文件、多编辑器的桌面 Workspace。用户可以选择任意本地目录作为 Workspace，在真实目录中创建和编辑 IdeaSketch、IdeaTable、IdeaWorkflow 和 Markdown 文件，并在中间编辑区域通过 Tabs 同时打开多个文件。

IdeaNote 同时支持：

- Workspace Mode：选择一个真实目录，以文件树和多文件 Tabs 进行长期工作。
- Single File Mode：直接打开单个受支持文件，不要求创建或导入 Workspace。

两种模式共享同一套文件模型、编辑器、格式解析与保存逻辑，即：

> 双模式、单内核。

长期产品布局为左、中、右三栏：

- 左侧：Workspace Explorer。
- 中间：多文件 Editor Tabs。
- 右侧：AI Agent。

当前阶段只实现左侧 Workspace Explorer、中间 Editor Tabs 和 IdeaSketch 编辑器。AI Agent、其他编辑器以及 Workspace 导入导出在后续阶段开发。

## 2. 已确认产品决定

1. 产品名称从 IdeaSlide 调整为 IdeaNote。
2. Open Workspace 表示选择一个真实本地目录，而不是打开一个 Workspace 压缩文件。
3. Workspace 中的用户文件就是目录中的真实文件，不复制到应用私有数据库作为主要内容源。
4. Workspace 元数据保存在根目录的 `.ideanote/` 子目录中。
5. 打开或浏览一个没有 `.ideanote/` 的目录时，不立即修改该目录。
6. 第一次在 Workspace Mode 中成功创建或保存文件时，才生成 `.ideanote/`。
7. Workspace Mode 和 Single File Mode 使用同一套 Editor、Parser、Serializer 和 Save Pipeline。
8. 中间编辑区支持同时打开多个文件，通过 Tabs 切换。
9. 从左侧新建文件后，新文件立即在中间的新 Tab 中打开。
10. 目标布局右侧为 AI Agent，但当前阶段不显示无功能的空 Agent 面板，只保留未来扩展边界。
11. 当前唯一支持的编辑器是 Excalidraw，文件格式为 `.is v1`。
12. 未来文件格式为 `.it`（IdeaTable）、`.iwf`（IdeaWorkflow）和 `.md`（Markdown）。
13. 当前阶段不实现 AI Agent。
14. 当前阶段不实现 Workspace 导入导出。
15. AI Agent 和 Workspace 导入导出在各核心编辑器完成后再开发。

## 3. 产品目标

### 3.1 当前阶段目标

1. 建立真实目录驱动的 Workspace Mode。
2. 建立 Single File Mode，并与 Workspace Mode 共用 IdeaSketch 编辑器。
3. 建立可扩展的 File Type Registry 和 Editor Host。
4. 建立左侧真实文件树和中间多文件 Tabs。
5. 实现 `.ideanote/` 延迟创建与 Workspace 状态恢复。
6. 将 `.is` Writer/Reader 回退并固定为既有 v1 结构。
7. 保留现有 Excalidraw、Pages、Cameras 和 Present 核心能力。
8. 为后续 `.md`、`.it`、`.iwf` 编辑器预留稳定扩展点。

### 3.2 长期目标

1. 支持 Markdown、IdeaTable 和 IdeaWorkflow 编辑器。
2. 为各文件类型提供稳定 SDK。
3. 在右侧增加可操作当前文件和 Workspace 的 AI Agent。
4. 支持 Workspace 的便携导入、导出、备份和迁移。
5. 在编辑器和 SDK 稳定后增加自动化执行、审计、权限和 Secret 管理。

### 3.3 当前阶段成功标准

用户能够完成以下闭环：

```text
Open Workspace
  → 选择一个本地目录
  → 在左侧新建 drawing.is
  → drawing.is 在中间新 Tab 打开
  → 使用 Excalidraw 编辑
  → 保存为真实 .is v1 文件
  → 首次保存后生成 .ideanote/
  → 再打开 Workspace 时恢复文件树和 Tabs
```

同时，用户可以双击或通过 Open File 直接打开一个 `.is v1` 文件，在 Single File Mode 中使用同一个编辑器并保存回原路径。

## 4. 非目标

以下内容不属于当前阶段：

- AI Agent 界面与模型接入。
- Agent SDK、Tool Call 和 Change Review。
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

增加新文件类型时，不应重新设计 Workspace Explorer、Tabs、Session、保存流程或 Editor Host。

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
- 新建 IdeaSketch (`.is`)。
- Rename。
- Move。
- Delete，并提供明确确认。
- Refresh。
- 监听外部文件创建、修改、移动和删除。
- 隐藏 `.ideanote/` 和应用内部临时文件。

新建流程：

```text
选中目标目录
  → New IdeaSketch
  → 输入文件名
  → 创建有效的空 .is v1 文件
  → 生成 .ideanote/（如果尚不存在）
  → 在中间新 Tab 打开
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

当前阶段只有 IdeaSketch 和 Folder 可创建。

### 6.3 Workspace 与真实文件

- Workspace Explorer 中的路径是相对 Workspace Root 的真实路径。
- 文件改名或移动后，已打开 Tab 必须更新路径和标题。
- 同一个真实文件只能打开一个 Tab。
- 不支持的文件仍然显示在树中，但不能被错误解析或修改。
- 不支持的文件可以显示 Unsupported File 页面，并提供 Reveal in Finder 或 Open Externally。
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
├── cache/
└── .gitignore
```

职责：

- `workspace.json`：Workspace ID、Schema Version 和 Workspace 级设置。
- `state.json`：打开的 Tabs、Active Tab、面板状态和最近活动文件。
- `recovery/`：未保存内容的恢复数据。
- `cache/`：可重新生成的索引、预览和临时数据。
- `.gitignore`：在 `.ideanote/` 内忽略易变的 `state.json`、`recovery/` 和 `cache/`；不得自动修改用户根目录的 `.gitignore`。

具体字段在技术设计阶段确定，但所有文件必须包含可识别的 Schema Version。

### 7.3 保存优先级与失败行为

用户文件保存优先于 Workspace 元数据：

```text
原子保存用户文件
  → 确认文件保存成功
  → 创建或更新 .ideanote/
  → 更新 Tab 和 Workspace 状态
```

- 用户文件保存成功但 `.ideanote/` 更新失败时，文件保存仍视为成功。
- 应单独提示 Workspace state could not be saved。
- `.ideanote/` 失败不能回滚或删除已成功保存的用户文件。
- `.ideanote/` 写入必须使用临时文件或等价原子替换。
- 损坏的元数据不能阻止用户浏览真实目录和打开文件。
- 无法解析元数据时，应保留原文件、使用安全默认状态，并显示诊断提示。

## 8. Editor Tabs

### 8.1 基本行为

中间区域支持多个同时打开的文件：

- 单击或双击左侧文件打开 Tab，具体交互在 UI 设计阶段确认。
- 新建文件后立即打开新 Tab。
- 同一路径只能存在一个 Tab。
- Tab 显示文件名、文件类型图标和 Dirty 状态。
- 可以切换、关闭、关闭其他、关闭右侧和重新打开最近关闭的 Tab。
- 关闭 Dirty Tab 时提示 Save、Discard 或 Cancel。
- 支持 Save、Save As 和 Save All。
- 文件在外部被删除或移动时，Tab 显示明确状态并允许重新定位或关闭。

### 8.2 Session 恢复

当 `.ideanote/` 已存在时，Workspace 重新打开后恢复：

- Open Tabs。
- Active Tab。
- 每个 Tab 的文件路径。
- 可安全恢复的编辑器视图状态。

恢复要求：

- 不存在的文件跳过并显示非阻塞提示。
- 不因恢复 Tabs 一次性解析所有文件内容。
- 文件内容按需加载。
- 恢复失败不能阻止 Workspace 打开。

### 8.3 目标布局

当前阶段：

```text
┌──────────────────┬────────────────────────────────────────┐
│ Workspace        │ Editor Tabs                            │
│ Explorer         │ drawing.is | another.is               │
│                  │                                        │
│ Folders          │ Current File Editor                    │
│ Files            │                                        │
└──────────────────┴────────────────────────────────────────┘
```

长期布局：

```text
┌──────────────────┬────────────────────────────┬──────────────────┐
│ Workspace        │ Editor Tabs                │ AI Agent         │
│ Explorer         │                            │                  │
│                  │ Current File Editor        │ Conversation     │
│                  │                            │ Tool Activity    │
└──────────────────┴────────────────────────────┴──────────────────┘
```

当前阶段不显示空白 Agent 占位面板，以保证编辑空间。布局组件应允许未来增加可折叠、可调整宽度的右侧 Agent Panel。

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
- 当前阶段只正式支持 `.is v1`。

### 9.2 保存

- Save 写回当前真实路径。
- Save As 写入新路径并更新当前 Session。
- 未保存关闭时提示 Save、Discard 或 Cancel。
- 应保存 Recovery Draft，但在用户未选择自动保存策略前不能静默覆盖原文件。
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
}
```

注册表服务于：

- Workspace Explorer 的 New File 菜单。
- Open File 格式过滤。
- 文件图标。
- Editor Host 路由。
- Empty File 创建。
- Parser、Serializer 和格式验证。
- Unsupported File 回退。
- 未来 AI Agent SDK 注册。

当前注册类型只有 IdeaSketch。

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
- 保存使用同目录临时文件和原子替换，不额外生成 `.is.bak` 备份文件。
- `.is v2` 必须被识别为不受当前 Editor 支持的 Legacy Workspace，不能按 v1 覆盖。

## 12. 未来文件类型

### 12.1 Markdown (`.md`)

标准 Markdown 文档。未来支持文本编辑、预览、链接和文件内引用。

### 12.2 IdeaTable (`.it`)

应用表格格式。未来支持字段、记录、视图、过滤、排序、公式和自动化触发。

### 12.3 IdeaWorkflow (`.iwf`)

自动化工作流格式。未来支持 Trigger、Node、Edge、Condition、File Operation、AI Operation、运行历史和权限。

`.iwf` 是已确认扩展名。

### 12.4 扩展顺序

建议开发顺序：

```text
IdeaSketch (.is)
  → Markdown (.md)
  → IdeaTable (.it)
  → IdeaWorkflow (.iwf)
  → AI Agent
  → Workspace Import/Export
```

每个新编辑器必须先完成 File Type Definition、Parser、Serializer、Editor、保存验证和基本命令接口，再进入下一个阶段。

## 13. AI Agent（未来阶段）

右侧 AI Agent 是长期产品布局的一部分，但不属于当前阶段。

在 `.is`、`.md`、`.it` 和 `.iwf` 编辑器及其基本 SDK 稳定后，再实现：

- 当前文件上下文。
- Workspace 文件上下文。
- 创建和修改受支持文件。
- Tool Activity。
- Change Review。
- Undo。
- 权限、确认和审计。

当前阶段要求：

- 不接入模型 Provider。
- 不显示伪 Agent 或不可用输入框。
- 不为 Agent 提前实现大量未验证的抽象。
- File Type Registry 和 Editor 边界不能阻止未来增加 Agent Tools。

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
- 写入使用临时文件和同目录原子替换。
- 保存失败保留 Dirty 状态。
- 一个文件保存失败不能阻止其他文件保存。
- Save All 应汇总每个文件的结果。
- 不因保存一个文件而序列化整个 Workspace。

### 15.2 Recovery

- Dirty Tab 应有 Recovery Draft。
- Workspace Mode 的 Recovery 存放在 `.ideanote/recovery/`。
- Single File Mode 的 Recovery 存放在应用本地恢复目录，不能在原文件旁静默创建未知文件。
- Recovery Draft 成功恢复后，由用户决定是否覆盖原文件。

### 15.3 外部修改

- 文件监听必须忽略应用自己的原子替换事件，避免保存循环。
- 外部内容变化时，未 Dirty 的 Tab 可以提示 Reload。
- 外部内容变化且 Tab Dirty 时，不得静默合并或覆盖。
- 文件被删除时保留内存内容，并提供 Save As 或 Close。
- 文件移动或重命名时尽可能更新 Tab；无法确认时提示重新定位。

## 16. 性能与可靠性

- 打开 Workspace 时只扫描必要的目录元数据，不解析全部文件内容。
- 文件内容按 Tab 打开按需加载。
- 恢复 Tabs 时不得一次性解析所有文件。
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
- Tab Dirty 状态必须清晰但不过度干扰。
- 左侧 Explorer 和中间 Editor 之间支持有最小、最大宽度限制的拖动调整。
- 左侧 Explorer 可以折叠。
- 当前阶段不显示右侧 Agent 空占位。
- 未来 Agent Panel 应可折叠、可调整宽度，并与现有布局共存。
- Unsupported File 页面必须说明当前不支持编辑，并提供安全的下一步操作。

## 18. 当前阶段 MVP 范围

### 18.1 包含

1. IdeaNote 产品术语和基础 Shell。
2. Open Workspace 目录选择。
3. 真实目录 Workspace Explorer。
4. `.ideanote/` 延迟生成。
5. Workspace 状态和 Tabs 恢复。
6. 多文件 Editor Tabs。
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
17. Unsupported File 回退。

### 18.2 不包含

1. AI Agent。
2. Markdown Editor。
3. IdeaTable Editor。
4. IdeaWorkflow Editor。
5. Workspace Import/Export。
6. `.is v2` 自动迁移。
7. Cloud Sync。
8. Collaboration。
9. Script Runtime。
10. Agent SDK 完整工具集。

## 19. MVP 验收标准

### Workspace

- 选择任意可访问目录后可以打开 Workspace。
- 仅打开和浏览目录不会生成 `.ideanote/`。
- 第一次成功创建或保存文件后生成合法 `.ideanote/`。
- `.ideanote/` 不出现在左侧文件树中。
- 真实目录外部变化可以被检测并更新文件树。

### Files and Tabs

- 用户可以在左侧创建 Folder 和 `.is`。
- 新建 `.is` 是磁盘上的有效 v1 文件，并立即在中间新 Tab 打开。
- 可以同时打开多个文件并切换 Tabs。
- 同一个真实路径不会出现重复 Tab。
- Dirty Tab 关闭时提供 Save、Discard、Cancel。
- 已存在 `.ideanote/` 时，重新打开 Workspace 可以恢复有效 Tabs。
- 不支持的文件不会被修改或丢弃。

### Dual mode, single core

- `.is v1` 可以在 Workspace Mode 打开。
- `.is v1` 可以在 Single File Mode 直接打开。
- 两种模式使用同一个 Reader、Writer 和 Excalidraw Editor。
- Single File Mode 不创建 `.ideanote/`。
- Save 写回当前真实文件，Save As 更新当前 Session。

### IdeaSketch

- Writer 输出 `version: "1.0"`、`slides[]` 和 `slides/{id}.json`。
- Page 名称和顺序保存后重新打开保持不变。
- Excalidraw Elements、Files 和必要 AppState 保持不变。
- Camera 顺序保持不变。
- Present 只播放当前 Page 的 Cameras。
- `.is v2` 不会被 v1 Writer 静默覆盖。

### Scope

- 当前构建不显示无功能的 Agent Panel。
- 当前构建不提供 Workspace Import/Export。
- New File 菜单当前只有 IdeaSketch 和 Folder。
- `.md`、`.it`、`.iwf` 可以作为不支持文件安全显示，但不宣称可编辑。

## 20. 推荐开发阶段

### Phase 0：PRD 与架构定稿

- 评审并批准本 PRD。
- 确定 `.ideanote/` 字段和状态持久化策略。
- 确定文件监听、原子写入和 Recovery 方案。
- 建立 `.is v1` 兼容样本和 `.is v2` 防覆盖样本。

### Phase 1：Workspace Shell

- Open Workspace。
- Workspace Explorer。
- `.ideanote/` 延迟生成。
- Multi-file Tabs。
- File Type Registry 和 Editor Host。
- File Watcher 和 Session Restore。

### Phase 2：IdeaSketch

- `.is v1` Reader/Writer。
- Excalidraw Editor。
- Pages、Cameras、Present。
- Workspace/Standalone 共用编辑器。
- Save、Recovery 和外部修改处理。

### Phase 3：Markdown

- `.md` Editor。
- Markdown Parser/Serializer。
- 基本命令接口。

### Phase 4：IdeaTable

- `.it` Schema。
- Table Editor。
- 基本命令接口。

### Phase 5：IdeaWorkflow

- `.iwf` Schema。
- Workflow Editor。
- 基本命令接口。
- 暂不自动运行不受信任流程。

### Phase 6：AI Agent

- 右侧 Agent Panel。
- 文件类型 SDK Tools。
- Current File 与 Workspace Context。
- Change Review、Undo、权限和审计。

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

### 21.3 Tabs 导致内存增长

同时打开大量 Excalidraw 文件可能消耗较多内存。必须按需加载，并为非活动 Tab 的卸载或快照恢复预留能力。

### 21.4 两套模式产生分叉

如果 Workspace 和 Single File 分别实现 Reader、Writer 或 Editor，行为会快速不一致。必须通过 Document Session 和 Persistence Adapter 共享内核。

### 21.5 过早实现 Agent 抽象

在各编辑器行为尚未稳定时实现 Agent，会导致 SDK 反复重构。Agent 必须后置到 `.is`、`.md`、`.it`、`.iwf` 编辑器完成之后。

### 21.6 `.is v1/v2` 冲突

当前 `.is v2` 曾表示旧 Workspace，而新 Writer 只写 v1。读取时必须先检查版本，v2 必须阻止覆盖并留待未来迁移。

## 22. 当前 MVP 的实施默认

以下决定作为当前主线计划的实施基线；后续可以通过新的 PRD 或 Feature Request 调整：

1. 用户可见产品名称改为 `IdeaNote`；当前 MVP 不迁移仓库名、Cargo/npm package name、Bundle ID 或用户数据目录，避免把产品重构与安装迁移混在一起。
2. `.ideanote/workspace.json` 使用 `schemaVersion: 1`，保存稳定的 `workspaceId`、创建/更新时间和 Workspace 级设置；`.ideanote/state.json` 使用 `schemaVersion: 1`，保存相对路径形式的 Tabs、Active Tab 和 Explorer 状态。
3. 第一版使用单个 `state.json`，并由 `.ideanote/.gitignore` 忽略 `state.json`、`recovery/` 和 `cache/`；不修改 Workspace 根目录的 `.gitignore`。
4. Workspace Mode 同时提供显式 Save 和防抖自动保存；Single File Mode 默认只显式保存，并使用 Recovery Draft 防止意外丢失。
5. 新建 IdeaSketch 默认名为 `Untitled.is`，冲突时使用递增后缀，并立即进入内联重命名。
6. 单击受支持文件即打开或激活唯一 Tab；目录单击只选择，展开/收起由目录箭头和键盘操作负责。
7. 只挂载当前活动 Editor；非活动 Tab 保留轻量 Document Session 和 Dirty Model，文件内容按需加载，并为后续内存压力卸载策略保留边界。
8. 默认不跟随 Symlink；Symlink 作为不可递归的特殊条目显示，不能借此越过 Workspace Root。
9. Delete 默认移动到系统 Trash；不能安全移动到 Trash 时不执行永久删除，并显示错误。
10. `.is` 覆盖不生成 `.is.bak`；只使用同目录临时文件和原子替换，失败时保留原文件并清理临时文件。
11. `.is v2` 自动迁移延后到 Workspace Import/Export 阶段；当前版本只识别、说明并阻止覆盖。
12. Markdown、IdeaTable 和 IdeaWorkflow 在各自启动前分别编写和批准详细 PRD；本阶段只保留注册表和 Editor Host 扩展边界。
13. 文件类型扩展采用前后端对称模块化：IdeaSketch 前端模块与 Rust 后端格式模块只通过稳定注册表和通用命令边界接入。

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
