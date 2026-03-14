# IdeaSlide

IdeaSlide 是一个基于 Tauri v2 + React + Excalidraw 的桌面幻灯片编辑器。

- 画布编辑：使用 Excalidraw 进行自由绘制与排版
- 幻灯片管理：新增/删除/切换幻灯片、左侧缩略图预览
- 演示模式：预览与全屏放映
- 本地文件格式：使用 `.is`（zip 包）保存工程
- 图片持久化：支持 Excalidraw 图片随 `.is` 一起保存与重开恢复

## 技术栈

- Frontend: React 19 + TypeScript + Vite + Tailwind CSS v4
- Canvas: `@excalidraw/excalidraw`
- Desktop: Tauri v2
- Backend: Rust

## 目录结构

```text
src/                    # 前端代码
  components/           # UI 组件（编辑器、预览、工具栏等）
  hooks/                # 状态与业务 hooks
  lib/tauriCommands.ts  # 前后端数据转换与 Tauri invoke 封装
src-tauri/src/          # Rust 后端（文件读写、zip 格式、最近文件）
docs/                   # 设计与实现计划文档
scripts/                # 回归脚本（用于快速验证关键问题）
```

## 开发环境

- Node.js 18+
- Rust stable
- Tauri 依赖（按官方文档安装）

## 安装依赖

```bash
npm install
```

## 本地开发

```bash
# 仅前端
npm run dev

# Tauri 桌面开发模式
npm run tauri dev
```

## 构建

```bash
npm run build
```

## Rust 后端测试

```bash
cd src-tauri
cargo test
```

## `.is` 文件格式

`.is` 是一个 zip 包，主要包含：

```text
manifest.json      # 元信息（版本、时间戳、slide 索引）
slides/{id}.json   # 每页 Excalidraw 场景
media/             # 图片媒体文件与索引
thumbnails/        # 预留目录
```

## 关键行为说明

- 自动保存依赖 `isDirty` 与当前 `slides` 状态。
- 缩略图由 `useSlideThumbnails` 通过 `exportToSvg` 生成。
- 图片显示/持久化依赖 `files` 与 `elements[].fileId` 的正确关联。

## 回归验证脚本

用于快速验证近期修复（无需额外测试框架）：

```bash
node scripts/tauriCommands-media-regression.mjs
node scripts/slide-thumbnails-image-regression.mjs
```

## 常见问题

1. **保存后重开图片丢失**
   - 检查 `elements` 中图片元素是否包含 `fileId`
   - 检查 `slide.files` 是否包含对应文件对象（`id/mimeType/dataURL`）

2. **左侧缩略图不显示图片**
   - 确认缩略图导出时传入了 `slide.files`

## License

当前仓库未声明许可证；如需开源发布，请补充 `LICENSE` 文件。
