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

Treat each `.is` file as an IdeaNote workspace rather than a traditional slide deck. Replace the slide-centric organizer with a three-pane editor: a hierarchical Workspace explorer on the left, the selected resource editor in the center, and a compact Cameras list on the right. The first resource types are folders and Excalidraw canvases, while the resource model, persisted type identifier, content reference, selection boundary, and unsupported-type fallback must allow more file types to be added later without redesigning the tree. Users can create folders and canvases, select and inline-rename them, reorder or move them through the hierarchy, and safely delete them. Cameras belong to the selected canvas. Both side panels collapse independently from divider markers. Do not render slide or camera thumbnails in this delivery. Make the existing manifest `version` field an enforced `.is` format version: F002 writes `2.0`, explicitly migrates supported `1.0` workspaces, rejects invalid or unsupported versions before reading payloads, and reserves major increments for breaking changes. Legacy flat-slide `.is` files open as root-level canvases in their original order; the workspace tree, active canvas identity, canvas content, and camera order survive save and reopen. Non-canvas editors, arbitrary linked local files, tabs, thumbnail generation, camera naming, and a presentation-mode redesign are out of scope.

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

## F017: Convert selected Excalidraw elements to draw.io

- status: done
- created: 2026-08-05

Add an IdeaSketch editor action that converts selected Excalidraw elements to a deterministic, clean draw.io-like visual style while keeping the result as editable Excalidraw elements inside the existing `.is` format. The action is available only for an editable non-empty selection and offers two targets: replace the selected elements in place on the current Page with Undo support, or create and switch to a new Page containing a converted copy while leaving the source Page unchanged; New Page is the safer default. Preserve geometry, colors, z-order, grouping, text and internal bindings where supported; normalize sketch roughness, line/fill treatment, and typography. Fully support basic shapes, text, lines, and arrows; retain images and freehand content unchanged with a conversion summary; exclude Camera and unsupported embedded/magic elements without data loss. Do not generate draw.io/mxGraph XML, add a draw.io editor, use AI redrawing, or change the `.is` Page content type.

## F018: Optimize conversion for formal presentation style

- status: done
- created: 2026-08-05

Strengthen the existing Excalidraw selection conversion so converted supported elements have no hand-drawn appearance and look precise, consistent, and suitable for formal presentations. Use a deterministic formal-style policy for geometry, strokes, fills, opacity, corners, arrows, and typography; clearly classify content such as freehand drawing that cannot be made formal without redrawing. Preserve editable Excalidraw output and the existing Current Page/New Page workflow rather than generating draw.io files.

## F019: Add Page list view mode switch

- status: done
- created: 2026-08-05

Add a view mode switch to the Pages list with thumbnail and name modes. Preserve the current name-list presentation as the default mode. Thumbnail mode must keep Page selection and existing Page management behaviors available.

## F020: Raise minimum window height

- status: done
- created: 2026-08-05

Set the main application window minimum height to 850 px so users cannot resize it below that height, and keep its default width at 1200 px.

## F021: Update documentation to IdeaNote branding

- status: done
- created: 2026-08-06

Update documentation that describes the current product so it consistently uses the IdeaNote product name. Preserve explicit predecessor references and exact technical or historical identifiers such as repository paths, package names, bundle identifiers, URLs, code symbols, legacy application paths, and recorded evidence.

## F022: Export editor content as draw.io

- status: done
- created: 2026-08-06

Add an Export as draw.io action to the editor's top-left Excalidraw main menu. Convert the current editor content to a .drawio file, using https://github.com/bhagman/excalidraw-to-drawio as the implementation reference, and persist the export through the desktop app.

## F023: Normalize draw.io exports to a clean diagram style

- status: done
- created: 2026-08-06

When exporting the active Page to draw.io, normalize supported vector and text cells to the project's existing formal draw.io-style contract: solid 2 px strokes, solid fills, full opacity, sharp geometry/connectors, and Helvetica text while preserving colors, geometry, labels, bindings, images, freehand representation, and the source IdeaSketch document.

## F024: Optimize large Excalidraw viewport interactions

- status: done
- created: 2026-08-06

Reduce zoom and pan stalls for large Excalidraw files without changing document/save semantics, Camera badge positioning, selection-style conversion, Page previews, or other user-visible editor behavior. Optimize scene-change classification and fingerprint reuse, selection availability checks, Camera viewport projection, React/WebView rendering isolation, and preview scheduling; verify the result in a production Tauri build.

## F025: Replace native unsaved-change prompts with a three-action dialog

- status: done
- created: 2026-08-06

Replace the current two-step native Unsaved Changes prompts with one polished in-app modal inspired by the provided reference. Show the affected file name and present three full-width actions in priority order: Save, Discard Changes, and Cancel. Apply the same decision flow to document close and session/application exit, preserve sequential handling for multiple dirty documents, and keep save failure, recovery cleanup, keyboard focus, Escape cancellation, and English UI behavior safe. Also change the title-bar `Unsaved changes` status text from low-contrast gray to a clearly visible red while leaving `Saving...` and `Saved` unchanged.

## F026: Refine unsaved-state danger color and dialog scale

- status: done
- created: 2026-08-06

Refine the recently added unsaved-state treatment so the title-bar dirty indicator uses one product-consistent danger color for both its dot and label, including a matching subtle halo. Reduce the unsaved-changes dialog to 260 by 200 pixels and proportionally tighten its padding, typography, action spacing, button height, radius, and shadow while preserving the existing three-action hierarchy, accessibility, keyboard behavior, and responsive fit.

## F027: Simplify Workspace Explorer Root Header

- status: done
- created: 2026-08-06

Keep Workspace actions permanently visible instead of revealing them only on hover, remove the Workspace name from the Explorer, and left-align top-level directory entries by removing the synthetic-root indentation. Preserve New File, New Folder, Refresh, tree actions, read-only behavior, tooltips, and the Workspace-root drop destination.

## F028: Start presentation at the first Camera and use a preview laser pointer

- status: done
- created: 2026-08-07

When playing an IdeaSketch Page, start at the first ordered Camera when Cameras exist; when none exist, preserve the Page's existing default viewport behavior. In Preview mode, replace the normal mouse cursor over the presentation canvas with a visible laser pointer without persisting scene changes.

## F029: Add a preview laser trail and reclaim native fullscreen toolbar space

- status: done
- created: 2026-08-07

Enhance the Preview presentation laser pointer with a smooth fading trail while keeping it presentation-local and non-persistent, and hide Excalidraw's top-left menu trigger while Preview is active. Keep macOS and Windows window controls native-only, retain their platform-specific toolbar safety space in a normal window, and remove that inset in native fullscreen so toolbar content can use the reclaimed width.

## F030: Lengthen the Preview laser trail

- status: done
- created: 2026-08-07

Make the laser trail in IdeaSketch Preview visibly longer while preserving its bounded, fading, presentation-local, non-interactive, and non-persistent behavior. Add a Preview setting that enables or disables the laser pointer and defaults to enabled.

## F031: Add configurable editor-agnostic AI Agent and remove legacy MCP

- status: done
- created: 2026-08-08

Add a reusable Settings Center accessible from Home and the editor. AI is enabled by default; when disabled, IdeaNote must not mount the Agent panel, initialize the Agent runtime, load Agent Skills, expose Agent tools, or start model work. When AI is enabled but no provider is configured, show a configuration-required state without attempting requests. Build one editor-agnostic AI Agent runtime whose active file type injects Agent Skills, tools, context, and change-review adapters; IdeaSketch is the first extension and future Markdown, IdeaTable, and IdeaWorkflow editors reuse the same runtime. Prefer maintained open-source frameworks, with the Rust runtime, open Agent Skills format, and composable React agent UI kept behind IdeaNote-owned interfaces. Remove the existing MCP feature because it conflicts with the in-app Agent: retire the --mcp startup mode, rmcp dependency, MCP server, hidden MCP renderer, frontend MCP bridge, MCP-only events/commands/capabilities, and current-product MCP documentation after reusable file and IdeaSketch operations have moved behind internal Agent tool services. Preserve real files as source of truth, shared Workspace/Single File behavior, review-before-write, undo, external-change protection, and secure credential storage outside Workspace files.

## F032: Define a Codex-style generic Agent RFC

- status: done
- created: 2026-08-08

Create an independent RFC for evolving IdeaNote's editor-agnostic AI Agent toward Codex-like interaction and capability. The RFC must define the right-column conversation UX, Markdown messages, streamed agent/reasoning-summary/tool/plan activity, persistent threads and turns, cancellation and steering, provider capability negotiation, retry and diagnostics, review-before-apply approvals, and editor-specific dynamic Tools/Skills/Context/Change Review injected through the existing File Type Registry. Prefer maintained open-source foundations, especially evaluating the open-source Codex app-server behind an IdeaNote-owned runtime protocol, while preserving an OpenAI-compatible provider path, keeping MCP removed as a product surface, preventing direct model writes, and allowing future Markdown and other editors to reuse the same Agent core.

## F033: Implement the Codex-style Generic Agent RFC

- status: done
- created: 2026-08-08

Implement accepted RFC 001 in independently deliverable phases: first add the IdeaNote-owned Agent SDK, normalized Thread/Turn/Item/Event state, safe Markdown, and Codex-style activity UI; then harden the OpenAI-compatible adapter with capability negotiation, classified diagnostics, safe retry, and streaming timing; then spike pinned Codex app-server and Grok Build ACP adapters against the same editor Tool and lifecycle contract; finally add persistent Threads, cancellation/steering/approvals, editor dynamic Tool routing, and a second-editor reuse proof. Preserve the independent right column, AI lifecycle gate, registry-driven editor extensions, proposal-only Change Sets, explicit Apply/Undo, secure credentials, and the retired MCP product surface.

## F034: Store the AI token in encrypted application configuration

- status: done
- created: 2026-08-09

Replace the native OS Credential Vault path for the AI provider token with a simple encrypted credential file under the application configuration directory. Keep plaintext out of frontend state, logs, Workspace files, Recovery, and Agent history; remove Keychain-facing UX and runtime dependency. Use authenticated encryption with application-owned key material, document the reduced same-user threat model, and require the user to save the token once in the new storage rather than triggering an automatic Keychain migration prompt. In AI Provider Settings, add a password visibility toggle for the token currently being entered and configurable automatic retry enablement plus a bounded maximum-attempt count.

## F035: Complete Agent history, Codex runtime, and streaming activity

- status: done
- created: 2026-08-09

Add permanent deletion for local Agent Threads with explicit confirmation and storage cleanup; make assistant Markdown visibly update from real text deltas before completion; provide a Teable-like activity stream with preparing/working state, elapsed time, public progress narration, and expandable Tool steps; and enable the pinned Codex app-server as the production rich runtime only after native editor Tool, lifecycle, fallback, packaging, and privacy acceptance. Stream only process text that the selected runtime explicitly marks as user-visible; do not require reasoning summaries, fabricate progress, or expose hidden chain-of-thought. Preserve the compatibility fallback, AI lifecycle gate, generic editor-extension boundary, proposal-only Change Sets, explicit Apply/Undo, and retired MCP surface.

## F036: Apply Agent edits directly with editor Undo

- status: done
- created: 2026-08-09

Remove the user-facing Change Review gate for editor content. Registered Agent mutation Tools should validate and apply directly through the active editor model, remain atomic and revision/fingerprint safe, never write files directly, enter the editor's Undo/Redo history as one transaction, and persist only through the normal dirty/autosave/safe-write pipeline. Keep approval for future irreversible non-editor operations.

## F037: Add Agent Runtime Visibility, Configurable Policies, and Custom Skills

- status: accepted
- created: 2026-08-10

Expose truthful per-Thread Agent runtime health and memory visibility: current runtime/model/effective capabilities, classified startup/provider/fallback/retry diagnostics, source-delivery telemetry, and context-window or compaction status when the selected runtime supplies it. Show an explicit unavailable/unknown state instead of estimating unsupported token counts and provide actionable new-Thread guidance as context pressure grows. Make user-meaningful Agent policy values configurable, including context-warning and new-Thread thresholds, diagnostic retention, Compatibility replay depth, delivery-telemetry visibility, and the existing maximum-step limit; validate their relationships and capture effective Turn policy so active work does not change unexpectedly. Add application-level custom Skills based on the standard `SKILL.md` format with progressive disclosure, safe local import, enable/disable and invocation controls, bounded references, validation diagnostics, and Turn-level version provenance. Custom Skills may guide use of already registered editor Tools but cannot register Tools, MCP, shell, filesystem, network, scripts, or otherwise widen capabilities. Keep credentials, raw provider payloads, hidden reasoning, editor-format logic, and presentation timers out of diagnostics and persistence. Preserve automatic runtime selection and the existing editor Tool safety boundary.

## F038: Implement the Markdown Editor and Agent Extension

- status: accepted
- created: 2026-08-10

Implement the first real Markdown (.md) editor in Workspace and Single File modes using the shared document kernel and established open-source components. Provide source editing, safe GFM preview, edit/split/preview modes, links and in-document references, native editor Undo/Redo, save/autosave/recovery/external-change protection, registry-driven create/open/filter behavior, and loss-aware UTF-8 line-ending/BOM handling. Generalize the currently IdeaSketch-specific frontend/backend seams instead of adding Markdown branches to shared commands. Add a Markdown Agent Extension with its own packaged Skill, bounded read/range Tools, direct editor-SDK mutations as one Undo transaction, and no file writes or runtime-specific logic.
