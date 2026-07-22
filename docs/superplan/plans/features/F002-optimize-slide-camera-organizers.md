---
id: "F002"
title: "Optimize Slide and Camera Organizers"
type: "feature"
status: "draft"
summary: "Deliver a collapsible three-pane editor with persistent slide names and sortable slide and camera sidebars."
source: "docs/superplan/human/features.md"
created: "2026-07-22"
order: 2
depends_on: []
parent: ""
---

# Optimize Slide and Camera Organizers Plan

**Goal:** Make deck structure, drawing, and camera sequencing continuously visible in a presentation-editor layout while preserving slide identity, titles, order, and unsaved canvas work.
**Scope:** Replace the toolbar Slide/Cameras dropdowns with a three-pane editor: a vertical Slides sidebar on the left, the Excalidraw canvas in the center, and a vertical Cameras sidebar on the right. Each sidebar has a divider marker that independently collapses it to a narrow rail and expands it again; the center canvas takes the released space. Slides show thumbnails and support selection, inline rename, vertical drag reorder, add, and delete. Cameras show thumbnails and support selection, vertical drag reorder, delete, and an empty state. Slide titles and array order persist through the existing `.is` manifest, and the current slide remains selected by id after reorder.
**Non-Goals:** This plan does not create a pixel-for-pixel Microsoft PowerPoint clone, add camera naming, multi-select or batch actions, add arbitrary drag resizing of sidebar widths, change presentation-mode behavior, add laser pointers, or change the `.is` format version.
**Architecture:** `EditorLayout` owns the two independent sidebar visibility states and composes a horizontal flex layout around the existing `SlideCanvas`. The sidebars use stable expanded widths and collapsed rails; divider buttons own only toggle behavior. Existing slide/camera thumbnail hooks and renderers are reused, with generation enabled only while the corresponding sidebar is visible. Sidebar visibility changes must leave the canvas functional after its container resizes. The slide store remains the committed presentation source of truth and gains explicit rename/reorder actions; `EditorLayout` flushes the active draft before slide order mutations and translates camera ordered ids into Excalidraw scene updates. Sidebar components own only transient edit and drag state.
**Baseline:** `Toolbar.tsx` currently embeds compact slide and camera dropdown lists, while `EditorLayout.tsx` intentionally renders only the canvas and tests lock that previewless shell. Unused horizontal `SlidePreviewPanel`, `CameraList`, and `ResizableDivider` components plus optimized `useSlideThumbnails` and `useCameraThumbnails` hooks remain in the repository and can be refactored for vertical sidebars. Slide labels are regenerated as `Slide N`; the frontend `Slide` model has no title, the store has no rename/reorder actions, and `tauriCommands.ts` discards manifest titles on load and rebuilds them from index on save. Camera order already lives in Excalidraw element metadata and can reuse `reorderCameras`.
**Exit Criteria:** The default editor shows Slides, canvas, and Cameras in three columns; each divider marker independently collapses/expands its sidebar and the canvas fills the available center space without clipping or stale input coordinates; hidden sidebars pause their thumbnail work; users can rename and drag slides, drag cameras, and select/add/delete from the appropriate sidebar; the active slide stays active after reorder; slide rename/order survive save and reopen; camera reorder updates presentation order; the last slide cannot be deleted; long lists scroll inside their sidebar; focused behavior/performance checks, the full Node test suite, production build, and editor smoke checks pass.

## Task 1: Persist Slide Identity, Titles, and Reorder State

**Outcome:** Slide titles and ordering become first-class presentation state with legacy-safe `.is` round-trip behavior and current-slide stability.
**Files:**
- Create: `src/lib/slideTitles.ts`
- Create: `src/lib/slideStoreReducer.ts`
- Modify: `src/types.ts`
- Modify: `src/hooks/useSlideStore.tsx`
- Modify: `src/lib/editorSession.ts`
- Modify: `src/lib/tauriCommands.ts`
- Test: `tests/slideTitles.test.mjs`
- Test: `tests/slideStoreReducer.test.mjs`
- Test: `tests/editorSession.test.mjs`
- Test: `tests/tauriCommands.test.mjs`

**Change Map:**
- `src/types.ts`: persistent `Slide.title` contract
- `src/lib/slideTitles.ts`: default-title, blank-title normalization, manifest id matching, and manifest serialization helpers
- `src/lib/slideStoreReducer.ts`: extracted pure reducer plus `RENAME_SLIDE` and `REORDER_SLIDES` actions that preserve the active slide by id
- `src/hooks/useSlideStore.tsx`: React context wiring around the pure reducer and initial state factory
- `src/lib/editorSession.ts`: draft commit/persistence snapshots retain slide metadata while replacing canvas content
- `src/lib/tauriCommands.ts`: load manifest titles by slide id, save current titles, and initialize new slides with defaults

**Verification:**
- `node --test tests/slideTitles.test.mjs tests/slideStoreReducer.test.mjs tests/editorSession.test.mjs tests/tauriCommands.test.mjs`
- Behavior cases: legacy/missing/blank titles fall back safely; rename marks dirty; reorder preserves slide objects and active id; renamed/reordered slides round-trip without title regeneration

- [ ] Add focused failing tests for title normalization, manifest id matching, reducer rename/reorder behavior, and editor-session metadata preservation.
- [ ] Add `title` to the slide model and centralize default/normalization logic.
- [ ] Extract the reducer into a testable library boundary and implement rename/reorder without resetting the active slide.
- [ ] Preserve titles through editor drafts and `.is` load/save/new-presentation conversion.
- [ ] Run the focused data/state test set and record evidence.

## Task 2: Convert Existing Preview Components into Vertical Sortable Sidebars

**Outcome:** Slides and cameras have compact vertical thumbnail lists with accessible rename, selection, deletion, drag ordering, internal scrolling, and independent collapse controls.
**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/ui/Input.tsx`
- Modify: `src/components/SlidePreviewPanel.tsx`
- Modify: `src/components/CameraList.tsx`
- Modify: `src/components/ResizableDivider.tsx`
- Test: `tests/slideSidebarWiring.test.mjs`
- Test: `tests/cameraSidebarWiring.test.mjs`
- Test: `tests/panelDividerWiring.test.mjs`

**Change Map:**
- `package.json` and `package-lock.json`: dnd-kit sortable dependencies
- `src/components/ui/Input.tsx`: constrained shared text input for inline slide rename
- `src/components/SlidePreviewPanel.tsx`: vertical slide thumbnails, titles, active state, local rename/drag state, add/delete/select actions, and drag-handle-only sorting
- `src/components/CameraList.tsx`: vertical camera thumbnails, active/empty state, select/delete actions, and drag-handle-only sorting
- `src/components/ResizableDivider.tsx`: reusable vertical left/right divider marker with correct hide/show labels and collapsed direction

**Verification:**
- `node --test tests/slideSidebarWiring.test.mjs tests/cameraSidebarWiring.test.mjs tests/panelDividerWiring.test.mjs`
- Source/behavior contracts: title/delete controls do not select rows, drag starts only from handles, only one title edits at a time, Enter/blur commit and Escape cancel, each divider direction/label matches its side, and long lists own their scrolling

- [ ] Add failing contracts for the vertical sidebar structure, thumbnail rows, rename keys, sortable ids, divider directions, and internal scrolling.
- [ ] Install the sortable dependencies and add the shared Input primitive.
- [ ] Refactor SlidePreviewPanel into the left sortable slide sidebar with inline rename.
- [ ] Refactor CameraList into the right sortable camera sidebar with its existing empty state.
- [ ] Refactor ResizableDivider into an orientation-aware collapsible panel marker.
- [ ] Run the focused sidebar test set and record evidence.

## Task 3: Integrate the Three-Pane Editor and Visibility-Aware Thumbnails

**Outcome:** EditorLayout renders the collapsible sidebars around a responsive canvas, while Toolbar returns to file/presentation actions and thumbnail work follows sidebar visibility.
**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `tests/editorChromeNavigation.test.mjs`
- Modify: `tests/tooltipWiring.test.mjs`
- Modify: `tests/cameraThumbnail.test.mjs`
- Verify: `scripts/slide-thumbnails-image-regression.mjs`

**Change Map:**
- `src/components/Toolbar.tsx`: remove embedded Slide/Cameras dropdowns and their management props while retaining file and presentation actions
- `src/components/EditorLayout.tsx`: own sidebar visibility, compose the three-pane flex layout, enable slide/camera thumbnail hooks only for visible panels, pass draft-safe rename/reorder callbacks, and keep SlideCanvas responsive to panel transitions
- `tests/editorChromeNavigation.test.mjs`: replace previewless-shell assertions with three-pane ownership, independent collapse state, and no toolbar dropdown duplication
- `tests/tooltipWiring.test.mjs`: retain shared tooltip contracts after toolbar/sidebar migration
- `tests/cameraThumbnail.test.mjs`: retain visibility-gated thumbnail generation and current draft/camera render-key behavior

**Verification:**
- `node --test tests/editorChromeNavigation.test.mjs tests/tooltipWiring.test.mjs tests/slideSidebarWiring.test.mjs tests/cameraSidebarWiring.test.mjs tests/panelDividerWiring.test.mjs tests/cameraThumbnail.test.mjs`
- `node scripts/slide-thumbnails-image-regression.mjs`
- `node --test tests/*.test.mjs`
- `npm run build`
- Editor smoke check: independently collapse/expand both sidebars; verify the canvas expands, pointer alignment remains correct, and panels restore; rename/cancel/drag slides; drag/select/delete cameras; add/delete/select slides; save/reopen; exercise long-list scrolling

- [ ] Add/update failing integration assertions for the three-pane shell, independent visibility states, toolbar simplification, thumbnail visibility gates, and draft-safe reorder callbacks.
- [ ] Remove Slide/Cameras management dropdowns from Toolbar and integrate both sidebars around SlideCanvas in EditorLayout.
- [ ] Wire slide rename/reorder and camera ordered-id updates through the existing store/scene boundaries.
- [ ] Gate slide/camera thumbnail generation by panel visibility and confirm canvas behavior after width transitions.
- [ ] Run focused integration/performance checks, the full Node regression suite, and the production build.
- [ ] Complete the editor smoke matrix and record final evidence before marking F002 complete.

## References
- `docs/superplan/human/features.md`
- `docs/mockups/f002-organizers.html`
- `docs/superplan/plans/features/F001-enable-excalidraw-image-export.md`
- `src/components/Toolbar.tsx`
- `src/components/EditorLayout.tsx`
- `src/components/SlidePreviewPanel.tsx`
- `src/components/CameraList.tsx`
- `src/components/ResizableDivider.tsx`
- `src/hooks/useSlideThumbnails.ts`
- `src/hooks/useCameraThumbnails.ts`
- `src/lib/editorSession.ts`
- `src/lib/tauriCommands.ts`
- `src/lib/cameraUtils.ts`
- `src-tauri/src/file_format.rs`
- `tests/editorChromeNavigation.test.mjs`
