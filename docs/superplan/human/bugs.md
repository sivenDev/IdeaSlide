# Bugs

> 缺陷清单（人工维护）。每条缺陷一个 `## ` 小节，编号 `B001`、`B002` … 顺序递增、不复用。
>
> 录入方式（二选一）：
> - 对 AI 说“新建 bug: <标题>”，由 `$bugfix-plan-and-delivery` 的 intake 自动追加并编号；
> - 或手动复制下方模板，自行填下一个编号。
>
> 字段说明：
> - `status`：`proposed`(待人工复核) → `accepted`(已确认、可规划) → `done`(已修复)
> - `created`：创建日期，格式 `YYYY-MM-DD`
>
> 建议在描述里写清：复现步骤 / 期望结果 / 实际结果 / 影响范围。确认无误后把 `status` 改为 `accepted`。

<!-- 新增条目模板（把 B<NNN> 替换为下一个编号，例如 B001）：

## B<NNN>: 简短标题

- status: proposed
- created: YYYY-MM-DD

复现步骤：
1. ...
期望：... ／ 实际：...
-->

## B001: Disable Excalidraw native save paths

- status: done
- created: 2026-07-01

复现步骤：
1. 在 IdeaSlide 编辑画布中触发 Excalidraw 原生保存入口，例如 `Cmd+Shift+S`。
2. 检查系统 Downloads 目录。

期望：所有保存触发都只走 IdeaSlide 的 `.is` 保存流程。／ 实际：Excalidraw 原生保存会下载 `Untitled-*.excalidraw` 文件到 Downloads。

## B002: Presentation exit leaves canvas visually corrupted until zoom

- status: done
- created: 2026-07-02

复现步骤：
1. 进入投屏/Present 模式。
2. 关闭投屏回到编辑器。
3. 观察编辑画布。

期望：退出投屏后编辑画布立即以正确 viewport/布局渲染。
实际：画布出现错位、残影或内容乱糟糟的视觉状态；手动缩放一下后恢复正常。

备注：截图显示 Excalidraw canvas 区域在退出投屏后渲染状态异常，缩放触发重绘后恢复，疑似 viewport/resize/scene refresh 时序问题。

## B003: GitHub release packaging selects the wrong package manager

- status: done
- created: 2026-07-22

复现步骤：
1. 推送版本标签触发 Release workflow。
2. 等待 Windows 与 macOS 构建进入 tauri-action。

期望：工作流沿用 npm ci 安装的依赖并执行 Tauri 打包。
实际：tauri-action 检测到 pnpm-lock.yaml 后改用 pnpm tauri build，三个平台的构建任务均失败。

证据：Release run 26559228461（v0.1.11）中 Windows 和两项 macOS build 均在 Tauri build 步骤失败；Windows annotation 为 Command pnpm [tauri,build,...] failed with exit code 1。

## B004: Opening the editor triggers a maximum update depth error

- status: done
- created: 2026-07-22

复现步骤：
1. 启动 IdeaSlide 并打开工作区进入编辑器。
2. 编辑器立即进入 ErrorBoundary。

期望：三栏编辑器正常显示并可操作。
实际：React 报 Maximum update depth exceeded，堆栈首先落在 Radix Tooltip 的组合 ref 更新。

## B005: Navigator button is outside the Excalidraw toolbar

- status: done
- created: 2026-08-04

The right-side Navigator toggle and Camera action are rendered in a separate top-right UI island next to the Excalidraw toolbar. Expected: remove that detached island, expose Navigator through Excalidraw's customizable left Main Menu, and keep Add camera only in the Cameras list header. The right divider remains a direct panel toggle.

## B006: Keep Page canvas and draft identity synchronized

- status: done
- created: 2026-08-04

After editing a newly created Page, switching Pages can leave Excalidraw showing the previous Page. Further edits can copy the stale scene into the selected Page, so subsequent saves persist cross-Page content. Expected: Page switching remounts Excalidraw only when the matching draft is ready, and edits/saves remain isolated to their owning Page.

## B007: Viewport changes incorrectly trigger document saving

- status: done
- created: 2026-08-04

In the .is editor, zooming or panning the Excalidraw canvas without changing document content marks the document dirty, triggers Workspace autosave, and can surface a file-conflict banner. Expected: viewport-only changes do not trigger document saving. Page selection should still be recorded as best-effort editor/session state without forcing a document save.

## B008: Workspace autosave self-write events cause false conflicts

- status: proposed
- created: 2026-08-04

Workspace autosave can emit multiple filesystem watcher events for one application-owned write while self-write suppression consumes only one event. A newly created or normally edited .is file can therefore enter File conflict even before any viewport interaction. Expected: all watcher events belonging to the completed application save operation are suppressed without hiding genuine external changes.
