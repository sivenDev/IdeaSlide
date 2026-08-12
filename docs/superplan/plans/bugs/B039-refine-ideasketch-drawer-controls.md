---
id: "B039"
title: "Refine the IdeaSketch Drawer Controls"
type: "bugfix"
status: "complete"
summary: "Remove redundant Excalidraw and drawer controls and align the single navigation trigger with Excalidraw's toolbar style."
source: "docs/superplan/human/bugs.md"
created: "2026-08-12"
order: 39
depends_on: ["F053"]
parent: ""
---

# Refine the IdeaSketch Drawer Controls Plan

**Goal:** Make the production IdeaSketch drawer controls feel native to Excalidraw while removing the redundant items identified in the reviewed screenshots.
**Scope:** Hide the remaining Excalidraw fallback Main Menu trigger from the editable IdeaSketch Canvas; keep one IdeaNote-owned drawer trigger in the Canvas top-left; use the same navigation-panel icon whether the drawer is open or closed; restyle that trigger with Excalidraw's compact square surface, neutral border, restrained elevation, violet hover/open state, and visible focus treatment; remove the `Canvas & export` heading and Help action from the drawer footer; retain Export image, Export draw.io, Canvas background, and Clear canvas in the separate footer below the unchanged Pages/Cameras navigator.
**Non-Goals:** This fix does not change Pages/Cameras content, tabs, counts, empty states, Page view modes, drag sorting, Present, Add Camera, drawer open/close/resize/overlay behavior, local width/tab persistence, Canvas selection conversion, export implementation, background or clear behavior, `.is` persistence, read-only rules, or the broader application chrome.
**Architecture:** `IdeaSketchEditor` remains the drawer state owner and renders one stable `PanelLeft` navigation glyph for both states while preserving dynamic accessible labels. `SlideCanvas` no longer exposes a Help command and explicitly suppresses Excalidraw's unavoidable fallback `.main-menu-trigger` through the existing scoped Excalidraw CSS boundary. `IdeaSketchDrawerCommands` becomes a label-free four-action footer; its remaining live actions continue through the current command bridge and Tauri/export paths.
**Baseline:** F053 removed the host-rendered `MainMenu` component but Excalidraw automatically installs `DefaultMainMenu` when no host menu is supplied, so `.main-menu-trigger` can still render. F053 also introduced a custom trigger with `Menu`/`PanelLeftClose`, a colored edge stripe and heavier shadow, plus a footer heading and Help action. The supplied screenshots show those controls as redundant or visually inconsistent.
**Reproduction:** Open a production `.is` file and open the left drawer. The Canvas top-left can retain Excalidraw's fallback menu entry while the IdeaNote trigger uses different open/closed glyphs and a bespoke violet treatment. The drawer footer includes the uppercase `CANVAS & EXPORT` heading and a Help row that the user marked for removal.
**Root Cause:** Excalidraw's `DefaultMainMenu` is rendered internally as a fallback even after the custom `MainMenu` child is removed; `UIOptions.canvasActions` controls individual actions but does not disable its trigger. Separately, F053 styled the new trigger as a branded drawer affordance rather than reusing Excalidraw's compact tool-button visual grammar, and treated the footer heading and Help bridge as required commands although they were not accepted in the screenshot review.
**Exit Criteria:** An editable `.is` Canvas shows no Excalidraw hamburger/Main Menu trigger and exactly one top-left IdeaNote navigation control. That control uses the same `PanelLeft`-style navigation icon for open and closed states, retains `Open IdeaSketch menu` / `Close IdeaSketch menu` labels, and visually matches Excalidraw's compact toolbar controls in Light and Dark themes. The drawer footer has no section heading and no Help action, while Export image, Export draw.io, Canvas background, and Clear canvas remain functional and read-only safe. The navigator remains unchanged, drawer behavior and layout refresh remain intact, focused regressions, full frontend tests, production build, Rust tests, visual inspection where available, and diff checks pass.

## Task 1: Lock the Reviewed Control Contract

**Outcome:** Focused regressions identify the fallback menu, redundant footer content, and mismatched trigger before implementation changes.
**Files:**
- Modify: `tests/ideaSketchDrawer.test.mjs`
- Modify: `tests/excalidrawMainMenu.test.mjs`
- Modify: `tests/slideCanvasProps.test.mjs`

**Change Map:**
- Excalidraw menu contract: require the scoped fallback `.main-menu-trigger` to be absent from the visible IdeaSketch Canvas
- drawer trigger contract: require one stable navigation icon and dynamic open/close labels without `Menu` or `PanelLeftClose`
- footer contract: reject the heading and Help action/bridge while retaining the four reviewed commands and confirmation/read-only behavior

**Verification:**
- `node --test tests/ideaSketchDrawer.test.mjs tests/excalidrawMainMenu.test.mjs tests/slideCanvasProps.test.mjs`

- [x] Add focused source/behavior contracts that fail against the current F053 controls.
- [x] Confirm the failures preserve the unchanged navigator and remaining command boundaries.

## Task 2: Remove Redundancy and Match Excalidraw Controls

**Outcome:** The Canvas and drawer expose one visually coherent navigation entry and only the requested footer actions.
**Files:**
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/IdeaSketchDrawerCommands.tsx`
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `src/index.css`
- Modify: `tests/ideaSketchDrawer.test.mjs`
- Modify: `tests/excalidrawMainMenu.test.mjs`
- Modify: `tests/slideCanvasProps.test.mjs`

**Change Map:**
- `IdeaSketchEditor`: replace the state-dependent `Menu`/`PanelLeftClose` pair with one `PanelLeft` glyph while preserving state, labels, position, Escape, and layout refresh
- `IdeaSketchDrawerCommands`: remove the heading and Help button; keep the two-column four-action surface and existing disabled semantics
- `SlideCanvas`: remove `openHelp` from `SlideCanvasCommandApi` and its app-state bridge; retain image export, draw.io, background, clear, selection UI, and Excalidraw dialogs still required by retained actions
- styles: suppress only `.ideanote-ideasketch-canvas .excalidraw .main-menu-trigger`; simplify the custom trigger to Excalidraw-like dimensions, radius, surface, border, shadow, hover/open, focus, Dark theme, and narrow-overlay placement; remove obsolete heading styles

**Verification:**
- Run the focused Task 1 suite.
- Interaction cases: open/close by pointer and keyboard; same glyph in both states; no fallback hamburger; desktop push and narrow overlay; Light/Dark; remaining commands; clear confirmation; editable/read-only behavior.

- [x] Apply the smallest source-level fix without changing navigator or drawer behavior.
- [x] Remove obsolete Help API/CSS/test surface and retain every reviewed command path.

## Task 3: Verify and Deliver B039

**Outcome:** The reviewed control cleanup ships with regression, build, native, progress, and Git evidence.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B039-refine-ideasketch-drawer-controls.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- B039 request/plan: completion state, checked outcomes, focused/full/build/Rust/visual evidence and any automation limitation
- generated plan index: current B039 status and dependency

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `git diff --check`
- Tauri or WebKit visual review: exactly one Excalidraw-style navigation trigger; no fallback menu, heading, or Help; remaining footer actions and drawer interactions intact.

- [x] Run the complete verification matrix once implementation is stable and inspect meaningful warnings.
- [x] Compare the final diff with every Exit Criterion, complete B039, refresh Superplan progress, and create one separate `fix(B039)` commit.

## Delivery Evidence

- Focused regression: the reviewed control contracts first failed against F053, then `node --test tests/ideaSketchDrawer.test.mjs tests/excalidrawMainMenu.test.mjs tests/slideCanvasProps.test.mjs tests/excalidrawViewportObservers.test.mjs` passed 26/26 after the fix.
- Drawer-layout regression: `node --test tests/f012DragRuntime.test.mjs` passed 2/2, covering the Page-card and Workspace drag runtime after the footer height adjustment.
- Full frontend regression: `node --test tests/*.test.mjs` passed 397/397.
- Production build: `npm run build` passed; only the existing Excalidraw mixed static/dynamic import and large-chunk warnings were reported.
- Native regression: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture` passed 166/166; only existing Rust dead-code warnings were reported.
- Source and behavior inspection: the editable IdeaSketch Canvas now suppresses the Excalidraw fallback `.main-menu-trigger` within the editor scope, exposes one stable `PanelLeft` trigger with dynamic open/close labels, removes the footer heading and Help bridge, and leaves the Pages/Cameras navigator source unchanged.
- Visual automation limitation: the current Tauri process was running, but macOS Computer Use could not attach by bundle identifier, display name, or executable path. A browser fallback rendered the application shell but could not load a real `.is` document because Tauri `invoke` is unavailable there, so no reliable automated Light/Dark editor screenshot was available. Visual claims are therefore limited to the reviewed CSS contract and passing source/build regressions.
- Diff hygiene: `git diff --check` passed before completion metadata was written.

## References
- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/features/F053-migrate-unified-ideasketch-drawer-to-tauri.md`
- `docs/superplan/plans/features/F014-simplify-file-and-navigator-controls.md`
- `docs/superplan/plans/bugs/B005-integrate-navigator-into-excalidraw-toolbar.md`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/IdeaSketchDrawerCommands.tsx`
- `src/components/SlideCanvas.tsx`
- `src/index.css`
- `public/excalidraw.css`
