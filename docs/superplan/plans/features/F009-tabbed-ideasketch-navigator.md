---
id: "F009"
title: "Unify Pages and Cameras in a Tabbed IdeaSketch Navigator"
type: "feature"
status: "complete"
summary: "Move Page and Camera management into one right-side tabbed navigator and align its controls with the Excalidraw tool surface."
source: "docs/superplan/human/features.md"
created: "2026-08-04"
order: 9
depends_on: ["04", "06", "F006"]
parent: ""
---

# Unify Pages and Cameras in a Tabbed IdeaSketch Navigator Plan

**Goal:** Give each IdeaSketch document one coherent navigation surface for Pages and Cameras while reclaiming the separate Page popover and detached Canvas control space.
**Scope:** Replace the Page popover and Camera-only sidebar with one thumbnail-free right-side navigator whose fixed Pages and Cameras tabs switch the visible list without collapsible sections. The Pages tab preserves create, select, inline rename, drag reorder, delete, active state, and last-Page protection. The Cameras tab remains scoped to the active Page and preserves Add Camera, selection, reorder, delete, empty state, and always-available Preview/Fullscreen Present. Keep the navigator hidden by default and controlled by the existing right divider plus one Excalidraw-aligned Navigator tool. Remove the redundant current-Page shortcut and its document chrome above the Canvas so Pages have one navigation surface. Replace the detached top-right Cameras island with a second Excalidraw-aligned tool for entering Camera drawing mode; Camera drawing opens the navigator on Cameras. All controls use English labels and shared hover/focus tooltips.
**Non-Goals:** This plan does not add Page or Camera thumbnails, persist navigator visibility or selected tab, resize the right panel, rename Cameras, add Camera titles, change Page/Camera persistence, alter presentation sequencing, add keyboard history/Quick Open, inject controls into private Excalidraw DOM, redesign the central Excalidraw tool set, or change Workspace Explorer behavior.
**Architecture:** IdeaSketchEditor remains the document/Page draft boundary and owns navigator visibility plus the active pages-or-cameras tab. A new IdeaSketchNavigator composes the existing Page and Camera behaviors through the shared Radix Tabs primitive; Page and Camera list modules remain presentation-only and delegate model changes back to the editor. SlideCanvas keeps Camera drawing mechanics internal and receives explicit navigator-toggle and Camera-tool callbacks. Excalidraw 0.18 exposes renderTopRightUI but no public central-toolbar extension slot, so the custom controls stay on that supported boundary and are styled as a compact tool island immediately adjacent to the native toolbar instead of using brittle portals or DOM mutation. The visual system keeps the approved neutral surfaces, quiet boundaries, and violet interaction accent; its signature is a restrained two-tab navigator rail with compact tabular counts rather than another generic sidebar header.
**Baseline:** IdeaSketchEditor renders a 40px document chrome containing PageOrganizer, which opens a separate Pages popover, then composes SlideCanvas, the right divider, and a fixed-width CameraList. CanvasPresentationControls renders a detached Cameras count island in Excalidraw's far-right area. Camera creation begins from the Cameras header through a monotonic drawing request token. Both sidebars initialize hidden, Present works with zero Cameras, Page switching flushes the current draft, and no Page/Camera thumbnails are mounted.
**Exit Criteria:** Opening a writable or read-only .is document shows no Page popover, current-Page shortcut, or document chrome above the Canvas. The right panel remains hidden initially; opening it shows a fixed Pages/Cameras tab strip with counts and exactly one list at a time. Pages and active-Page-scoped Cameras retain all current management behavior without thumbnails. Selecting another Page updates the Canvas, resets Camera selection, and changes the Cameras tab contents without losing pending edits. The Navigator tool opens/hides the panel; the Camera tool opens Cameras and enters one Camera drawing request, with disabled/read-only behavior and visible tooltips. Present stays in the Cameras view and remains available at zero Cameras. The detached far-right Cameras island is gone, the custom controls align with the Excalidraw toolbar at supported desktop widths without wrapping or overlapping, panel collapse and presentation-exit refresh still work, focused UI contracts, the full Node suite, production build, diff checks, and native/browser interaction checks pass.

## Task 1: Lock the Navigator and Tool-placement Contract

**Outcome:** Focused regressions describe the tabbed navigator, Page/Camera ownership, and Excalidraw-aligned control behavior before production composition changes.
**Files:**
- Create: tests/ideaSketchNavigator.test.mjs
- Modify: tests/ideaSketchEditor.test.mjs
- Modify: tests/pageOrganizer.test.mjs
- Modify: tests/cameraSidebarWiring.test.mjs
- Modify: tests/canvasPresentationControls.test.mjs
- Modify: tests/tooltipWiring.test.mjs
- Modify: tests/panelDividerWiring.test.mjs

**Change Map:**
- navigator contract: fixed Pages/Cameras Tabs, counts, one active content surface, hidden-by-default composition, and no collapsible-section or thumbnail behavior
- Page/Camera interaction contract: Navigator tool toggles the combined panel; Camera tool opens Cameras and issues one drawing request; tab switching does not mutate the document
- Canvas control contract: remove the detached Cameras-only island and require accessible navigator plus Camera-tool actions on the supported Excalidraw custom-UI boundary
- continuity contract: Present remains Cameras-owned and enabled at zero Cameras; right divider and read-only behavior remain intact

**Verification:**
- node --test tests/ideaSketchNavigator.test.mjs tests/ideaSketchEditor.test.mjs tests/pageOrganizer.test.mjs tests/cameraSidebarWiring.test.mjs tests/canvasPresentationControls.test.mjs tests/tooltipWiring.test.mjs tests/panelDividerWiring.test.mjs

- [x] Add focused failing contracts for the approved tabbed navigation and toolbar interactions.
- [x] Confirm failures correspond to the separate Page popover, Camera-only panel, and detached Canvas control.

## Task 2: Build the Tabbed Document Navigator

**Outcome:** Pages and Cameras share one modular right-side panel while preserving their independent behavior and active-Page safety.
**Files:**
- Create: src/components/IdeaSketchNavigator.tsx
- Modify: src/components/PageOrganizer.tsx
- Modify: src/components/CameraList.tsx
- Modify: src/components/IdeaSketchEditor.tsx
- Modify: src/components/ResizableDivider.tsx
- Modify: src/components/ui/Tabs.tsx
- Modify: src/index.css

**Change Map:**
- IdeaSketchNavigator: controlled Pages/Cameras tab strip, tabular counts, accessible tab/content semantics, and content-height ownership
- PageOrganizer: replace popover ownership with an embeddable thumbnail-free Page list and compact Page actions
- CameraList: render as the Cameras tab content while retaining Add Camera, Present, rows, ordering, deletion, and zero-Camera direction
- IdeaSketchEditor: own showNavigator and navigatorTab, remove the redundant document chrome, keep draft flush before Page changes, project current Page/Cameras into the navigator, and preserve the existing fixed right-panel/divider boundary
- ResizableDivider: rename the right-side accessible toggle from Cameras to the combined Navigator
- shared Tabs/CSS: apply the approved quiet neutral/violet system, visible focus states, internal list scrolling, and one moving active rail without generic pill-heavy styling

**Verification:**
- Run the focused Task 1 suite.
- Interaction cases: hidden initial panel; Pages/Cameras switching; Page add/rename/reorder/delete/select; Camera list follows active Page; long lists scroll internally; read-only actions disable safely; no thumbnail hooks or popover remain.

- [x] Implement the controlled navigator and convert both list modules to panel content.
- [x] Preserve Page draft isolation and Camera scoping while removing the separate Page popover.
- [x] Apply the navigator hierarchy, density, focus, empty, and active states from the approved editor-shell visual system.

## Task 3: Align Navigator and Camera Tools with Excalidraw

**Outcome:** Navigator visibility and Camera drawing are available as compact Canvas tools without a detached far-right Cameras island or private Excalidraw integration.
**Files:**
- Modify: src/components/CanvasPresentationControls.tsx
- Modify: src/components/SlideCanvas.tsx
- Modify: src/components/IdeaSketchEditor.tsx
- Modify: src/lib/slideCanvasProps.ts
- Modify: src/index.css
- Modify: tests/slideCanvasProps.test.mjs

**Change Map:**
- Canvas custom controls: replace the labeled Cameras/count toggle with icon-first Navigator and Add Camera tools, selected/disabled states, concise English tooltips, and Excalidraw Button styling
- SlideCanvas: keep renderTopRightUI as the public integration slot, accept explicit tool callbacks, retain the monotonic drawing request boundary, and avoid Camera tool behavior in view/read-only mode
- IdeaSketchEditor: Navigator tool toggles the panel; Camera tool opens Cameras and issues exactly one drawing request
- prop comparator/CSS: include the new callbacks/state in memoization safety and align the custom island beside the native toolbar across supported widths without wrapping, overlap, or pointer interception

**Verification:**
- node --test tests/canvasPresentationControls.test.mjs tests/tooltipWiring.test.mjs tests/slideCanvasProps.test.mjs tests/cameraBadgeWiring.test.mjs tests/ideaSketchNavigator.test.mjs
- Interaction cases: Navigator opens/closes with Pages as its initial tab; Camera tool opens Cameras then draws one frame; Escape/selection cleanup remains correct; read-only mode exposes navigation but no creation; Canvas badges, image export, native-save suppression, and presentation-exit refresh remain unchanged.

- [x] Recompose the custom tool group through Excalidraw's supported public boundary.
- [x] Wire navigator and Camera actions without duplicating or weakening Camera drawing state.
- [x] Verify responsive placement and remove obsolete detached-control styling.

## Task 4: Verify and Deliver F009

**Outcome:** The unified navigator ships with current behavioral, visual, accessibility, and regression evidence.
**Files:**
- Modify: docs/superplan/human/features.md
- Modify: docs/superplan/plans/features/F009-tabbed-ideasketch-navigator.md
- Modify: docs/superplan/plans/README.md

**Change Map:**
- F009 feature/plan: completion state and final Page/Camera/Canvas-tool evidence
- generated plan index: refreshed accepted/delivery status

**Verification:**
- node --test tests/*.test.mjs
- npm run build
- git diff --check
- Browser/Tauri acceptance: open a multi-Page .is; confirm the right panel starts hidden; open Pages and Cameras from their intended controls; exercise Page and Camera mutations; draw a Camera from the Canvas tool; run zero-/nonzero-Camera Preview and Fullscreen; collapse/restore the panel; inspect toolbar alignment at representative desktop widths and verify Canvas pointer alignment after each width transition.

- [x] Run focused checks during implementation and the complete frontend regression/build matrix once behavior stabilizes.
- [x] Complete visual and native interaction acceptance, record evidence, mark F009 done/complete, refresh the index, and create a separate feat(F009) commit excluding unrelated files.

## Delivery Evidence

- Focused navigator contracts: `node --test tests/ideaSketchNavigator.test.mjs tests/ideaSketchEditor.test.mjs tests/pageOrganizer.test.mjs tests/cameraSidebarWiring.test.mjs tests/canvasPresentationControls.test.mjs tests/tooltipWiring.test.mjs tests/panelDividerWiring.test.mjs tests/slideCanvasProps.test.mjs` — 30 passed.
- Full frontend regression: `node --test tests/*.test.mjs` — 166 passed.
- Production build and diff validation: `npm run build` and `git diff --check` passed; only the existing Excalidraw mixed-import and large-chunk warnings remain.
- Native regression: `cargo test` in `src-tauri` — 64 passed.
- Browser acceptance at default desktop, 1200px, and 1024px widths confirmed the navigator starts hidden, opens on Pages through the Canvas Navigator tool, switches between fixed Pages/Cameras tabs, preserves Page add/select/rename and active-Page Camera scoping, creates a Camera through the Canvas tool, keeps Present available at zero Cameras, exits Preview cleanly, exposes both tooltips, and logs no console errors. At 1024px the native toolbar, custom tool island, and 244px navigator remain non-overlapping with an 8px boundary gap.
- The final refinement removes the redundant Page shortcut and 40px document chrome above the Canvas, leaving the Navigator tool and divider as the intentional entry points.

## References
- docs/superplan/human/features.md
- docs/superplan/plans/04-ideasketch-editor-integration.md
- docs/superplan/plans/06-single-active-editor.md
- docs/superplan/plans/features/F002-workspace-resource-explorer.md
- docs/superplan/plans/features/F003-canvas-presentation-controls.md
- docs/superplan/plans/features/F004-refine-editor-shell.md
- docs/superplan/plans/features/F005-align-workspace-camera-actions.md
- docs/superplan/plans/features/F006-revision-c-editor-shell-defaults.md
- src/components/IdeaSketchEditor.tsx
- src/components/PageOrganizer.tsx
- src/components/CameraList.tsx
- src/components/CanvasPresentationControls.tsx
- src/components/SlideCanvas.tsx
- src/components/ResizableDivider.tsx
- src/components/ui/Tabs.tsx
- src/index.css
- node_modules/@excalidraw/excalidraw/dist/types/excalidraw/types.d.ts
