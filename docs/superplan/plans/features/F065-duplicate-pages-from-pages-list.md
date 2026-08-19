---
id: "F065"
title: "Duplicate pages from the IdeaSketch Pages list"
type: "feature"
status: "complete"
summary: "Add a page-row copy action that clones the page scene and media into a new adjacent active page."
source: "docs/superplan/human/features.md"
created: "2026-08-19"
order: 65
depends_on: []
parent: ""
---

# Duplicate pages from the IdeaSketch Pages list Plan

**Goal:** Let users quickly create an editable copy of any page from the Pages list.
**Scope:** Add a copy control to editable page rows, clone page content/app state/media with a new id, insert the copy after the source, and activate it.
**Non-Goals:** No cross-document duplication, keyboard shortcut, or new persistence format.
**Architecture:** Keep duplication in the existing reducer/action flow; the editor creates a fresh page identity and the organizer only emits the user intent.
**Baseline:** Pages already support add, rename, reorder, delete, and active-page selection. Page ids are generated with `crypto.randomUUID()` and page payloads carry Excalidraw elements, appState, and files.
**Exit Criteria:** Every editable page row exposes a Copy action; invoking it preserves source scene/media by value, creates a unique adjacent page titled as a copy, selects it, and passes build plus focused reducer/source tests.

## Task 1: Add page duplication behavior and UI

**Outcome:** Copying a page from the Pages list creates and activates an adjacent independent page.
**Files:**
- Modify: `src/lib/ideaSketchReducer.ts`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/PageOrganizer.tsx`
- Modify: `tests/ideaSketchReducer.test.mjs`
- Modify: `tests/pageOrganizer.test.mjs`

**Change Map:**
- `IdeaSketchAction`/`ideaSketchReducer`: add a `DUPLICATE_PAGE` action that inserts a cloned page after the source and activates it.
- `IdeaSketchEditor`: flush the active draft, clone the source page with a fresh id and copy title, then dispatch duplication.
- `PageOrganizer`: expose a Copy icon/button per editable page row and thread the callback.

**Verification:**
- `node --test tests/ideaSketchReducer.test.mjs tests/pageOrganizer.test.mjs`
- `npm run build`

- [x] Add reducer coverage for adjacent insertion, active selection, independent identity, and preserved payloads.
- [x] Add organizer/source coverage for the Copy action and callback wiring.
- [x] Run focused tests and production build.

**Evidence:** `node --test tests/ideaSketchReducer.test.mjs tests/pageOrganizer.test.mjs` (6 passed); `npm run build` (TypeScript and Vite build passed).

## References
- `docs/superplan/human/features.md#F065`
- `src/types.ts`
