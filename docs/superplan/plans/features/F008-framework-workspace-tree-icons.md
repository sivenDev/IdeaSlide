---
id: "F008"
title: "Standardize Workspace Tree Icons"
type: "feature"
status: "complete"
summary: "Replace duplicated text glyphs in Workspace rows with clear Lucide disclosure, entry-type, and row-action icons."
source: "docs/superplan/human/features.md"
created: "2026-08-03"
order: 8
depends_on: ["F007"]
parent: ""
---

# Standardize Workspace Tree Icons Plan

**Goal:** Make the Workspace tree immediately readable by giving hierarchy, file type, and row actions distinct framework icons.
**Scope:** Reuse the installed `lucide-react` dependency in `WorkspaceResourceRow`. Replace the text disclosure marks with `ChevronRight` and `ChevronDown`; show `Folder` or `FolderOpen` as the directory entry icon instead of a second triangle; show `FilePenLine` for IdeaSketch `.is` documents, `File` for unsupported files, and `ExternalLink` for Symlinks. Replace the hover-only rename and Trash characters with `Pencil` and `Trash2`. Preserve row height, indentation, icon slots, labels, callbacks, drag/drop, selection styling, keyboard behavior, Symlink non-recursion, and accessible action names.
**Non-Goals:** This plan does not change the Workspace header action bar, add file thumbnails, change file-type detection, redesign row spacing or selection colors, alter folder expansion semantics, add new resource types, or migrate icons outside `WorkspaceResourceRow`.
**Architecture:** `WorkspaceResourceRow` remains the single row interaction boundary. Its local `EntryIcon` maps backend `WorkspaceEntry` metadata to decorative Lucide components, while the existing disclosure button retains the interactive expanded state and ARIA label. Shared CSS continues to own fixed icon slots and colors, adding explicit SVG sizing so glyph metrics no longer affect alignment. A focused source contract protects the icon mapping and prevents the legacy disclosure, diamond, link, rename, and delete characters from returning.
**Baseline:** Directory rows currently render `⌄` or `›` in the disclosure button and then render `▾` or `▸` again inside `EntryIcon`, producing the duplicated arrows visible in the screenshot. IdeaSketch files use `◇`, Symlinks use `↗`, unsupported files use `·`, and row actions use `✎` and `×`. Their visual weight and platform font metrics differ from the Lucide title-bar icons delivered by F007.
**Exit Criteria:** Each directory row shows one disclosure Chevron followed by one Folder/FolderOpen icon; IdeaSketch, unsupported file, and Symlink rows show distinct framework icons in the same fixed slot. Rename and Trash actions use framework icons while retaining their existing hover/focus visibility and accessible labels. No legacy row glyph remains. Indentation, selection, rename, drag/drop, open/expand, keyboard, and safe unsupported/Symlink behavior remain unchanged. Focused tests, the full Node suite, production build, diff checks, and an isolated Tauri visual smoke check pass.

## Task 1: Lock the Workspace Row Icon Contract

**Outcome:** A focused regression contract captures the requested Lucide hierarchy and file-type mapping before implementation.
**Files:**
- Modify: `tests/workspaceExplorerWiring.test.mjs`

**Change Map:**
- row icon contract: require named Lucide imports and disclosure, folder, IdeaSketch, generic file, Symlink, rename, and Trash components
- regression boundary: reject the legacy `⌄`, `›`, `▾`, `▸`, `◇`, `↗`, `·`, `✎`, and `×` row glyphs
- behavior boundary: retain current ARIA labels, keyboard expansion, Symlink safety, and unsupported-file state

**Verification:**
- `node --test tests/workspaceExplorerWiring.test.mjs`

- [x] Add the focused framework-icon assertions and confirm they fail for the current glyph implementation.
- [x] Keep assertions tied to the Workspace row's semantic icon mapping and existing interaction contract.

## Task 2: Apply the Lucide Workspace Row System

**Outcome:** Workspace rows use one coherent, compact icon language without changing navigation or filesystem behavior.
**Files:**
- Modify: `src/components/WorkspaceResourceRow.tsx`
- Modify: `src/index.css`

**Change Map:**
- `WorkspaceResourceRow`: replace disclosure, entry-type, rename, and Trash characters with named Lucide components
- `EntryIcon`: map directory expanded state and file metadata to FolderOpen/Folder, FilePenLine/File, and ExternalLink
- `src/index.css`: give disclosure, entry, and row-action SVGs stable size/flex metrics and preserve the neutral/violet state palette

**Verification:**
- Run the focused Task 1 test.
- Inspect collapsed/expanded folders, nested IdeaSketch files, unsupported files, Symlinks, selected rows, and hover/focus row actions at normal and minimum Workspace widths.

- [x] Replace every legacy row glyph with a decorative or interactive Lucide component as appropriate.
- [x] Preserve fixed alignment, selected-state color, disclosure hit target, and row-action focus/hover behavior.
- [x] Review the diff for any change to filesystem callbacks, keyboard handling, or row dimensions.

## Task 3: Verify and Deliver F008

**Outcome:** The Workspace tree icon refresh ships as an isolated, documented F008 change.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/features/F008-framework-workspace-tree-icons.md`

**Change Map:**
- F008 feature and plan: completion status, checked outcomes, and final verification evidence
- generated plan index: refreshed F008 state

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Isolated Tauri smoke for expanded/collapsed folders, nested `.is` rows, selection, and row-action alignment

- [x] Run the complete Node regression suite and production build once after implementation stabilizes.
- [x] Complete the Workspace tree visual smoke matrix and record any environment limitation.
- [x] Mark F008 and its human request complete, refresh the plan index, and create a separate `feat(F008)` commit without staging `AGENTS.md`.

## Delivery Evidence

- Test-first contract: `node --test tests/workspaceExplorerWiring.test.mjs` first failed against the legacy glyph implementation, then passed all 3 focused tests after the Lucide mapping was applied.
- Regression: `node --test tests/*.test.mjs` passed all 159 tests.
- Build: `npm run build` completed successfully; only the existing Excalidraw mixed-import and large-chunk warnings remained.
- Diff hygiene: `git diff --check` passed and review confirmed no Workspace filesystem callback, drag/drop, keyboard, selection, or row-height behavior changed.
- Visual smoke: the isolated debug Tauri bundle launched successfully and exposed the expected launch-screen accessibility tree. The desktop automation environment could read the WebView but did not activate its controls, including the pure frontend New File action. A local runtime preview therefore rendered the real `WorkspaceResourceRow` component with production CSS and verified expanded/collapsed folders, nested IdeaSketch files, unsupported files, Symlinks, selected state, and hover row actions at both 216px and the 180px minimum Workspace width.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F002-workspace-resource-explorer.md`
- `docs/superplan/plans/features/F004-refine-editor-shell.md`
- `docs/superplan/plans/features/F007-framework-title-bar-icons.md`
- `src/components/WorkspaceExplorer.tsx`
- `src/components/WorkspaceResourceRow.tsx`
- `src/index.css`
- `tests/workspaceExplorerWiring.test.mjs`
