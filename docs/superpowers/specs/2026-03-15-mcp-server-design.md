# IdeaSlide MCP Server 设计文档

## 概述

为 IdeaSlide 添加 MCP (Model Context Protocol) Server 功能，使外部 AI 客户端（Claude Code、Cursor 等）能够通过标准 MCP 协议创建、编辑 IdeaSlide 演示文稿。

目标 MCP 协议版本：2024-11-05。Server 仅广播 `tools` capability，不提供 `resources` 或 `prompts`。

## 设计决策

### 角色定位
IdeaSlide 作为 MCP Server，暴露工具给外部 AI 客户端调用。

### 运行模式
仅 Tauri 嵌入模式。MCP Server 运行在 IdeaSlide 应用进程内，通过 stdio transport 与 AI 客户端通信。应用通过 `--mcp` 启动参数进入 MCP 服务模式。

`--mcp` 模式下，Tauri 仍创建一个隐藏的 webview 窗口（`visible: false`），用于加载 React 应用和 Excalidraw 渲染引擎。前端通过 `mcp-renderer-ready` 事件通知后端渲染器就绪，preview tools 在收到就绪信号前返回 `RenderNotReady` 错误。

### 状态模型
无状态。每次 Tool 调用独立执行：从磁盘读取 .is 文件 → 操作 → 原子写回。不维护内存中的 session 状态。每次写操作立即持久化，无需显式 save。

### 并发控制
使用 per-file `Arc<Mutex<()>>`（按规范化路径索引）序列化同一 `.is` 文件的读-改-写操作，防止并发调用导致数据竞争。

### 异步与阻塞 I/O
所有文件 I/O 操作（zip 读写）通过 `tokio::task::spawn_blocking()` 执行，避免阻塞 async runtime。Tauri v2 内部使用 tokio，MCP server 复用 Tauri 的 tokio runtime，不创建独立 runtime。`rmcp` 的 stdio server loop 在 `tauri::async_runtime::spawn` 中启动。

### Excalidraw 内容策略
MCP Server 不提供元素级 CRUD 操作。LLM 直接生成/修改完整的 Excalidraw JSON，MCP 只负责文件和 slide 级别的读写。理由：
1. 主流 LLM 能理解并生成合法的 Excalidraw JSON 格式
2. 大幅简化 MCP Server 复杂度
3. LLM 不受预定义 tools 限制，灵活度更高
4. Excalidraw 版本升级不影响 MCP Server

为弥补 LLM 无法"看到"渲染结果的缺陷，提供 preview tools 返回渲染截图，形成"生成 → 预览 → 修正"闭环。

### 扩展机制
基于 `rmcp` 的 `#[tool]` 宏和 `ServerHandler` trait。Tool 按模块组织（file/slide/preview），新增 Tool 只需在对应模块添加 `#[tool]` 方法并在 `ServerHandler` 的 `tool_list` 和 `call_tool` 中注册。编译时静态注册，不支持运行时动态加载。

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
│  │    rmcp ServerHandler              │  │
│  │    #[tool] 方法路由                │  │
│  └──────────────┬─────────────────────┘  │
│                 │                         │
│  ┌──────────────▼─────────────────────┐  │
│  │    Tool Modules                    │  │
│  │  file_tools | slide_tools          │  │
│  │  preview_tools | (扩展...)         │  │
│  └──────────────┬─────────────────────┘  │
│                 │                         │
│  ┌──────────────▼─────────────────────┐  │
│  │         Core Services              │  │
│  │  FileService    (file_format.rs)   │  │
│  │  SlideService   (slide 增删改查)   │  │
│  │  FileLock       (per-file mutex)   │  │
│  └──────────────┬─────────────────────┘  │
│                 │                         │
│  ┌──────────────▼─────────────────────┐  │
│  │  Preview Renderer (隐藏 webview)   │  │
│  │  Excalidraw exportToBlob() → PNG   │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

## Tool 清单

### File Tools（3 个）

| Tool | 描述 | 参数 | 返回 |
|------|------|------|------|
| `create_presentation` | 新建 .is 文件。如果目标路径已存在则返回错误。 | `path: String` | manifest 元数据 |
| `open_presentation` | 打开 .is 文件 | `path: String` | manifest + slide 列表 |
| `get_presentation_info` | 获取元数据 | `path: String` | manifest 信息 |

注：无 `save_presentation`。无状态模型下，每次写操作（`add_slide`、`set_slide_content` 等）立即持久化，无需显式 save。

### Slide Tools（6 个）

| Tool | 描述 | 参数 | 返回 |
|------|------|------|------|
| `list_slides` | 列出所有 slide | `path` | id + title 列表（title 来自 manifest） |
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

共 11 个 tools。

## rmcp 集成

### ServerHandler 实现

使用 `rmcp` 的 `#[tool]` 宏定义 tools，而非自建 registry：

```rust
use rmcp::{ServerHandler, model::*, tool};

#[derive(Clone)]
pub struct IdeaSlideServer {
    file_service: Arc<FileService>,
    slide_service: Arc<SlideService>,
    app_handle: tauri::AppHandle,
}

#[tool(tool_box)]
impl IdeaSlideServer {
    #[tool(description = "Create a new .is presentation file. Errors if file already exists.")]
    async fn create_presentation(&self, #[tool(param)] path: String) -> Result<CallToolResult, McpError> {
        let file_service = self.file_service.clone();
        let result = tokio::task::spawn_blocking(move || {
            file_service.create(Path::new(&path))
        }).await??;
        Ok(CallToolResult::success(serde_json::to_string(&result)?))
    }

    #[tool(description = "Get the full Excalidraw JSON content of a slide")]
    async fn get_slide_content(
        &self,
        #[tool(param)] path: String,
        #[tool(param)] slide_id: String,
    ) -> Result<CallToolResult, McpError> {
        // ...
    }

    // ... 其他 tools 同理
}

#[tool(tool_box)]
impl ServerHandler for IdeaSlideServer {
    fn name(&self) -> String { "idea-slide".into() }
    fn version(&self) -> String { env!("CARGO_PKG_VERSION").into() }
}
```

### 扩展方式

新增 Tool 的步骤：
1. 在 `IdeaSlideServer` 上添加新的 `#[tool]` 方法
2. 如果需要新的 Service，在 `IdeaSlideServer` 中添加字段
3. 编译即完成注册

模块化组织：将 `#[tool]` 方法按功能拆分到不同文件，通过 `impl` 块分散定义：

```rust
// tools/file_tools.rs
#[tool(tool_box)]
impl IdeaSlideServer {
    #[tool(description = "...")]
    async fn create_presentation(&self, ...) { ... }
    // ...
}

// tools/slide_tools.rs
#[tool(tool_box)]
impl IdeaSlideServer {
    #[tool(description = "...")]
    async fn add_slide(&self, ...) { ... }
    // ...
}
```

## Core Services

### FileService

封装 `file_format.rs`，提供高阶操作。所有方法为同步（在 `spawn_blocking` 中调用）：

```rust
pub struct FileService {
    locks: Mutex<HashMap<PathBuf, Arc<Mutex<()>>>>,
}

impl FileService {
    /// 创建新 .is 文件。如果文件已存在则返回错误。
    pub fn create(&self, path: &Path) -> Result<IsFileData, ToolError>;
    /// 读取 .is 文件
    pub fn read(&self, path: &Path) -> Result<IsFileData, ToolError>;
    /// 写入 .is 文件（原子操作）
    pub fn write(&self, path: &Path, data: &IsFileData) -> Result<(), ToolError>;
    /// 获取 per-file 锁 → 读取 → 应用修改闭包 → 原子写回
    pub fn read_and_modify<F>(&self, path: &Path, f: F) -> Result<(), ToolError>
    where F: FnOnce(&mut IsFileData) -> Result<(), ToolError>;
}
```

`read_and_modify` 内部流程：
1. 获取该路径的 `Arc<Mutex<()>>` 锁
2. 锁定
3. `read_is_file(path)`
4. 调用闭包 `f(&mut data)`
5. `write_is_file(path, &data)`（原子写入：.tmp + rename）
6. 释放锁

### SlideService

操作 `IsFileData` 中的 slides（纯数据操作，无 I/O）：

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

### 隐藏 Webview

`--mcp` 模式下，Tauri 创建一个 `visible: false` 的窗口，加载 React 应用。前端初始化完成后发送 `mcp-renderer-ready` 事件。后端维护一个 `ready: AtomicBool` 标志，preview tools 在 ready 前返回 `RenderNotReady` 错误。

### 渲染流程

```
MCP tool: preview_slide(path, slide_id)
  → Rust: 检查 renderer ready 状态
  → Rust: 读取 slide content JSON
  → Rust: 通过 Tauri event 发送渲染请求到前端
  → 前端: 加载 Excalidraw JSON，调用 exportToBlob()
  → 前端: 通过 Tauri invoke 将 PNG bytes 传回 Rust
  → Rust: 写入临时目录文件
  → Rust: 返回文件路径给 MCP client
```

### 临时文件管理

Preview 图片写入 `$TMPDIR/idea-slide-mcp/` 目录。每次 preview 调用前清理该 slide 的旧预览文件。MCP server 关闭时清理整个临时目录。

### 前端渲染模块

`src/lib/mcpRenderer.ts`：
- 监听 Tauri `mcp-render-request` 事件
- 使用 Excalidraw 的 `exportToBlob()` API 渲染为 PNG
- 通过 Tauri invoke 将 PNG bytes 返回后端
- 初始化完成后发送 `mcp-renderer-ready` 事件

## 错误处理

```rust
pub enum ToolError {
    FileNotFound(String),
    FileAlreadyExists(String),
    SlideNotFound(String),
    InvalidContent(String),     // Excalidraw JSON 格式不合法
    InvalidFile(String),        // .is 文件损坏（zip 解析失败等）
    IoError(String),
    PermissionDenied(String),
    RenderTimeout,              // 前端渲染超时
    RenderNotReady,             // 渲染器尚未就绪
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
                // 创建隐藏窗口用于 Excalidraw 渲染
                let _window = tauri::WebviewWindowBuilder::new(
                    app, "mcp-renderer", tauri::WebviewUrl::App("index.html".into())
                )
                .visible(false)
                .build()?;

                // 在 Tauri 的 tokio runtime 上启动 MCP server
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    mcp::start_server(handle).await;
                });
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
│   ├── mod.rs              # MCP server 启动、IdeaSlideServer 定义
│   ├── services/
│   │   ├── mod.rs
│   │   ├── file_service.rs # FileService（封装 file_format.rs + per-file lock）
│   │   └── slide_service.rs
│   └── tools/
│       ├── mod.rs
│       ├── file_tools.rs   # #[tool] impl: create/open/info
│       ├── slide_tools.rs  # #[tool] impl: list/add/delete/get/set/reorder
│       └── preview_tools.rs # #[tool] impl: preview_slide/preview_presentation
```

### 前端新增

```
src/lib/
└── mcpRenderer.ts          # 渲染请求处理 + ready 信号
```

### 新增依赖

Cargo.toml:
```toml
rmcp = { version = "0.17", features = ["server", "transport-io"] }
```

注：不需要单独添加 `tokio`，Tauri v2 已内置 tokio runtime。

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
