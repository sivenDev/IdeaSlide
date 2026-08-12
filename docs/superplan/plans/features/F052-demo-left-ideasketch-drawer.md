---
id: "F052"
title: "Prototype the Unified Left IdeaSketch Drawer"
type: "feature"
status: "complete"
summary: "Prototype a left-side IdeaSketch drawer that combines Pages, Cameras, and Canvas menu actions inside the isolated browser demo."
source: "docs/superplan/human/features.md"
created: "2026-08-12"
order: 52
depends_on: ["F044-02"]
parent: ""
---

# Prototype the Unified Left IdeaSketch Drawer Plan

**Goal:** Make the proposed IdeaSketch information architecture directly reviewable before changing the production editor.
**Scope:** Change only the isolated `.temp/f041-native-workbench-review` demo. Replace its right-side IdeaSketch Navigator and separate editor toolbar actions with one resizable left drawer opened from an Excalidraw-aligned top-left menu button. The drawer keeps Pages and Cameras as counted tabs with their existing demo operations, and adds a lower Canvas & export command group for clean-diagram conversion, presentation, PNG/SVG/draw.io export, and a demonstrative canvas-background action. Preserve document dirty-state integration, Excalidraw editing, read-only behavior, presentation, and the surrounding Workspace/Agent shell.
**Non-Goals:** This plan does not change production `src`, tests, Tauri code, `.is` serialization, editor registry contracts, real Excalidraw Main Menu integration, native export dialogs, or approve production migration. It does not add Page thumbnails, Camera frame drawing, or new document behavior beyond what the demo already supports.
**Architecture:** Keep the demo's existing IdeaSketch model and mutation functions authoritative. Recompose the current `Navigator` as a left drawer within the editor workspace and pass existing editor actions into it rather than duplicating state. Persist only demo-local drawer width and the selected Pages/Cameras tab. Use the existing React, Excalidraw, lucide, and CSS boundaries; the demo remains isolated from production code.
**Baseline:** The demo currently renders a native-looking toolbar above Excalidraw, a right-side resizable Navigator open by default, Pages/Cameras tabs inside that panel, and export/presentation/conversion actions in the separate toolbar. The F052 request proposes one left-origin surface launched from the top-left menu button, with both navigation lists and menu functions.
**Exit Criteria:** Opening `launch-plan.is` shows the Canvas at full width with no right Navigator. Activating the top-left menu button opens a left drawer and moves the Canvas boundary without covering the outer Workspace panel. The drawer can close, resize, switch between counted Pages/Cameras tabs, and exercise all existing Page/Camera operations. Canvas & export actions are available in the same drawer and still produce their current demo results. Keyboard focus is visible, Escape closes the drawer when focus is inside it, reduced motion is respected, tests and the demo build pass, and browser inspection confirms the layout at representative desktop and narrow widths.

## Task 1: Lock the Unified Drawer Interaction Contract

**Outcome:** Focused demo tests describe the proposed left-origin control, combined content, preserved operations, and production-isolation boundary.
**Files:**
- Create: `.temp/f041-native-workbench-review/tests/ideasketchDrawer.test.mjs`

**Change Map:**
- IdeaSketch source contract: require a top-left drawer trigger, left-side composition, counted Pages/Cameras tabs, one Canvas & export command group, Escape close behavior, and no right-side Navigator restoration control
- isolation contract: reject imports from production `src` and keep the prototype inside the existing review demo

**Verification:**
- `cd .temp/f041-native-workbench-review && node --test tests/ideasketchDrawer.test.mjs`

- [x] Add focused source-level acceptance checks that fail against the current right-side Navigator layout.
- [x] Confirm the failures distinguish the requested drawer from the existing toolbar-plus-panel composition.

## Task 2: Recompose IdeaSketch into the Left Tool Drawer

**Outcome:** The review demo presents one coherent left-side IdeaSketch surface without losing current Canvas, Page, Camera, export, or presentation behavior.
**Files:**
- Modify: `.temp/f041-native-workbench-review/src/editors/ideasketch/IdeaSketchEditor.jsx`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Modify: `.temp/f041-native-workbench-review/README.md`

**Change Map:**
- `IdeaSketchEditor` and `Navigator`: move navigation before the Canvas, replace the separate toolbar with an Excalidraw-aligned drawer trigger and compact contextual actions, route conversion/export/presentation callbacks into the drawer, remember demo-local width/tab state, and close on Escape without changing the document model
- IdeaSketch styles: create the restrained violet-gray drawer, stable left resize rail, counted tab treatment, command-group hierarchy, responsive overlay fallback, focus states, and reduced-motion behavior
- demo walkthrough: describe the combined drawer as review-only UX and retain the production migration gate

**Verification:**
- `cd .temp/f041-native-workbench-review && node --test tests/ideasketchDrawer.test.mjs`
- Browser cases: open/close/resize; Pages and Cameras switching and mutations; export/conversion/presentation actions; narrow-window fallback; Light/Dark themes; no overlap with Workspace or Agent panels.

- [x] Build the left drawer around the existing single IdeaSketch state and action paths.
- [x] Calibrate hierarchy, spacing, responsive behavior, focus, and motion to the demo's existing visual system.

## Task 3: Verify and Deliver the Reviewable Prototype

**Outcome:** F052 has current automated and visual evidence, while remaining explicitly separate from production migration.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F052-demo-left-ideasketch-drawer.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- F052 feature and plan: completion state plus focused, full-demo, build, and browser review evidence
- generated plan index: current F052 status and dependency

**Verification:**
- `cd .temp/f041-native-workbench-review && npm test`
- `cd .temp/f041-native-workbench-review && npm run build`
- `git diff --check`
- Browser acceptance with `launch-plan.is` at representative desktop and narrow widths.

- [x] Run the focused test while iterating, then the full demo suite/build once the prototype stabilizes.
- [x] Inspect the final diff and browser result, update Superplan progress, and create one `feat(F052)` commit containing only this demo prototype.

## Completion Evidence

- The focused drawer contract first failed all three checks against the previous toolbar-plus-right-Navigator composition, then passed 3/3 after the prototype was implemented.
- `npm test` passed all 68 isolated demo tests, including the new left-drawer, combined-command, Escape, responsive, persistence, and production-isolation checks.
- `npm run build` completed successfully. Vite reported only the demo's existing large-chunk advisory; there were no build errors.
- Browser review at the default 1601×1222 viewport confirmed the Canvas starts at full width, the 42px top-left menu trigger opens a 304px left drawer, counted Pages/Cameras tabs and existing mutations work, the keyboard resize separator changes the drawer to 312px, Canvas background feedback appears, Present opens and exits, and the console contains no errors.
- Browser review at 700×850 confirmed the drawer switches to a 330px overlay inside the editor region, hides its resize divider, preserves the outer Workspace column, and keeps Canvas controls reachable behind the dismissible surface. Escape closed the drawer and an Add Camera action updated the current Page's counted list.
- The final design stays within the demo's violet-gray visual system and adds one distinctive blue left-edge tool rail connecting the menu trigger to the opened drawer. Production `src`, Tauri code, and document formats were unchanged.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F044-complete-mocked-tauri-review-demo/F044-02-ideasketch-and-markdown-editor-experiences.md`
- `docs/superplan/plans/features/F009-tabbed-ideasketch-navigator.md`
- `docs/superplan/plans/features/F014-simplify-file-and-navigator-controls.md`
- `.temp/f041-native-workbench-review/src/editors/ideasketch/IdeaSketchEditor.jsx`
- `.temp/f041-native-workbench-review/src/styles.css`
- `.temp/f041-native-workbench-review/README.md`
