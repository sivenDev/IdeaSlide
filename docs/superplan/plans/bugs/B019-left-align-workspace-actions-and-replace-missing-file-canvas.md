---
id: "B019"
title: "Left-align Workspace Actions and Replace Missing-file Canvas"
type: "bugfix"
status: "complete"
summary: "Left-align the persistent Workspace action bar and make clean deleted files close naturally without duplicate missing-file UI."
source: "docs/superplan/human/bugs.md"
created: "2026-08-06"
order: 19
depends_on: ["05", "06", "F027"]
parent: ""
---

# Left-align Workspace Actions and Replace Missing-file Canvas Plan

**Goal:** Remove the Workspace Explorer's awkward leading gap and make externally deleted files leave the editor naturally without redundant missing-file chrome.
**Scope:** Align the persistent New File, New Folder, Refresh Workspace, and Workspace Tree Actions controls to the left edge of their existing action bar. When a clean active file is deleted externally, close that document session automatically, clear its stale Workspace selection, remove it from the tree, and return to the ordinary empty editor without a top warning or centered `File missing` label. If the deleted document contains unsaved work, retain the protected in-memory session and its existing Save As/Close recovery notice, hide the canvas and navigator, and leave the editor surface visually empty so recovery remains safe without duplicate messaging.
**Non-Goals:** This fix does not restore the removed Workspace name row, return actions to hover-only visibility, change action order, iconography, tooltips, root drop behavior, row indentation, or sidebar sizing. It does not change external-change, conflict, read-only, root-missing, autosave, file-watcher, Save As, or Close semantics, and it does not discard or recreate a dirty missing document session.
**Architecture:** F027's action bar remains the single always-visible Workspace command surface; only its flex alignment changes. External-deletion handling moves the clean-versus-protected decision into `appStoreReducer`: clean missing documents are evicted like closed foreground sessions, while dirty documents retain the existing `missing` status and recovery contract. For a retained dirty IdeaSketch session, `DocumentEditorHost` keeps the same editor subtree mounted so `IdeaSketchEditor` retains its registered `flushAndGetDocument` snapshot provider and latest Excalidraw draft, but marks that subtree hidden without adding a second missing-file message.
**Baseline:** `.idea-slide-workspace-action-bar` currently uses `justify-content: flex-end`, leaving unused space before its four persistent controls. `EditorLayout` renders `ExternalChangeNotice` and then `DocumentEditorHost`; the notice already recognizes `missing` and exposes `Save As…` plus `Close`, but the host has no missing-state branch and continues to call `renderIdeaSketch(document)` whenever an IdeaSketch model exists. `IdeaSketchEditor` registers its snapshot provider on mount and unregisters it on unmount, so directly replacing or unmounting the editor could make recovery save an older parent model.
**Reproduction:** Open a Workspace and observe that the four Explorer actions sit against the right side of the action bar with a blank leading region. Then open an IdeaSketch file and remove it outside IdeaNote. The red `File missing` notice appears, but the active canvas and navigator remain visible and interactive beneath it.
**Root Cause:** F027 made Workspace actions permanently visible but retained right-end flex alignment after removing the Workspace-name row. Separately, every missing-file decision is currently preserved as an active protected session, even when the document is clean, and the UI expresses that state twice through `ExternalChangeNotice` plus the editor surface. Clean deletion therefore looks like an error requiring recovery when there is no unsaved work to protect. The editor's snapshot lifecycle still means a genuinely dirty missing session cannot be safely unmounted.
**Exit Criteria:** Workspace actions begin at the left side of the existing action bar at normal and narrow supported sidebar widths while retaining order, tooltips, visibility, separator, and root drop feedback. Deleting a clean active file removes its session and Workspace selection and shows the ordinary empty editor with no missing warning or label. Deleting a dirty active file retains one Save As/Close recovery notice, hides the canvas and navigator without a duplicate editor message, and preserves the latest in-memory snapshot. Focused reducer and source contracts, complete frontend regressions, strict production build, native visual smoke, and diff checks pass.

## Task 1: Lock the Alignment and Missing-surface Contracts

**Outcome:** Focused regressions fail unless the action bar is left-aligned, clean deleted documents close automatically, and protected dirty sessions hide their editor without duplicate missing text.
**Files:**
- Modify: `tests/workspaceExplorerWiring.test.mjs`
- Modify: `tests/documentEditorHost.test.mjs`
- Modify: `tests/appStoreReducer.test.mjs`

**Change Map:**
- Workspace Explorer style contract: require `.idea-slide-workspace-action-bar` to use `justify-content: flex-start` and reject `flex-end`
- clean deletion contract: require Workspace watcher and standalone inspection removal to evict clean sessions, clear active identity, and clear stale Workspace selection
- protected deletion contract: require dirty missing sessions to remain recoverable in memory
- snapshot-safety contract: require the IdeaSketch renderer to remain inside a consistently rendered wrapper whose visibility changes for retained `missing`, without `File missing` text
- fallback boundary: retain the assertion that `missing` does not route through `UnsupportedFileView`

**Verification:**
- `node --test tests/appStoreReducer.test.mjs tests/documentEditorHost.test.mjs tests/workspaceExplorerWiring.test.mjs`

- [x] Add focused behavior-level source contracts and confirm they fail against the current right-aligned, still-visible canvas implementation.
- [x] Keep the contracts scoped to observable layout, missing-state replacement, and mounted-session safety rather than implementation trivia outside this fix.

## Task 2: Left-align the Persistent Workspace Actions

**Outcome:** The four Workspace command buttons begin at the Explorer's left edge without regressing F027's simplified header behavior.
**Files:**
- Modify: `src/index.css`

**Change Map:**
- `.idea-slide-workspace-action-bar`: change horizontal distribution from end alignment to start alignment
- preservation boundary: keep existing bar margin, padding, gap, icon sizes, separator spacing, always-visible controls, and root drop-state styling

**Verification:**
- Run the focused Task 1 tests.
- Browser smoke at 220-pixel and 180-pixel Workspace widths: actions remain fully usable, start from the left, preserve order and tooltips, and retain root drop feedback.

- [x] Change only the action bar's horizontal alignment contract.
- [x] Inspect standard and narrow supported sidebar widths for balanced left alignment and control fit.

## Task 3: Close Clean Deletions and Protect Dirty Recovery

**Outcome:** Clean deleted documents leave the editor automatically, while dirty deleted documents retain one safe recovery surface without duplicated messaging.
**Files:**
- Modify: `src/lib/appStoreReducer.ts`
- Modify: `src/components/DocumentEditorHost.tsx`

**Change Map:**
- `APPLY_WORKSPACE_CHANGE`: evict documents whose deletion decision is `missing` when `isDirty` is false; clear an evicted active session and selected path; retain dirty deleted documents and their tree/recovery protection
- `APPLY_DOCUMENT_INSPECTION`: apply the same clean-close versus dirty-protect rule for standalone polling
- IdeaSketch render branch: keep retained dirty `missing` sessions out of `UnsupportedFileView`
- mounted editor wrapper: render consistently for available IdeaSketch models, hide it from layout, interaction, and accessibility while status is `missing`, and avoid remounting across the transition
- editor surface: add no centered missing-file copy; the existing recovery notice is the single message for dirty sessions

**Verification:**
- Run the focused Task 1 tests.
- Native clean-deletion smoke: delete a saved active file externally and verify the session closes, its tree row and selection disappear, and the ordinary empty editor has no warning or missing label.
- Native dirty-deletion smoke: make an edit before deletion and verify only the Save As/Close notice remains while the canvas and navigator are hidden.
- Recovery contract: verify the dirty case retains `Save As…` and `Close` while the consistently mounted hidden editor preserves its registered latest-snapshot provider.

- [x] Close clean missing sessions and clear their stale active and Workspace selection state.
- [x] Keep dirty missing IdeaSketch sessions mounted but hidden and non-interactive, with one recovery notice and no duplicate editor copy.

## Task 4: Verify and Deliver B019

**Outcome:** Both corrections ship together as one isolated, regression-checked B019 delivery.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B019-left-align-workspace-actions-and-replace-missing-file-canvas.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- B019 request and plan: completion status and concise verification evidence
- generated plan index: refreshed B019 state and dependencies
- Git delivery: one separate `fix(B019)` commit containing only this task

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `python3 <using-superplan-root>/scripts/generate_plans_readme.py --write --check`
- `git diff --check`
- Native visual smoke for left-aligned actions, clean auto-close, dirty single-notice recovery, latest-draft Save As, and Close

- [x] Run the complete frontend regression and strict production build after focused behavior stabilizes.
- [x] Complete B019 progress, refresh the generated index, and create the required separate delivery commit.

## Completion Evidence

- Test-first regression: the focused B019 suite initially failed on the right-aligned action bar, retained clean missing sessions, retained standalone clean missing inspection, and duplicate editor-area `File missing` copy. After implementation, `node --test tests/appStoreReducer.test.mjs tests/documentEditorHost.test.mjs tests/workspaceExplorerWiring.test.mjs` passed 16/16 tests.
- Workspace layout: `.idea-slide-workspace-action-bar` now uses `justify-content: flex-start` with all existing geometry, order, tooltips, separator, visibility, and root drop styling unchanged. The loaded browser stylesheet reported `{ display: "flex", justifyContent: "flex-start" }`.
- Clean deletion behavior: `APPLY_WORKSPACE_CHANGE` and `APPLY_DOCUMENT_INSPECTION` evict clean missing documents and clear stale active identity; Workspace removal also clears the deleted selected path and applies the real tree event.
- Dirty deletion safety: dirty missing sessions remain protected. `DocumentEditorHost` keeps the IdeaSketch editor subtree mounted behind `hidden` and `aria-hidden`, removes the duplicate centered copy, and leaves the existing single `Save As…` / `Close` notice as the recovery surface.
- Native clean smoke: the current debug bundle showed the four Workspace actions at the Explorer's left edge. Deleting a saved active test file removed its tree row and selection, changed the tree to `This Workspace is empty.`, and returned the center to `Open a file from the Workspace Explorer.` with no warning or missing label.
- Native dirty smoke: adding a Page and deleting the file before autosave retained the disabled missing row and one top recovery notice with `Save As…` and `Close`; the Excalidraw canvas, navigator, and centered `File missing` copy were absent.
- Full frontend regression: `node --test tests/*.test.mjs` passed 246/246 tests with no failures, skips, or cancellations.
- Production frontend build: `npm run build` passed strict TypeScript and Vite generation. Existing Excalidraw mixed-import and large-chunk warnings remain informational.
- Native debug delivery build: `npm run tauri build -- --debug` completed the current `IdeaNote.app` and DMG bundles successfully.
- `git diff --check` and Superplan catalog/index validation passed after the final structural revision.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/05-workspace-reliability-and-recovery.md`
- `docs/superplan/plans/06-single-active-editor.md`
- `docs/superplan/plans/features/F027-simplify-workspace-explorer-root-header.md`
- `src/components/DocumentEditorHost.tsx`
- `src/components/EditorLayout.tsx`
- `src/components/ExternalChangeNotice.tsx`
- `src/components/IdeaSketchEditor.tsx`
- `src/index.css`
- `tests/documentEditorHost.test.mjs`
- `tests/workspaceExplorerWiring.test.mjs`
