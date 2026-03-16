# Excalidraw MCP vs IdeaSlide MCP 实现对比

## 架构差异

### Excalidraw MCP (官方)
**定位**: 实时交互式绘图工具
- **技术栈**: TypeScript + Node.js + React + Vite
- **运行方式**: Node.js 进程，通过 stdio 通信
- **UI 模式**: MCP Apps 扩展 - 返回交互式 HTML 界面
- **存储**: 可选的 checkpoint store（内存或 Upstash Redis）
- **部署**: 支持本地和远程（Vercel）部署

### IdeaSlide MCP
**定位**: 演示文稿文件管理工具
- **技术栈**: Rust + Tauri v2 + React + Excalidraw
- **运行方式**: Tauri 原生应用，支持 headless 和 visible 模式
- **UI 模式**: 可选可视化窗口（--visible 参数）
- **存储**: .is 文件格式（zip 归档，包含 manifest + 多个幻灯片）
- **部署**: 本地桌面应用

## 功能对比

| 功能 | Excalidraw MCP | IdeaSlide MCP |
|------|----------------|---------------|
| **核心用途** | 单个图表的实时绘制 | 多幻灯片演示文稿管理 |
| **工具数量** | 5 个工具 | 11 个工具 |
| **文件格式** | 无持久化（或 checkpoint） | .is 文件（zip 归档） |
| **多页面支持** | ❌ 单图表 | ✅ 多幻灯片 |
| **实时编辑** | ✅ 全屏交互式编辑 | ✅ 可选可视化窗口 |
| **流式渲染** | ✅ 逐元素动画 | ❌ 静态渲染 |
| **导出分享** | ✅ excalidraw.com | ❌ 本地文件 |
| **预览生成** | ❌ | ✅ PNG 导出（base64/文件） |
| **幻灯片排序** | ❌ | ✅ reorder_slides |
| **演示模式** | ❌ | ✅ 内置演示模式 |

## 工具对比

### Excalidraw MCP 工具

1. **read_me** - 返回 Excalidraw 元素格式参考文档
   - 包含详细的颜色调色板、元素类型、最佳实践
   - 内置在服务器代码中的"cheat sheet"

2. **create_view** - 渲染手绘图表
   - 输入: JSON 数组字符串（Excalidraw 元素）
   - 输出: 交互式 HTML 界面（MCP App）
   - 特性: 流式动画、相机控制、全屏编辑

3. **export_to_excalidraw** - 上传到 excalidraw.com
   - 生成可分享的 URL
   - 使用 Excalidraw v2 二进制格式

4. **save_checkpoint** - 保存用户编辑状态
   - 仅从 UI 调用（visibility: ["app"]）
   - 支持迭代编辑

5. **read_checkpoint** - 读取 checkpoint 状态
   - 仅从 UI 调用
   - 用于恢复编辑

### IdeaSlide MCP 工具

1. **create_presentation** - 创建新 .is 文件
2. **open_presentation** - 打开现有演示文稿
3. **get_presentation_info** - 获取元数据
4. **list_slides** - 列出所有幻灯片
5. **add_slide** - 添加新幻灯片
6. **delete_slide** - 删除幻灯片
7. **reorder_slides** - 重新排序幻灯片
8. **get_slide_content** - 获取幻灯片内容
9. **set_slide_content** - 更新幻灯片内容
10. **preview_slide** - 渲染单个幻灯片为 PNG
11. **preview_presentation** - 渲染所有幻灯片为 PNG

## 技术实现差异

### 1. MCP 协议实现

**Excalidraw MCP**:
```typescript
// 使用 @modelcontextprotocol/sdk
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool, registerAppResource } from "@modelcontextprotocol/ext-apps/server";

// 注册工具
registerAppTool(server, "create_view", {
  inputSchema: z.object({ elements: z.string() }),
  _meta: { ui: { resourceUri } }
}, handler);
```

**IdeaSlide MCP**:
```rust
// 使用 rmcp (Rust MCP 库)
use rmcp::{tool, tool_handler, ServerHandler};

#[tool(
    name = "create_presentation",
    description = "Create a new .is presentation file."
)]
async fn create_presentation(&self, params: PathParam) -> Result<String, String> {
    // 实现
}
```

### 2. UI 渲染方式

**Excalidraw MCP**:
- **MCP Apps 扩展**: 返回交互式 HTML 资源
- **流式渲染**: 逐元素添加，带绘制动画
- **相机控制**: 支持平滑视口移动
- **全屏编辑**: 用户可以直接在界面中编辑
- **实时反馈**: 编辑后截图发回给 Claude

```typescript
// 返回 HTML 资源
return {
  content: [{
    type: "resource",
    resource: {
      uri: resourceUri,
      mimeType: RESOURCE_MIME_TYPE,
      text: htmlContent
    }
  }]
};
```

**IdeaSlide MCP**:
- **Tauri 窗口**: 原生桌面窗口
- **事件驱动**: Rust 后端 ↔ React 前端通信
- **Headless 渲染**: 隐藏的 webview 用于 PNG 生成
- **可选可视化**: --visible 参数显示主窗口

```rust
// 发送渲染请求到前端
app_handle.emit("mcp-render-request", &request)?;

// 等待前端响应
let response = tokio::time::timeout(RENDER_TIMEOUT, rx).await?;
```

### 3. 数据持久化

**Excalidraw MCP**:
- **无文件系统**: 默认不保存到磁盘
- **Checkpoint 机制**: 可选的状态保存
- **导出到云端**: excalidraw.com 分享

```typescript
interface CheckpointStore {
  save(id: string, data: any): Promise<void>;
  load(id: string): Promise<any | null>;
}
```

**IdeaSlide MCP**:
- **.is 文件格式**: Zip 归档
- **原子写入**: 先写 .tmp，再重命名
- **自动备份**: 覆盖前创建 .bak
- **结构化存储**: manifest.json + slides/*.json

```rust
// .is 文件结构
manifest.json          // 版本、时间戳、幻灯片索引
slides/{id}.json       // 每个幻灯片的 Excalidraw 数据
media/                 // 预留
thumbnails/            // 预留
```

### 4. 渲染引擎

**Excalidraw MCP**:
- **浏览器渲染**: 直接在 Claude Desktop 中显示
- **SVG 输出**: Excalidraw 原生 SVG
- **动画效果**: CSS 动画 + morphdom 增量更新

**IdeaSlide MCP**:
- **Excalidraw exportToBlob**: 使用官方导出 API
- **PNG 输出**: 位图格式
- **Base64 或文件**: 灵活的输出方式

```typescript
// IdeaSlide 前端渲染
const blob = await exportToBlob({
  elements: content.elements,
  appState: content.appState,
  files: content.files || {}
});
const arrayBuffer = await blob.arrayBuffer();
const pngBytes = Array.from(new Uint8Array(arrayBuffer));
```

## 设计理念差异

### Excalidraw MCP
**目标**: 让 AI 能够实时绘制和迭代图表
- 强调**交互性** - 用户可以在 Claude 中直接编辑
- 强调**流式体验** - 逐元素绘制，像人类画图一样
- 强调**分享** - 一键导出到 excalidraw.com
- **无状态** - 不依赖本地文件系统
- **单图表** - 专注于单个图表的质量

### IdeaSlide MCP
**目标**: 让 AI 能够管理完整的演示文稿
- 强调**文件管理** - CRUD 操作 .is 文件
- 强调**多页面** - 幻灯片的增删改查和排序
- 强调**预览** - PNG 导出用于验证
- **有状态** - 基于本地文件系统
- **演示文稿** - 专注于多幻灯片的组织

## 适用场景

### Excalidraw MCP 适合:
- ✅ 快速绘制单个图表（架构图、流程图、示意图）
- ✅ 需要实时迭代和编辑
- ✅ 需要分享给他人（excalidraw.com 链接）
- ✅ 在对话中逐步构建复杂图表
- ✅ 需要流畅的视觉体验

### IdeaSlide MCP 适合:
- ✅ 创建完整的演示文稿（多张幻灯片）
- ✅ 需要本地文件存储和版本控制
- ✅ 需要批量生成幻灯片
- ✅ 需要预览和导出 PNG
- ✅ 需要演示模式（全屏播放）
- ✅ 需要可视化窗口实时查看

## 技术亮点

### Excalidraw MCP
1. **MCP Apps 扩展** - 展示了 MCP 的高级能力（交互式 UI）
2. **流式渲染** - 优秀的用户体验设计
3. **Checkpoint 机制** - 支持迭代编辑
4. **详细的文档** - read_me 工具内置完整的使用指南
5. **远程部署** - 支持 Vercel 部署，无需本地安装

### IdeaSlide MCP
1. **Rust + Tauri** - 高性能原生应用
2. **双模式运行** - headless 和 visible 模式
3. **事件驱动架构** - Rust 后端与 React 前端解耦
4. **灵活的输出** - base64 或文件路径
5. **完整的文件格式** - 结构化的 .is 文件

## 可以互相借鉴的地方

### IdeaSlide 可以学习 Excalidraw MCP:
1. **流式渲染** - 在可视化窗口中逐元素绘制
2. **详细的文档工具** - 添加 get_help 工具返回使用指南
3. **相机控制** - 支持视口动画和缩放
4. **导出分享** - 支持上传到云端分享
5. **MCP Apps** - 考虑支持交互式 UI（如果 Tauri 支持）

### Excalidraw MCP 可以学习 IdeaSlide:
1. **多页面支持** - 支持多图表管理
2. **文件持久化** - 保存到本地文件系统
3. **批量操作** - 批量渲染、批量导出
4. **预览生成** - PNG 导出用于其他用途
5. **演示模式** - 全屏播放多个图表

## 总结

两个实现各有特色，服务于不同的使用场景：

- **Excalidraw MCP** 是一个**实时交互式绘图工具**，强调单图表的质量和用户体验
- **IdeaSlide MCP** 是一个**演示文稿管理系统**，强调多幻灯片的组织和文件管理

如果要选择：
- 需要快速画图、实时迭代 → **Excalidraw MCP**
- 需要创建演示文稿、管理多页面 → **IdeaSlide MCP**

两者可以共存，甚至可以互补使用！
