---
id: "F015"
title: "Select the Workspace Filename Stem During Rename"
type: "feature"
status: "complete"
summary: "Match VS Code inline rename by initially selecting a file's stem while leaving its extension visible and deliberately editable."
source: "docs/superplan/human/features.md"
created: "2026-08-05"
order: 15
depends_on: ["F013"]
parent: ""
---

# Select the Workspace Filename Stem During Rename Plan

**Goal:** Make Workspace file renaming safer and faster by preserving the visible extension outside the initial text selection.
**Scope:** When inline rename starts from F2, the row Rename action, or the automatic post-create flow, initially select only the portion before a file's final extension. Keep the extension in the input and allow users to edit it deliberately. Select the complete name for directories, extensionless files, and leading-dot files.
**Non-Goals:** This feature does not lock extensions, change rename validation or filesystem operations, alter commit/cancel behavior, add file-type-specific extension rules, or change Page and Camera rename interactions.
**Architecture:** Keep `WorkspaceResourceRow` as the inline-rename owner. A small pure selection helper derives the initial selection end from the entry kind and name, and the existing rename-focus effect applies that range after the input mounts. Rename submission continues through the current `onRename` callback and native Workspace command boundary.
**Baseline:** `WorkspaceResourceRow` currently calls `inputRef.current?.select()` whenever rename mode begins, which selects the entire name including the extension for every entry. All three rename entry paths converge on the same `isRenaming` state, so one selection policy can cover them without changing Explorer orchestration.
**Exit Criteria:** Starting rename for `drawing.is` selects `drawing` while `.is` remains visible; starting rename for `archive.tar.gz` selects `archive.tar`; directories, `README`, and `.gitignore` select their complete names. F2, the Rename row action, and post-create rename use the same behavior. Enter, blur, and Escape retain their existing commit/cancel semantics, and focused tests, the full frontend suite, production build, and diff checks pass.

## Task 1: Apply and Verify the Filename-stem Selection Policy

**Outcome:** Workspace inline rename consistently applies the VS Code-style initial selection without restricting deliberate extension edits.
**Files:**
- Create: `src/lib/workspaceRename.ts`
- Modify: `src/components/WorkspaceResourceRow.tsx`
- Create: `tests/workspaceRename.test.mjs`
- Modify: `tests/workspaceExplorerWiring.test.mjs`

**Change Map:**
- `src/lib/workspaceRename.ts`: pure initial-selection boundary for directories, conventional extensions, multi-dot filenames, extensionless names, and leading-dot files
- `WorkspaceResourceRow`: focus the rename input and set the computed selection range for every rename entry path
- focused tests: assert the filename cases and protect the row's use of the shared selection policy while preserving commit/cancel wiring

**Verification:**
- `node --test tests/workspaceRename.test.mjs tests/workspaceExplorerWiring.test.mjs`
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`

- [x] Add focused failing selection-policy and row-wiring regressions.
- [x] Implement the shared selection policy and apply it when inline rename begins.
- [x] Run focused and full verification, then record completion evidence and deliver F015 in a separate commit.

## Completion Evidence

- Test-first focused verification initially failed because the selection helper did not exist and `WorkspaceResourceRow` still selected the complete input value; after implementation, `node --test tests/workspaceRename.test.mjs tests/workspaceExplorerWiring.test.mjs` passed all 6 tests.
- Selection-policy coverage proves `drawing.is` selects `drawing`, `archive.tar.gz` selects `archive.tar`, and directories, extensionless names, leading-dot files, and trailing-dot names select their complete values.
- `node --test tests/*.test.mjs` passed all 189 frontend tests, including the existing WebKit Workspace interaction regression.
- `npm run build` passed TypeScript checking and the Vite production build; only the existing Excalidraw mixed-import and large-chunk informational warnings remain.
- `git diff --check` passed, and final review confirmed that filesystem rename, Enter/blur commit, Escape cancel, drag, selection, and open behavior are unchanged.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/03-multifile-workspace-shell.md`
- `docs/superplan/plans/06-single-active-editor.md`
- `docs/superplan/plans/features/F002-workspace-resource-explorer.md`
- `docs/superplan/plans/features/F008-framework-workspace-tree-icons.md`
- `docs/superplan/plans/features/F013-compact-workspace-and-navigator-layout.md`
- `src/components/WorkspaceExplorer.tsx`
- `src/components/WorkspaceResourceRow.tsx`
- `tests/workspaceExplorerWiring.test.mjs`
