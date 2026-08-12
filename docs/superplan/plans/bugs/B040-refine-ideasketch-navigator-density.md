---
id: "B040"
title: "Refine the IdeaSketch Navigator Density"
type: "bugfix"
status: "complete"
summary: "Make the IdeaSketch drawer compact, gap-free while resizing, and aligned with the Excalidraw toolbar."
source: "docs/superplan/human/bugs.md"
created: "2026-08-12"
order: 40
depends_on: ["B039"]
parent: ""
---

# Refine the IdeaSketch Navigator Density Plan

**Goal:** Give the production IdeaSketch navigator more Canvas room and a quieter, product-consistent control hierarchy.
**Scope:** Reduce the drawer's effective default width to 244px and its resize minimum to 220px; migrate the UI-only drawer storage key so existing wider saved values do not mask the reviewed new default; constrain the narrow-editor overlay to the same 244px compact width; prevent the shell/content width divergence that exposes blank Canvas during a fast left resize; remove the decorative violet line from the drawer's left edge; remove the `Current Page` Camera-toolbar text; order the Camera toolbar as `Present` followed by the icon-only Add Camera button; reduce the `Pages` / `Cameras` tab-label size from 12px to 11px; and align the custom navigation trigger's top and bottom edges with Excalidraw's top toolbar Island at standard and high-DPI control sizes.
**Non-Goals:** This fix does not change Page or Camera data, active-Page Camera scoping, list rows, counts, selection, creation behavior, drag sorting, deletion, Page view modes, presentation Preview/Fullscreen choices, drawer open/close/Escape behavior, maximum resize width, keyboard resize semantics, read-only semantics, Canvas commands, `.is` persistence, Workspace/Agent panels, or the global theme. It does not implement B034 shell-parity work inside the editor-owned IdeaSketch surface.
**Architecture:** `IdeaSketchEditor` remains the owner of drawer width and local UI persistence, with a versioned key change applying the new reviewed default without touching document data. Resize lifecycle state disables only the shell's open/close width transition during an active drag so shell and drawer geometry stay synchronous. `CameraList` keeps the same callbacks and maintained Tooltip/Dropdown primitives while simplifying only toolbar content and order. Existing `IdeaSketchNavigator` markup and Tabs semantics remain unchanged; scoped CSS owns the narrower overlay geometry, removal of the obsolete pseudo-element, compact tab typography, and trigger geometry derived from Excalidraw's 16px top inset plus its padded toolbar height.
**Baseline:** B039 leaves the drawer resizable at a 304px default and 260px minimum under the v1 local-storage key. At editor widths up to 700px, CSS overrides the inline drawer width with a `min(330px, available width)` overlay. The drawer also renders a 3px `::before` violet stripe on its left edge. `CameraList` explicitly renders `Current Page`, then Add Camera, then Present. The tab labels use 0.75rem (12px), which is larger than the compact 11px control typography used elsewhere in the current product shell.
**Reproduction:** Open the supplied production `.is` file, open the drawer, and inspect the Pages tab. The drawer consumes more Canvas width than requested and shows a full-height violet line on its left edge. Rapidly drag the divider left after widening the drawer: the animated outer shell lags the immediately updated inner drawer and exposes a blank strip. Switch to Cameras: the toolbar includes `Current Page`, and Add Camera appears before Present. The `Pages` and `Cameras` labels read larger than neighboring compact controls. With the drawer closed, the navigation trigger starts 4px above Excalidraw's toolbar and ends 4px above its bottom edge.
**Root Cause:** The visible line is deliberately created by `.ideanote-ideasketch-drawer::before`, so changing a border token cannot remove it. Drawer density is controlled by both React width constants/local persistence and a separate narrow-overlay CSS cap; changing only one boundary leaves the other or an existing v1 saved value authoritative. During pointer resize, the shell retained its 180ms width transition while the inner drawer width updated immediately, creating transient width divergence. The Camera label and action order are hard-coded in `CameraList`, and the tab size is an explicit 0.75rem declaration rather than inherited product typography. The trigger used a fixed 12px inset and 36px height, while Excalidraw's top toolbar Island uses a 16px inset and a 44px standard padded height (48px at its high-DPI breakpoint).
**Exit Criteria:** A newly opened or previously persisted production `.is` drawer starts at 244px, can resize down to 220px and up to the existing 420px maximum, persists future v2 width/tab choices outside `.is`, and overlays at no more than 244px in the narrow editor fallback. Rapid left pointer resize keeps shell and content widths within 1px without suppressing the normal open/close transition. No violet line appears on the drawer's left edge. The Cameras toolbar contains no `Current Page` text and presents the existing Present dropdown first with the existing Add Camera button immediately to its right; both retain their labels/tooltips, keyboard focus, disabled/read-only behavior, and callbacks. Pages/Cameras labels render at 11px with unchanged counts, tab semantics, active indicator, and Light/Dark theme behavior. The closed/open navigation trigger retains its icon and accessible labels while its top and bottom edges align within 1px of Excalidraw's top toolbar Island. Page/Camera operations, Canvas commands, drawer interactions, focused regressions, full frontend tests, production build, Rust tests, visual inspection where available, and diff checks pass.

## Task 1: Lock the Compact Navigator Contract

**Outcome:** Focused regressions distinguish the reviewed density, stripe removal, Camera action order, and tab typography from the current B039 result.
**Files:**
- Modify: `tests/ideaSketchDrawer.test.mjs`
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/ideaSketchNavigator.test.mjs`
- Modify: `tests/cameraSidebarWiring.test.mjs`
- Modify: `tests/panelDividerWiring.test.mjs`
- Modify: `tests/f012DragRuntime.test.mjs`

**Change Map:**
- drawer sizing contract: require v2 UI persistence, 244px default, 220px minimum, retained 420px maximum, and a 244px narrow-overlay cap
- drawer styling contract: reject the left-edge `::before` stripe while retaining the normal right boundary and resize rail
- Camera toolbar contract: reject `Current Page`, require one Present dropdown before the one Add Camera action, and preserve Tooltip/Dropdown callbacks and zero-Camera availability
- tab typography contract: require 11px labels without changing Tabs markup, counts, active rail, or focus treatment
- resize/trigger geometry contract: require transition-free active pointer resizing, no shell/content gap, and matching top/bottom edges with Excalidraw's toolbar Island

**Verification:**
- `node --test tests/ideaSketchDrawer.test.mjs tests/ideaSketchEditor.test.mjs tests/ideaSketchNavigator.test.mjs tests/cameraSidebarWiring.test.mjs tests/panelDividerWiring.test.mjs`

- [x] Add focused source/behavior regressions that fail against the current width, stripe, action order, and tab size.
- [x] Keep Page/Camera operations and drawer accessibility explicit in the preservation contract.

## Task 2: Tighten the Drawer and Camera Toolbar

**Outcome:** The production drawer uses the reviewed compact geometry and simplified Camera control order without behavioral changes.
**Files:**
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/CameraList.tsx`
- Modify: `src/index.css`
- Modify: focused tests from Task 1

**Change Map:**
- `IdeaSketchEditor`: advance the UI-only storage key to v2, set 244px default and 220px minimum, retain the 420px maximum and existing clamp/resizer/persistence behavior
- `CameraList`: remove only the toolbar context span and render Present before the existing Tooltip-wrapped Add Camera button
- drawer CSS: delete the violet left-edge pseudo-element, cap narrow overlay and trigger placement at 244px, and retain the neutral right border/shadow
- navigator CSS: set the tab-label size to 0.6875rem (11px) while preserving weight, counts, hover, active rail, and focus styles
- trigger/resize CSS: disable shell width animation only while resizing; use Excalidraw's 16px top inset and 44px/48px padded toolbar heights for the navigation trigger; keep the compact overlay trigger inside the drawer edge

**Verification:**
- Run the focused Task 1 suite.
- Interaction cases: initial width after v1 history, rapid pointer and keyboard resize plus v2 persistence; desktop push and narrow overlay; navigation trigger/toolbar top-bottom alignment; Pages/Cameras switching; Present Preview/Fullscreen; Add Camera editable/read-only behavior; Light/Dark; no left stripe.

- [x] Apply the smallest editor-owned source and CSS changes without modifying Page/Camera models or callbacks.
- [x] Verify the compact layout remains legible, every existing control remains reachable at 220px, rapid resize is gap-free, and the navigation trigger follows Excalidraw's toolbar geometry.

## Task 3: Verify and Deliver B040

**Outcome:** The density refinement ships with current regression, build, native, workflow, and Git evidence.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B040-refine-ideasketch-navigator-density.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- B040 request/plan: completion state, checked outcomes, focused/full/build/Rust/visual evidence and any automation limitation
- generated plan index: current B040 status and dependency

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `git diff --check`
- Tauri visual review where available: 244px desktop/narrow drawer, no left stripe, compact tabs, Camera toolbar ordered Present then Add Camera in Light and Dark.

- [x] Run the complete verification matrix once the implementation is stable and inspect meaningful warnings.
- [x] Compare the final diff with every Exit Criterion, complete B040, refresh Superplan progress, and create one separate `fix(B040)` commit.

## Delivery Evidence

- Test-first regression: the focused B040 suite initially failed 5/17 against the B039 implementation, covering the v1/304/260px geometry, violet pseudo-element, `Current Page`, Add-before-Present order, and 12px tabs. After the fix, `node --test tests/ideaSketchDrawer.test.mjs tests/ideaSketchEditor.test.mjs tests/ideaSketchNavigator.test.mjs tests/cameraSidebarWiring.test.mjs tests/panelDividerWiring.test.mjs` passed 17/17.
- Related UI regression: `node --test tests/pageOrganizer.test.mjs tests/tooltipWiring.test.mjs tests/excalidrawMainMenu.test.mjs tests/slideCanvasProps.test.mjs` passed 25/25, preserving Page organization, tooltips, Canvas menu suppression, Camera ownership, and Canvas comparator behavior.
- Rapid-resize regression: focused source/runtime checks passed 10/10 before the trigger-alignment follow-up. The WebKit drag holds `.is-resizing`, computes a `0s` shell transition, and keeps shell/content width delta at or below 1px during the fast left pointer move.
- Trigger-alignment regression: `node --test tests/ideaSketchDrawer.test.mjs tests/f012DragRuntime.test.mjs` passed 8/8. WebKit measures both the top and bottom edge deltas between the navigation trigger and `.App-toolbar.Island` at or below 1px while preserving Workspace dragging and virtualized Page-card sorting.
- Full frontend regression: `node --test tests/*.test.mjs` passed 398/398.
- Production build: `npm run build` passed; only the existing Excalidraw mixed static/dynamic import and large-chunk warnings were reported.
- Native regression: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture` passed 166/166 before the final React/CSS-only resize and trigger geometry changes; that evidence remains applicable because no Rust source or configuration changed. Only existing Rust dead-code warnings were reported.
- Source inspection: the drawer uses the v2 UI-only key with 244px default, 220px minimum, and retained 420px maximum; active resize disables only the shell transition; the narrow overlay is capped at 244px; the left-edge pseudo-element is absent; the Camera toolbar source orders Present before the one Add Camera action and contains no `Current Page`; tab labels use 0.6875rem; and the trigger uses a 16px inset with 44px standard and 48px high-DPI size while counts, active rail, focus styling, and accessible labels remain.
- Visual automation limitation: native macOS attachment remained unavailable. A normal browser tab also cannot enter the production editor without the Tauri invoke bridge. Native screenshot claims were not made; the mocked WebKit production `.is` runtime supplies executable geometry evidence for drawer width, rapid resize, toolbar alignment, and Page sorting.
- Diff hygiene: `git diff --check` passed against the final implementation before completion metadata was written.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/bugs/B039-refine-ideasketch-drawer-controls.md`
- `docs/superplan/plans/features/F053-migrate-unified-ideasketch-drawer-to-tauri.md`
- `docs/superplan/plans/features/F013-compact-workspace-and-navigator-layout.md`
- `docs/superplan/plans/features/F009-tabbed-ideasketch-navigator.md`
- `docs/superplan/plans/features/F005-align-workspace-camera-actions.md`
- `docs/superplan/plans/bugs/B034-restore-reviewed-demo-parity-in-tauri.md`
- Human-supplied production screenshot from `2026-08-12`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/IdeaSketchNavigator.tsx`
- `src/components/CameraList.tsx`
- `src/index.css`
