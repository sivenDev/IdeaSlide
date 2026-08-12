---
id: "F051"
title: "Add a Workspace Tree Refresh Action"
type: "feature"
status: "complete"
summary: "Let users explicitly rescan the active Workspace directory from its root row and refresh the visible tree."
source: "docs/superplan/human/features.md"
created: "2026-08-12"
order: 61
depends_on: []
parent: ""
---

# Add a Workspace Tree Refresh Action Plan

**Goal:** Give users a clear manual way to synchronize the visible Workspace directory tree with the current files on disk.
**Scope:** Add an accessible refresh icon button to the active Workspace root row beside the existing create and overflow actions. Activating it rescans the active Workspace through the existing Tauri `refresh_workspace` boundary and replaces the visible tree entries with the returned safe, filtered snapshot. Keep expanded directories, the selected path, open documents, dirty editor content, watcher behavior, and Workspace metadata semantics intact; if the refresh fails, surface the existing concise Workspace error treatment without clearing the current tree.
**Non-Goals:** This feature does not add automatic polling, change filesystem watcher behavior, refresh standalone Recents, reload open document contents, reconcile external edits inside an editor, write Workspace files or metadata, add a refresh action to inactive Workspace roots, or redesign Workspace row actions beyond fitting the new control into the established compact action group.
**Architecture:** Reuse `EditorLayout.refreshTree` and `refreshWorkspace` as the only rescan path instead of introducing another filesystem command or client-side tree walk. Pass an active-root refresh callback into `WorkspaceSidebar`; render the control only for the active root because only that root owns the mounted tree state. Keep the operation asynchronous, preserve current tree state until a successful result is dispatched, and use the existing Workspace action error boundary for failure reporting. Use the maintained Lucide icon set and the existing compact tree-action styling with an explicit English accessible name and tooltip.
**Baseline:** `EditorLayout` already defines `refreshTree`, which invokes the Tauri `refresh_workspace` command and dispatches `SET_WORKSPACE_ENTRIES`; create, rename, move, and Trash flows reuse it after successful mutations. `WorkspaceSidebar` renders each root row with create and overflow actions but has no explicit rescan control. The native watcher normally projects external changes, but users currently have no direct recovery action when they want to force a fresh directory snapshot. B034 may adjust the same shell files for approved visual parity, so this feature must preserve its compact Workspace tokens and avoid broader geometry or styling changes.
**Exit Criteria:** The active Workspace root row shows a keyboard-accessible refresh icon between its existing create and overflow controls with a clear `Refresh <Workspace name>` accessible label and tooltip. Clicking it invokes one rescan for the active root, and a successful response updates added, removed, renamed, and newly supported visible entries without collapsing expanded directories, changing the current selection, closing or reloading open documents, discarding dirty content, or writing to disk. Inactive Workspace roots do not show or invoke the active-tree refresh control. Repeated activation cannot silently clear the tree on failure, and failures use the existing Workspace error presentation. The focused Workspace sidebar/wiring tests, complete frontend regression, strict production build, and diff hygiene pass.

## Task 1: Connect a Compact Root-row Refresh Control to the Existing Rescan Boundary

**Outcome:** Users can manually refresh the active Workspace tree from the root row without creating a parallel filesystem or state-management path.
**Files:**
- Modify: `src/components/WorkspaceSidebar.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/index.css`
- Modify: `tests/workspaceSidebar.test.mjs`
- Modify: `tests/workspaceExplorerWiring.test.mjs`

**Change Map:**
- `WorkspaceSidebar` props and active root actions: accept one refresh callback, render a Lucide refresh action only for the active root, and provide a stable accessible label/title while retaining create and overflow ordering
- `EditorLayout.refreshTree` and `WorkspaceSidebar` composition: expose the existing active Workspace rescan callback and route errors through `handleWorkspaceActionError` without replacing entries on rejection
- Workspace action styling: fit the third compact action into the current row hover/focus treatment without changing the sidebar's approved density or inactive-root layout
- focused contracts: prove active-only rendering, accessible naming, existing `refreshWorkspace` reuse, success dispatch, and failure preservation/error routing

**Verification:**
- `node --test tests/workspaceSidebar.test.mjs tests/workspaceExplorerWiring.test.mjs`
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- Manual native/browser cases: active and inactive Workspace roots; expanded nested directories; selected/open dirty file; files added/removed/renamed externally before refresh; repeated clicks; simulated command failure; Light/Dark/System; keyboard focus and tooltip; compact Workspace width.
- `git diff --check`

- [x] Add focused failing contracts for the active-root refresh affordance and the existing rescan/error boundary.
- [x] Add the compact accessible control and connect it to `refreshTree` without changing watcher, document, selection, or persistence semantics.
- [x] Run focused and full frontend verification, inspect the final UI/diff, then record completion evidence and deliver one `feat(F051)` commit.

## Delivery Evidence

- `node --test tests/workspaceSidebar.test.mjs tests/workspaceExplorerWiring.test.mjs`: 9 focused Workspace sidebar and wiring tests passed.
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`: the complete frontend regression passed.
- `npm run build`: strict TypeScript checking and the Vite production build completed successfully; only the existing chunk-size/dynamic-import advisory remained.
- `npm run tauri dev`: the native application compiled and launched successfully; only existing Rust dead-code warnings were reported.
- Source and diff inspection confirmed the refresh action is active-root-only, uses the existing 24px tree-action styling and maintained tooltip primitive, replaces entries only after a successful `refreshWorkspace` result, and routes rejection through the existing Workspace error dialog.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-01-production-shell-workspaces-and-recents.md`
- `docs/superplan/plans/bugs/B034-restore-reviewed-demo-parity-in-tauri.md`
- `src/components/WorkspaceSidebar.tsx`
- `src/components/EditorLayout.tsx`
- `src/lib/tauriCommands.ts`
- Human-supplied Workspace screenshot from `2026-08-12`
