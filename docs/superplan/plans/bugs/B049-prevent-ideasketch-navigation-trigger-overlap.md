---
id: "B049"
title: "Prevent IdeaSketch Navigation Trigger Overlap"
type: "bugfix"
status: "complete"
summary: "Move the closed IdeaSketch navigation trigger to the lower-left on selection and shift Excalidraw's lower-left controls to its right."
source: "docs/superplan/human/bugs.md"
created: "2026-08-14"
order: 49
depends_on: ["B042"]
parent: ""
---

# Prevent IdeaSketch Navigation Trigger Overlap Plan

**Goal:** Keep the IdeaSketch navigation entry permanently reachable without covering Excalidraw's contextual controls or consuming Canvas width.
**Scope:** Keep the existing closed-drawer navigation trigger inside `IdeaSketchEditor` and at the Canvas upper-left by default. While Excalidraw reports one or more selected elements and displays its upper-left selection controls, move the trigger to the Canvas lower-left and shift Excalidraw's existing lower-left control group to its right; return both surfaces to their normal positions when the selection clears. Preserve the existing icon, accessible label, focus treatment, opening behavior, drawer-owned close control, drawer sizing/persistence, responsive overlay behavior, and Excalidraw layout refresh.
**Non-Goals:** This fix does not add a permanent side rail, consume Canvas width, use Excalidraw's right-side slot, move editor state into the workbench shell, change Excalidraw's property-panel structure, alter the central toolbar, Pages/Cameras content, drawer width or persistence, Canvas commands, presentation, selection conversion, Page/Camera models, document persistence, Workspace/Agent chrome, or the open drawer's close-control placement.
**Architecture:** `IdeaSketchEditor` remains the only drawer-state and trigger owner. `SlideCanvas`, already responsible for observing live Excalidraw selection state, reports only the boolean presence of selected elements through its editor-local prop boundary. The editor applies one Canvas state class and a placement modifier to the existing closed-state trigger; scoped CSS switches the trigger between upper-left and lower-left and temporarily adds an inline-start margin to Excalidraw's public lower-left footer group, without changing Canvas dimensions, introducing a shell dependency, or querying Excalidraw DOM from React.
**Baseline:** B042 conditionally renders the closed trigger inside `.ideanote-ideasketch-canvas`, and `.ideanote-ideasketch-drawer-trigger.is-canvas` absolutely anchors it at `top: 1rem; left: 1rem` with a higher z-index. Excalidraw renders the selected-element properties surface as an absolutely positioned `.App-menu__left` in the same upper-left Canvas region.
**Reproduction:** Close the IdeaSketch drawer, select an Excalidraw element, and inspect the upper-left editor region. The IdeaNote navigation trigger remains at the Canvas origin while Excalidraw opens the Stroke/Background/Stroke width properties surface underneath it, causing the two interactive surfaces to overlap.
**Root Cause:** The closed navigation trigger is structurally inside the Canvas and removed from flex layout by absolute positioning. Because the application control and Excalidraw's contextual panel independently claim the same Canvas coordinate space, neither component reserves room for the other; changing `z-index` would only choose which control obscures the other.
**Exit Criteria:** With the drawer closed and no selection, exactly one `Open IdeaSketch menu` button remains at the Canvas upper-left and Excalidraw's lower-left controls keep their normal inset. Selecting any live Excalidraw element moves that same button to the lower-left so the upper-left properties panel is unobstructed, shifts the existing lower-left Excalidraw control group to begin to the trigger's right without overlap, and consumes no permanent Canvas width; clearing selection returns both surfaces to their original positions. The trigger retains its `PanelLeft` glyph, label, `aria-expanded=false`, keyboard focus, and click behavior. With the drawer open, the Canvas trigger is absent and the existing drawer header close control remains the only trigger; desktop resize plus narrow overlay behavior are unchanged. No editor state enters the workbench shell, focused/runtime regressions and the full frontend suite pass, the production build passes, Superplan validation and diff hygiene pass, and the fix is delivered in one separate B049 commit.

## Task 1: Lock the Selection-Aware Placement Contract

**Outcome:** Focused regressions prove the existing Canvas trigger moves out of the upper-left only while Excalidraw selection controls are active.
**Files:**
- Modify: `tests/ideaSketchDrawer.test.mjs`
- Modify: `tests/f012DragRuntime.test.mjs`

**Change Map:**
- source contract: require an editor-local selection-presence callback from `SlideCanvas` and a lower-left placement modifier on the existing closed Canvas trigger
- runtime placement: verify upper-left at rest, lower-left after selecting an element, no intersection with the properties panel or lower-left control group, that group beginning to the trigger's right, and return of both surfaces after clearing selection
- state preservation: verify one trigger total, drawer-owned close placement when open, existing focus/accessibility, one divider, and rapid-resize behavior

**Verification:**
- `node --test tests/ideaSketchDrawer.test.mjs tests/f012DragRuntime.test.mjs`

- [x] Add focused regressions that fail against the current absolute Canvas trigger and reproduce the overlap.
- [x] Keep existing drawer ownership, resize, responsive, accessibility, and Excalidraw toolbar contracts explicit.

## Task 2: Make the Closed Trigger Selection-Aware

**Outcome:** The navigation trigger vacates Excalidraw's upper-left controls only when needed and consumes no additional Canvas width.
**Files:**
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `src/lib/slideCanvasProps.ts`
- Modify: `src/index.css`
- Modify: focused tests from Task 1

**Change Map:**
- `SlideCanvas` and comparator: edge-trigger a boolean callback when live selected-element presence changes without widening document or shell state
- `IdeaSketchEditor`: keep the existing Canvas-owned `PanelLeft` control and apply a lower-left modifier while selection controls are active; leave the open drawer and header close control unchanged
- styles: preserve current upper-left geometry at rest, switch to an equivalent lower-left inset when selected, and offset Excalidraw's existing footer-left group by one trigger plus gap; retain hover, focus, theme, and high-DPI sizing

**Verification:**
- Run the focused Task 1 suite.
- Interaction cases: select elements with the drawer closed; pointer and keyboard open; drawer header close and Escape; desktop resize; narrow overlay; Light/Dark; minimum supported application size; no duplicate trigger or obscured properties controls.

- [x] Apply the smallest editor-owned state and style change without overriding Excalidraw's property panel or involving the workbench shell.
- [x] Confirm the trigger moves only when necessary while preserving drawer, Canvas, and document behavior.

## Task 3: Verify and Deliver B049

**Outcome:** The overlap correction ships with current regression, build, workflow, visual/runtime, and Git evidence.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B049-prevent-ideasketch-navigation-trigger-overlap.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- B049 request/plan: completion state, checked outcomes, focused/full/build/runtime evidence, and any native automation limitation
- generated plan index: current B049 status and B042 dependency

**Verification:**
- `node --test tests/ideaSketchDrawer.test.mjs tests/f012DragRuntime.test.mjs`
- `node --test tests/*.test.mjs`
- `npm run build`
- Reuse current Rust evidence because no native source or Tauri configuration changes; rerun Rust tests only if implementation scope expands.
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`

- [x] Run the complete verification matrix once implementation is stable and inspect meaningful warnings.
- [x] Compare the final diff with every Exit Criterion, complete B049, refresh Superplan progress, and create one separate `fix(B049)` commit.

## Delivery Evidence

- Test-first regression: the focused source suite initially failed against the fixed upper-left trigger, proving the missing selection-aware callback and placement modifier. After implementation, `node --test tests/ideaSketchDrawer.test.mjs tests/excalidrawViewportObservers.test.mjs tests/slideCanvasProps.test.mjs tests/f012DragRuntime.test.mjs` passed 27/27.
- WebKit runtime: with no selection, the trigger and Excalidraw footer-left group both retain the normal 16px Canvas inset. Drawing and selecting a rectangle moves the trigger to a 16px lower-left inset, exposes `.App-menu__left` without intersection, and moves the footer-left group to begin at least 12px after the trigger; clicking empty Canvas clears the selection and restores the trigger to its original upper-left position. Opening the drawer afterward still leaves exactly one drawer-owned close control.
- Initial/Page state correctness: `SlideCanvas` reports selection presence before its unchanged-observation fast return, so an initially selected Page and Page-scoped remount cannot leave the parent at a stale default. The callback remains edge-triggered after initialization and is included in the memo comparator.
- Full frontend regression: `node --test tests/*.test.mjs` passed 433/433.
- Production build: `npm run build` passed. Only the existing Tauri opener/Excalidraw mixed static-dynamic import and large-chunk warnings were reported.
- Native regression: B042's native evidence remains applicable because B049 changes only React, scoped CSS, frontend tests, and Superplan metadata; no Rust source, Tauri command, capability, or configuration changed.
- Diff hygiene: `git diff --check` passed before completion metadata was written.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/features/F053-migrate-unified-ideasketch-drawer-to-tauri.md`
- `docs/superplan/plans/bugs/B039-refine-ideasketch-drawer-controls.md`
- `docs/superplan/plans/bugs/B040-refine-ideasketch-navigator-density.md`
- `docs/superplan/plans/bugs/B041-remove-duplicate-ideasketch-divider-lines-and-restore-close-icon.md`
- `docs/superplan/plans/bugs/B042-move-open-ideasketch-close-control-into-navigator.md`
- Human-supplied production screenshot from `2026-08-14`
- `src/components/IdeaSketchEditor.tsx`
- `src/index.css`
- `public/excalidraw.css`
