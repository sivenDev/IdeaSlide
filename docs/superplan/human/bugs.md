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

- status: done
- created: 2026-08-04

In a Workspace containing two `.is` files, saving the active file reliably enters `File conflict`; the notice says the file disappeared and then reappeared while unsaved edits existed. Workspace autosave can emit multiple filesystem watcher events for one application-owned atomic replacement while self-write suppression consumes only one event. Expected: every event belonging to the completed application save operation is suppressed as one operation, while genuine external changes remain visible.

## B009: Keep F012 drag targets active through drop

- status: done
- created: 2026-08-04

In the shipped F012 Workspace, Page, and Camera drag interactions, WebKit emits a dragleave with relatedTarget null immediately before drop. Each row clears its React drop-target state during that dragleave, so Workspace drops are discarded entirely and Page/Camera drops can fall back to the wrong placement or become no-ops. Preserve the active target through the actual drop/end boundary, derive placement reliably at drop time, and add a real WebKit behavior regression covering upward/downward reorder and Workspace movement.

## B010: Limit Workspace dragging to cross-directory moves

- status: done
- created: 2026-08-04

Dragging a Workspace file over the before, after, or inside drop zones visually compresses and distorts the entire row. Simplify Workspace behavior to standard file-explorer semantics: files and folders may move only into a different directory or back to the Workspace root, while same-directory manual ordering is removed and siblings use deterministic folder-first/name ordering. Preserve the row's normal dimensions throughout pointer dragging. Page and Camera drag sorting remain unchanged.

## B011: Handle Unsaved Untitled Files on Home and Window Close

- status: done
- created: 2026-08-04

When an untitled IdeaSketch document has unsaved changes, clicking Home prompts to save but then reports “Some files could not be saved: Untitled.is”. Clicking the native window close button provides no visible prompt or feedback. Saving should route an untitled document through Save As, then continue Home/close only after a successful save; cancelling or failing the save should keep the editor/window open with clear feedback.

## B012: Save the Active Dirty Document Before Switching Files

- status: done
- created: 2026-08-04

When the active IdeaSketch file has unsaved edits, opening another Workspace file or creating a new file must automatically save that active file first. Continue the switch/create only after the direct save succeeds; a cancelled Save As or save failure must keep the current file active and must not create the requested file. Remove Save All semantics from shortcuts, navigation, and exit coordination; any legacy multiple-dirty session must be resolved one file at a time rather than through a bulk Save All operation.

## B013: Keep Workspace Selection on the Active File When Switching Is Blocked

- status: done
- created: 2026-08-04

When a dirty active Workspace file cannot be saved because of an external-change conflict, clicking another file correctly keeps the original editor active but the Explorer selection moves to the requested destination. This creates contradictory UI state. Expected: failed or cancelled switching keeps both the active editor and Explorer selection on the original file; successful switching updates both.

## B014: Fix Workspace Auto-save Completion Loop

- status: done
- created: 2026-08-05

In a Workspace IdeaSketch file, make a persisted edit such as adding a Page and wait longer than the auto-save debounce. The .is archive is updated on disk, but the toolbar remains at Unsaved changes, the recovery draft remains, and the same unchanged document is written repeatedly. Expected: once the saved snapshot remains current, auto-save marks the document Saved, clears recovery, and stops writing until another persisted edit occurs.
