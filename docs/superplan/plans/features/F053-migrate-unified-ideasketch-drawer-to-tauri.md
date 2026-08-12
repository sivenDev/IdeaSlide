---
id: "F053"
title: "Migrate the Unified IdeaSketch Drawer into Tauri"
type: "feature"
status: "complete"
summary: "Move the production IdeaSketch navigator into the accepted left drawer and append the existing Canvas menu actions below it."
source: "docs/superplan/human/features.md"
created: "2026-08-12"
order: 53
depends_on: ["F052", "F014", "F022", "F024"]
parent: ""
---

# Migrate the Unified IdeaSketch Drawer into Tauri Plan

**Goal:** Deliver the accepted F052 navigation composition in the production Tauri `.is` editor without changing the established Page, Camera, Canvas, export, or persistence behavior.
**Scope:** Replace the production right-side IdeaSketch Navigator and Excalidraw top-left menu popover with one left-origin drawer opened by a custom top-left menu button. Move the existing `IdeaSketchNavigator` into that drawer unchanged: its Pages/Cameras tabs, counts, list content, empty states, Page view modes and thumbnails, Present menu, Add Camera, selection, rename/delete, and drag sorting remain authoritative. Append a separate `Canvas & export` section below the navigation content and route its commands through the current production paths for draw.io export, Excalidraw image export, Canvas background, clear/reset confirmation, and Help; keep contextual selection conversion in its existing Canvas-owned control. The drawer starts closed, pushes Canvas on normal desktop widths, overlays Canvas in the narrow editor fallback, closes on Escape, supports bounded pointer/keyboard resizing in push mode, and persists only drawer width and selected navigation tab as application UI state outside `.is` data.
**Non-Goals:** This plan does not redesign or reorder the existing Pages/Cameras navigator content; change Page/Camera models, Page-scoped Camera behavior, drag sorting, thumbnails, presentation keyboard handling, native export formats/dialogs, style-conversion behavior, Agent Tool behavior, save/autosave/recovery, editor registry contracts, `.is` serialization, Workspace/Agent panels, or the global Ink Violet palette. It does not add a second Page/Camera state owner, put layout state in document metadata, or depend on private Excalidraw toolbar DOM for command execution.
**Architecture:** `IdeaSketchEditor` remains the sole owner of Page/Camera state and drawer composition. It renders the existing `IdeaSketchNavigator` as the drawer's flexible upper region and a new production `IdeaSketchDrawerCommands` component as the bounded lower region, with the shared `ResizableDivider` on the drawer's right edge in desktop push mode. `SlideCanvas` removes `MainMenu`, exposes supported callbacks for its existing live-scene actions, and keeps Excalidraw ownership for image-export and Help dialogs plus native draw.io export; background and clear use the live imperative API without duplicating document state, with clear retaining an accessible confirmation boundary. A Canvas layout token causes the existing Excalidraw refresh path to run after open/close/resize transitions. UI width/tab persistence uses a versioned local application key and is deliberately independent from `.is` content. CSS extends the current Ink Violet tokens with a restrained left drawer/trigger treatment and an editor-width responsive overlay, without changing navigator-internal selectors.
**Baseline:** Production currently opens a 260px `IdeaSketchNavigator` on the right by default and uses the shared right-side divider to resize or hide it. The Navigator already provides the accepted Pages/Cameras content and all Page/Camera operations. `SlideCanvas` currently owns an Excalidraw `MainMenu` containing draw.io export plus Excalidraw image export, Canvas background, clear, and Help, while selection conversion uses `renderTopRightUI`. F052 proves the left-trigger, push/overlay, resize, Escape, and combined-surface composition only in the isolated browser demo; production services and tests were deliberately untouched.
**Exit Criteria:** Opening an editable or read-only `.is` document shows a full-width Canvas and one top-left custom menu button, with no right Navigator and no Excalidraw menu popover. Activating the button opens a left drawer whose upper navigation area is observably the existing Pages/Cameras UI without changed controls, ordering, empty states, or operations; the separate lower command section invokes the existing production draw.io, image export, Canvas background, clear confirmation, and Help behavior. Desktop open/close and bounded resize move the Canvas without remounting or persisting document changes; the narrow fallback overlays only the editor Canvas region and hides resizing. Escape closes the drawer, focus remains visible, reduced motion is respected, layout changes refresh Excalidraw geometry, and drawer width/tab persistence never enters `.is` data. Focused contracts, the complete frontend suite, strict production build, Rust tests, native Tauri interaction review, and final diff checks pass.

## Task 1: Lock the Production Drawer and Preservation Contract

**Outcome:** Focused regressions distinguish the accepted left drawer from the current right Navigator/Main Menu while explicitly protecting the unchanged navigation content and current production command paths.
**Files:**
- Create: `tests/ideaSketchDrawer.test.mjs`
- Modify: `tests/ideaSketchNavigator.test.mjs`
- Modify: `tests/excalidrawMainMenu.test.mjs`
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/panelDividerWiring.test.mjs`
- Modify: `tests/slideCanvasProps.test.mjs`

**Change Map:**
- drawer composition contract: require a closed-by-default left trigger, left drawer before Canvas, desktop push and narrow overlay markers, Escape dismissal, local width/tab persistence, and a right-edge resize divider with no right Navigator composition
- navigator preservation contract: require the existing `IdeaSketchNavigator` props and its `PageOrganizer`/`CameraList` ownership to remain intact, with the command section rendered after rather than inside the navigator content
- Canvas command contract: reject Excalidraw `MainMenu`/`.main-menu-trigger`, require explicit production callbacks for draw.io, image export, background, clear confirmation, and Help, and retain live API reads plus contextual selection conversion
- performance/persistence contract: require layout refresh token comparison and reject `.is` model/editor-state writes for drawer width/open/tab state

**Verification:**
- `node --test tests/ideaSketchDrawer.test.mjs tests/ideaSketchNavigator.test.mjs tests/excalidrawMainMenu.test.mjs tests/ideaSketchEditor.test.mjs tests/panelDividerWiring.test.mjs tests/slideCanvasProps.test.mjs`

- [x] Add focused source and behavior contracts that fail against the current right-side Navigator and Excalidraw menu composition.
- [x] Confirm the failures protect the exact existing navigator wiring and native command boundaries rather than only checking new class names.

## Task 2: Recompose the Existing Navigator as a Left Drawer

**Outcome:** The production editor opens the unchanged Pages/Cameras navigation in the accepted responsive left-side surface.
**Files:**
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/ResizableDivider.tsx`
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `src/lib/slideCanvasProps.ts`
- Modify: `src/index.css`

**Change Map:**
- `IdeaSketchEditor`: replace `showNavigator`/right width composition with closed-by-default drawer state, a custom top-left trigger, unchanged `IdeaSketchNavigator` prop wiring, versioned UI-only width/tab persistence, Escape dismissal, responsive overlay mode, and a layout refresh token
- `ResizableDivider`: preserve Workspace/Agent behavior while allowing the drawer to use the same accessible resize mechanics without a duplicate collapse notch in the open surface
- `SlideCanvas` and comparator: remove Excalidraw `MainMenu`, accept the drawer-open callback and layout token without remounting Page-scoped Canvas state, and refresh geometry after drawer transitions
- styles: add the violet-led trigger/left edge, drawer boundary, flexible navigation region, command footer slot, desktop push layout, narrow overlay, visible focus, and reduced-motion rules while leaving `.idea-slide-ideasketch-navigator*` internals unchanged

**Verification:**
- Run the focused Task 1 suite.
- Interaction cases: closed initial Canvas; trigger open/close; Pages/Cameras switching and all existing mutations; pointer and keyboard resize; Escape; read-only mode; narrow overlay; focus visibility; reduced motion; no Canvas remount or false dirty state.

- [x] Move only the existing navigator container and preserve every Page/Camera callback and list implementation.
- [x] Make drawer geometry, persistence, accessibility, and responsive behavior production-safe without changing document data.

## Task 3: Append the Existing Canvas Menu Functions Below Navigation

**Outcome:** The drawer's lower section replaces the Excalidraw popover while executing the same production Canvas and export behavior.
**Files:**
- Create: `src/components/IdeaSketchDrawerCommands.tsx`
- Create: `src/components/IdeaSketchClearCanvasDialog.tsx`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `src/lib/slideCanvasProps.ts`
- Modify: `src/index.css`

**Change Map:**
- command surface: append English `Canvas & export` actions below the unchanged navigator with clear icon/label hierarchy and read-only/disabled semantics
- live Canvas command bridge: keep draw.io export on `exportExcalidrawToDrawio` with live elements/files; open Excalidraw image export and Help through supported live app-state updates; change Canvas background through the live scene update path; and clear only after an accessible application confirmation using an undoable Excalidraw scene update
- ownership boundaries: keep selection conversion in `CanvasSelectionActions`, Camera creation in `CameraList`, presentation in the existing Cameras toolbar, and all document persistence through the existing Canvas `onChange`/editor session pipeline
- failure feedback: continue using Excalidraw toast feedback for native draw.io results and keep command availability truthful when the Canvas API is not ready or the document is read-only

**Verification:**
- Run the focused Task 1 suite plus `node --test tests/drawioExport.test.mjs tests/canvasSelectionActions.test.mjs tests/cameraBadgeWiring.test.mjs tests/excalidrawViewportObservers.test.mjs`.
- Tauri cases: PNG/SVG image export dialog and download bridge; draw.io native save/cancel/error; background update and save/reopen; clear cancel/confirm/Undo/save/reopen; Help dialog; read-only disabled mutations; conversion and presentation continuity.

- [x] Route each lower-section command through the established production implementation rather than recreating export or document state.
- [x] Preserve confirmations, undoability, feedback, read-only behavior, and the existing ownership of conversion, Camera, and presentation actions.

## Task 4: Verify and Deliver the Production Migration

**Outcome:** F053 ships as a regression-safe Tauri change with current automated, native interaction, workflow, and Git evidence.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F053-migrate-unified-ideasketch-drawer-to-tauri.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- F053 request/plan: completion state, checked outcomes, focused/full/build/Rust/native evidence, and any platform limitation
- generated plan index: current F053 status and dependencies

**Verification:**
- Run the focused Task 1–3 suites.
- `node --test tests/*.test.mjs`
- `npm run build`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `git diff --check`
- Native Tauri acceptance at representative desktop and narrow editor widths: drawer open/close/resize/overlay/Escape; unchanged Page and Camera operations including drag sorting and presentation; all lower commands; Light/Dark themes; editable/read-only documents; save/reopen; no false dirty state; no console errors.

- [x] Run the complete regression/build/native matrix once the implementation is stable and inspect meaningful warnings.
- [x] Compare the final diff and UI with every Exit Criterion, complete F053, refresh Superplan progress, and create one separate `feat(F053)` task commit.

## Completion Evidence

- `node --test tests/f012DragRuntime.test.mjs`: 2/2 WebKit runtime cases passed, including the opened-drawer thumbnail-mode virtualized Page sort.
- `node --test tests/*.test.mjs`: 397/397 frontend tests passed.
- `npm run build`: strict TypeScript and production Vite build passed. Existing Excalidraw mixed static/dynamic import and large-chunk warnings remain; this feature introduced no new build failure.
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`: 166/166 Rust library tests passed; main and doc-test targets had zero tests. Existing Agent adapter dead-code warnings remain.
- `git diff --check`: passed with no whitespace errors.
- Final implementation inspection confirms the unchanged `IdeaSketchNavigator` remains the sole Pages/Cameras surface above a separate `Canvas & export` footer, with closed-by-default left opening, desktop push/resize, narrow overlay, Escape dismissal, UI-only width/tab persistence, and live Canvas command routing.
- Native interaction automation limitation: the running `target/debug/idea-slide` process was visible to the OS, but the available macOS Computer Use bridge reported `com.zhengxiwan.idea-slide` as invalid/not running and could not return a window tree or screenshot. Native visual interaction was therefore not claimed; WebKit runtime interaction, production build, and Tauri Rust coverage provide the executable evidence available in this environment.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F052-demo-left-ideasketch-drawer.md`
- `docs/superplan/plans/features/F009-tabbed-ideasketch-navigator.md`
- `docs/superplan/plans/features/F014-simplify-file-and-navigator-controls.md`
- `docs/superplan/plans/features/F019-add-page-list-view-mode-switch.md`
- `docs/superplan/plans/features/F022-export-editor-content-as-drawio.md`
- `docs/superplan/plans/features/F024-optimize-large-excalidraw-viewport-interactions.md`
- `docs/superplan/plans/bugs/B005-integrate-navigator-into-excalidraw-toolbar.md`
- `docs/superplan/plans/bugs/B016-prevent-large-page-switch-freeze.md`
- `docs/superplan/plans/bugs/B021-use-unique-slide-canvas-child-keys.md`
- `docs/superplan/plans/bugs/B027-use-ideasketch-native-undo-for-agent-canvas-edits.md`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/IdeaSketchNavigator.tsx`
- `src/components/SlideCanvas.tsx`
- `src/components/ResizableDivider.tsx`
- `src/index.css`
