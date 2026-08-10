---
id: "F040"
title: "Implement Workspace Loom as the Production Shell"
type: "feature"
status: "complete"
summary: "Replace Home-first routing with an always-mounted responsive Workspace, editor, and Agent shell and functional Light, Dark, and System themes."
source: "docs/superplan/human/features.md"
created: "2026-08-10"
order: 47
depends_on: ["F039", "B023", "F016", "F031-01", "F038-02"]
parent: ""
---

# Implement Workspace Loom as the Production Shell Plan

**Goal:** Make IdeaNote open directly into a coherent, theme-aware local Workspace workbench whose active editor and independent AI Agent remain useful before, during, and after a file session.
**Scope:** Replace the visible and semantic Home route with an always-mounted product shell derived from the approved F039 Workspace Loom direction. The shell always presents a left Workspace region, a center editor region, and—when AI is enabled—an independent right Agent region. The initial no-session state uses the left region for New File, Open Workspace, Open File, Settings, recent Workspaces, and recent standalone files; the center gives bounded next-step guidance; and the Agent stays in its existing safe no-binding or provider-required state. Workspace Mode replaces the left start content with the real local Explorer, while Standalone Mode retains the Workspace command rail and start/recent access instead of removing the whole left region. Remove `LaunchScreen`, the `launch` application mode, `GO_HOME`, and the title-bar Home action. Introduce an explicit empty-shell state and a session-reset action that reaches it only after existing Save/Discard/Cancel protection. Adapt—not copy—the Workspace Loom visual hierarchy: a deep-ink command rail, neutral authoritative editor, pale-mint Agent, cobalt actions, and a compact teal-accented `Working context` strip that visibly names the current local file and editor-provided focus/selection without extending through the conversation. In the same delivery, activate the existing General → Appearance preference as a real application theme contract with persistent `Light`, `Dark`, and `System` choices. The resolved theme applies immediately to the Workspace shell, Toolbar, Settings, dialogs, menus, Markdown/editor chrome, and Agent; IdeaSketch's Excalidraw UI follows the resolved app theme while document-authored canvas/background colors remain content-owned. `System` follows live operating-system color-scheme changes. Preserve all existing local-file, registry-driven editor, recovery, external-change, direct editor mutation, Undo, Settings, recent-history, presentation, and AI activation boundaries. Define responsive behavior for the native 1200×850 default window, 1100×850 compact desktop, and 850×850 native minimum without page-level horizontal overflow.
**Non-Goals:** This feature does not add IdeaTable or any new editor, imitate the F039 mockup's sample table UI in production, introduce Search or Quick Open, add split editors or visible file Tabs, change Agent providers/runtime/thread persistence/Tool execution, add direct Agent file writes, redesign editor-owned IdeaSketch Pages/Cameras controls, change Workspace filesystem commands, persist panel widths, migrate installation identity, or alter Tauri window minimums. It does not add custom themes, per-Workspace/per-editor theme overrides, cloud theme sync, or recolor document-authored content. It does not copy Cursor, Kition, or Teable branding, proprietary assets, or exact screens.
**Architecture:** `ApplicationMode` becomes `"empty" | "workspace" | "standalone"`; `createInitialAppState()` returns the empty product state, and a semantic reset action replaces `GO_HOME` without reintroducing Home routing. `AppContent` always mounts `EditorLayout`, so native close handling, system file-open coordination, recovery prompts, Settings, and presentation share one lifecycle rather than branching around `LaunchScreen`. `EditorLayout` remains the app-shell owner of panel visibility, sizing, unsaved-session transitions, and the independent Agent column. A new Workspace shell component owns the slim command rail and switches its detail surface between the existing `WorkspaceExplorer` and a start/recent surface that reuses F016's typed recents APIs and established Radix primitives. The center stays editor-authoritative: `DocumentEditorHost` renders the registered active editor or a directional empty state without creating document content. The Agent binding gains a small editor-agnostic presentation contract for user-facing context labels/chips; IdeaSketch and Markdown populate that contract from their existing bounded page/selection context, while the shell never parses editor-specific models. The Agent renders one header plus a visible context strip/thread, but all mutation capability still comes only from `createToolExecutor()` and `applyChangeSet()`. Responsive layout derives effective panel presentation from viewport width without discarding the user's expanded widths: at 1180px and above both detail columns may remain expanded; from 960–1179px the Workspace detail compacts to a 48px rail while Agent stays bounded near 300–330px; from 850–959px both outer regions expose 48px restore rails by default so the center remains usable, with either outer panel independently restorable. Theme preference remains in the existing versioned global Settings source of truth. A small theme runtime resolves `light`/`dark`/`system`, applies `data-theme` and `color-scheme` at the document root, subscribes to `matchMedia("(prefers-color-scheme: dark)")` only for System mode, and exposes the resolved theme to theme-aware editor adapters. Workspace Loom and app-owned component styles consume semantic CSS variables with complete light/dark token pairs rather than scattered hard-coded surface colors. Keyboard resizing/collapse semantics, visible focus, reduced-motion behavior, and AI-disabled teardown remain authoritative.
**Baseline:** The app currently starts in `mode: "launch"`, and `AppContent` conditionally renders `LaunchScreen`; `GO_HOME` resets to that route, the Toolbar exposes a House button labeled `Back to Home`, system file-open and native close handling contain launch-only branches, and F016's recent Workspace/file UI lives inside Home. Once a session opens, `EditorLayout` already owns the three required boundaries: optional left `WorkspaceExplorer`, central `DocumentEditorHost`, and independent right Agent. Standalone mode omits the left region, the Agent shell contains a redundant outer header, Workspace defaults to 220px, Agent defaults to 300px, and the current no-document host only says to open a file from Workspace Explorer. `ActiveAgentEditorBinding` contains a document, editor extension, `activeContextId`, bounded context builder, Tool executor, Change Set description, and safe Apply callback, but no generic user-facing context labels. F039 recommends Workspace Loom and preserves its design research, mockup, viewport evidence, and cross-product interaction mapping under `docs/design-research/f039-workspace-agent-layouts/`. The Settings schema, default value, normalization, persistence, and General Appearance control already accept `system`, `light`, and `dark`, but no production code reads that preference to resolve or apply a theme; the app has no root theme attribute, OS color-scheme listener, dark token set, or app-to-Excalidraw theme bridge. The native main window is 1200×850 by default and cannot shrink below 850×850.
**Exit Criteria:** A fresh launch renders the production shell immediately and no `LaunchScreen`, Home route, Home button, or Home-only close/file-open branch remains. Empty, Workspace, and Standalone states all use the same shell lifecycle. In the empty state, New File, Open Workspace, Open File, Settings, recent Workspaces, and recent files remain keyboard-accessible from the left region; the center explains the next action; and enabled Agent renders truthful no-file/provider guidance without enabling the composer prematurely. Opening a Workspace mounts the real Explorer at left and restores its active file normally; opening a standalone file keeps the Workspace rail/start access at left; closing/resetting a session reaches the empty shell only after Save/Discard/Cancel and recovery cleanup rules pass. The Toolbar retains Open, Save, document identity, and Settings without a Home action. At 1440×900 and 1200×850 both outer regions, center editor, native title-bar insets, and editor-owned navigators remain coherent; at 1100×850 Workspace compacts to a 48px rail while Agent remains usable; at 850×850 both outer columns provide independent 48px restore rails by default, the center remains directly usable, and expanding either panel causes no overlap or page-level horizontal overflow. AI disabled mounts no Agent host/divider/context lifecycle. When an editor is active, the Agent visibly names the local document and current editor-provided page/selection context; switching documents, pages, or selections updates or clears those labels without stale data, and no editor-specific parsing enters the shell. Appearance offers English `Light`, `Dark`, and `System` choices; changing it updates every app-owned shell surface immediately without reload and persists across restart. System mode resolves from the operating system and updates live when its preference changes, while explicit Light/Dark ignore later OS changes. The document root exposes the resolved scheme and correct `color-scheme`; app-owned dialogs, menus, focus/disabled/error states, Markdown chrome/preview, Agent activity/composer, and Workspace content remain legible in both themes. Excalidraw controls follow the resolved app theme without changing saved scene/background colors or retaining an independent app-theme toggle. Agent Tools, direct editor mutations, Undo, save, recovery, external-change protection, Workspace side-effect rules, presentation capture-phase keyboard handling, focused tests, full frontend regression, production build, browser/native interaction checks, accessibility contrast/states, reduced motion, and diff checks pass.

## Task 1: Replace Home Routing with the Always-mounted Product Shell

**Outcome:** Startup, empty, Workspace, and Standalone flows use one shell while all launch actions and recent history remain available from the persistent left region.
**Files:**
- Modify: `docs/superplan/human/prd.md`
- Modify: `src/types.ts`
- Modify: `src/lib/appStoreReducer.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/DocumentEditorHost.tsx`
- Modify: `src/components/WorkspaceExplorer.tsx`
- Create: `src/components/WorkspaceSidebar.tsx`
- Create: `src/components/WorkspaceStart.tsx`
- Remove: `src/components/LaunchScreen.tsx`
- Modify: `src/index.css`
- Modify: `tests/appStoreReducer.test.mjs`
- Modify: `tests/editorChromeNavigation.test.mjs`
- Modify: `tests/documentEditorHost.test.mjs`
- Modify: `tests/workspaceExplorerWiring.test.mjs`
- Create: `tests/workspaceShell.test.mjs`
- Remove: `tests/launchScreen.test.mjs`

**Change Map:**
- product contract: replace Home/Editor Settings and Home Open File language with persistent Workspace-shell entry points; preserve real-file authority, shared dual-mode core, lazy metadata, editor registry, and Agent mutation safety
- application state/reducer: rename the initial mode to `empty`, replace `GO_HOME` with a session reset/close action, return the last standalone document close to the empty shell, and retain Workspace-with-no-active-file as Workspace Mode
- `AppContent`: always compose `EditorLayout`; route New/Open/recent callbacks into the shell; remove launch-only native close and system file-open shortcuts while preserving dirty-session coordination, startup recovery, Settings, and presentation
- Workspace region: keep a 44–48px command rail mounted in every mode; show the real Explorer for an open Workspace and a start/recent detail surface for empty or standalone sessions; reuse existing recent Workspace/file list/remove/open commands and established accessible Tabs/Tooltip/Dropdown primitives
- center/editor boundary: keep the registered editor as the only active document surface and replace the Workspace-only empty copy with directional English guidance that also works before a Workspace exists
- Toolbar: remove House/Home props, icon, separator, and copy; retain native drag regions, platform insets, document identity, Open, Save/Save As, and Settings
- shell tests: reject `LaunchScreen`, `mode === "launch"`, `GO_HOME`, and `Back to Home`; prove direct startup into the empty shell, action/recents accessibility, safe session reset, and unchanged Workspace/Standalone open behavior

**Verification:**
- `node --test tests/appStoreReducer.test.mjs tests/workspaceShell.test.mjs tests/editorChromeNavigation.test.mjs tests/documentEditorHost.test.mjs tests/workspaceExplorerWiring.test.mjs`
- Behavior cases: fresh startup; New File; Open Workspace; Open File; both recent lists and removal; Settings; empty native close; system file-open from empty and Dirty sessions; close/reset Save/Discard/Cancel; last standalone close; Workspace with no active file; startup recovery; no Home route or Home copy.

- [x] Add focused shell/state regressions that fail against the current Home-first routing.
- [x] Replace launch semantics and compose the persistent Workspace/start region without duplicating file or recent-history services.
- [x] Remove Home-only modules, props, branches, tests, and PRD statements after equivalent shell entry points exist.

## Task 2: Apply Workspace Loom Hierarchy and Visible Agent Context

**Outcome:** The production shell has the selected Workspace Loom identity, responsive outer-panel behavior, and truthful file/view/selection context without weakening editor or Agent ownership.
**Files:**
- Modify: `src/lib/agent/types.ts`
- Modify: `src/lib/panelSizing.ts`
- Modify: `src/components/WorkspaceSidebar.tsx`
- Modify: `src/components/WorkspaceStart.tsx`
- Modify: `src/components/WorkspaceExplorer.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/ResizableDivider.tsx`
- Modify: `src/components/RightSidebarHost.tsx`
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/MarkdownEditor.tsx`
- Modify: `src/index.css`
- Modify: `tests/panelSizing.test.mjs`
- Modify: `tests/agentShellLayout.test.mjs`
- Modify: `tests/agentPanel.test.mjs`
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/markdownEditorContract.test.mjs`
- Create: `tests/workspaceLoomLayout.test.mjs`

**Change Map:**
- design system: retain the existing precise desktop density and system UI reading face; use `ui-monospace` only for paths/context metadata; concentrate the aesthetic change in a deep-ink Workspace command rail, neutral editor surfaces, cobalt primary actions, pale-mint Agent surfaces, and teal context accents rather than recoloring editor-owned content
- Workspace Loom signature: render one compact `Working context` strip with a restrained teal accent and chips for the active local document and editor focus; do not extend a decorative line through the conversation, and remove elements that do not encode authority, focus, activity, or a safe action
- `ActiveAgentEditorBinding`: add a small generic presentation object for stable user-facing document/context labels and ordered chips; keep `activeContextId`, raw context objects, Tool descriptors/executor, and Change Set application as the behavioral authority
- editor adapters: IdeaSketch publishes the active Page label; Markdown publishes bounded cursor/selection wording; both clear and republish presentation data with the same lifecycle as their existing binding and do not expose mutable editor internals
- Agent composition: eliminate the redundant double Agent header, keep Thread/history/runtime controls intact, place the context strip above the activity stream, show safe no-binding/provider-required wording, and disable context-dependent actions when no binding exists
- responsive layout: preserve independent left/Agent state and last expanded widths; derive 1180px, 960px, and 850px effective presentations; expose 48px keyboard-operable restore rails; clamp expanded columns; hide only optional detail; prevent flex/grid children and editor-owned navigators from causing page overflow
- interaction quality: keep visible keyboard focus, separator ARIA values, pointer capture, collapse/restore labels, platform title-bar drag areas, and `prefers-reduced-motion` behavior; panel collapse or resize never changes the other outer panel, active editor, or Agent binding

**Verification:**
- `node --test tests/workspaceLoomLayout.test.mjs tests/panelSizing.test.mjs tests/agentShellLayout.test.mjs tests/agentPanel.test.mjs tests/ideaSketchEditor.test.mjs tests/markdownEditorContract.test.mjs tests/workspaceExplorerWiring.test.mjs`
- Viewport cases: 1440×900, 1200×850, 1100×850, and 850×850 in empty, Workspace, and Standalone states; expanded/collapsed left and right panels; AI disabled; provider-required; no active document; IdeaSketch Page switch; Markdown cursor/selection change; long paths/names; read-only file; reduced motion; keyboard-only rail/divider operation.

- [x] Add focused layout/context contracts for the Workspace Loom hierarchy, generic context presentation, independent rails, and compact breakpoints.
- [x] Recompose Workspace, editor, and Agent styling around one intentional token system without changing editor-owned content or runtime behavior.
- [x] Publish and verify current context from both registered editors, including stale-binding cleanup and safe no-context states.

## Task 3: Activate Light, Dark, and System Themes

**Outcome:** The existing Appearance preference controls a complete, persistent application theme and follows live operating-system changes in System mode.
**Files:**
- Modify: `docs/superplan/human/prd.md`
- Modify: `index.html`
- Create: `src/lib/theme.ts`
- Modify: `src/hooks/useSettings.tsx`
- Modify: `src/components/settings/GeneralSettings.tsx`
- Modify: `src/components/SettingsCenter.tsx`
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `src/components/MarkdownEditor.tsx`
- Modify: `src/index.css`
- Modify: `tests/settings.test.mjs`
- Modify: `tests/settingsCenter.test.mjs`
- Modify: `tests/slideCanvasProps.test.mjs`
- Create: `tests/themeRuntime.test.mjs`

**Change Map:**
- theme runtime: resolve the stored preference to `light` or `dark`, apply one root `data-theme`/`color-scheme` contract, subscribe and clean up OS preference changes only in System mode, and avoid duplicate theme state outside versioned Settings
- Settings integration: expose the resolved theme from `SettingsProvider`; keep the existing persistent `system`/`light`/`dark` values and render the three English choices with immediate feedback, keyboard access, and truthful saving/error state
- semantic tokens: provide complete light/dark Workspace Loom variables for canvas-neutral shell surfaces, text, borders, hover, selection, focus, danger, cobalt action, pale Agent, teal context, overlays, menus, Settings, notices, and empty states; convert affected app-owned hard-coded colors to those tokens
- editor integration: make Markdown editor/preview chrome theme-aware; pass the resolved theme into Excalidraw UI and remove its independent app-theme menu choice while preserving document `viewBackgroundColor` and serialized scene colors
- startup behavior: establish a system-compatible base background/color-scheme before the React shell paints, then let the hydrated persisted preference take authority without showing an unthemed white application surface

**Verification:**
- `node --test tests/themeRuntime.test.mjs tests/settings.test.mjs tests/settingsCenter.test.mjs tests/slideCanvasProps.test.mjs tests/markdownEditorContract.test.mjs tests/workspaceLoomLayout.test.mjs`
- Cases: fresh System default in light and dark OS states; live OS switch in System; explicit Light/Dark ignore OS events; preference persistence/reload; invalid legacy preference normalizes to System; Settings saving/error; empty/Workspace/Standalone shell; all responsive widths; dialogs/menus/notices; Agent no-binding/running/error; Markdown edit/split/preview; Excalidraw UI theme with unchanged document colors; visible focus and reduced motion.

- [x] Add focused theme-runtime and component contracts that fail while Appearance remains persistence-only.
- [x] Apply semantic Light/Dark Workspace Loom tokens and wire the resolved theme through app-owned surfaces and supported editor chrome.
- [x] Verify immediate switching, restart persistence, System listeners, Excalidraw content preservation, and accessible states in both resolved themes.

## Task 4: Verify and Deliver the Production Shell

**Outcome:** Workspace Loom is proven against the current frontend, native desktop lifecycle, local-file safety boundaries, and Superplan delivery contract.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F040-implement-workspace-loom-production-shell.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- regression evidence: startup/state replacement, action and recent-history continuity, Workspace/Standalone editor behavior, Agent activation/context, Light/Dark/System runtime, Settings, recovery, external changes, presentation, keyboard capture, and responsive panel ownership
- visual/native acceptance: exact region geometry, both resolved themes, live System switching, title-bar insets, overflow, truncation, focus, reduced motion, context accuracy, Agent no-binding/configuration states, and temporary local Workspace/file workflows
- progress metadata: complete F040 only after the stabilized implementation satisfies every exit criterion; refresh the generated plan index and create one separate task commit containing only F040 changes

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `npm run tauri dev`
- Browser/Tauri acceptance at 1440×900, 1200×850, 1100×850, and 850×850 using an isolated temporary Workspace and standalone files: direct startup; recent/open/new/settings; Workspace and standalone switching; save/reset/close decisions; independent panels; Light/Dark/System selection and live OS changes; AI disabled/provider-required; IdeaSketch and Markdown context updates; Agent edit plus native Undo and save; recovery/external-change notices; Preview keyboard behavior; restart.
- Browser console inspection for errors, missing assets, page-level overflow, inaccessible controls, and non-English user-facing copy.
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git status --short`

- [x] Run focused checks during implementation and the full frontend regression/build matrix once after behavior and layout stabilize.
- [x] Complete browser and native acceptance without mutating the user's real Workspace data, then compare the final diff with every exit criterion.
- [x] Mark F040 complete/done, refresh the plan index, and create a separate `feat(F040)` task commit containing only this feature.

## Delivery Evidence

- Removed the Home/Launch route and opened IdeaNote directly into one persistent `empty | workspace | standalone` shell with a 48px Workspace command rail, authoritative center editor, independent Agent column, and safe session-reset flow.
- Implemented responsive Workspace Loom behavior at the approved viewports: both outer details at 1440x900 and 1200x850, compact Workspace rail with usable Agent at 1100x850, and independent 48px restore rails at 850x850. Browser geometry checks found no page-level horizontal overflow or fresh-console application errors.
- Added a compact presentation-only `Working context` strip. It names the current local file and editor-owned Page or Markdown selection context without changing Agent payloads, Tool permissions, direct-mutation behavior, AI-disabled teardown, or editor-format ownership.
- Activated persistent Light, Dark, and System themes with immediate root `data-theme` and `color-scheme` updates. System mode alone subscribes to live operating-system changes; Markdown/CodeMirror and Excalidraw chrome follow the resolved theme while document-owned canvas colors remain unchanged.
- The final frontend regression passed 361/361 tests, `npm run build` completed successfully, and `git diff --check` passed. Vite reported only the existing dynamic-import and large-chunk warnings.
- Native Tauri compilation and startup succeeded using an isolated development identity (`com.zhengxiwan.idea-slide.devtest`, product name `IdeaNote Dev`) so the installed production application was not replaced. Computer Use could not expose the WKWebView accessibility tree before timeout, so native visual acceptance is supported by successful native startup plus the browser viewport/interaction evidence rather than a second native accessibility-tree inspection.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F039-workspace-first-ai-agent-layout-concepts.md`
- `docs/design-research/f039-workspace-agent-layouts/README.md`
- `docs/design-research/f039-workspace-agent-layouts/sources/comparison.md`
- `docs/design-research/f039-workspace-agent-layouts/mockups/workspace-loom.html`
- `docs/superplan/plans/03-multifile-workspace-shell.md`
- `docs/superplan/plans/06-single-active-editor.md`
- `docs/superplan/plans/bugs/B023-separate-agent-right-column.md`
- `docs/superplan/plans/features/F004-refine-editor-shell.md`
- `docs/superplan/plans/features/F013-compact-workspace-and-navigator-layout.md`
- `docs/superplan/plans/features/F016-refine-launch-actions-and-add-recent-workspaces.md`
- `docs/superplan/plans/features/F020-raise-minimum-window-height.md`
- `docs/superplan/plans/features/F027-simplify-workspace-explorer-root-header.md`
- `docs/superplan/plans/features/F031-configurable-ai-agent/F031-01-settings-and-ai-gating.md`
- `docs/superplan/plans/features/F035-agent-history-codex-runtime-and-streaming-activity.md`
- `docs/superplan/plans/features/F038-markdown-editor-and-agent-extension/F038-02-markdown-agent-skill-and-tools.md`
- `src/App.tsx`
- `src/components/EditorLayout.tsx`
- `src/components/WorkspaceExplorer.tsx`
- `src/components/AgentPanel.tsx`
- `src/lib/agent/types.ts`
- `src/lib/settings.ts`
- `src/hooks/useSettings.tsx`
- `src/components/settings/GeneralSettings.tsx`
