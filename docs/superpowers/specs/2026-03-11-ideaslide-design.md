# ideaSlide 设计文档

**日期：** 2026-03-11
**版本：** 1.0
**状态：** 设计阶段

## 概述

ideaSlide 是一个桌面端演示文稿应用，类似微软幻灯片，使用 Tauri v2 + Rust 开发，前端使用 Excalidraw 实现手绘风格的 slide 画布。核心特性是快速想法记录和 MCP 服务器支持，让大模型能够自动绘制图表。

## 目标用户与使用场景

**主要用户：** 个人用户 - 快速记录想法、做简单演示，强调轻量和速度
**次要场景：** 协作团队 - 多人共同编辑（后续迭代）

## 技术架构

### 技术栈

- **前端：** React 18 + TypeScript + Excalidraw v0.17+ (最新稳定版) + Tailwind CSS
- **后端：** Tauri v2 + Rust
- **渲染：** Excalidraw 的 rough.js（手绘风格）
- **MCP：** 内嵌 Rust 模块，支持连接外部服务器

### 架构方案

采用**轻量集成方案**：

- 前端使用 `@excalidraw/excalidraw` npm 包，复用其渲染引擎和数据格式
- 自定义工具栏覆盖 Excalidraw 默认 UI
- Rust 后端专注文件 I/O 操作
- 前端负责 PDF 导出和缩略图生成

**选择理由：**
- 快速验证产品价值（核心创新是"快速想法记录 + MCP 大模型绘图"）
- Excalidraw 数据格式对大模型友好
- rough.js 手绘风格成熟稳定
- 后续可扩展，逐步替换组件

### 核心模块

#### 1. 前端层（React）

- **启动界面：** 最近文件列表（文件名 + 修改时间）
- **主界面：** 工具栏 + 左侧预览区（可调节宽度，默认 200px）+ 右侧编辑区
- **Excalidraw 集成：** 使用 `@excalidraw/excalidraw`，通过 `UIOptions` prop 隐藏默认工具栏，使用 `renderTopRightUI` 和 `renderCustomStats` 渲染自定义工具栏
- **PDF 导出：** 使用 Excalidraw 的 `exportToBlob` API 导出每个 slide 为图片，再用 `jsPDF` 合并为 PDF
- **缩略图生成：** 使用 Excalidraw 的 `exportToCanvas` API 生成 canvas，转为 PNG（200x150px，质量 80%）

#### 2. Rust 后端层（Tauri）

- **文件管理：** 读写 .is 文件（zip 格式）、自动保存
- **数据处理：** 解压/压缩 zip、JSON 序列化
- **MCP 集成：** `ideaslide-mcp` crate 作为独立模块，通过 Tauri 命令接口调用
- **关键库：**
  - `tauri` v2 - 应用框架
  - `zip` - zip 文件操作
  - `serde_json` - JSON 序列化
  - `tokio` - 异步运行时

#### 3. MCP 服务器层

- **基础绘图 API：** 创建矩形、圆形、线条、文本、箭头等元素
- **高级语义 API：** 生成流程图、思维导图、架构图
- **部署模式：** 默认内嵌，可选外部连接（通过配置文件切换）

## 文件格式

### .is 文件结构

.is 文件是 zip 压缩包，内部结构如下：

```
example.is (zip 文件)
├── manifest.json          # 元数据
├── slides/
│   ├── slide-1.json      # Excalidraw 格式
│   ├── slide-2.json
│   └── slide-3.json
├── media/                 # 用户插入的图片
│   ├── image-abc123.png
│   └── image-def456.jpg
└── thumbnails/            # 预览缩略图
    ├── slide-1.png
    ├── slide-2.png
    └── slide-3.png
```

### manifest.json 结构

```json
{
  "version": "1.0",
  "created": "2026-03-11T12:00:00Z",
  "modified": "2026-03-11T12:30:00Z",
  "slides": [
    {"id": "slide-1", "title": "Untitled 1"},
    {"id": "slide-2", "title": "Untitled 2"}
  ]
}
```

### 缩略图策略

**混合策略：**
- 编辑时：内存缓存预览图，实时更新左侧预览区
- 保存时：将缓存的预览图写入 `thumbnails/` 目录
- 平衡性能和体验

## 数据流

### 打开文件
1. Rust 解压 .is 文件
2. 读取 manifest.json
3. 加载 slides/*.json
4. 前端渲染 Excalidraw 画布

### 编辑流程
1. 用户编辑 → Excalidraw 更新内存状态
2. 触发自动保存（防抖 2-3 秒）
3. 前端发送当前 slide JSON → Rust 调用 `save_file` 命令
4. Rust 重新创建整个 zip 文件（读取现有内容 → 更新指定 slide → 重新压缩 → 原子性替换原文件）
5. 后台生成缩略图（内存缓存 + 保存时写入）

### 导出 PDF
1. 前端遍历所有 slides
2. 使用 `jsPDF` 或 `@react-pdf/renderer` 渲染每个 canvas
3. 合并为 PDF 文件
4. 保存到用户指定位置

## UI 设计

### 启动界面

- **最近文件列表：** 文件名 + 最后修改时间（极简）
- **新建按钮：** 创建空白演示文稿
- **打开按钮：** 浏览文件系统选择 .is 文件

### 主界面布局

#### 顶部工具栏

- **左侧：** 文件操作（新建 slide、删除 slide、保存、导出 PDF）
- **中间：** 绘图工具（矩形、圆形、线条、文本、箭头）
- **右侧：** 编辑操作（撤销、重做）+ 样式设置（颜色、粗细、字体）

#### 左侧预览区

- 可调节宽度（拖动边界），默认 200px
- 垂直滚动的缩略图列表
- 当前 slide 高亮显示
- 点击切换 slide

#### 右侧编辑区

- Excalidraw 画布（全屏）
- 自定义工具栏覆盖 Excalidraw 默认 UI
- 支持所有 Excalidraw 快捷键

### 自动保存机制

- 编辑后 2-3 秒触发保存（防抖）
- 保存时显示状态指示器（"已保存" / "保存中..."），位于工具栏右上角
- 缩略图：编辑时内存缓存，保存时写入 thumbnails/
- 关闭应用时：如果有未保存的更改正在保存，显示模态对话框阻止关闭，直到保存完成或失败

## MCP 服务器设计

### 工具集（混合模式）

#### 基础绘图 API

- `create_rectangle(x, y, width, height, style)` - 创建矩形
- `create_ellipse(x, y, width, height, style)` - 创建圆形
- `create_line(points, style)` - 创建线条/折线
- `create_arrow(startX, startY, endX, endY, style)` - 创建箭头
- `create_text(x, y, text, style)` - 创建文本
- `update_element(id, properties)` - 修改元素属性
- `delete_element(id)` - 删除元素

#### 高级语义 API

- `create_flowchart(nodes, edges, layout)` - 生成流程图（自动布局）
- `create_mindmap(root, children, style)` - 生成思维导图
- `create_sequence_diagram(actors, messages)` - 生成时序图
- `create_architecture_diagram(components, connections)` - 生成架构图

### 部署模式

- **内嵌模式（默认）：** MCP 作为独立 Rust crate（`ideaslide-mcp`），编译进主应用，通过 Tauri 命令调用
- **外部模式：** MCP 作为独立进程，通过 stdio 或 HTTP 通信

**配置文件：** `~/.ideaslide/config.json`

```json
{
  "mcp": {
    "mode": "embedded",  // "embedded" | "external"
    "external_url": "http://localhost:3000"  // 仅在 external 模式使用
  }
}
```

### 数据交互

**内嵌模式流程：**
1. 大模型通过 MCP 协议调用工具（如 `create_rectangle`）
2. Tauri 命令 `mcp_execute(tool_name, params)` 调用 `ideaslide-mcp` crate
3. MCP crate 生成 Excalidraw JSON 元素
4. 通过 Tauri 事件 `mcp:element_created` 推送到前端
5. 前端接收事件，更新 Excalidraw 状态

**外部模式流程：**
1. 大模型调用外部 MCP 服务器
2. 前端通过 WebSocket 或轮询接收更新
3. 更新 Excalidraw 状态

**增量更新：** 大模型可以通过 `update_element(id, properties)` 修改现有元素，不必重新生成整个 slide

## 前后端通信

### 命令模式（文件操作）

- `open_file(path)` - 打开 .is 文件，返回解压后的数据
- `save_file(path, manifest, slides)` - 保存 .is 文件，Rust 负责 zip 压缩和写入
- `save_thumbnail(slide_id, png_data)` - 保存单个缩略图到 zip
- `create_file(path)` - 创建新的空白 .is 文件
- `write_file(path, data)` - 通用文件写入（用于 PDF 导出等）
- `mcp_execute(tool_name, params)` - 执行 MCP 工具（内嵌模式）

### 事件模式（实时功能）

- `file:save_started` - 开始保存文件
- `file:save_completed` - 保存完成
- `file:save_failed` - 保存失败（附带错误信息）
- `mcp:element_created` - MCP 创建了新元素（内嵌模式）
- `mcp:element_updated` - MCP 更新了元素（内嵌模式）
- `mcp:error` - MCP 执行错误

## 错误处理

- **文件损坏：** 尝试恢复 manifest.json，失败则提示用户
- **自动保存失败：** 重试 3 次，失败后提示用户手动保存
- **MCP 调用超时：** 5 秒超时，返回错误信息给大模型
- **备份机制：** 每次成功保存时创建 .is.bak 文件（覆盖上一次备份），保留最近一次备份，应用退出时清理超过 7 天的备份文件

## 性能优化

- **缩略图懒加载：** 预览区只渲染可见区域的缩略图
- **缩略图规格：** 200x150px PNG，质量 80%，确保文件大小和清晰度平衡
- **大文件处理：** 超过 100 个 slides 时，分页加载（每页 20 个），避免一次性加载所有缩略图导致内存占用过高
- **自动保存防抖：** 避免频繁写入磁盘
- **前端导出：** PDF 和缩略图生成在前端完成，减少前后端数据传输

## 快捷键

**应用级快捷键：**
- `Cmd/Ctrl + N` - 新建 slide
- `Cmd/Ctrl + S` - 手动保存（触发立即保存）
- `Cmd/Ctrl + E` - 导出 PDF
- `Cmd/Ctrl + Delete` - 删除当前 slide
- `Cmd/Ctrl + ↑/↓` - 切换上一个/下一个 slide
- `Cmd/Ctrl + [/]` - 调整预览区宽度

**编辑器快捷键：**
- 继承所有 Excalidraw 默认快捷键（选择、绘制、撤销/重做等）

## 开发阶段

### 第一阶段（MVP）

- 基础文件操作：新建、打开、自动保存 .is 文件
- 主界面：工具栏 + 预览区 + Excalidraw 编辑区
- Slide 管理：新建、删除、切换 slide
- 启动界面：最近文件列表

### 第二阶段

- PDF 导出功能
- 缩略图生成与显示
- 预览区可调节宽度
- 样式设置面板（颜色、粗细、字体）

### 第三阶段

- MCP 服务器（基础绘图 API）
- MCP 高级语义 API
- MCP 外部连接模式

### 第四阶段（后续迭代）

- 更多导出格式（PNG、SVG）
- 模板库
- 协作功能探索

## 技术风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| Excalidraw 定制难度 | 先用默认 UI 验证，再逐步定制 |
| Zip 文件损坏 | 实现备份机制（保存时创建 .is.bak） |
| MCP 性能问题 | 大模型生成复杂图表时添加进度提示 |
| 前端 PDF 导出质量 | 使用成熟库（jsPDF），测试多种场景 |

## 设计原则

1. **YAGNI（You Aren't Gonna Need It）：** 只实现当前需要的功能，避免过度设计
2. **快速验证：** 第一版专注核心价值（快速想法记录 + MCP 绘图）
3. **渐进增强：** 从 MVP 开始，根据用户反馈迭代
4. **保持简单：** 文件格式、数据流、UI 交互都追求简洁明了
