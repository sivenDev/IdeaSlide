---
id: "F010"
title: "Clarify Save Menu and Workspace Explorer Actions"
type: "feature"
status: "draft"
summary: "Remove redundant title-bar save choices and replace ambiguous Workspace header glyphs with a compact, clearly labeled Lucide action system."
source: "docs/superplan/human/features.md"
created: "2026-08-04"
order: 10
depends_on: ["F008"]
parent: ""
---

# Clarify Save Menu and Workspace Explorer Actions Plan

**Goal:** Make the title-bar save choices and Workspace Explorer header immediately understandable without adding visual density.
**Scope:** Keep the primary title-bar Save button, but remove the duplicate `Save` and exposed `Save All` rows from its adjacent dropdown so the dropdown contains only `Save As…`. Preserve Save All as an internal multi-document safety operation for shortcuts and exit coordination rather than a visible title-bar command. Redesign the Workspace Explorer header as a compact four-action strip using Lucide icons and shared visible tooltips: New File, New Folder, Refresh Workspace, and Workspace Tree Actions. Move the lower-frequency `Expand all` and `Collapse all` commands into the Workspace Tree Actions menu with readable labels and leading icons. Keep the Workspace name left-aligned and truncatable, retain the creation separator, and preserve all current callbacks and read-only rules.
**Non-Goals:** This plan does not remove the primary Save button, remove Save As, delete Save All coordination from keyboard shortcuts or unsaved-exit flows, change autosave, change file persistence, add new file types, alter Workspace selection/expansion state, redesign tree rows, add thumbnails, change sidebar width bounds, or restyle the rest of the editor shell.
**Architecture:** `Toolbar` remains the window-command composition boundary, but no longer receives `onSaveAll`; `EditorLayout` retains `handleSaveAll` for shortcut and session-exit safety while forwarding only Save and Save As to the visible toolbar. `WorkspaceExplorer` continues to own expansion state and creation callbacks. It will reuse `ToolbarAction`, shared Tooltip primitives, and the installed `lucide-react` package so header actions share the same interaction, focus, and icon language as the window toolbar. The visible header favors frequent creation/refresh actions; infrequent whole-tree operations become explicit menu rows rather than ambiguous standalone glyphs.
**Baseline:** The save dropdown currently repeats the adjacent primary Save command and exposes Save All even though the product uses one foreground editor. The Workspace header renders `＋`, `⌑`, `↻`, `⌃`, and `•••` text glyphs. These marks are font-dependent, the New Folder and Collapse All meanings are not recognizable, and the overflow contains only Expand All. Existing Lucide title-bar and tree-row icons already establish the framework icon language, and shared `ToolbarAction`/Tooltip primitives already provide accessible hover and focus hints.
**Exit Criteria:** The title bar retains its primary Save button and a save-options dropdown containing only `Save As…`; no visible Save All title-bar command remains, while Save All shortcut/exit behavior is unchanged. The Workspace header shows framework icons for New File, New Folder, Refresh Workspace, and Workspace Tree Actions with English accessible names and visible hover/focus tooltips. The tree menu contains icon-and-text `Expand all` and `Collapse all` commands. No legacy Workspace header glyph remains. Actions stay aligned and reachable at the 180px minimum sidebar width, the Workspace name truncates safely, read-only mode hides creation actions only, and focused UI tests, the full Node suite, production build, diff checks, and browser interaction verification pass.

## Task 1: Lock the Simplified Action Contract

**Outcome:** Focused regressions describe the exact visible save and Workspace header actions before production code changes.
**Files:**
- Modify: `tests/editorChromeNavigation.test.mjs`
- Modify: `tests/workspaceExplorerWiring.test.mjs`

**Change Map:**
- title-bar contract: retain the primary Save button and Save As row, reject duplicate Save and visible Save All dropdown rows, and keep generic file commands/title behavior
- Workspace header contract: require named Lucide header/menu icons, shared tooltip-capable actions, four visible actions, textual Expand/Collapse menu rows, and rejection of the legacy glyph set
- safety boundary: retain `EditorLayout` Save All shortcut/exit coordination and all Workspace callbacks/read-only conditions

**Verification:**
- `node --test tests/editorChromeNavigation.test.mjs tests/workspaceExplorerWiring.test.mjs`

- [ ] Add focused failing contracts for the simplified save dropdown and semantic Workspace actions.
- [ ] Confirm failures identify the duplicate menu rows and font glyph controls without rejecting retained Save All safety behavior.

## Task 2: Implement the Compact Semantic Action System

**Outcome:** Production UI uses fewer, clearer actions while preserving save and Workspace behavior.
**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/WorkspaceExplorer.tsx`
- Modify: `src/index.css`

**Change Map:**
- `Toolbar`: remove `SaveAll` and the duplicate Save/Save All dropdown items; keep Save, Save As, icons, status, centered title, and drag behavior
- `EditorLayout`: stop forwarding `onSaveAll` to `Toolbar` while retaining `handleSaveAll` for shortcuts and unsaved-session decisions
- `WorkspaceExplorer`: replace header glyphs with FilePlus2, FolderPlus, RefreshCw, Ellipsis, ChevronsDown, and ChevronsUp; use shared tooltip actions; move Collapse All beside Expand All in the tree-actions menu
- `src/index.css`: stabilize panel action SVG sizing and compact grouping at normal and minimum sidebar widths

**Verification:**
- Run the focused Task 1 suite.
- Browser cases: Save dropdown shows only Save As; each Workspace action exposes the expected tooltip; file/folder creation and refresh still fire; Expand/Collapse update the tree; read-only mode removes creation but leaves refresh/tree actions.

- [ ] Apply the smallest toolbar prop and menu cleanup without changing save coordination.
- [ ] Replace every Workspace header text glyph and simplify whole-tree operations into the labeled menu.
- [ ] Verify alignment, truncation, hover/focus hints, and callbacks at the 180px minimum panel width.

## Task 3: Verify and Deliver F010

**Outcome:** The clearer action system ships with regression, build, visual, and progress evidence.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F010-clarify-save-and-workspace-actions.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- F010 feature and plan: completed status plus implementation and interaction evidence
- generated plan index: refreshed F010 state

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Browser acceptance for title-bar save options and Workspace header actions/tooltips at normal and minimum sidebar widths.

- [ ] Run focused checks during implementation and the complete frontend regression/build matrix once stable.
- [ ] Record browser evidence, mark F010 done/complete, refresh the index, and create a separate `feat(F010)` commit excluding `AGENTS.md`.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/06-single-active-editor.md`
- `docs/superplan/plans/features/F005-align-workspace-camera-actions.md`
- `docs/superplan/plans/features/F007-framework-title-bar-icons.md`
- `docs/superplan/plans/features/F008-framework-workspace-tree-icons.md`
- `src/components/Toolbar.tsx`
- `src/components/EditorLayout.tsx`
- `src/components/WorkspaceExplorer.tsx`
- `src/components/ui/ToolbarAction.tsx`
- `src/components/ui/Tooltip.tsx`
- `src/index.css`
- `tests/editorChromeNavigation.test.mjs`
- `tests/workspaceExplorerWiring.test.mjs`
