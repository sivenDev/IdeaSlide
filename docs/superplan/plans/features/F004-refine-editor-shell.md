---
id: "F004"
title: "Refine the Editor Shell and Canvas Controls"
type: "feature"
status: "complete"
summary: "Prototype and deliver a cohesive editor shell with stable Excalidraw controls, expressive resize rails, and modern thumbnail-free sidebars."
source: "docs/superplan/human/features.md"
created: "2026-07-24"
order: 4
depends_on: []
parent: ""
---

# Refine the Editor Shell and Canvas Controls Plan

**Goal:** Make IdeaSlide's three-pane editor feel like one deliberate visual workspace while fixing the unstable Canvas controls and making panel resizing self-evident.
**Scope:** First create a disposable interactive HTML prototype under `.temp/f004-editor-shell-prototype/` that reproduces the current top toolbar, Workspace tree, Canvas surface, Camera list, collapse controls, and bounded left-panel dragging without requiring Tauri. The prototype will establish a quiet instrument-panel visual system: `#F7F8FA` panel surfaces, `#FFFFFF` Canvas/island surfaces, `#E2E5EA` boundaries, `#20242C` primary text, `#747B88` secondary text, and Excalidraw violet `#6965DB` as the only selection/interaction accent; system UI typography remains the reading face while tabular counts use the system monospace face. Its signature interaction is a slim edge rail that becomes violet on hover/drag and integrates a compact collapse notch. Present the running prototype for human visual approval before changing production UI. After approval, rebuild the Canvas top-right actions as a single compact Excalidraw-aligned group using the package's public `Button` component and scoped CSS variables rather than relying on shrinkable Tailwind-only buttons. Desktop controls show single-line `Cameras` with a count and a legible `Present`; constrained/mobile layouts use accessible icon-first variants rather than wrapping. Upgrade the divider to an 8px full-height interactive gutter with a visible hover/drag line, `col-resize` cursor, pointer capture, keyboard adjustment, standard separator semantics, and the existing 180–420px Workspace bounds. Restyle Workspace and Cameras headers, rows, selected states, icon actions, count badges, and empty state with the shared neutral/violet token system while retaining text-only lists and all existing behaviors.
**Non-Goals:** This plan does not add thumbnails, change `.is` persistence, rename Cameras, add Camera thumbnails or naming, persist panel widths, make the right Camera panel resizable, redesign Excalidraw's central drawing toolbar, replace the resource hierarchy model, add a general design-system package, or introduce a resizable-panel dependency solely for one divider. The `.temp` prototype is disposable validation material and is not part of the production bundle or task commit.
**Architecture:** `EditorLayout` remains the owner of panel visibility and Workspace width. `ResizableDivider` remains a small local primitive because the installed Radix `Separator` is visual-only and the repository has no resizable-panel component; it will expose an accessible separator boundary without changing layout ownership. `CanvasPresentationControls` uses Excalidraw's public `Button` API and a narrowly scoped `.idea-slide-canvas-controls` style block that consumes Excalidraw theme variables, avoiding the current collision between a wide custom flex group and Excalidraw's `1fr 2fr 1fr` top grid. `WorkspaceExplorer`, `WorkspaceResourceRow`, and `CameraList` share production CSS tokens/classes instead of independently choosing gray, blue, and amber states. Prototype approval is an explicit gate between visual exploration and Tauri migration.
**Baseline:** The current `CanvasPresentationControls` renders two Tailwind-only buttons whose combined intrinsic width exceeds the reliable space in Excalidraw's top-right grid cell; the flex children can shrink and wrap, and the Radix-triggered disabled Present style is not reliably legible inside Excalidraw. The screenshot shows `Cameras 0` on two lines and Present as an empty white rectangle. Excalidraw 0.18 exports a public `Button` component and supplies island/button theme variables, but not a public `Island` component. The existing divider already captures pointer movement and clamps Workspace width, yet its draggable area is an invisible 12px overlay on a 1px rule and its large centered collapse pill dominates the rail, so the resize gesture is not discoverable. The only installed separator primitive is non-interactive. Workspace and Cameras currently use separate flat gray headers, bright blue and amber active states, and an oversized centered Camera empty state.
**Exit Criteria:** The approved `.temp` prototype can resize the Workspace between 180px and 420px, collapse and restore both sidebars, demonstrate normal/hover/drag/selected/disabled states, and remain coherent at representative 1280px and 1920px desktop widths. Production Canvas controls occupy one compact group, never wrap or lose their labels at supported desktop widths, expose accessible names in icon-first constrained mode, visibly preserve disabled Present, and continue to toggle Cameras and open Preview/Fullscreen. Hovering or dragging the Workspace divider shows `col-resize`, a visible violet rail, and active feedback; dragging stays bounded, collapse/restore preserves the last width, and keyboard/ARIA separator behavior is present. Workspace and Cameras use the same neutral/violet palette, header height, spacing rhythm, action-button treatment, row selection language, and compact empty-state tone without thumbnails. Focused UI contracts, the full Node suite, production build, diff checks, and browser/Tauri smoke checks pass.

## Task 1: Validate the Editor-Shell Direction in an Interactive HTML Prototype

**Outcome:** A browser-runnable prototype demonstrates the complete visual direction and interaction states before production UI is touched.
**Files:**
- Create (ignored): `.temp/f004-editor-shell-prototype/index.html`
- Create (ignored): `.temp/f004-editor-shell-prototype/styles.css`
- Create (ignored): `.temp/f004-editor-shell-prototype/app.js`

**Change Map:**
- `.temp/f004-editor-shell-prototype/index.html`: representative IdeaSlide shell, Workspace resources, Canvas toolbar/island, and Cameras content
- `.temp/f004-editor-shell-prototype/styles.css`: approved neutral/violet tokens, typography roles, sidebar composition, control group, and interactive edge rail
- `.temp/f004-editor-shell-prototype/app.js`: bounded Workspace dragging, collapse/restore, Cameras toggle, selected rows, and disabled/enabled Present demonstration

**Verification:**
- Serve the prototype from its directory and inspect it in a browser at representative 1280×800 and 1920×1080 viewports.
- Interaction cases: hover and drag the Workspace rail; clamp at 180px and 420px; collapse/restore both sides; toggle Cameras; inspect zero-Camera disabled Present and populated-Camera enabled Present; confirm labels never wrap.
- Human visual approval is required before Task 2 starts.

- [x] Build the standalone prototype from the defined token and layout direction.
- [x] Capture browser views and self-critique spacing, hierarchy, control density, and resize discoverability.
- [x] Present the prototype to the human and pause until the design is approved.

Prototype evidence: the standalone shell was reviewed at 1280×800 and 1920×1080. The compact layout reduces the Canvas action group to 111px and leaves 114px between it and the drawing toolbar; the wide layout restores full labels at 235px with a 173px gap. Present remains visibly disabled at zero Cameras, adding a Camera updates both counts and enables the Preview/Fullscreen menu, the divider reports `col-resize`, pointer dragging changed the Workspace from 232px to 312px, keyboard bounds reached exactly 180px/420px, and both panel collapse/restore paths remained operable. Browser console errors: none.

## Task 2: Stabilize Canvas Controls and Make the Resize Rail Discoverable

**Outcome:** Canvas actions follow Excalidraw's visual contract and the Workspace divider clearly communicates both resize and collapse interactions.
**Files:**
- Modify: `src/components/CanvasPresentationControls.tsx`
- Modify: `src/components/ResizableDivider.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/index.css`
- Modify: `tests/canvasPresentationControls.test.mjs`
- Modify: `tests/panelDividerWiring.test.mjs`

**Change Map:**
- `src/components/CanvasPresentationControls.tsx`: public Excalidraw `Button` usage, no-wrap desktop labels, accessible constrained layout, selected Cameras state, and legible disabled Present
- `src/components/ResizableDivider.tsx`: full-height interactive separator, visible hover/drag rail, compact collapse notch, pointer/keyboard resizing, and ARIA values
- `src/components/EditorLayout.tsx`: pass Workspace minimum/maximum/current values and incremental keyboard resize requests into the divider
- `src/index.css`: scoped Excalidraw control-group variables plus editor-shell rail states that cannot be overridden by generic Canvas CSS
- UI contract tests: prevent regression to wrapping controls, invisible disabled actions, or an undiscoverable one-pixel divider

**Verification:**
- `node --test tests/canvasPresentationControls.test.mjs tests/panelDividerWiring.test.mjs tests/panelSizing.test.mjs`
- Interaction cases: Cameras/Present stay in one line; zero Cameras leaves Present visibly disabled; populated Cameras opens both presentation choices; hover and drag display resize feedback; Arrow keys resize within bounds; collapse/restore retains the last expanded width.

- [x] Add focused failing UI contracts for Excalidraw Button usage, nowrap/disabled states, separator semantics, and visible drag affordance.
- [x] Replace the unstable top-right button styling with the approved compact Excalidraw-aligned group.
- [x] Implement the approved edge rail, pointer feedback, keyboard resizing, and compact collapse control.
- [x] Run the focused Canvas-control and divider suite.

## Task 3: Apply One Visual System to Workspace and Cameras

**Outcome:** Both sidebars read as parts of the same modern editor shell while preserving the extensible resource and Camera behaviors delivered by F002/F003.
**Files:**
- Modify: `src/components/WorkspaceExplorer.tsx`
- Modify: `src/components/WorkspaceResourceRow.tsx`
- Modify: `src/components/CameraList.tsx`
- Modify: `src/index.css`
- Modify: `tests/workspaceExplorerWiring.test.mjs`
- Modify: `tests/cameraSidebarWiring.test.mjs`

**Change Map:**
- `src/components/WorkspaceExplorer.tsx`: shared compact header/action treatment, panel surface, and scrolling rhythm
- `src/components/WorkspaceResourceRow.tsx`: unified violet selection edge, neutral folder/canvas icons, restrained hover/actions, and preserved rename/drag behavior
- `src/components/CameraList.tsx`: sentence-case header, compact count/action, unified selection styling, and smaller directional empty state
- `src/index.css`: reusable editor-shell surface, text, boundary, focus, and accent tokens scoped outside Excalidraw

**Verification:**
- `node --test tests/workspaceExplorerWiring.test.mjs tests/cameraSidebarWiring.test.mjs tests/resourceEditorHost.test.mjs`
- Interaction cases: create menus and inline rename remain usable; selected Workspace and Camera rows use the same accent language; long lists scroll internally; empty Cameras state is compact; no thumbnails or amber active state return.

- [x] Add or update focused sidebar visual/behavior contracts.
- [x] Migrate Workspace header, rows, and resource actions to the approved system.
- [x] Migrate Cameras header, rows, count, actions, and empty state to the approved system.
- [x] Run the focused sidebar suite.

## Task 4: Verify and Deliver the Refined Editor Shell

**Outcome:** The approved design works in the production shell without breaking Canvas interaction, panel sizing, or existing Workspace/Camera behavior.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/features/F004-refine-editor-shell.md`

**Change Map:**
- F004 plan and feature entry: final behavior and verification evidence
- generated plans index: refreshed completion status

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Browser smoke against the `.temp` prototype plus Tauri editor smoke for Cameras/Present, divider hover/drag/collapse, Workspace actions, Camera actions, Canvas pointer alignment, and representative window widths.

- [x] Run the complete Node regression suite and production build once after implementation stabilizes.
- [x] Compare the Tauri shell with the approved prototype and complete the interaction smoke matrix.
- [x] Review the final diff, mark F004 complete, refresh the plan index, and create a separate task-level F004 commit without staging `AGENTS.md` or `.temp` artifacts.

## Delivery Evidence

- Prototype smoke at 1280×800 and 1920×1080: the compact Canvas action group measured 111px with a 114px toolbar gap, while the wide variant measured 235px with a 173px gap. Present stayed visibly disabled with zero Cameras and enabled after adding one.
- Divider interaction smoke: the rail reported `col-resize`; pointer dragging changed Workspace width from 232px to 312px; Home/End keyboard resizing reached exactly 180px and 420px; Workspace and Cameras collapse/restore paths remained operable. Browser console errors: none.
- Focused editor-shell UI contracts: 15 tests passed across Canvas controls, divider wiring/sizing, Workspace styling, Camera styling, and the Camera empty state.
- `node --test tests/*.test.mjs` — 122 tests passed.
- `npm run build` — TypeScript and Vite production build passed; existing Excalidraw dynamic-import and large-chunk warnings remain informational.
- `git diff --check` — passed against the completed implementation.
- Tauri smoke limitation: the debug process was running, but macOS Computer Use resolved only the separately installed `/Applications/IdeaSlide.app`, whose older pre-F002 UI confirmed it was not the active debug shell. The existing user app/debug processes were left untouched. Production-shell behavior is therefore supported by the approved browser prototype, focused contracts, full regression suite, and production build rather than a trustworthy native-window visual capture.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F002-workspace-resource-explorer.md`
- `docs/superplan/plans/features/F003-canvas-presentation-controls.md`
- `src/components/CanvasPresentationControls.tsx`
- `src/components/ResizableDivider.tsx`
- `src/components/EditorLayout.tsx`
- `src/components/WorkspaceExplorer.tsx`
- `src/components/WorkspaceResourceRow.tsx`
- `src/components/CameraList.tsx`
- `src/index.css`
- `public/excalidraw.css`
- `node_modules/@excalidraw/excalidraw/dist/types/excalidraw/components/Button.d.ts`
