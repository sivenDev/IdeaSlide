# IdeaSlide

基于 [Excalidraw](https://excalidraw.com/) 的桌面幻灯片编辑器 — 用手绘画布来做演示文稿。

[English](./README.md)

## 功能特性

- **自由画布** — 使用 Excalidraw 的完整工具集进行绘制、书写与排版
- **幻灯片管理** — 新增、删除、切换幻灯片，左侧实时缩略图预览
- **图片支持** — 粘贴或拖拽图片到画布，随文件一起持久化保存
- **演示模式** — 预览与全屏放映，支持键盘导航
- **本地文件格式** — 项目以 `.is` 文件（zip 包）保存，便携且自包含
- **自动保存** — 修改自动写入磁盘
- **最近文件** — 快速访问最近打开的项目

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19、TypeScript、Vite 7、Tailwind CSS v4 |
| 画布 | @excalidraw/excalidraw 0.18 |
| 桌面 | Tauri v2 |
| 后端 | Rust |

## 快速开始

### 环境要求

- Node.js 18+
- Rust stable 工具链
- Tauri v2 依赖（[安装指南](https://v2.tauri.app/start/prerequisites/)）

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
# 仅前端（打开 http://localhost:1420）
npm run dev

# 完整桌面应用（Tauri + Vite）
npm run tauri dev
```

### 构建

```bash
# 前端生产构建
npm run build

# 桌面应用打包
npm run tauri build
```

### 测试

```bash
# Rust 后端测试
cd src-tauri && cargo test

# 前端回归验证
node scripts/tauriCommands-media-regression.mjs
node scripts/slide-thumbnails-image-regression.mjs
```

## 项目结构

```text
src/
  components/           # UI 组件（编辑器、预览面板、工具栏等）
  hooks/                # 状态管理与业务逻辑 hooks
  lib/tauriCommands.ts  # 前后端数据转换与 Tauri IPC 封装
src-tauri/
  src/
    commands.rs         # Tauri 命令处理
    file_format.rs      # .is zip 格式读写与媒体持久化
    recent_files.rs     # 最近文件追踪
    lib.rs              # Tauri 应用初始化与命令注册
```

## `.is` 文件格式

`.is` 文件是一个 zip 包，内部结构：

```text
manifest.json          # 版本号、时间戳、幻灯片索引
slides/{id}.json       # 每页 Excalidraw 场景数据
media/index.json       # 媒体文件注册表
media/{id}.{ext}       # 图片二进制文件
```

保存采用原子写入（先写 `.is.tmp`，再重命名）。每次覆盖前会创建 `.is.bak` 备份。

## 参与贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

[MIT](./LICENSE)
