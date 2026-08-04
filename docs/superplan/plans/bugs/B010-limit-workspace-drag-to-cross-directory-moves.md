---
id: "B010"
title: "Limit Workspace Dragging to Cross-Directory Moves"
type: "bugfix"
status: "complete"
summary: "Use stable, standard file-explorer dragging: Workspace entries move across directories without same-directory manual sorting or row distortion."
source: "docs/superplan/human/bugs.md"
created: "2026-08-04"
order: 10
depends_on: ["B009"]
parent: ""
---

# Limit Workspace Dragging to Cross-Directory Moves Plan

**Goal:** Make Workspace dragging predictable and visually stable by supporting only real cross-directory moves.
**Scope:** Workspace files and folders remain draggable, but valid destinations are only another writable directory or the Workspace root when that destination differs from the source parent. Remove same-directory before/after reordering and its drop lines. Siblings use the backend's deterministic directory-first/name order after open, refresh, watcher updates, and cross-directory moves. Existing schema-v3 `entryOrder` data remains readable for compatibility but is no longer applied or written as active ordering state and is cleared by the next normal state snapshot. Keep Page and Camera sortable lists unchanged. Preserve the dragged Workspace row's dimensions by rendering dnd-kit's translation only.
**Non-Goals:** This fix does not replace dnd-kit, change filenames to encode order, remove schema-v3 fields from Rust or stored JSON, add multi-select or cross-Workspace dragging, change Page/Camera sorting, or modify filesystem collision, cycle, read-only, watcher, save, autosave, and conflict-safety rules.
**Architecture:** Workspace rows expose one full-height `inside` droppable target only for eligible directories, plus the existing root target. Collision selection excludes the source's current parent so same-directory drops provide no feedback and cannot invoke `onMove`. `EditorLayout` accepts only parent-changing projections, completes the existing native `moveWorkspaceEntry` transaction, remaps open paths, then refreshes without a custom order override. Workspace open and state snapshot paths tolerate legacy `entryOrder` but project and persist deterministic scan order instead. `WorkspaceResourceRow` serializes `useDraggable` coordinates with dnd-kit's translation-only utility so root or directory target geometry cannot scale the row.
**Baseline:** B009 supports before/inside/after zones and persists a custom sibling order. Partial-height zones cause dnd-kit to calculate scale from the target rectangle, and the row currently renders that scale. Same-parent reorder also introduces behavior uncommon in file explorers and requires custom order state.
**Reproduction:** Drag a Workspace file over a before, after, or folder-inside target and hold before release. The active row compresses vertically. Dropping before or after a sibling in the same directory changes a manually persisted order even though the user expects filesystem-style movement between directories.
**Root Cause:** Workspace combines two different interactions—filesystem reparenting and free-form sibling ordering—on one drag surface. Partial ordering zones become dnd-kit collision rectangles, and their scale metadata is rendered on the whole row. The custom `entryOrder` projection then preserves same-directory positions instead of returning to deterministic filesystem ordering.
**Exit Criteria:** Same-directory dragging produces no drop highlight, move request, order mutation, or metadata-only reorder. Dragging a file or eligible folder into a different directory or the root completes the existing native move once, remaps active/open paths, and refreshes into deterministic directory-first/name order. The active row retains its original dimensions over directory and root targets. Legacy schema-v3 state opens safely without applying custom order, the next state snapshot writes an empty order, and Page/Camera sorting remains unchanged. Focused WebKit, Workspace state/reducer/wiring, full frontend, build, and diff checks pass.

## Task 1: Restrict Workspace Drop Targets to Other Directories

**Outcome:** Workspace dragging exposes only meaningful cross-directory destinations and never performs same-parent ordering.
**Files:**
- Modify: `src/components/WorkspaceExplorer.tsx`
- Modify: `src/components/WorkspaceResourceRow.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/index.css`
- Modify: `tests/f012DragRuntime.test.mjs`
- Modify: `tests/workspaceExplorerWiring.test.mjs`
- Modify: `tests/appStoreReducer.test.mjs`

**Change Map:**
- Workspace collision policy: keep only directory/root `inside` targets and exclude the source's current parent
- resource rows: remove before/after droppables and ordering-line feedback; keep a full-height directory target and explicit drag handle
- editor transaction: reject same-parent requests, perform native reparent once, remap paths, and refresh without applying a projected sibling order
- WebKit behavior: prove same-parent attempts are inert and cross-directory folder/root moves still complete

**Verification:**
- `node --test tests/f012DragRuntime.test.mjs tests/workspaceExplorerWiring.test.mjs tests/appStoreReducer.test.mjs tests/workspaceState.test.mjs`
- Cases: root-to-root and nested-to-current-parent no-op; file/folder into another directory; nested entry to root; collision/descendant/read-only/Symlink/Missing rejection.

- [x] Add failing behavior assertions for inert same-parent dragging and unchanged cross-directory movement.
- [x] Remove same-directory ordering targets without weakening native move and path-remap safety.

## Task 2: Restore Deterministic Workspace Order and Stable Drag Geometry

**Outcome:** Workspace siblings return to deterministic scan order and dragged rows never inherit target scaling.
**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/lib/tauriCommands.ts`
- Modify: `src/lib/workspaceState.ts`
- Modify: `src/components/WorkspaceResourceRow.tsx`
- Modify: `docs/workspace-format.md`
- Modify: `tests/f012DragRuntime.test.mjs`
- Modify: `tests/tauriCommands.test.mjs`
- Modify: `tests/workspaceState.test.mjs`
- Modify: `tests/workspaceExplorerWiring.test.mjs`

**Change Map:**
- drag rendering: declare `@dnd-kit/utilities` directly and use its translation-only CSS serializer
- Workspace open: accept legacy schema-v3 `entryOrder` but do not apply it to scanned entries or session order
- Workspace state snapshot: persist an empty order and stop treating manual order as a metadata-creation trigger
- format documentation: mark `entryOrder` as a retained compatibility field that current clients ignore and clear on normal state persistence
- WebKit geometry regression: compare row dimensions before drag and while held over directory/root targets

**Verification:**
- `node --test tests/f012DragRuntime.test.mjs tests/tauriCommands.test.mjs tests/workspaceState.test.mjs tests/workspaceExplorerWiring.test.mjs`
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`

- [x] Add failing regressions for legacy custom-order suppression, empty order snapshots, and stable dragged-row dimensions.
- [x] Preserve schema compatibility while returning Workspace presentation and persistence to deterministic order.
- [x] Verify the focused and full frontend suites, complete B010, and create a separate `fix(B010)` commit.

## Completion Evidence

- Test-first WebKit evidence reproduced the distorted active row at `34px → 14.953125px`; the stabilized regression keeps the height within 1px over both directory and root targets.
- Same-parent dragging is inert, while cross-directory and root moves invoke `move_workspace_entry` exactly once each and refresh only after those two real moves.
- Focused Workspace/runtime/state/command/reducer regressions passed, including legacy `entryOrder` suppression and empty state snapshots.
- `node --test tests/*.test.mjs` passed all 181 frontend tests.
- `npm run build` and `git diff --check` passed; Vite emitted only the existing Excalidraw mixed-import and large-chunk warnings.

## References
- `docs/superplan/plans/features/F012-drag-sort-workspace-pages-and-cameras.md`
- `docs/superplan/plans/bugs/B009-keep-f012-drag-targets-active-through-drop.md`
- `src/components/WorkspaceExplorer.tsx`
- `src/components/WorkspaceResourceRow.tsx`
- `src/components/EditorLayout.tsx`
- `src/lib/tauriCommands.ts`
- `src/lib/workspaceState.ts`
- `tests/f012DragRuntime.test.mjs`
