---
id: "F055"
title: "Add Workspace from the Sidebar Header"
type: "feature"
status: "complete"
summary: "Let users add and open a Workspace from a compact plus action beside the Workspaces heading."
source: "docs/superplan/human/features.md"
created: "2026-08-12"
order: 70
depends_on: ["F046-01", "F051"]
parent: ""
---

# Add Workspace from the Sidebar Header Plan

**Goal:** Make adding another Workspace immediately discoverable from the persistent Workspace sidebar.
**Scope:** Add a compact `+` action to the right of the `Workspaces` section title. Activating it opens the existing native Workspace directory picker and passes the selected directory through the current safe Workspace open/navigation flow. Keep the existing empty-state `Open Workspace` action, recent Workspace list, and single active Workspace editor core unchanged.
**Non-Goals:** This feature does not create a directory on disk, add simultaneous multi-Workspace editing, change Workspace persistence or recent ordering, alter row-scoped file/folder creation, remove the empty-state action, add search, or change unsaved-document and Workspace-switch safeguards.
**Architecture:** Reuse the existing `WorkspaceSidebar.onOpenWorkspace(path?)` callback with no path so `EditorLayout` remains the sole coordinator for directory selection, safe session transition, opening, error handling, and navigation refresh. `WorkspaceSidebar` owns only the accessible header affordance and its compact visual treatment. Use the maintained Lucide `Plus` icon and existing tooltip primitive. This explicit human request narrowly supersedes F045/F046-01's earlier no-header-action UI choice without changing their filesystem or session architecture.
**Baseline:** `WorkspaceSidebar` currently renders `Workspaces` as a text-only section title, already imports `Plus`, and receives `onOpenWorkspace`, which opens a supplied recent root or invokes the existing directory picker when called without a path. The empty state already exposes `Open Workspace`. F051 established compact, accessible Workspace actions and B034 still owns broader shell parity work in `WorkspaceSidebar.tsx` and `src/index.css`, so this feature must keep its styling isolated and avoid unrelated token or geometry changes.
**Exit Criteria:** The `Workspaces` heading shows a right-aligned compact `+` button matching the supplied reference placement. The button has an English accessible name and tooltip, is reachable and activatable by keyboard, and calls `onOpenWorkspace()` exactly through the existing directory-picker flow. Selecting a directory adds it to Workspaces and makes it active under current behavior; cancelling does nothing; existing unsaved-transition, error, recent-list, active-tree, empty-state, Light/Dark/System, and narrow-sidebar behavior remain unchanged. Focused sidebar tests, the full frontend regression, production build, visual inspection, and diff hygiene pass.

## Task 1: Add the Accessible Header Action and Preserve Existing Workspace Semantics

**Outcome:** Users can add/open a Workspace from the section heading without introducing another file or session-management path.
**Files:**
- Modify: `src/components/WorkspaceSidebar.tsx`
- Modify: `src/index.css`
- Modify: `tests/workspaceSidebar.test.mjs`

**Change Map:**
- `WorkspaceSidebar` section heading: wrap the label and compact action in one aligned header row, render the Lucide plus button with `Add Workspace` accessible text/tooltip, and invoke the existing no-path `onOpenWorkspace` callback
- Workspace sidebar styling: size and align the action at the right edge while preserving B034 surface tokens, title typography, scroll geometry, and compact-width behavior
- focused contract: prove the header action is accessible, uses the maintained icon/tooltip primitive, and reuses `onOpenWorkspace()` while the empty-state action remains available

**Verification:**
- `node --test tests/workspaceSidebar.test.mjs`
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- Browser/native inspection: populated and empty Workspaces; directory-picker cancel/select; dirty-document switch decision; Light/Dark/System; keyboard focus; 254px and compact sidebar widths.
- `git diff --check`

- [x] Add a focused failing source/interaction contract for the Workspaces header action.
- [x] Implement the compact accessible button by reusing the existing open-Workspace callback and isolated sidebar styles.
- [x] Run focused and full verification, inspect the rendered placement against the supplied screenshot, then record completion evidence and deliver one `feat(F055)` commit.

## Delivery Evidence

- `node --test tests/workspaceSidebar.test.mjs`: all four focused Workspace sidebar contracts passed, including the accessible header action, tooltip, existing no-path open callback, and retained empty-state action.
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`: the stabilized full frontend regression passed.
- `npm run build`: strict TypeScript checking and the Vite production build passed; only the existing Excalidraw mixed static/dynamic import and large-chunk advisories remained.
- Local browser inspection at the normal 254px Workspace width measured a 24px button, 8px right inset, exact vertical centering with the section title, visible hover/focus treatment, and the `Add Workspace` tooltip. At an 850px viewport the button remained visible with zero horizontal overflow. The browser-only shell showed the expected missing-Tauri navigation error while layout inspection remained valid.
- Final source and diff inspection confirmed the action calls only `onOpenWorkspace()` and does not alter directory selection, session transition, recent-list, empty-state, or filesystem behavior.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F045-refine-review-demo-workspace-actions-and-document-chrome.md`
- `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-01-production-shell-workspaces-and-recents.md`
- `docs/superplan/plans/features/F051-add-workspace-tree-refresh-action.md`
- `docs/superplan/plans/bugs/B034-restore-reviewed-demo-parity-in-tauri.md`
- `src/components/WorkspaceSidebar.tsx`
- `src/components/EditorLayout.tsx`
- `src/index.css`
- Human-supplied Workspace sidebar screenshot from `2026-08-12`
