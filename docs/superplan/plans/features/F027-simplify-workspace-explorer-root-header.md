---
id: "F027"
title: "Simplify Workspace Explorer Root Header"
type: "feature"
status: "complete"
summary: "Keep Workspace actions visible, remove the Workspace-name root row, and align top-level entries with the Explorer edge."
source: "docs/superplan/human/features.md"
created: "2026-08-06"
order: 27
depends_on: ["F010", "F013", "F014"]
parent: ""
---

# Simplify Workspace Explorer Root Header Plan

**Goal:** Reduce Workspace Explorer chrome so its commands remain immediately available while the file hierarchy starts at the panel's natural left edge.
**Scope:** Replace the hover-revealed synthetic Workspace root row with a persistent compact action bar containing New File, New Folder, Refresh Workspace, and Workspace Tree Actions. Remove the visible Workspace name and its folder icon, render top-level directories/files without the extra synthetic-root indentation, and retain a visible root drop destination for moves back to the Workspace root. Preserve the existing action callbacks, English tooltips and accessible names, read-only creation rules, expansion behavior, selection, rename, Trash, and document status indicators.
**Non-Goals:** This feature does not rename the Workspace elsewhere, change filesystem paths or sorting, remove any Workspace command, redesign entry-row hover actions, change sidebar sizing or collapse behavior, modify Page/Camera navigators, change file creation menus, or alter save/autosave behavior.
**Architecture:** `WorkspaceExplorer` remains the owner of Workspace commands, expansion state, and drag completion. The synthetic `WorkspaceRootRow` and `rootName` prop are removed; a dedicated persistent action bar outside the ARIA tree owns the existing root `useDroppable` target and drop feedback. Real Workspace entries return to root-relative visual depth, while `WorkspaceResourceRow` continues to derive correct ARIA levels from its supplied depth. `EditorLayout` stops forwarding the now-unused Workspace name. Existing `ToolbarAction`, Tooltip, Dropdown Menu, Lucide icons, and panel design tokens remain authoritative.
**Baseline:** The Explorer currently renders the Workspace name as a synthetic level-one tree item, nests every real entry one level deeper, and absolutely overlays its action group only on hover or focus. This consumes horizontal space, hides frequent commands at rest, and leaves top-level directories visibly indented even when the Workspace label is not useful.
**Exit Criteria:** Workspace actions are visible without hover or keyboard focus at normal and minimum sidebar widths. The Workspace name and synthetic root folder icon are absent. Top-level entries use the first hierarchy level and move left by one indentation step, with nested entries retaining relative indentation. New File, New Folder, Refresh Workspace, Expand all, and Collapse all remain functional and tooltip/accessibility labels remain English. Read-only mode hides only creation actions. Dragging an entry to the persistent action-bar root target still moves it to the Workspace root and shows drop feedback. Focused source/runtime tests, the complete frontend suite, production build, visual interaction inspection, and diff checks pass.

## Task 1: Lock the Persistent Header and Root-Level Hierarchy Contract

**Outcome:** Focused regressions define the removed Workspace label, always-visible commands, root-relative entry depth, and retained root-drop behavior before production edits.
**Files:**
- Modify: `tests/workspaceExplorerWiring.test.mjs`
- Modify: `tests/f012DragRuntime.test.mjs`

**Change Map:**
- Explorer source contract: reject `rootName`, `WorkspaceRootRow`, hover-only opacity/pointer-event rules, and the synthetic root tree item; require a persistent Workspace action bar and top-level `depth={depth}` projection
- accessibility contract: keep one `Workspace resources` tree whose real top-level entries resolve to ARIA level one, while the separate action bar retains accessible command labels and tooltips
- runtime drag contract: update expected tree rows to exclude the Workspace-name row and continue targeting `[data-workspace-root="true"]` for moves back to the root

**Verification:**
- `node --test tests/workspaceExplorerWiring.test.mjs tests/f012DragRuntime.test.mjs`

- [x] Add focused failing expectations for the simplified header and hierarchy without weakening existing command or drag coverage.
- [x] Confirm the current hover-only synthetic root fails only the newly requested acceptance boundaries.

## Task 2: Recompose the Workspace Explorer Header

**Outcome:** The Explorer presents a stable command strip and a left-aligned real file hierarchy while preserving all Workspace interactions.
**Files:**
- Modify: `src/components/WorkspaceExplorer.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/index.css`

**Change Map:**
- `WorkspaceExplorer`: remove `rootName` and `WorkspaceRootRow`; attach the root droppable to a persistent action bar outside the tree; render real entries at root-relative depth
- `EditorLayout`: remove the obsolete `rootName={state.workspace.name}` prop only
- `src/index.css`: replace absolute hover-reveal root-row styling with an always-visible compact action-bar layout and retain violet root-drop feedback, icon sizing, separator spacing, and minimum-width fit

**Verification:**
- Run the focused Task 1 suite.
- Interaction cases: commands are visible at rest; tooltips and menus open; creation/refresh/expand/collapse callbacks remain intact; read-only mode hides creation only; nested indentation remains legible; root drop feedback and movement still complete.

- [x] Remove the unused Workspace label surface and one level of artificial entry indentation.
- [x] Keep the action group permanently visible and preserve command, tooltip, read-only, and root-drop behavior.

## Task 3: Verify and Deliver F027

**Outcome:** The simplified Workspace header ships with current regression, build, visual, progress, and Git evidence.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F027-simplify-workspace-explorer-root-header.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- F027 feature and plan: completion state plus focused, full-suite, build, and visual evidence
- generated plan index: refreshed F027 lifecycle state

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- Browser/Tauri inspection at normal and 180px sidebar widths for persistent commands, absent Workspace name, left-aligned top-level entries, nested indentation, tooltips, menus, read-only behavior, and root drag target
- `git diff --check`
- `git status --short`

- [x] Run focused checks during implementation and the complete frontend regression/build matrix once the UI stabilizes.
- [x] Compare the final rendered layout with the request, complete F027 metadata, refresh the plan index, and create a separate `feat(F027)` commit containing only task changes.

## Delivery Evidence

- Test-first evidence: `node --test tests/workspaceExplorerWiring.test.mjs tests/f012DragRuntime.test.mjs` first failed because the Explorer source still exposed `rootName`/`WorkspaceRootRow` and the WebKit runtime still rendered `mock-workspace` as the first tree item. The stabilized focused suite passed all 5 tests, including cross-directory and Workspace-root drag completion.
- Full frontend regression passed: `node --test tests/*.test.mjs` (245 passed).
- Production frontend build passed: `npm run build`; only the existing Excalidraw mixed-import and large-chunk warnings remain.
- Browser inspection rendered the real `WorkspaceExplorer` with production CSS at 220px and the 180px minimum width. Both action bars were visible at rest and fit without overflow; at 180px the action bar and top-level row both began 7px from the panel edge, the last action retained an 11px right gap, and top-level rows used 7px padding while nested rows remained ARIA level two.
- Browser interaction confirmed the Explorer contains no Workspace-name row, exposes real entries at ARIA levels one/two, displays the New Folder tooltip, and keeps the tree menu functional (`4` visible rows -> `2` after Collapse all -> `4` after Expand all) with no browser console warnings or errors. The temporary preview harness was removed after inspection.
- `git diff --check` passed, and final review found no change to Workspace filesystem callbacks, read-only rules, drag collision policy, row actions, save behavior, or panel sizing.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F010-clarify-save-and-workspace-actions.md`
- `docs/superplan/plans/features/F013-compact-workspace-and-navigator-layout.md`
- `docs/superplan/plans/features/F014-simplify-file-and-navigator-controls.md`
- `src/components/WorkspaceExplorer.tsx`
- `src/components/WorkspaceResourceRow.tsx`
- `src/components/EditorLayout.tsx`
- `src/index.css`
- `tests/workspaceExplorerWiring.test.mjs`
- `tests/f012DragRuntime.test.mjs`
