---
id: "F002"
title: "Optimize Slide and Camera Organizers"
type: "feature"
status: "draft"
summary: "Provide consistent toolbar organizers with persistent slide names and drag reordering for slides and cameras."
source: "docs/superplan/human/features.md"
created: "2026-07-22"
order: 2
depends_on: []
parent: ""
---

# Optimize Slide and Camera Organizers Plan

**Goal:** Make deck and camera management faster from the editor toolbar while preserving slide identity, titles, order, and unsaved canvas work.
**Scope:** Replace the inline Slide and Cameras dropdown contents with dedicated, consistently styled organizer popovers. Slides support selection, inline rename, vertical drag reorder, add, and delete. Cameras support selection, vertical drag reorder, delete, and a clear empty state. Slide titles and array order persist through the existing `.is` manifest, and the current slide remains selected by id after reorder.
**Non-Goals:** This plan does not add slide thumbnails, camera naming, multi-select or batch actions, a permanent slide/camera side panel, presentation-mode behavior, laser pointers, or an `.is` format-version change.
**Architecture:** The slide store remains the committed presentation source of truth and gains explicit rename/reorder actions, while organizer components own only transient popover, edit, and drag state. A shared title-normalization boundary pairs manifest titles with slide content by id and supplies legacy/default fallbacks. `EditorLayout` flushes the active draft before slide order mutations and translates organizer callbacks into store or Excalidraw scene updates. Shared Radix Popover/Input primitives and dnd-kit sortable behavior keep floating-surface and drag mechanics outside `Toolbar`.
**Baseline:** `Toolbar.tsx` currently embeds separate Radix dropdown lists for slides and cameras. Slide labels are regenerated as `Slide N`; the frontend `Slide` model has no title, `useSlideStore` has no rename/reorder actions, and `tauriCommands.ts` discards manifest titles on load and rebuilds them from index on save. Camera order already lives in Excalidraw camera element metadata and can be changed with arrow controls, so camera drag ordering can reuse `reorderCameras` without a persistence schema change. The editor intentionally has no permanent preview panel, and existing source-level tests lock that architecture.
**Exit Criteria:** Users can rename a slide with Enter/blur commit and Escape cancel; blank names retain a valid prior/default title; users can drag slides and cameras vertically from explicit handles; the active slide stays active after reorder; slide rename/order survive save and reopen; camera reorder updates the scene order used by presentation; add/delete/select remain available; a one-slide document cannot delete its last slide; long lists scroll within the popover; focused behavior tests, the full Node test suite, production build, and editor smoke checks pass.

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

## Task 2: Provide Dedicated Sortable Organizer Surfaces

**Outcome:** Slide and camera management use consistent, accessible popovers with conflict-free selection, editing, deletion, and drag interactions.
**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/ui/Popover.tsx`
- Create: `src/components/ui/Input.tsx`
- Create: `src/components/SlideOrganizer.tsx`
- Create: `src/components/CameraOrganizer.tsx`
- Test: `tests/slideOrganizerWiring.test.mjs`
- Test: `tests/cameraOrganizerWiring.test.mjs`

**Change Map:**
- `package.json` and `package-lock.json`: Radix Popover and dnd-kit sortable dependencies
- `src/components/ui/Popover.tsx`: shared anchored floating-surface primitive consistent with existing Radix wrappers
- `src/components/ui/Input.tsx`: constrained shared text input used for inline slide rename
- `src/components/SlideOrganizer.tsx`: local open/edit/drag state, scrollable slide rows, inline rename semantics, add/delete/select actions, and drag-handle-only sorting
- `src/components/CameraOrganizer.tsx`: scrollable camera rows, active state, empty state, select/delete actions, and drag-handle-only sorting

**Verification:**
- `node --test tests/slideOrganizerWiring.test.mjs tests/cameraOrganizerWiring.test.mjs`
- Source/behavior contracts: title and delete controls stop row selection, drag starts only from handles, only one title edits at a time, keyboard rename semantics are wired, and both organizers constrain long-list overflow

- [ ] Add failing organizer contracts for shared primitives, row interaction boundaries, rename keys, sortable ids, and internal scrolling.
- [ ] Install the minimal Popover and sortable dependencies and add shared UI wrappers.
- [ ] Implement `SlideOrganizer` with inline rename and vertical sortable rows.
- [ ] Implement `CameraOrganizer` with vertical sortable rows and empty-state behavior.
- [ ] Run the focused organizer test set and record evidence.

## Task 3: Integrate Organizers Without Regressing Editor Navigation

**Outcome:** The toolbar delegates management behavior to the organizers, and EditorLayout safely commits slide/camera order changes through existing state and scene boundaries.
**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `tests/editorChromeNavigation.test.mjs`
- Modify: `tests/tooltipWiring.test.mjs`
- Test: `tests/slideOrganizerWiring.test.mjs`
- Test: `tests/cameraOrganizerWiring.test.mjs`

**Change Map:**
- `src/components/Toolbar.tsx`: keep compact Slide/Cameras triggers and badges while replacing embedded list markup with organizer components
- `src/components/EditorLayout.tsx`: pass slide objects and rename/reorder callbacks, flush the current draft before slide reorder, and apply ordered camera ids through `reorderCameras`
- `tests/editorChromeNavigation.test.mjs`: replace legacy inline-dropdown assertions with dedicated organizer architecture and retain previewless editor-shell boundaries
- `tests/tooltipWiring.test.mjs`: retain shared toolbar tooltip contracts after component extraction

**Verification:**
- `node --test tests/editorChromeNavigation.test.mjs tests/tooltipWiring.test.mjs tests/slideOrganizerWiring.test.mjs tests/cameraOrganizerWiring.test.mjs`
- `node --test tests/*.test.mjs`
- `npm run build`
- Editor smoke check: rename, cancel rename, drag slides, drag cameras, select/delete/add, verify the active slide and current canvas remain stable, save/reopen the deck, and exercise long-list scrolling

- [ ] Add/update failing wiring assertions for dedicated organizers and draft-safe reorder callbacks.
- [ ] Replace Toolbar's embedded slide/camera list markup with the dedicated organizer components while preserving compact triggers and counts.
- [ ] Wire slide rename/reorder and camera ordered-id updates through EditorLayout's existing state/scene boundaries.
- [ ] Run focused wiring checks, the full Node regression suite, and the production build.
- [ ] Complete the editor smoke matrix and record final evidence before marking F002 complete.

## References
- `docs/superplan/human/features.md`
- `docs/mockups/f002-organizers.html`
- `docs/superplan/plans/features/F001-enable-excalidraw-image-export.md`
- `src/components/Toolbar.tsx`
- `src/components/EditorLayout.tsx`
- `src/hooks/useSlideStore.tsx`
- `src/lib/editorSession.ts`
- `src/lib/tauriCommands.ts`
- `src/lib/cameraUtils.ts`
- `src-tauri/src/file_format.rs`
- `tests/editorChromeNavigation.test.mjs`
