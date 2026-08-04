---
id: "F013"
title: "Compact Workspace and Navigator Layout"
type: "feature"
status: "complete"
summary: "Remove the Workspace handle column, promote the Workspace name into the tree root, and use narrower side-panel defaults with the IdeaSketch navigator open initially."
source: "docs/superplan/human/features.md"
created: "2026-08-04"
order: 13
depends_on: ["B010"]
parent: ""
---

# Compact Workspace and Navigator Layout Plan

**Goal:** Give the editor more Canvas space while making Workspace dragging and hierarchy feel like a compact desktop file explorer.
**Scope:** Remove the visible six-dot drag-handle column from Workspace rows and make the row's icon/name content the dnd-kit activator, with the existing pointer threshold and isolated disclosure, rename, Trash, and status controls. Replace the separate Workspace-name header treatment with one synthetic tree-root row containing the Workspace name and existing actions; root entries render beneath it and the root row is the visible destination for moves back to the Workspace root. Reduce the Workspace default width from 240px to 220px while retaining the 180–420px resize bounds. Reduce the fixed IdeaSketch Page/Camera navigator width from 244px to 220px and initialize it open for a newly mounted IdeaSketch editor, while preserving its divider toggle. Keep Page and Camera drag sorting and row controls unchanged.
**Non-Goals:** This feature does not replace dnd-kit, remove Page/Camera drag affordances, persist panel visibility or width, make the right navigator resizable, change Workspace filesystem movement or deterministic ordering, add thumbnails, redesign the toolbar, alter the existing neutral/violet visual system, or change document save/autosave behavior.
**Architecture:** `WorkspaceResourceRow` keeps one focusable, accessible row-content activator instead of a dedicated handle button, so normal selection/open behavior and keyboard dragging share the meaningful content surface while child controls remain independent. `WorkspaceExplorer` renders a non-filesystem synthetic root tree item inside the scroll/tree boundary, reuses the existing root droppable contract on that row, preserves all four Workspace commands, and increases real-entry ARIA/depth projection by one visual level. `panelSizing` remains the left-panel policy owner. `IdeaSketchEditor` retains session-local right-panel visibility and its fixed-width boundary, changing only the initial state and shared compact width. Existing editor-shell tokens, row heights, focus rings, and violet drag feedback remain authoritative.
**Baseline:** Workspace rows reserve a permanent leading column for `GripVertical`; the Workspace name sits in a separate action header above root-level entries, and the root drop target is an otherwise empty surface after the list. The left panel defaults to 240px. IdeaSketchEditor fixes the right navigator at 244px and initializes it hidden. Page and Camera sorting already use dnd-kit and must remain untouched.
**Exit Criteria:** Workspace rows show no six-dot handle or empty handle gutter. Pointer dragging starts from the icon/name area after the existing movement threshold; clicking still selects/opens, folder disclosure remains independent, rename/Trash do not initiate drag, and keyboard dragging remains accessible. The Workspace name appears once as the first tree-root row with the existing actions and root-drop feedback, and real entries are visually nested below it. The Workspace opens at 220px and still resizes/collapses within 180–420px. A newly mounted IdeaSketch editor opens its 220px Pages navigator by default and can still collapse/restore it. Page/Camera sorting behavior and controls remain unchanged. Focused WebKit/UI contracts, the full frontend suite, production build, diff checks, and compact-width interaction checks pass.

## Task 1: Promote Workspace Root and Remove the Handle Column

**Outcome:** The Workspace tree has one compact root row and uses meaningful row content as the drag activator without weakening interaction isolation.
**Files:**
- Modify: `src/components/WorkspaceExplorer.tsx`
- Modify: `src/components/WorkspaceResourceRow.tsx`
- Modify: `src/index.css`
- Modify: `tests/workspaceExplorerWiring.test.mjs`
- Modify: `tests/f012DragRuntime.test.mjs`

**Change Map:**
- Workspace root composition: move `rootName` and the existing action group into a synthetic root tree item and attach the root droppable feedback to that row
- real-entry hierarchy: render existing entries one visual/ARIA level below the root without changing their root-relative filesystem paths
- row activation: delete `GripVertical` and its dedicated button, attach dnd-kit activator attributes/listeners to the icon/name content surface, and keep disclosure/input/actions isolated
- compact styling: remove the reserved handle gutter, add root-row hierarchy/drop states, and retain existing focus, selection, status, and violet interaction tokens
- WebKit behavior: target the new content activator/root row and prove selection, cross-directory/root movement, and action isolation still work

**Verification:**
- `node --test tests/f012DragRuntime.test.mjs tests/workspaceExplorerWiring.test.mjs`
- Cases: content-area pointer drag; simple click/open; folder disclosure; rename/Trash isolation; directory drop; root-row drop; read-only/Symlink/Missing restrictions; no visible Workspace `GripVertical`.

- [x] Add failing UI/runtime contracts for the root row and handle-free content activator.
- [x] Recompose the root and row activation surfaces without changing Workspace move semantics.

## Task 2: Tighten Side-Panel Defaults

**Outcome:** Both side panels release more Canvas width, and the IdeaSketch navigator is immediately available on open.
**Files:**
- Modify: `src/lib/panelSizing.ts`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `tests/panelSizing.test.mjs`
- Modify: `tests/panelDividerWiring.test.mjs`
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/ideaSketchNavigator.test.mjs`

**Change Map:**
- Workspace sizing policy: change only the default from 240px to 220px and retain the 180px minimum, 420px maximum, and session-local resizing
- IdeaSketch navigator: use a 220px fixed width and initialize `showNavigator` to true while preserving Pages as the initial tab and the existing divider/Main Menu toggles
- regression contracts: replace the hidden-by-default assumptions and verify both compact widths without changing right-panel resize ownership

**Verification:**
- `node --test tests/panelSizing.test.mjs tests/panelDividerWiring.test.mjs tests/ideaSketchEditor.test.mjs tests/ideaSketchNavigator.test.mjs`
- Interaction cases: Workspace initial width 220px; clamp remains 180–420px; IdeaSketch starts on an open 220px Pages navigator; collapse and restore still work; Camera-triggered opening still selects Cameras.

- [x] Add failing panel-default contracts for 220px widths and the open-by-default IdeaSketch navigator.
- [x] Apply the compact defaults without adding persistence or right-panel resizing.

## Task 3: Verify and Deliver F013

**Outcome:** The compact layout ships after B010 without regressing Workspace movement, navigator behavior, or Page/Camera sorting.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F013-compact-workspace-and-navigator-layout.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- F013 feature/plan: completion state and current interaction/build evidence
- generated plan index: refreshed F013 status after B010 delivery

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Browser/Tauri acceptance at 220px: root-row hierarchy and actions, content-area drag, directory/root move, selected/open behavior, both panel toggles, Pages/Cameras sorting, and Canvas pointer alignment.

- [x] Run the focused and complete frontend verification matrix once implementation stabilizes.
- [x] Review the final diff, complete F013, refresh progress, and create a separate `feat(F013)` commit.

## Completion Evidence

- Focused Workspace drag, hierarchy, panel sizing, divider, and navigator contracts passed all 14 tests, including the WebKit content-activator and root-row drop regression.
- The WebKit drag regression confirmed same-parent dragging stays inert, cross-directory/root moves still complete once, dragged-row height stays stable, and content dragging does not open the source file.
- Browser acceptance measured the Workspace and IdeaSketch navigator at 220px, confirmed root actions appear on hover, and verified both panels collapse to 0px and restore to 220px.
- Visual inspection confirmed the Workspace name remains readable in the synthetic root row, real entries are nested beneath it, and the Pages navigator opens by default without crowding the Canvas.
- `node --test tests/*.test.mjs` passed all 181 frontend tests; `npm run build` and `git diff --check` passed with only the existing Excalidraw mixed-import and large-chunk warnings.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F003-canvas-presentation-controls.md`
- `docs/superplan/plans/features/F004-refine-editor-shell.md`
- `docs/superplan/plans/features/F006-revision-c-editor-shell-defaults.md`
- `docs/superplan/plans/features/F008-framework-workspace-tree-icons.md`
- `docs/superplan/plans/features/F009-tabbed-ideasketch-navigator.md`
- `docs/superplan/plans/features/F010-clarify-save-and-workspace-actions.md`
- `docs/superplan/plans/features/F012-drag-sort-workspace-pages-and-cameras.md`
- `docs/superplan/plans/bugs/B009-keep-f012-drag-targets-active-through-drop.md`
- `docs/superplan/plans/bugs/B010-limit-workspace-drag-to-cross-directory-moves.md`
- `src/components/WorkspaceExplorer.tsx`
- `src/components/WorkspaceResourceRow.tsx`
- `src/components/IdeaSketchEditor.tsx`
- `src/lib/panelSizing.ts`
