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

- status: done
- created: 2026-07-22

Treat each `.is` file as an IdeaSlide workspace rather than a traditional slide deck. Replace the slide-centric organizer with a three-pane editor: a hierarchical Workspace explorer on the left, the selected resource editor in the center, and a compact Cameras list on the right. The first resource types are folders and Excalidraw canvases, while the resource model, persisted type identifier, content reference, selection boundary, and unsupported-type fallback must allow more file types to be added later without redesigning the tree. Users can create folders and canvases, select and inline-rename them, reorder or move them through the hierarchy, and safely delete them. Cameras belong to the selected canvas. Both side panels collapse independently from divider markers. Do not render slide or camera thumbnails in this delivery. Make the existing manifest `version` field an enforced `.is` format version: F002 writes `2.0`, explicitly migrates supported `1.0` workspaces, rejects invalid or unsupported versions before reading payloads, and reserves major increments for breaking changes. Legacy flat-slide `.is` files open as root-level canvases in their original order; the workspace tree, active canvas identity, canvas content, and camera order survive save and reopen. Non-canvas editors, arbitrary linked local files, tabs, thumbnail generation, camera naming, and a presentation-mode redesign are out of scope.

## F003: Move camera presentation controls into the Canvas and resize the Workspace sidebar

- status: done
- created: 2026-07-23

将 Cameras 和 Present 从全局工具栏移动到当前 Excalidraw 画布右上角。Cameras 按钮负责打开或收起当前 Canvas 的镜头列表；CameraList 标题栏提供 Add Camera，替代画布中现有同名 Camera 绘制按钮。Present 仅播放当前 Canvas 中按顺序排列的 Cameras，不跨 Canvas；没有 Camera 时禁用。左侧 Workspace 文件列表默认宽度缩小，并可拖动调整，必须限制最小和最大宽度，同时保留分割线上的收起/展开按钮。文件列表顶部不显示 WORKSPACE 标题，也不重复显示窗口工具栏已有的 `.is` 文件名，而是直接使用紧凑操作栏加资源树。操作栏提供 New resource 下拉框（从可创建资源类型注册表生成，当前只有 Canvas）、独立 New folder 和 Collapse all；选中目录时创建在目录内，选中文件时创建为同级资源，新建后立即进入重命名。

## F004: Refine the editor shell and canvas controls

- status: done
- created: 2026-07-24

Fix the broken Excalidraw top-right Cameras and Present controls so labels never wrap or disappear and disabled state remains legible. Improve the left Workspace-to-canvas divider with an obvious resize cursor, visible hover/drag feedback, bounded resizing, and accessible separator semantics while retaining collapse/restore. Redesign the Workspace and Cameras sidebars as one modern, restrained visual system without thumbnails. First build an interactive HTML prototype in a new .temp subdirectory, visually review it, and only migrate the approved design into the Tauri frontend.

## F005: Align Workspace actions and Camera presentation header

- status: done
- created: 2026-07-24

Implement the approved Revision B editor-shell prototype in the Tauri frontend. Match the Workspace header to the reference action sequence: New resource, New folder, a visual separator, Collapse all, and More. Keep the More action intentionally non-destructive and reserved for future workspace commands. Remove Present from the Excalidraw top-right group so it contains only the Cameras toggle and count. Move the disabled-aware Present Preview/Fullscreen dropdown into the Cameras sidebar header beside a compact Add Camera action. Present remains disabled when the current Canvas has no Cameras and continues to present only that Canvas. Preserve the existing neutral/violet visual system, text-only lists, resource behavior, camera behavior, panel resizing, and persistence.

## F006: Apply Revision C editor shell defaults

- status: done
- created: 2026-07-24

Implement the approved Revision C editor shell in the Tauri frontend: hide the Workspace and Cameras sidebars by default; keep both divider expand controls available; show a visible Show cameras / Hide cameras hover tooltip on the Excalidraw canvas Cameras toggle; arrange Home, New, Open, Save, and save status as a compact left title-bar command cluster while centering the current .is document title independently; and keep Present enabled in the Cameras header even when the selected Canvas has zero Cameras. Present must continue to target only the selected Canvas. Preserve existing sidebar resizing, resource and camera behavior, persistence, neutral/violet styling, and text-only lists. Thumbnails and new resource types remain out of scope.

## F007: Use framework icons for title bar file actions

- status: done
- created: 2026-08-03

Replace the current custom or text-like Home, New, Open, Save, and related title-bar action icons with icons from the project's existing UI icon framework. Preserve the compact layout, action behavior, tooltips, accessibility labels, disabled states, and save-status presentation.

## F008: Use framework icons in the Workspace tree

- status: done
- created: 2026-08-03

Replace the Workspace tree's text-like disclosure marks and diamond resource glyphs with Lucide framework icons. Use clear collapsed/expanded chevrons, closed/open folder icons, an identifiable IdeaSketch file icon, and a safe generic icon for unsupported files while preserving indentation, row hit targets, selection styling, accessibility, Symlink behavior, and Explorer actions.

## F009: Unify Pages and Cameras in a tabbed IdeaSketch navigator

- status: done
- created: 2026-08-04

Merge the IdeaSketch Page list into the existing right-side document navigator and switch between Pages and Cameras with fixed, non-collapsible tabs. Keep Cameras scoped to the active Page, preserve Page and Camera create/select/rename/reorder/delete behavior and Present behavior, and do not add thumbnails. Remove the separate Page popover, the redundant Page shortcut above the Canvas, and the floating top-right Cameras control. Expose the document navigator and camera drawing action through compact Excalidraw-aligned custom toolbar controls with accessible tooltips, while keeping the right panel hidden by default and toggleable through the existing divider.

## F010: Clarify Save Menu and Workspace Explorer Actions

- status: done
- created: 2026-08-04

Remove the duplicate Save and Save All entries from the title-bar save dropdown while retaining the primary Save button, Save As, and non-toolbar save coordination behavior. Replace the Workspace Explorer header's symbolic text controls with clear framework icons, consistent grouping, accessible labels, and tooltips for New File, New Folder, Refresh, Collapse All, and additional tree actions.

## F011: Filter Workspace Files and Centralize Temporary Writes

- status: done
- created: 2026-08-04

Update Workspace Explorer so it preserves navigable directories but exposes only file types currently registered as openable (currently .is), while hiding unsupported files and the entire .ideanote subtree. Route Workspace-mode user-file, metadata, and internal temporary writes through <workspace>/.ideanote/tmp/ so sibling .is.tmp or .is.bak files are never created. Preserve original files on failed replacement, ignore .ideanote watcher events, and keep Single File Mode free of workspace metadata by using its existing app-local or platform-safe temporary strategy.

## F012: Drag-sort Workspace Entries, Pages, and Cameras

- status: done
- created: 2026-08-04

Workspace Explorer entries can be dragged into another folder or inserted before/after a sibling, with custom sibling order persisted in Workspace metadata. In the .is editor, Pages and Cameras can be drag-sorted; Page order and Camera order persist through the existing document save/autosave path. Drag mutation is disabled for read-only content and must preserve existing open-document path remapping and filesystem safety.

## F013: Compact Workspace and Navigator Layout

- status: done
- created: 2026-08-04

Remove the persistent Workspace drag-handle column and allow dragging from the row content without interfering with selection, opening, rename, or row actions. Present the Workspace name as the directory-tree root, similar to VS Code, and use that root as the drop destination for moves back to the Workspace root. Reduce the default widths of the left Workspace tree and the IdeaSketch Page/Camera navigator, and open the right navigator by default. Keep the Workspace resizable, keep both panels collapsible, and preserve Page/Camera drag sorting.

## F014: Simplify File and Navigator Controls

- status: done
- created: 2026-08-04

Remove the New File action from the top editor toolbar while keeping file creation available from the Launch Screen and Workspace root. Fix the Open dropdown so its tooltip does not overlap the open menu and both Open Workspace… and Open File… stay on one line with aligned icons. Remove the custom Navigator item from the Excalidraw main menu and its redundant SlideCanvas state props; make the right-side navigator toggle the single in-editor open/close control and give it the shared Hide navigator / Show navigator tooltip. Preserve Save/Save As, Workspace collapse/resize, Page/Camera sorting, and Camera creation behavior.

## F015: Select the filename stem during Workspace rename

- status: done
- created: 2026-08-05

When inline rename starts in the Workspace directory tree, match VS Code by initially selecting only a file's name before its final extension. Keep the extension visible and editable when the user deliberately changes the selection. Select the full name for directories, extensionless files, and leading-dot files. Apply the behavior consistently to F2, the Rename row action, and automatic rename after creating an entry.

## F016: Refine launch actions and add recent workspaces

- status: done
- created: 2026-08-05

Replace the Open Workspace and Open File character glyphs on the IdeaNote Home screen with clear Lucide icons consistent with the rest of the application. Add a Recent Workspaces section alongside Recent Files, persist successfully opened directory workspaces in global user configuration, reopen a workspace from its recent row, allow removing stale or unwanted workspace entries, filter paths that no longer exist, and preserve backward compatibility with existing recent-file configuration.
