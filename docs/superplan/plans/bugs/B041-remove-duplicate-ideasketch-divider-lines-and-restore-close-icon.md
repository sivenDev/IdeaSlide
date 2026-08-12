---
id: "B041"
title: "Remove Duplicate IdeaSketch Divider Lines and Restore Close Icon"
type: "bugfix"
status: "complete"
summary: "Render one IdeaSketch drawer divider and give the open drawer a distinct close-sidebar icon."
source: "docs/superplan/human/bugs.md"
created: "2026-08-12"
order: 41
depends_on: ["B040"]
parent: ""
---

# Remove Duplicate IdeaSketch Divider Lines and Restore Close Icon Plan

**Goal:** Make the open IdeaSketch navigator boundary visually singular and make its trigger clearly communicate the close action.
**Scope:** Remove the overlapping desktop drawer border and drawer-owned edge shadow so the existing interactive resize rail is the only vertical boundary between the navigator and Canvas; retain the narrow-overlay shell elevation where a floating drawer still needs separation from the Canvas; render `PanelLeft` while the drawer is closed and `PanelLeftClose` while it is open; preserve the Excalidraw-aligned trigger size, position, surface, active treatment, focus state, accessible labels, and expanded state.
**Non-Goals:** This fix does not change drawer width, minimum/maximum bounds, resize hit area, pointer or keyboard resize behavior, rapid-resize synchronization, narrow-overlay width, Pages/Cameras content, Canvas commands, drawer persistence, Excalidraw toolbar geometry, global Workspace/Agent divider styling, or `.is` data.
**Architecture:** `ResizableDivider` remains the single accessible and interactive boundary primitive. IdeaSketch-specific CSS stops drawing a second structural boundary on the drawer itself, while the general resize rail retains its normal neutral line and focus/drag states. `IdeaSketchEditor` keeps one trigger and one state owner but renders state-specific Lucide glyphs; this intentionally supersedes only B039's same-glyph decision in response to the newer reviewed screenshot, without restoring Excalidraw's removed Main Menu.
**Baseline:** B040 leaves the desktop drawer with a `1px` right border and a right-cast shadow while `ResizableDivider` overlays the same edge with its own centered line. The screenshot shows these adjacent edge effects as several parallel vertical lines. `IdeaSketchEditor` imports only `PanelLeft` and renders it for both `drawerOpen` states, so the open trigger changes color but has no close-sidebar glyph.
**Reproduction:** Open a production `.is` file and open the IdeaSketch navigator. Inspect the divider between the drawer and Canvas: the drawer border, edge shadow, and resize-rail line appear as multiple adjacent vertical marks. Inspect the open-state trigger: its accessible label says `Close IdeaSketch menu`, but its visible glyph is the same `PanelLeft` icon used to open the drawer.
**Root Cause:** Three visual layers currently share the same desktop boundary: `.ideanote-ideasketch-drawer` supplies `border-right` and an outward `box-shadow`, while `.idea-slide-resize-rail__line` supplies the actual interactive divider. The trigger has no visual state branch because its JSX always renders `<PanelLeft>` even though `drawerOpen` already drives its label and styling.
**Exit Criteria:** The desktop boundary between the open IdeaSketch navigator and Canvas contains one neutral 1px resize-rail line at rest, with the existing focus/hover/drag emphasis and no adjacent drawer border or edge shadow. The narrow overlay retains appropriate floating elevation without reintroducing a parallel boundary. The closed trigger shows `PanelLeft`; the open trigger shows `PanelLeftClose`; both retain the reviewed Excalidraw-aligned top/bottom geometry, labels, `aria-expanded`, keyboard focus, Light/Dark behavior, and click/Escape closing behavior. Rapid pointer resizing remains gap-free, focused and full frontend regressions pass, the production build passes, applicable native evidence is current, Superplan validation passes, and the fix is delivered in one separate B041 commit.

## Task 1: Lock the Single-Boundary and Icon-State Contract

**Outcome:** Focused regressions distinguish one resize boundary and a real open-state close icon from the B040 implementation.
**Files:**
- Modify: `tests/ideaSketchDrawer.test.mjs`
- Modify: `tests/f012DragRuntime.test.mjs`

**Change Map:**
- source contract: require `PanelLeft` and `PanelLeftClose` state branches with unchanged accessible labels and reject a permanent single-glyph trigger
- boundary contract: reject the IdeaSketch drawer's desktop `border-right` and drawer-owned edge shadow while retaining the shared resize-rail line
- runtime geometry: verify one narrow resting boundary band, preserved trigger/toolbar top-bottom alignment, and unchanged rapid-resize shell/content synchronization

**Verification:**
- `node --test tests/ideaSketchDrawer.test.mjs tests/f012DragRuntime.test.mjs`

- [x] Add focused regressions that fail against B040's overlapping edge effects and same icon in both states.
- [x] Preserve explicit contracts for trigger accessibility, toolbar alignment, resize behavior, and narrow overlay elevation.

## Task 2: Make the Rail the Only Divider and Restore the Close Glyph

**Outcome:** The production IdeaSketch drawer has one quiet interactive boundary and an unambiguous open-state close control.
**Files:**
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/index.css`
- Modify: focused tests from Task 1

**Change Map:**
- `IdeaSketchEditor`: import `PanelLeftClose` and render it only when `drawerOpen`, retaining `PanelLeft` for the closed state and all existing button semantics
- IdeaSketch drawer CSS: remove the drawer's desktop right border and drawer-owned edge shadow so the shared rail line exclusively owns the split
- narrow overlay CSS: retain the shell's floating shadow because the resize rail is hidden in overlay mode and elevation, rather than parallel rules, separates the surfaces

**Verification:**
- Run the focused Task 1 suite.
- Interaction cases: open/close by pointer, keyboard, and Escape; closed/open glyph switch; one resting line; focused/dragged rail emphasis; rapid left resize; 244px narrow overlay; Light/Dark.

- [x] Apply the smallest state-glyph and scoped CSS changes without modifying the shared divider primitive.
- [x] Confirm the boundary remains discoverable and resizable without duplicate lines or loss of narrow-overlay separation.

## Task 3: Verify and Deliver B041

**Outcome:** The visual correction ships with current regression, build, workflow, and Git evidence.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B041-remove-duplicate-ideasketch-divider-lines-and-restore-close-icon.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- B041 request/plan: completion state, checked outcomes, focused/full/build/native/visual evidence and any automation limitation
- generated plan index: current B041 status and B040 dependency

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture` when native evidence is invalidated or otherwise required by the final matrix
- `git diff --check`
- WebKit/Tauri review where available: one divider line, open/close glyph switch, trigger alignment, rapid resize, desktop and narrow overlay.

- [x] Run the complete verification matrix once the implementation is stable and inspect meaningful warnings.
- [x] Compare the final diff with every Exit Criterion, complete B041, refresh Superplan progress, and create one separate `fix(B041)` commit.

## Delivery Evidence

- Test-first regression: `node --test tests/ideaSketchDrawer.test.mjs tests/f012DragRuntime.test.mjs` initially failed 2/8 against B040, proving the open trigger still rendered `lucide-panel-left` and the production source still lacked the state-specific close glyph/single-boundary contract. After the fix, the same focused suite passed 8/8.
- WebKit runtime: the open trigger renders `lucide-panel-left-close`; the drawer computes `border-right-width: 0px` and `box-shadow: none`; the resting resize-rail line measures between 0.9px and 1.1px and remains visibly colored. Existing top/bottom alignment with Excalidraw, rapid-resize `0s` transition with at most 1px shell/content delta, Workspace dragging, and virtualized Page sorting also passed in the same 2/2 runtime suite.
- Related UI regression: `node --test tests/ideaSketchEditor.test.mjs tests/ideaSketchNavigator.test.mjs tests/panelDividerWiring.test.mjs tests/excalidrawMainMenu.test.mjs tests/slideCanvasProps.test.mjs` passed 23/23, preserving editor ownership, navigator content, shared divider behavior, Main Menu suppression, and Canvas comparator behavior.
- Full frontend regression: `node --test tests/*.test.mjs` passed 398/398.
- Production build: `npm run build` passed; only the existing Excalidraw mixed static/dynamic import and large-chunk warnings were reported.
- Native regression: the B040 `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture` result of 166/166 remains applicable because B041 changes only React, CSS, frontend tests, and Superplan metadata; no Rust source or Tauri configuration changed.
- Source inspection: `IdeaSketchEditor` renders `PanelLeft` only while closed and `PanelLeftClose` only while open, retaining the existing labels and button semantics. IdeaSketch-specific CSS removes the drawer-owned desktop border and shadow without modifying `ResizableDivider`; the narrow overlay shell retains its floating shadow because the rail is hidden there.
- Visual automation boundary: native macOS attachment remains unavailable, so no native screenshot claim is made. The mocked WebKit production `.is` runtime provides executable visual geometry and state-glyph evidence.
- Diff hygiene: `git diff --check` passed before completion metadata was written.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/bugs/B039-refine-ideasketch-drawer-controls.md`
- `docs/superplan/plans/bugs/B040-refine-ideasketch-navigator-density.md`
- `docs/superplan/plans/features/F004-refine-editor-shell.md`
- Human-supplied production screenshot from `2026-08-12`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/ResizableDivider.tsx`
- `src/index.css`
