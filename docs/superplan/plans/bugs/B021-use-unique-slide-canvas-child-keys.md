---
id: "B021"
title: "Use Unique SlideCanvas Child Keys"
type: "bugfix"
status: "complete"
summary: "Keep Page-scoped Canvas remounting while giving sibling Excalidraw and Camera overlay children unique React keys."
source: "docs/superplan/human/bugs.md"
created: "2026-08-07"
order: 21
depends_on: ["B016"]
parent: ""
---

# Use Unique SlideCanvas Child Keys Plan

**Goal:** Remove the repeated duplicate React-key error from the IdeaSketch editor without weakening Page-scoped Canvas lifecycle isolation.
**Scope:** Give the sibling `Excalidraw` and `CameraBadgeOverlay` children inside `SlideCanvas` distinct deterministic key namespaces derived from the same `slideId`. Preserve the outer `SlideCanvas key={draft.slideId}` boundary and both internal Page-sensitive remount safeguards established by B006/B016. Add a focused regression and verify the warning is absent on new-document mount and Page switching.
**Non-Goals:** This fix does not remove Page-scoped remounting, change Canvas or Camera state ownership, alter Excalidraw scene element IDs, deduplicate document content, modify Page IDs, change thumbnail behavior, or suppress React console errors globally.
**Architecture:** `slideId` remains the lifecycle identity, but each sibling React child receives a component-specific namespace such as `excalidraw:<slideId>` and `camera-badges:<slideId>`. The suffix changes whenever the Page changes, retaining remount behavior, while the prefix makes sibling keys unique within their shared parent. No additional state, effect, or render pass is introduced.
**Baseline:** `IdeaSketchEditor` correctly keys the complete `SlideCanvas` owner by `draft.slideId`. Inside `SlideCanvas`, both `<Excalidraw key={slideId}>` and `<CameraBadgeOverlay key={slideId}>` are rendered as children of the same container. React therefore sees two siblings with the identical Page UUID key and logs the duplicate-key error on initial mount and subsequent updates.
**Reproduction:** Start the local frontend, create a new IdeaSketch document, and inspect the console before drawing anything. React repeatedly logs `Encountered two children with the same key` followed by the current Page UUID. The UUID exactly matches the Page row's `data-page-id`, and source inspection finds the same unqualified `key={slideId}` on both sibling children.
**Root Cause:** Page lifecycle identity was applied directly as the React key to two sibling component instances. React key uniqueness is scoped to siblings, so identical Page identity is valid input for both lifecycles but invalid as their final sibling keys. The problem is key namespacing, not duplicate Pages or scene elements.
**Exit Criteria:** Opening a new IdeaSketch document and switching among Pages produces no duplicate-key warning for the Page UUID. `Excalidraw` and `CameraBadgeOverlay` retain stable keys within one Page and receive new keys when `slideId` changes. The outer full-Canvas remount, initial-emission isolation, Camera overlay subscriptions, drawing, selection, thumbnails, and save behavior remain unchanged. Focused lifecycle tests, the complete frontend regression, production build, UI console acceptance, and diff checks pass.

## Task 1: Lock the Sibling-key Regression

**Outcome:** A focused test fails while both Page-scoped sibling children use the unqualified `slideId` key and passes only when their keys are distinct and deterministic.
**Files:**
- Modify: `tests/excalidrawViewportObservers.test.mjs`

**Change Map:**
- `SlideCanvas` source contract: require separate Excalidraw and Camera-overlay key namespaces, reject two direct `key={slideId}` sibling assignments, and preserve Page-derived identity

**Verification:**
- `node --test tests/excalidrawViewportObservers.test.mjs tests/ideaSketchEditor.test.mjs`
- Cases: distinct child key prefixes; both include `slideId`; outer `SlideCanvas key={draft.slideId}` remains present; Page-scoped cleanup and unmounted-callback guards remain unchanged.

- [x] Add the focused failing key-uniqueness regression.
- [x] Preserve the existing B016 full-Canvas identity and cleanup assertions.

## Task 2: Namespace the Internal Page Keys and Deliver B021

**Outcome:** React receives unique sibling keys while both internal children continue to remount for every Page identity transition.
**Files:**
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B021-use-unique-slide-canvas-child-keys.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- `SlideCanvasInner`: replace the two identical sibling keys with component-specific Page-derived keys; do not change props, ordering, conditional rendering, or ownership
- B021 workflow artifacts: record focused/full/UI evidence and refresh the generated plan index

**Verification:**
- `node --test tests/excalidrawViewportObservers.test.mjs tests/ideaSketchEditor.test.mjs tests/cameraBadgeWiring.test.mjs tests/slideCanvasProps.test.mjs`
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- UI acceptance: create a new document, add and switch Pages, draw normally, and confirm the console contains no duplicate-key message for any Page UUID.

- [x] Apply the smallest key-namespacing change and pass the focused regression.
- [x] Verify Page remount, Camera overlay, drawing, save, and console behavior.
- [x] Complete B021, refresh progress, and create a separate `fix(B021)` commit containing only this delivery.

## Completion Evidence

- The focused regression failed before implementation with 11/12 passing because both sibling children still used `key={slideId}`.
- After namespacing the two keys, the Page lifecycle, Camera overlay, editor identity, and render-boundary suite passed 26/26.
- The complete frontend regression passed 253/253 with no failures, skips, or cancellations.
- `npm run build` passed strict TypeScript and the production Vite build. Existing informational warnings remain for Excalidraw's mixed static/dynamic import and generated chunks over 500 kB.
- Local UI acceptance created an empty IdeaSketch document, added three Pages, switched among them in both Name and Thumbnail views, and drew a rectangle. The browser console contained no warning or error, including no duplicate-key message.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/bugs/B006-synchronize-page-canvas-draft-identity.md`
- `docs/superplan/plans/bugs/B016-prevent-large-page-switch-freeze.md`
- `docs/superplan/plans/bugs/B020-reuse-unchanged-page-thumbnails.md`
- `docs/superplan/plans/features/F024-optimize-large-excalidraw-viewport-interactions.md`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/SlideCanvas.tsx`
- `src/components/CameraBadgeOverlay.tsx`
- `tests/excalidrawViewportObservers.test.mjs`
- `tests/ideaSketchEditor.test.mjs`
