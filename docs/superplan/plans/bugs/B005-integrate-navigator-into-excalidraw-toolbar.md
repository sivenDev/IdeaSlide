---
id: "B005"
title: "Integrate Navigator Controls with the Excalidraw Toolbar"
type: "bugfix"
status: "draft"
summary: "Make the Navigator and Camera controls read as one continuous Excalidraw toolbar instead of a detached top-right island."
source: "docs/superplan/human/bugs.md"
created: "2026-08-04"
order: 5
depends_on: ["F009"]
parent: ""
---

# Integrate Navigator Controls with the Excalidraw Toolbar Plan

**Goal:** Make the Navigator and Camera actions feel structurally and visually native to the active Excalidraw drawing toolbar.
**Scope:** Keep Excalidraw 0.18's supported `renderTopRightUI` extension boundary, but visually dock the IdeaSketch Navigator and Camera buttons to the right edge of the native drawing toolbar as one continuous toolbar surface. Remove the detached-island gap, independent rounded shell, and duplicate shadow language; add one quiet seam between native and IdeaSketch tools while preserving Excalidraw sizing, violet selected state, shared tooltips, read-only Camera disabling, right-divider fallback, and responsive non-overlap. The visual system remains the approved white/neutral Excalidraw surface with violet interaction feedback; its signature is a single continuous toolbar with a deliberate divider where IdeaSketch-specific tools begin.
**Non-Goals:** This fix does not portal or mutate controls into Excalidraw's private DOM, fork Excalidraw, change drawing tools, remove the right divider collapse control, change Navigator or Camera behavior, resize the right panel, add labels or counts to the toolbar, add thumbnails, or alter presentation and persistence.
**Architecture:** `SlideCanvas` continues to provide `CanvasPresentationControls` through the public `renderTopRightUI` prop. The repair is a toolbar-extension composition rather than DOM injection: `CanvasPresentationControls` exposes explicit toolbar semantics and one internal seam, while scoped CSS uses the existing Excalidraw top-grid and toolbar classes to close the known grid gap at each desktop breakpoint, square the native toolbar's adjoining edge, and give the custom group only the complementary edge radius. Component behavior and callback ownership remain unchanged. Browser geometry checks guard the native/custom seam and ensure the combined surface stays clear of the 244px Navigator panel.
**Baseline:** F009 renders the two IdeaSketch actions inside `.layer-ui__wrapper__top-right`. The custom group currently owns a complete island background, shadow, padding, and four rounded corners, and is translated only partway across Excalidraw's 2rem/3rem top-grid gap. It therefore appears beside the native `.App-toolbar` as a second floating island. Excalidraw exposes `renderTopRightUI`, but no public central-toolbar insertion slot.
**Reproduction:** Open any writable IdeaSketch file. The Canvas shows the native shape toolbar and, to its right, a separate two-button white island containing Navigator and Camera. At 1024px the islands have an 8px gap; at the default desktop viewport the gap is larger. The Navigator action is therefore adjacent to, not part of, the Excalidraw toolbar.
**Root Cause:** `SlideCanvas.renderTopRightUI` correctly uses the public extension API, but `src/index.css` styles `.idea-slide-canvas-controls` as a self-contained island and only partially offsets the separate top-right grid cell with `translateX(-1.5rem)`. Because the native toolbar and custom controls keep independent shells and a residual grid gap, they cannot read as one toolbar even though their button primitives match.
**Exit Criteria:** On writable IdeaSketch canvases, native drawing tools followed by a subtle divider, Navigator, and Camera appear as one continuous toolbar surface with no visible inter-island gap or duplicated adjoining corners. Navigator selected state, both tooltips, Camera disabled/read-only state, Camera drawing, panel toggling, and the right divider remain functional. At 1024px, 1200px, and default/wide desktop widths, the native and custom toolbar bounds touch without overlap, wrapping, clipping, or intrusion into the open Navigator panel. View/presentation mode still hides the custom controls. Focused contracts, full frontend regression, production build, diff checks, and browser interaction checks pass.

## Task 1: Lock the Continuous-toolbar Contract

**Outcome:** A focused regression distinguishes a true toolbar extension from the detached island shipped by F009.
**Files:**
- Modify: `tests/canvasPresentationControls.test.mjs`
- Modify: `tests/tooltipWiring.test.mjs`

**Change Map:**
- control semantics: require one labeled IdeaSketch toolbar extension containing Navigator and Camera buttons
- visual contract: reject a standalone four-corner island and require adjoining native/custom edge treatment plus breakpoint-aware grid-gap closure
- continuity contract: preserve tooltips, selected state, Camera disabling, and the official `renderTopRightUI` boundary

**Verification:**
- `node --test tests/canvasPresentationControls.test.mjs tests/tooltipWiring.test.mjs tests/slideCanvasProps.test.mjs`

- [ ] Add a focused failing contract for continuous-toolbar semantics and styling.
- [ ] Confirm the failure identifies the independent island shell and residual toolbar gap.

## Task 2: Dock the IdeaSketch Tools to the Native Toolbar

**Outcome:** Navigator and Camera render as the rightmost segment of one Excalidraw toolbar without private DOM injection.
**Files:**
- Modify: `src/components/CanvasPresentationControls.tsx`
- Modify: `src/index.css`

**Change Map:**
- `CanvasPresentationControls`: add accessible toolbar-group semantics and a structural seam without changing callbacks
- Excalidraw-scoped CSS: close the 2rem standard and 3rem wide grid gaps, remove the independent left edge/corners, complement the native toolbar radius, unify surface/shadow/height, and retain visible focus/selected/disabled states
- responsive boundary: keep the combined toolbar clear of the Navigator panel and avoid label wrapping or clipped icons

**Verification:**
- Run the focused Task 1 suite.
- Browser interaction cases: toggle Navigator; hover both tools; activate Camera drawing; inspect writable and read-only states; compare closed/open Navigator layouts at 1024px, 1200px, and default/wide widths.

- [ ] Implement the continuous toolbar extension through the supported custom-UI slot.
- [ ] Preserve behavior, accessibility, and right-divider fallback while removing detached-island styling.
- [ ] Verify geometry at each supported desktop breakpoint and self-critique the seam, density, and selected state.

## Task 3: Verify and Deliver B005

**Outcome:** The toolbar-placement defect is closed with regression, build, visual, and progress evidence.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B005-integrate-navigator-into-excalidraw-toolbar.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- B005 bug and plan: completed status plus root-cause and verification evidence
- generated plan index: refreshed bugfix state

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Browser acceptance: continuous toolbar seam, Navigator open/close, Camera drawing, shared tooltips, read-only state, panel boundary, and console errors at representative desktop widths.

- [ ] Run focused checks during implementation and the complete frontend regression/build matrix once stable.
- [ ] Record browser evidence, mark B005 done/complete, refresh the index, and create a separate `fix(B005)` commit excluding `AGENTS.md`.

## References
- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/features/F003-canvas-presentation-controls.md`
- `docs/superplan/plans/features/F004-refine-editor-shell.md`
- `docs/superplan/plans/features/F005-align-workspace-camera-actions.md`
- `docs/superplan/plans/features/F006-revision-c-editor-shell-defaults.md`
- `docs/superplan/plans/features/F009-tabbed-ideasketch-navigator.md`
- `src/components/CanvasPresentationControls.tsx`
- `src/components/SlideCanvas.tsx`
- `src/index.css`
- `public/excalidraw.css`
- `node_modules/@excalidraw/excalidraw/dist/types/excalidraw/types.d.ts`
