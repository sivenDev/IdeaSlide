---
id: "B006"
title: "Synchronize Page Canvas and Draft Identity"
type: "bugfix"
status: "complete"
summary: "Prevent Excalidraw from mounting a stale Page scene under a newly selected Page identity and contaminating subsequent saves."
source: "docs/superplan/human/bugs.md"
created: "2026-08-04"
order: 6
depends_on: ["B005"]
parent: ""
---

# Synchronize Page Canvas and Draft Identity Plan

**Goal:** Make Page switching display and persist only the scene owned by the selected Page.
**Scope:** Bind the mounted `SlideCanvas` identity to the editor draft that supplies its elements, app state, and files. Preserve the existing synchronous flush before Page add/select/reorder/delete and the current document snapshot/save pipeline. Add a focused regression requiring Page identity and scene data to come from the same draft, then verify that switching away from an edited Page removes its scene from the Canvas and cannot copy it into the destination Page on the next edit or save.
**Non-Goals:** This fix does not redesign `useEditorSession`, change the 250 ms preview synchronization debounce, replace Excalidraw, alter Page creation/order/title behavior, change `.is v1` serialization, modify autosave policy, change Cameras or Present placement, or add Page thumbnails/history.
**Architecture:** `useEditorSession` remains the owner of the live draft and changes `draft.slideId`, `draft.elements`, `draft.appState`, and `draft.files` together when its Page synchronization effect runs. `IdeaSketchEditor` will use `draft.slideId`—not the earlier-rendered `activePage.id`—as the `SlideCanvas`/Excalidraw remount identity. This preserves the invariant that Excalidraw's mount-only `initialData` and its React key always describe the same Page snapshot. Page selection may update the navigator immediately, while the Canvas remains on the flushed old draft for one effect turn and then remounts once the destination draft is complete.
**Baseline:** `IdeaSketchEditor` currently passes `slideId={activePage.id}` while passing scene data from `draft`. Page selection updates `activePage.id` synchronously, but `useEditorSession` updates the destination draft in an effect. Excalidraw therefore mounts once with the destination Page key and the previous Page scene; later prop changes do not reapply `initialData` because the key is already the destination id.
**Reproduction:** Create Page 2, draw one Camera on it, and switch to blank Page 1. The navigator reports Page 1 has zero Cameras, but the Canvas still displays Page 2's Camera badge/frame. Add one Camera on Page 1: the list becomes two Cameras because the stale Page 2 element is included in the Page 1 scene. Saving then persists cross-Page content rather than isolated Page scenes.
**Root Cause:** The Canvas remount identity comes from `activePage.id`, while its mount-only scene comes from an asynchronously synchronized `draft`. During Page transitions those values temporarily refer to different Pages. Excalidraw consumes the mismatched pair at mount and ignores the later `initialData` correction, so subsequent Canvas changes are emitted under the selected Page and contaminate its draft/save snapshot.
**Exit Criteria:** Switching between edited and blank Pages remounts Excalidraw with the destination Page's own scene; no Camera badge or drawing from the previous Page remains visible. Editing the destination Page starts from its own elements and cannot copy elements from the prior Page. Switching back restores each Page's original content. Explicit save and Workspace autosave snapshots preserve independent Page scenes. The focused identity contract, full frontend regression, production build, diff checks, native regression, and browser interaction reproduction all pass without new console errors.

## Task 1: Lock the Page-to-Draft Canvas Identity Contract

**Outcome:** A focused failing regression proves `SlideCanvas` cannot combine the active Page id with another Page's draft scene.
**Files:**
- Modify: `tests/ideaSketchEditor.test.mjs`

**Change Map:**
- `IdeaSketch editor binds Excalidraw drafts to document and Page identity`: require `SlideCanvas` identity to use `draft.slideId`, require scene props from the same `draft`, and reject `activePage.id` as the Canvas identity

**Verification:**
- `node --test tests/ideaSketchEditor.test.mjs`

- [x] Add the focused Canvas/draft identity regression.
- [x] Confirm it fails against the current mixed `activePage.id` and `draft` wiring.

## Task 2: Remount Excalidraw from One Complete Page Draft

**Outcome:** Page switching waits for the matching draft identity before Excalidraw remounts, preserving edit and save isolation.
**Files:**
- Modify: `src/components/IdeaSketchEditor.tsx`

**Change Map:**
- `SlideCanvas` composition: pass `draft.slideId` as the Canvas identity while retaining `draft.elements`, `draft.appState`, and `draft.files`
- Page lifecycle: keep existing flush-before-mutation handlers and document snapshot registration unchanged

**Verification:**
- Run the focused Task 1 test.
- Browser cases: Page 2 Camera disappears when switching to blank Page 1; Page 1 reports zero Cameras and has no stale Canvas badge; adding one Page 1 Camera results in exactly one Camera; switching back restores only Page 2's original Camera.

- [x] Apply the smallest identity-boundary fix without changing session or persistence policy.
- [x] Verify Page selection, Camera scoping, and save snapshot isolation.

## Task 3: Verify and Deliver B006

**Outcome:** The Page isolation fix ships with focused, full-regression, build, native, browser, and progress evidence.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B006-synchronize-page-canvas-draft-identity.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- B006 bug and plan: completed status plus reproduction/root-cause/verification evidence
- generated plan index: refreshed bugfix state

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `cargo test`
- `git diff --check`
- Browser acceptance: reproduce the two-Page Camera scenario, verify Canvas/list identity in both directions, edit both Pages independently, and inspect console errors.

- [x] Run focused checks during implementation and the complete regression/build matrix once stable.
- [x] Record browser evidence, mark B006 done/complete, refresh the index, and create a separate `fix(B006)` commit excluding `AGENTS.md`.

## Delivery Evidence
- The focused Canvas/draft identity regression first failed against `slideId={activePage.id}`, then passed after binding the Canvas identity to `draft.slideId`: `node --test tests/ideaSketchEditor.test.mjs` (2 passed).
- Full frontend regression passed: `node --test tests/*.test.mjs` (166 passed).
- Production frontend build passed: `npm run build`; only the existing Excalidraw mixed-import and bundle-size warnings remain.
- Native regression passed: `cargo test` (64 passed).
- `git diff --check` passed.
- Browser acceptance passed on the local Vite frontend: switching from Page 2 with one Camera to blank Page 1 reported `Cameras 0` and removed the Canvas Camera badge overlay; adding one Camera to Page 1 produced exactly `Cameras 1`; switching back restored Page 2's original single Camera at its independent position, and returning to Page 1 restored its own single Camera; no console errors were reported.

## References
- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/04-ideasketch-editor-integration.md`
- `docs/superplan/plans/features/F009-tabbed-ideasketch-navigator.md`
- `docs/superplan/plans/bugs/B004-stabilize-editor-session-slide.md`
- `docs/superplan/plans/bugs/B005-integrate-navigator-into-excalidraw-toolbar.md`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/SlideCanvas.tsx`
- `src/hooks/useEditorSession.ts`
- `src/lib/editorSession.ts`
- `tests/ideaSketchEditor.test.mjs`
- `tests/editorSession.test.mjs`
