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
1. 在 IdeaNote 编辑画布中触发 Excalidraw 原生保存入口，例如 `Cmd+Shift+S`。
2. 检查系统 Downloads 目录。

期望：所有保存触发都只走 IdeaNote 的 `.is` 保存流程。／ 实际：Excalidraw 原生保存会下载 `Untitled-*.excalidraw` 文件到 Downloads。

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
1. 启动 IdeaNote 并打开工作区进入编辑器。
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

## B015: Enable Auto-save in Standalone File Mode

- status: done
- created: 2026-08-05

When an existing editable IdeaSketch file is opened in Standalone (single-file) mode, persisted edits remain unsaved after the normal auto-save debounce and require a manual Save. Expected: writable existing standalone files use the same safe debounced auto-save behavior as Workspace files, while untitled, read-only, externally changed, conflicting, or missing targets remain protected.

## B016: Switching Pages freezes large IdeaSketch files after F024

- status: done
- created: 2026-08-06

Opening chenlan.is succeeds, but switching to another Page causes the desktop client to become unresponsive after F024. Diagnose the Page-switch remount/subscription path and restore responsive switching without reverting F024's save, Camera, conversion, thumbnail, presentation, or file-format guarantees.

## B017: Match the editor title bar to Shimo and preserve inactive macOS traffic lights

- status: done
- created: 2026-08-06

In the editor window, the custom top status/title bar uses a near-white background instead of the Shimo-style light gray shown in the reference. On macOS, the native three traffic-light controls disappear when the window loses focus, leaving an awkward empty padded area. Reproduce by opening an editor window and switching focus to another window. Acceptance: use the reference-style light gray top bar, keep native controls unchanged while focused, and show aligned neutral placeholder dots in their reserved area while unfocused without affecting non-macOS layout or toolbar interactions.

## B018: Lower macOS window controls to align with the title bar

- status: done
- created: 2026-08-06

After B017, the three macOS system window controls and their inactive placeholders appear slightly too high within the 48px editor title bar. Reproduce by opening an editor window and comparing the traffic-light row with the toolbar centerline. Acceptance: move both the native traffic lights and the inactive placeholder row down by 2px, keep their horizontal position, size, spacing, focus behavior, and title-bar height unchanged, and preserve non-macOS layout.

## B019: Left-align Workspace Actions and Replace Missing-file Canvas

- status: done
- created: 2026-08-06

The Workspace Explorer action buttons are right-aligned, leaving an unnecessary empty area on the left. When an active file is removed outside IdeaNote, the File missing notice appears but the live IdeaSketch canvas remains visible underneath. Left-align the action buttons and replace the visible editor surface with a simple File missing state while retaining the existing Save As and Close recovery actions and the latest in-memory document snapshot.

## B020: Reuse unchanged Page thumbnails when switching Pages

- status: done
- created: 2026-08-07

In Thumbnail view, selecting a different Page always replaces its thumbnail with 'Generating preview' and re-exports it even when the Canvas content and preview render key are unchanged. Reuse a matching cached thumbnail across Page activation while preserving live active-draft refresh after real edits, bounded transient cache ownership, stale-job protection, and Blob URL cleanup.

## B021: Use unique SlideCanvas child keys

- status: done
- created: 2026-08-07

Opening an IdeaSketch editor logs repeated React errors that two children share the current Page UUID as their key. SlideCanvas renders Excalidraw and CameraBadgeOverlay as siblings with the same key={slideId}. Keep both Page-remount safeguards while assigning distinct, deterministic child keys so an empty new document and Page switching produce no duplicate-key warning.

## B022: Keep portrait Page thumbnails visible

- status: done
- created: 2026-08-07

In the Pages thumbnail view, a Page can contain visible canvas content while its portrait-oriented thumbnail appears blank or heavily clipped in Tauri WebKit. The exported PNG is valid; WebKit Grid intrinsic sizing offsets the image inside the fixed preview and overflow clips it. Fix the preview layout for portrait, near-square, and landscape thumbnails without changing thumbnail generation, caching, virtualization, or update frequency.

## B023: Place Agent in an app-level right column

- status: done
- created: 2026-08-08

The Agent is incorrectly rendered as a tab inside the IdeaSketch Navigator. Reproduce by opening an IdeaSketch document and selecting Agent in the editor's right sidebar. The required shell is left Workspace directory, center document editor (including editor-owned navigation), and an independent app-level Agent column on the right. AI-disabled behavior, provider-required guidance, reviewed changes, and future editor reuse must remain intact.

## B024: Align Tauri versions and verify Agent editing

- status: done
- created: 2026-08-08

The standard Tauri debug bundle build fails because @tauri-apps/api resolves to 2.11 while the Rust tauri crate remains 2.10. Align the Tauri runtime toolchain on one minor line, prevent future cross-package-manager drift, restore the normal bundle build, then use a disposable unsaved .is document to verify Agent proposal, explicit Apply, visible editor mutation, and Undo without changing a real user file.

## B025: Fix Agent fallback hangs, cancellation, and activity presentation

- status: done
- created: 2026-08-09

The Agent transcript still renders Reasoning summary cards instead of a Teable-style continuous activity stream. A Codex Turn can report 'Codex stopped before producing output; using Compatibility', then remain Working indefinitely after Compatibility Tool activity; the composer Stop button does not terminate it. Diagnose the Codex timeout/fallback path, ensure fallback reaches one terminal state, make cancellation interrupt runtime and pending editor Tool waits, and replace reasoning-summary cards with concise public activity while never exposing hidden chain-of-thought.

## B026: Validate Agent editing of saved IdeaSketch files

- status: done
- created: 2026-08-09

The previous Agent verification did not prove editing a real saved .is file end to end. Build an explicit capability checklist and exercise every supported IdeaSketch Agent read and direct mutation Tool against disposable saved files, including immediate editor application, Undo/Redo, autosave/manual save where applicable, close/reopen persistence, stale-target rejection, cancellation safety, and file integrity. Reproduce and repair every discovered failure, then repeat the complete matrix until clean.

## B027: Use IdeaSketch Native Undo for Agent Canvas Edits

- status: done
- created: 2026-08-09

Agent current-Page element edits currently mutate the IdeaSketch document model and maintain a separate Agent-only history instead of entering Excalidraw's native edit history. Route current-Page canvas operations through the mounted IdeaSketch/Excalidraw frontend SDK as one captured editor transaction, remove the application-level Agent Undo/Redo controls and snapshot stack, and let the normal editor change/autosave pipeline persist the result. Page add, delete, reorder, and non-mounted Page operations must not falsely claim Excalidraw-native Undo support.

## B028: Show Real Agent Read Tools in Execution Order

- status: done
- created: 2026-08-09

Agent editing Turns can skip read_active_page because the full active Page scene is injected into the initial context, so the UI shows only the mutation Tool. Assistant text also remains in one item across Tool calls, placing the completed response before later Tool cards. Make editor reads real and observable: provide lean turn-start metadata, require a successful same-turn current-revision read before canvas mutation, stream Tool Running and Completed states in true execution order, segment assistant output around Tool activity, and keep editor SDK application, stale-target safety, and native Undo/Redo intact.

## B029: Make Burst-delivered Agent Answers Visibly Progressive

- status: done
- created: 2026-08-09

The Agent answer still appears as one complete block instead of growing visibly like Teable. A direct Codex app-server trace reproduced 149 genuine `item/agentMessage/delta` events arriving within roughly 4 ms, followed by Turn completion about 63 ms later; the frontend then frame-batches the burst into one visible React update. A Teable comparison showed answer text growing over roughly 5.3 seconds in repeated visible increments after its Preparing/Working state. Preserve authoritative source events and chronology, add Codex delivery telemetry, and introduce bounded answer-only presentation pacing for burst or atomic delivery without presenting it as hidden reasoning or live model-token generation. Tool, lifecycle, cancellation, error, and terminal state must remain immediate and authoritative.

## B030: Fix transient menus, simplify AI Provider settings, and refine Agent history

- status: done
- created: 2026-08-11

Refine only .temp/f041-native-workbench-review from the latest review feedback. Workspace three-dot menus must dismiss on focus loss and use an established open-source menu primitive instead of a custom implementation; remove Move to Archive and Cancel from those menus. Simplify Settings: AI Provider uses a normal password input for token entry, removes configured-credential removal and explanatory copy, adds a Test action, and only exposes a model select after a successful test; move the AI features switch into Agent settings, reduce navigation and explanatory density, and keep controls visually consistent. In Agent, replace the static Agent mark with a conversation-history select, give each history record a three-dot menu with Rename and Delete, remove the separate history button, replace the Runtime Inspector side rail with a dialog that closes on focus loss/Escape, and pin the composer to the bottom of the panel. Preserve English copy, Light/Dark/System, deterministic mocks, responsive behavior, and the no-production-migration boundary.

## B031: Compact workspace and Agent menus and remove redundant labels

- status: done
- created: 2026-08-11

Refine only .temp/f041-native-workbench-review from the latest visual review. Workspace roots must not expose a Read-only state: an added Workspace is writable, the default Operations Hub fixture must be editable, and the read-only review scenario must remain document-scoped. All floating action menus must size to their actions instead of using a fixed wide surface, open adjacent to their three-dot or plus trigger, and omit decorative object-name headings. Agent conversation history must omit the Conversations/count header, keep the history list compact, and anchor each Rename/Delete menu beside its row trigger without the current vertical drift. Settings content must remove redundant kicker/navigation copy so each page has one clear title while the left navigation retains grouping. Preserve Radix accessibility and dismissal behavior, English copy, Light/Dark/System, responsive geometry, deterministic mocks, and the no-production-migration boundary.

## B032: Refine Agent controls, window chrome, menus, and Workspace dragging

- status: done
- created: 2026-08-11

Symptoms and acceptance:
- Remove the Agent composer "Automatic Skill" control and the exposed "incremental" delivery-mode text.
- Add a compact per-assistant-response capability inspector showing the model, reasoning effort, and context-window usage.
- Add composer model and reasoning-effort selection modeled on the supplied ChatGPT references; selections must affect subsequent mocked Turns.
- Make the upper-left Workspace toggle respect desktop window chrome: macOS windowed traffic-light safe area, macOS fullscreen without traffic lights, and Windows/non-macOS caption-button space.
- Re-anchor Workspace overflow menus beside their three-dot triggers with collision-safe fallback instead of opening as a wide dropdown under the row.
- Add maintained-library drag interactions for visible Workspace files/folders. A file or directory may be dragged from any tree depth into another directory, including moving outward from a nested directory into its parent, a different branch, or back to the current Workspace root through the existing mock desktop boundary; same-parent ordering, cross-Workspace moves, external filesystem drops, invalid targets, and self-descendant drops remain inert or are rejected, and the active document identity is preserved.

## B033: Refine Markdown Editor Navigation, View Switching, and Controls

- status: done
- created: 2026-08-11

In the review demo Markdown editor: move the Outline navigation control to the far left; fix Preview -> Split/Edit transitions that leave the editor blank; add an IdeaSketch-adjacent Markdown setting controlling line-number visibility with line numbers off by default; remove the Markdown formatting Tool menu and place Undo/Redo controls at the editor's lower-left like the IdeaSketch surface.

## B034: Restore reviewed demo parity in the migrated Tauri workbench

- status: done
- created: 2026-08-11

The production Tauri workbench does not visually or interactively match the approved .temp/f041-native-workbench-review baseline. Reproduction: compare the native app at the same light-theme desktop size with the reviewed demo. The production shell uses different color tokens and spacing, places macOS/window controls and the document identity differently, renders workspace/editor/Agent dividers differently, keeps an extra Agent Settings action, allows nested conversation actions to be obscured, presents a substantially different Settings dialog and controls, and adds a Settings action to Welcome. Restore parity across the outer shell, Crown, panel dividers, Agent header/history menus, Settings layout and controls, Welcome, Light/Dark/System, and windowed/fullscreen states while preserving real Tauri services and excluding demo-only mocks, Review Scenarios, and demo Excalidraw.

## B035: Restore editor Tool rebinding and terminal Agent response actions

- status: done
- created: 2026-08-12

Reproduce by reusing one Agent conversation across a Markdown document and an IdeaSketch .is document, then request an IdeaSketch read or mutation: the Agent UI reports the current editor Tools, but Codex resumes an upstream Thread whose persisted dynamic Tools belong to the previous editor, so read_active_page and replace_page_elements are unavailable. On successful completion, remove the terminal Completed-in label from the Working lifecycle row and render the elapsed duration beside Copy on the final assistant response only. Copy and final response metadata must remain hidden while the Turn or paced text presentation is still running. Preserve local conversation history, editor Tool safety prerequisites, cancellation, direct reversible edits, and the reviewed B034 Agent layout.

## B036: Unify Light and Dark Theme Palette and Remove Legacy Accent Conflicts

- status: done
- created: 2026-08-12

The F047 interface mixes the new green semantic theme with legacy purple selections, blue file accents, and inconsistent neutral surfaces, producing a visually fragmented Light theme and leaving the same risk in Dark. Establish one art-directed violet-led Light/Dark palette, migrate application-owned legacy accent and surface literals to semantic tokens, keep blue only for document/file semantics and green only for success/online status, preserve editor-owned document colors and all existing behavior, and verify both themes visually and with contrast/theme regressions.

## B037: Restore Danger, Disabled, and Theme-Choice Visual Semantics

- status: done
- created: 2026-08-12

Nested Workspace file and directory Move to Trash menu items render as ordinary actions instead of danger actions; disabled Settings Save retains an active violet outline; and Light/Dark/System cards use redundant decorative icons despite already having visual previews. Restore red danger styling for nested resource deletion in normal, hover, focus, and highlighted states; make disabled Settings actions clearly inactive without violet emphasis; simplify theme cards to preview plus label while preserving accessibility, theme behavior, layout, and all Workspace and Settings functionality.

## B038: Prevent blank Agent panel space during rapid resize

- status: done
- created: 2026-08-12

When the right Agent sidebar divider is dragged quickly from left to right, a blank strip appears on the right side of the panel instead of the Agent content continuously filling the resized width. The panel should track the pointer without animated width lag or exposed empty space, while preserving its min/max sizing, keyboard resizing, persisted width, and normal show/hide transition.

## B039: Refine the IdeaSketch drawer controls

- status: done
- created: 2026-08-12

In the production .is editor, remove the remaining Excalidraw top-left menu button, remove the Canvas & export section heading and Help action highlighted in the supplied screenshot, and restyle the drawer open/close trigger to match Excalidraw toolbar controls. Use the same navigation icon for both open and hidden states while preserving accessible labels, drawer behavior, Pages/Cameras content, and the remaining export/background/clear actions.

## B040: Refine the IdeaSketch navigator density

- status: done
- created: 2026-08-12

In the production .is editor, make the left IdeaSketch drawer narrower, remove the violet line on its left edge, remove Current Page from the Cameras toolbar, place Add camera to the right of Present, and reduce the Pages/Cameras tab label size so the navigator matches the product's compact visual system. Preserve drawer resizing, Page and Camera data/operations, presentation choices, read-only behavior, and Canvas commands.

## B041: Remove Duplicate IdeaSketch Divider Lines and Restore Close Icon

- status: done
- created: 2026-08-12

In the production .is editor, the boundary between the open IdeaSketch navigator and Canvas appears as several parallel vertical lines, and the navigator trigger does not provide a distinct close-navigation icon while the drawer is open. Render one quiet product-consistent divider/resizer boundary and show a clear Excalidraw-style close-sidebar icon in the open state while preserving resizing, accessible open/close labels, compact drawer geometry, and the closed-state navigation icon.

## B042: Move the Open IdeaSketch Close Control into the Navigator

- status: done
- created: 2026-08-12

When the production IdeaSketch navigator is open, place the close-navigation button in the sidebar's top area and hide the corresponding button from the Excalidraw Canvas. When the navigator is closed, keep the Canvas-side open-navigation button. Preserve the existing Pages/Cameras content, compact drawer geometry, resize behavior, Excalidraw-style icon treatment, accessible labels, and Escape closing.

## B043@fix-welcome-sidebar-motion: Keep Welcome title motion coherent while opening Workspaces

- status: done
- created: 2026-08-12

When the Workspaces sidebar opens from the fileless Welcome state, the title first re-anchors because the restore button and native-frame padding disappear, then moves again as the sidebar width animates. Preserve a polished animated open/close transition while keeping the title on one continuous visual trajectory, with reduced-motion support.

## B044: Relaunch IdeaNote after a successful macOS update

- status: done
- created: 2026-08-13

On macOS, installing a signed update successfully replaces /Applications/IdeaNote.app with the new runtime version, but the running application does not automatically relaunch. The updater controller intends to call the Tauri process relaunch API after install, and its current unit test only proves a fake client call; diagnose the native install/relaunch boundary and preserve unsaved-change safeguards before proposing a fix.

## B045: Fix fragmented Markdown selection range styling

- status: done
- created: 2026-08-13

Multi-line Markdown selections show detached purple blocks at line boundaries. The regression was introduced by F059 applying an inset box-shadow border to every CodeMirror selection-layer rectangle. Restore a continuous, readable focused and unfocused selection range without changing editor state, history, document content, or Agent selection behavior.

## B046: Replace blocky Markdown selection geometry

- status: done
- created: 2026-08-13

Markdown selection geometry remains wrong after B045: CodeMirror drawSelection deliberately fills horizontal space across line breaks, producing detached-looking blocks for both inline and multi-line selections. First prove a character-tight native-selection treatment in the tracked review demo, covering inline, cross-line, wrapped, focused, unfocused, Light and Dark states; only after demo acceptance migrate the same selection boundary to the production Tauri Markdown editor without changing history, document state, or Agent selection context.

## B047: Match Tauri Markdown selection to the approved demo

- status: done
- created: 2026-08-13

The Tauri Markdown editor still renders incorrect inline and cross-line selections after B046, while the approved review demo is correct. Reproduce the production-only mismatch, then migrate the demo's exact Markdown-host CSS selector boundary (.cm-content, .cm-line, and descendant ::selection targets) into Tauri instead of relying on the approximate EditorView theme ancestor selector. Preserve one EditorView, history, document state, Agent selection context, and Edit/Split/Preview behavior.

## B048: Align update, Settings navigation, and Markdown history controls

- status: done
- created: 2026-08-13

1. When an update is available and its large notice has been dismissed, the compact Update action to the right of Settings should use the violet primary color shown in the supplied reference. 2. In Settings navigation, General and About should appear directly as top-level navigation items without an Application category label; AI and Editors remain grouped. 3. In the Markdown editor, move Undo and Redo from the lower-left floating control to the top toolbar immediately to the right of Edit, Split, and Preview. Preserve current actions, disabled behavior, accessibility, themes, and responsive layout.

## B049: Prevent IdeaSketch navigation trigger from overlapping Excalidraw controls

- status: done
- created: 2026-08-14

When the IdeaSketch drawer is closed, its floating navigation trigger occupies the same upper-left canvas region as Excalidraw's selection properties panel. Selecting an element causes the two controls to overlap. Keep the trigger at the Canvas upper-left by default; while selection controls are present, move it to the lower-left and shift Excalidraw's existing lower-left controls to its right. Return both to their normal positions when selection clears, without consuming permanent Canvas width, using a right-side slot, or moving editor state into the workbench shell.

## B050: Translate the Enacta Agent Kernel RFC into Chinese

- status: done
- created: 2026-08-14

RFC 003 was delivered in English, but the required document language is Chinese. Translate the complete RFC, including headings, prose, tables, decisions, risks, migration stages, and acceptance criteria, while preserving protocol method names, type names, code snippets, local paths, URLs, commit hashes, licenses, and other exact technical identifiers. Do not change the accepted architecture decision or implement runtime behavior.

## B051: Disable WebView context menu

- status: done
- created: 2026-08-19

Reproduction: right-clicking inside the IdeaNote WebView opens the platform browser context menu (Look Up, Translate, Search, Copy, Share, Speech, Inspect Element). Expected: the application WebView must suppress the native browser context menu everywhere in the app. Scope: prevent the default contextmenu behavior at the application boundary without changing editor-owned interactions.

## B052: Continue Compatibility Turns after editor read Tools

- status: done
- created: 2026-09-01

When the rich Codex runtime is unavailable or incompatible, asking the active IdeaSketch editor what is on the current Page successfully executes read_active_page but then ends with the generic “I completed the requested editor Tool activity” response instead of answering from the Tool result. The Compatibility path must return bounded editor Tool results to the model, continue the Turn under existing Tool Broker, prerequisite, cancellation, and safety limits, and produce a substantive final response. Reusing one persistent conversation across Markdown and IdeaSketch is valid; the retained conversation title is not this defect.

## B053: Avoid exact local Codex CLI version pinning

- status: done
- created: 2026-09-01

Runtime discovery must not reject an installed Codex solely because its version differs from hard-coded 0.147.0. Probe and negotiate the required app-server protocol and capabilities, accept compatible local versions, and show a truthful diagnostic only when required Tool, lifecycle, cancellation, approval, or dynamic-tool contracts are incompatible.

## B054: Fix Agent Markdown rendering

- status: done
- created: 2026-09-01

Agent assistant responses can show Markdown syntax and collapsed headings or paragraphs instead of correctly separated, formatted content in the transcript.
