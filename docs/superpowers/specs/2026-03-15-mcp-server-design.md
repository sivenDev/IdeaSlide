# IdeaSlide MCP Server 设计文档

## 概述

为 IdeaSlide 添加 MCP (Model Context Protocol) Server 功能，使外部 AI 客户端（Claude Code、Cursor 等）能够通过标准 MCP 协议创建、编辑 IdeaSlide 演示文稿。

## 设计决策

### 角色定位
IdeaSlide 作为 MCP Server，暴露工具给外部 AI 客户端调用。

### 运行模式
仅 Tauri 嵌入模式。MCP Server 运行在 IdeaSlide 应用进程内，通过 stdio transport 与 AI 客户端通信。应用通过 `--mcp` 启动参数进入 MCP 服务模式。

### 状态模型
无状态。每次 Tool 调用独立执行：从磁盘读取 .is 文件 → 操作 → 原子写回。不维护内存中的 session 状态。

### Excalidraw 内容策略
MCP Server 不提供元素级 CRUD 操作。LLM 直接生成/修改完整的 Excalidraw JSON，MCP 只负责文件和 slide 级别的读写。理由：
1. 主流 LLM 能理解并生成合法的 Excalidraw JSON 格式
2. 大幅简化 MCP Server 复杂度
3. LLM 不受预定义 tools 限制，灵活度更高
4. Excalidraw 版本升级不影响 MCP Server

为弥补 LLM 无法"看到"渲染结果的缺陷，提供 preview tools 返回渲染截图，形成"生成 → 预览 → 修正"闭环。

### 扩展机制
编译时 trait 插件注册。定义 `McpToolDef` trait 和 `ToolGroup` trait，新增 Tool 只需实现 trait 并在 builder 链中注册。不支持运行时动态加载。

## 架构

```
AI Client (Claude Code 等)
    │
    │ MCP Protocol (stdio / JSON-RPC)
    ▼
┌──────────────────────────────────────────┐
│            IdeaSlide (Tauri)              │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │         rmcp Server                │  │
│  │   协议解析、Tool 路由              │  │
│  └──────────────┬─────────────────────┘  │
│                 │                         │
│  ┌──────────────▼─────────────────────┐  │
│  │         ToolRegistry               │  │
│  │  FileToolGroup | SlideToolGroup    │  │
│  │  PreviewToolGroup | (扩展...)      │  │
│  └──────────────┬─────────────────────┘  │
│                 │                         │
│  ┌──────────────▼─────────────────────┐  │
│  │         Core Services              │  │
│  │  FileService    (file_format.rs)   │  │
│  │  SlideService   (slide 增删改查)   │  │
│  └──────────────┬─────────────────────┘  │
│                 │                         │
│  ┌──────────────▼─────────────────────┐  │
│  │     Preview Renderer (前端)        │  │
│  │  Excalidraw exportToBlob() → PNG   │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

## Tool 清单

### File Tools（4 个）

| Tool | 描述 | 参数 | 返回 |
|------|------|------|------|
| `create_presentation` | 新建 .is 文件 | `path: String` | manifest 元数据 |
| `open_presentation` | 打开 .is 文件 | `path: String` | manifest + slide 列表 |
| `save_presentation` | 保存当前修改 | `path: String` | 成功/失败 |
| `get_presentation_info` | 获取元数据 | `path: String` | manifest 信息 |

### Slide Tools（6 个）

| Tool | 描述 | 参数 | 返回 |
|------|------|------|------|
| `list_slides` | 列出所有 slide | `path` | id + 摘要列表 |
| `add_slide` | 新增 slide | `path, index?, content?` | 新 slide id |
| `delete_slide` | 删除 slide | `path, slide_id` | 成功/失败 |
| `get_slide_content` | 读取完整 Excalidraw JSON | `path, slide_id` | elements + appState + files |
| `set_slide_content` | 写入完整 Excalidraw JSON | `path, slide_id, content` | 成功/失败 |
| `reorder_slides` | 重排序 | `path, slide_ids: Vec<String>` | 成功/失败 |

### Preview Tools（2 个）

| Tool | 描述 | 参数 | 返回 |
|------|------|------|------|
| `preview_slide` | 渲染单个 slide 为 PNG | `path, slide_id` | 本地图片文件路径 |
| `preview_presentation` | 渲染所有 slide 缩略图 | `path` | 本地图片文件路径数组 |

共 12 个 tools。

## 插件系统

### 核心 Trait

```rust
/// 每个 Tool 实现此 trait
pub trait McpToolDef: Send + Sync {
    /// Tool 名称，如 "create_presentation"
    fn name(&self) -> &str;
    /// JSON Schema 描述参数
    fn schema(&self) -> serde_json::Value;
    /// Tool 描述（供 AI 理解用途）
    fn description(&self) -> &str;
    /// 执行 Tool
    async fn execute(
        &self,
        params: serde_json::Value,
        ctx: &ToolContext,
    ) -> Result<ToolResult, ToolError>;
}

/// Tool 运行时上下文
pub struct ToolContext {
    pub file_service: Arc<FileService>,
    pub slide_service: Arc<SlideService>,
    pub app_handle: tauri::AppHandle,  // 用于与前端通信（preview 渲染）
}

/// 一组相关 Tool 的集合
pub trait ToolGroup {
    fn tools(&self) -> Vec<Box<dyn McpToolDef>>;
}

/// Tool 注册表
pub struct ToolRegistry {
    tools: HashMap<String, Box<dyn McpToolDef>>,
}
```

### 注册方式

```rust
let server = McpServer::builder(app_handle)
    .register_group(FileToolGroup)
    .register_group(SlideToolGroup)
    .register_group(PreviewToolGroup)
    // 扩展：添加新 ToolGroup 实现即可
    // .register_group(ExportToolGroup)
    // .register_group(TemplateToolGroup)
    .build();
```

扩展步骤：
1. 创建新的 struct 实现 `ToolGroup` trait
2. 在 `ToolGroup::tools()` 中返回该组的所有 `McpToolDef` 实现
3. 在 builder 链中加一行 `.register_group(NewToolGroup)`

## Core Services

### FileService

封装 `file_format.rs`，提供高阶操作：

```rust
pub struct FileService;

impl FileService {
    /// 创建新 .is 文件
    pub fn create(&self, path: &Path) -> Result<IsFileData, ToolError>;
    /// 读取 .is 文件
    pub fn read(&self, path: &Path) -> Result<IsFileData, ToolError>;
    /// 写入 .is 文件（原子操作）
    pub fn write(&self, path: &Path, data: &IsFileData) -> Result<(), ToolError>;
    /// 读取 → 应用修改闭包 → 原子写回
    pub fn read_and_modify<F>(&self, path: &Path, f: F) -> Result<(), ToolError>
    where F: FnOnce(&mut IsFileData) -> Result<(), ToolError>;
}
```

### SlideService

操作 `IsFileData` 中的 slides：

```rust
pub struct SlideService;

impl SlideService {
    pub fn list(&self, data: &IsFileData) -> Vec<SlideInfo>;
    pub fn get_content(&self, data: &IsFileData, slide_id: &str) -> Result<serde_json::Value, ToolError>;
    pub fn set_content(&self, data: &mut IsFileData, slide_id: &str, content: serde_json::Value) -> Result<(), ToolError>;
    pub fn add(&self, data: &mut IsFileData, index: Option<usize>, content: Option<serde_json::Value>) -> Result<String, ToolError>;
    pub fn delete(&self, data: &mut IsFileData, slide_id: &str) -> Result<(), ToolError>;
    pub fn reorder(&self, data: &mut IsFileData, slide_ids: &[String]) -> Result<(), ToolError>;
}
```

## Preview 渲染

### 流程

```
MCP tool: preview_slide(path, slide_id)
  → Rust: 读取 slide content JSON
  → Rust: 通过 Tauri event 发送渲染请求到前端
  → 前端: 加载 Excalidraw JSON，调用 exportToBlob()
  → 前端: 写入临时文件 /tmp/idea-slide-preview-{slide_id}.png
  → 前端: 通过 Tauri event 返回文件路径
  → Rust: 返回文件路径给 MCP client
```

### 前端渲染模块

`src/lib/mcpRenderer.ts`：
- 监听 Tauri `mcp-render-request` 事件
- 使用 Excalidraw 的 `exportToBlob()` API 渲染为 PNG
- 写入临时文件，通过 `mcp-render-response` 事件返回路径

## 错误处理

```rust
pub enum ToolError {
    FileNotFound(String),
    SlideNotFound(String),
    InvalidContent(String),   // Excalidraw JSON 格式不合法
    IoError(String),
    RenderTimeout,            // 前端渲染超时
}
```

所有 `ToolError` 映射为 MCP 标准错误响应（`isError: true`），附带人类可读的错误描述，LLM 可据此自行修正。

## MCP Server 启动

### Tauri 集成

```rust
// src-tauri/src/lib.rs
fn main() {
    tauri::Builder::default()
        .setup(|app| {
            if std::env::args().any(|a| a == "--mcp") {
                mcp::start_server(app.handle().clone());
            }
            Ok(())
        })
        .invoke_handler(/* 现有 commands */)
        .run(tauri::generate_context!())
}
```

### AI 客户端配置

```json
{
  "idea-slide": {
    "command": "/path/to/idea-slide",
    "args": ["--mcp"],
    "transport": "stdio"
  }
}
```

## 项目结构

### Rust 后端新增

```
src-tauri/src/
├── mcp/
│   ├── mod.rs              # MCP server 启动、rmcp 集成
│   ├── registry.rs         # ToolRegistry + McpToolDef trait
│   ├── context.rs          # ToolContext
│   ├── services/
│   │   ├── mod.rs
│   │   ├── file_service.rs
│   │   └── slide_service.rs
│   └── tools/
│       ├── mod.rs
│       ├── file_tools.rs
│       ├── slide_tools.rs
│       └── preview_tools.rs
```

### 前端新增

```
src/lib/
└── mcpRenderer.ts          # 渲染请求处理
```

### 新增依赖

Cargo.toml:
```toml
rmcp = { version = "0.17", features = ["server", "transport-io"] }
tokio = { version = "1", features = ["full"] }
```

## LLM 工作流示例

典型的 AI 辅助创建演示文稿流程：

```
1. create_presentation("/path/to/demo.is")
2. get_slide_content(path, slide_id)        → 获取空白 slide JSON
3. LLM 生成 Excalidraw JSON（标题页）
4. set_slide_content(path, slide_id, json)  → 写入
5. preview_slide(path, slide_id)            → 获取截图路径
6. LLM 查看截图，发现文字位置偏移          → 修正 JSON
7. set_slide_content(path, slide_id, json)  → 写入修正版
8. preview_slide(path, slide_id)            → 确认效果
9. add_slide(path)                          → 新增第二页
10. 重复 3-8 流程
```
