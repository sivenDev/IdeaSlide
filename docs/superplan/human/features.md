# Features

> 功能需求清单（人工维护）。每条需求一个 `## ` 小节，编号 `F001`、`F002` … 顺序递增、不复用。
>
> 录入方式（二选一）：
> - 对 AI 说“新建 feature: <标题>”，由 `$feature-plan-and-delivery` 的 intake 自动追加并编号；
> - 或手动复制下方模板，自行填下一个编号。
>
> 字段说明：
> - `status`：`proposed`(待人工复核) → `accepted`(已确认、可规划) → `done`(已交付)
> - `created`：创建日期，格式 `YYYY-MM-DD`
>
> 确认某条无误后，把它的 `status` 改为 `accepted`，再交给 skill 规划实现。

<!-- 新增条目模板（把 F<NNN> 替换为下一个编号，例如 F001）：

## F<NNN>: 简短标题

- status: proposed
- created: YYYY-MM-DD

可选详细描述：目标 / 范围 / 验收标准 / 非目标。
-->

## F001: Enable Excalidraw image export from the canvas menu

- status: done
- created: 2026-07-22

在画布左上角菜单中，恢复显示并允许使用 Excalidraw 原生的“导出图片”功能。

## F002: Evolve the editor into an extensible workspace explorer

- status: accepted
- created: 2026-07-22

Treat each `.is` file as an IdeaSlide workspace rather than a traditional slide deck. Replace the slide-centric organizer with a three-pane editor: a hierarchical Workspace explorer on the left, the selected resource editor in the center, and a compact Cameras list on the right. The first resource types are folders and Excalidraw canvases, while the resource model, persisted type identifier, content reference, selection boundary, and unsupported-type fallback must allow more file types to be added later without redesigning the tree. Users can create folders and canvases, select and inline-rename them, reorder or move them through the hierarchy, and safely delete them. Cameras belong to the selected canvas. Both side panels collapse independently from divider markers. Do not render slide or camera thumbnails in this delivery. Legacy flat-slide `.is` files open as root-level canvases in their original order; the workspace tree, active canvas identity, canvas content, and camera order survive save and reopen. Non-canvas editors, arbitrary linked local files, tabs, thumbnail generation, camera naming, and a presentation-mode redesign are out of scope.
