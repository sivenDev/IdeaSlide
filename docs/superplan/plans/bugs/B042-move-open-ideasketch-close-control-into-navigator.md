---
id: "B042"
title: "Move the Open IdeaSketch Close Control into the Navigator"
type: "bugfix"
status: "complete"
summary: "Show the open drawer's close control in the navigator header and keep the Canvas trigger only while the drawer is closed."
source: "docs/superplan/human/bugs.md"
created: "2026-08-12"
order: 42
depends_on: ["B041"]
parent: ""
---

# Move the Open IdeaSketch Close Control into the Navigator Plan

**Goal:** Put each IdeaSketch navigation control on the surface it affects: open from the Canvas, close from the open navigator.
**Scope:** Render the `Open IdeaSketch menu` button only in the Canvas while the drawer is closed; render the `Close IdeaSketch menu` button only in the drawer's top-right header area while it is open; keep the existing `PanelLeft` and `PanelLeftClose` glyphs, Excalidraw-style square control treatment, labels, `aria-expanded`, click behavior, and Escape dismissal; reserve explicit header space so the close button does not cover the Pages/Cameras tabs or counts; remove the narrow-overlay rule that repositions the open control over the Canvas.
**Non-Goals:** This fix does not change drawer width, minimum/maximum bounds, open/close transition, resize rail, rapid-resize synchronization, overlay width/elevation, Pages/Cameras content or behavior, tab labels/counts/active indicator, Camera controls, Canvas commands, Excalidraw toolbar geometry, `.is` data, local drawer persistence, or Workspace/Agent chrome.
**Architecture:** `IdeaSketchEditor` remains the single drawer-state owner and conditionally renders one control in one of two state-specific placements instead of moving one Canvas-owned element with CSS. The open-state control belongs to a small drawer header control slot adjacent to, but separate from, the existing navigator tab list; the closed-state control retains the Canvas alignment established by B040. Shared button visuals remain under the current trigger class with placement modifiers, while the narrow overlay inherits the drawer-owned placement without a viewport-width calculation.
**Baseline:** B041 renders one `ideanote-ideasketch-drawer-trigger` inside `ideanote-ideasketch-canvas` for both states. When open, CSS only applies the `is-open` appearance and, at narrow widths, shifts that Canvas-owned button toward the drawer edge. The screenshot therefore shows the close action floating in the Canvas even though it controls the visible sidebar.
**Reproduction:** Open a production `.is` document and activate `Open IdeaSketch menu`. The button changes to `PanelLeftClose`, but inspection and visible placement show it remains inside the Canvas at its top-left edge rather than inside the open navigator header. At narrow editor widths, a calculated `left` rule moves the same Canvas button over the drawer instead of giving the drawer ownership of the close action.
**Root Cause:** `IdeaSketchEditor` has a single unconditional trigger element nested under `<main className="ideanote-ideasketch-canvas">`; `drawerOpen` changes only its label, class, and glyph. No close-control slot exists in the drawer or navigator header, so CSS positioning is the only current placement mechanism and cannot semantically or structurally remove the open-state button from the Canvas.
**Exit Criteria:** With the drawer closed, the Canvas contains exactly one `Open IdeaSketch menu` button using `PanelLeft`, aligned with the Excalidraw toolbar as before. With the drawer open, the Canvas contains no drawer trigger and the drawer top-right contains exactly one `Close IdeaSketch menu` button using `PanelLeftClose`; it does not obscure Pages/Cameras labels, counts, active rails, or focus outlines at the 220px minimum width or the 244px narrow overlay. Pointer, keyboard, and Escape closing work; no duplicate trigger exists during either state; resizing remains gap-free with one divider; relevant focused and runtime regressions, the full frontend suite, production build, Superplan validation, and diff hygiene pass; the fix is delivered in one separate B042 commit.

## Task 1: Lock State-exclusive Control Ownership

**Outcome:** Focused regressions prove that the close control leaves the Canvas and appears only in the open drawer header without changing its semantics.
**Files:**
- Modify: `tests/ideaSketchDrawer.test.mjs`
- Modify: `tests/f012DragRuntime.test.mjs`

**Change Map:**
- source contract: require separate `!drawerOpen` Canvas-open and `drawerOpen` drawer-close branches, reject the unconditional Canvas trigger, and preserve labels, `aria-expanded`, and state-specific Lucide glyphs
- runtime ownership: verify one trigger total, closed trigger containment in Canvas, open trigger containment in drawer, and absence of the trigger from Canvas while open
- header geometry: verify the open control stays inside the drawer, fits at 220px/244px, and does not intersect the Pages/Cameras tab labels or counts
- preservation: retain closed trigger/Excalidraw toolbar alignment, Escape dismissal, single divider, and rapid-resize shell/content synchronization

**Verification:**
- `node --test tests/ideaSketchDrawer.test.mjs tests/f012DragRuntime.test.mjs`

- [x] Add focused source/runtime regressions that fail against B041's unconditional Canvas-owned trigger.
- [x] Keep the existing layout, resize, accessibility, and navigator-content contracts explicit.

## Task 2: Place the Close Control in the Drawer Header

**Outcome:** The open drawer owns its close action while the closed Canvas retains the existing open action.
**Files:**
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/IdeaSketchNavigator.tsx`
- Modify: `src/index.css`
- Modify: focused tests from Task 1

**Change Map:**
- `IdeaSketchEditor`: render the Canvas `PanelLeft` button only when closed; pass or compose the `PanelLeftClose` button only in the open drawer's navigation header; keep the editor as the sole state owner
- `IdeaSketchNavigator`: provide a bounded header-control slot alongside the existing tabs without changing tab state, Page/Camera props, or content ownership
- styles: share the established Excalidraw-like visual tokens, add explicit Canvas/open-drawer placement modifiers, reserve header width for the close control, and delete the narrow-overlay Canvas trigger offset
- responsive behavior: keep the drawer-owned control inside the 244px overlay and maintain focus visibility and tab legibility down to the 220px desktop minimum

**Verification:**
- Run the focused Task 1 suite.
- Interaction cases: closed/open pointer and keyboard activation; Escape; 220px and 420px desktop resize; 244px narrow overlay; Pages/Cameras switching; Light/Dark; no duplicate or overlapping control.

- [x] Apply the smallest state-exclusive placement change without modifying navigator actions or drawer geometry.
- [x] Confirm the control reads as part of the sidebar header and the Canvas is visually free of a close button while open.

## Task 3: Verify and Deliver B042

**Outcome:** The control relocation ships with current regression, build, workflow, and Git evidence.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B042-move-open-ideasketch-close-control-into-navigator.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- B042 request/plan: completion state, checked outcomes, focused/full/build/native/visual evidence and any automation limitation
- generated plan index: current B042 status and B041 dependency

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- Reuse current Rust evidence when no native source or Tauri configuration changes; otherwise run `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- WebKit/Tauri review where available: closed Canvas open control; open drawer header close control; no Canvas close control; no tab overlap; desktop/narrow, Light/Dark.

- [x] Run the complete verification matrix once the implementation is stable and inspect meaningful warnings.
- [x] Compare the final diff with every Exit Criterion, complete B042, refresh Superplan progress, and create one separate `fix(B042)` commit.

## Delivery Evidence

- Test-first regression: `node --test tests/ideaSketchDrawer.test.mjs tests/f012DragRuntime.test.mjs` initially failed 3/8 against B041, proving the only trigger remained inside the Canvas and the drawer contained no close control. After implementation and the reviewed style refinement, the same focused suite passed 8/8.
- WebKit runtime: the closed state contains one Canvas-owned `Open IdeaSketch menu` control; after opening, the application contains exactly one trigger, it is inside the drawer, the Canvas contains zero triggers, and the glyph is `PanelLeftClose`. At both the 244px default and 220px minimum widths, the control stays inside the drawer and does not intersect the Pages/Cameras tabs. Existing single-divider and rapid-resize checks continue to pass.
- Visual refinement: the drawer close control is 32px with a 16px glyph, 6px top/right inset, restrained radius, neutral border/surface, no persistent shadow, and no violet selected-tool treatment. The tab bar reserves only the bounded width required by this compact action. The closed Canvas control retains its 44px/48px Excalidraw toolbar alignment.
- Related IdeaSketch regression: `node --test tests/ideaSketchDrawer.test.mjs tests/ideaSketchEditor.test.mjs tests/ideaSketchNavigator.test.mjs tests/panelDividerWiring.test.mjs tests/excalidrawMainMenu.test.mjs tests/slideCanvasProps.test.mjs tests/pageOrganizer.test.mjs tests/cameraSidebarWiring.test.mjs` passed 32/32 before the final visual-only refinement; the focused runtime and full suite passed afterward.
- Full frontend regression: `node --test tests/*.test.mjs` passed 398/398.
- Production build: `npm run build` passed after the final style refinement. Only the existing Excalidraw mixed static/dynamic import and large-chunk warnings were reported.
- Native regression: B041's 166/166 Rust result remains applicable because B042 changes only React, CSS, frontend tests, and Superplan metadata; no Rust source, Tauri command, capability, or configuration changed.
- Source inspection: `IdeaSketchEditor` uses mutually exclusive open/close placements, `IdeaSketchNavigator` exposes only a generic header action slot, and the obsolete narrow-overlay Canvas offset is removed. Page/Camera callbacks, drawer width/persistence, resize boundaries, and Canvas commands are unchanged.
- Diff hygiene: `git diff --check` passed before completion metadata was written.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/bugs/B039-refine-ideasketch-drawer-controls.md`
- `docs/superplan/plans/bugs/B040-refine-ideasketch-navigator-density.md`
- `docs/superplan/plans/bugs/B041-remove-duplicate-ideasketch-divider-lines-and-restore-close-icon.md`
- `docs/superplan/plans/features/F053-migrate-unified-ideasketch-drawer-to-tauri.md`
- Human-supplied production screenshot from `2026-08-12`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/IdeaSketchNavigator.tsx`
- `src/index.css`
