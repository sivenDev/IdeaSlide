---
id: "F006"
title: "Apply Revision C Editor Shell Defaults"
type: "feature"
status: "complete"
summary: "Apply the approved collapsed-by-default shell, centered document title, Camera tooltip, and always-available Present action."
source: "docs/superplan/human/features.md"
created: "2026-07-24"
order: 6
depends_on: ["F005"]
parent: ""
---

# Apply Revision C Editor Shell Defaults Plan

**Goal:** Make the production Tauri editor match the approved Revision C prototype while keeping presentation contextual to the selected Canvas.
**Scope:** Hide the Workspace and Cameras sidebars by default while leaving both divider expand controls available. Recompose the window toolbar as Home → New → Open → Save → save status on the left, with the current `.is` filename centered independently of command width. Add a visible shared-tooltip hover/focus hint to the Canvas Cameras toggle whose text follows `Show cameras` / `Hide cameras`. Keep the Cameras-header Present dropdown enabled when the current Canvas has zero Cameras; Preview and Fullscreen then show that Canvas using its saved viewport without Camera navigation, while non-empty Camera sequences continue unchanged.
**Non-Goals:** This plan does not persist panel visibility, change Workspace width bounds, add thumbnails, add resource types, rename Cameras, alter Camera creation or ordering, change `.is` persistence, redesign PresentationMode settings, or move Present out of the Cameras header.
**Architecture:** `EditorLayout` remains the session-local owner of panel visibility and initializes both visibility states to false. `Toolbar` keeps the native drag-region behavior but separates a compact left command cluster from an absolutely centered document-title layer; `SaveIndicator` remains the source of saving/dirty/saved status. `CanvasPresentationControls` wraps its existing Excalidraw button with the shared Tooltip primitives and derives accessible and visible tooltip text from the open state. `CameraList` always exposes the existing Present dropdown. `PresentationMode` retains current-Canvas input and its existing saved-viewport fallback for zero Cameras, but hides the nonsensical Camera page indicator in that state.
**Baseline:** Production currently initializes both sidebars open, places the filename and save status immediately after Home while New/Open/Save sit on the far right, exposes only an ARIA label on the Canvas Cameras button, disables Present when `cameras.length === 0`, and renders `1 / 0` if the zero-Camera presentation path is entered. The approved `.temp/f004-editor-shell-prototype/` Revision C demonstrates the requested default layout, centered title, dynamic Cameras tooltip, and enabled zero-Camera Present menu.
**Exit Criteria:** A newly mounted editor shows neither sidebar content, preserves clickable expand notches, and gives the Canvas the released width. The toolbar visibly follows the approved left action order, keeps the filename centered regardless of platform padding or save-status width, retains window dragging, and shows all save states. Hovering or focusing Cameras exposes `Show cameras` while closed and `Hide cameras` while open. Present is enabled at Camera count zero; Preview and Fullscreen open the current Canvas without Camera navigation or a `1 / 0` indicator, while Camera-backed presentation order and isolation remain unchanged. Focused UI contracts, the full Node suite, production build, diff checks, and a production-shell smoke check pass.

## Task 1: Lock Revision C Behavior with Focused Contracts

**Outcome:** Source-level UI contracts fail on each production mismatch before implementation and protect the approved behavior afterward.
**Files:**
- Modify: `tests/panelDividerWiring.test.mjs`
- Modify: `tests/editorChromeNavigation.test.mjs`
- Modify: `tests/tooltipWiring.test.mjs`
- Modify: `tests/cameraSidebarWiring.test.mjs`
- Modify: `tests/canvasPresentationControls.test.mjs`

**Change Map:**
- panel contract: both `EditorLayout` visibility states initialize closed while divider toggles remain wired
- toolbar contract: left action order, independent centered title, save status, and drag region
- tooltip contract: Canvas Cameras uses shared visible tooltip wiring with dynamic text
- Camera/presentation contract: Present has no zero-count disabled gate and zero-Camera PresentationMode omits Camera-only navigation status

**Verification:**
- `node --test tests/panelDividerWiring.test.mjs tests/editorChromeNavigation.test.mjs tests/tooltipWiring.test.mjs tests/cameraSidebarWiring.test.mjs tests/canvasPresentationControls.test.mjs`

- [x] Add the focused Revision C contracts and confirm they fail for the expected current behavior.
- [x] Keep each assertion tied to observable ownership or interaction rather than incidental formatting.

## Task 2: Apply the Approved Shell and Presentation States

**Outcome:** Production components reproduce the approved Revision C defaults and interactions without changing persistence or Camera sequencing.
**Files:**
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/SaveIndicator.tsx`
- Modify: `src/components/CanvasPresentationControls.tsx`
- Modify: `src/components/CameraList.tsx`
- Modify: `src/components/PresentationMode.tsx`
- Modify: `src/index.css`

**Change Map:**
- `EditorLayout`: initialize Workspace and Cameras hidden and retain existing expand/resize ownership
- `Toolbar` and `SaveIndicator`: implement the left command cluster, independent centered filename, responsive compact status, and native drag surface
- `CanvasPresentationControls`: add shared dynamic tooltip content around the existing toggle
- `CameraList`: remove the Camera-count disabled gate from Present
- `PresentationMode`: keep the current Canvas viewport fallback and suppress Camera-only status when no Cameras exist
- `src/index.css`: add scoped title-bar composition and responsive status styles without disturbing Excalidraw

**Verification:**
- Run the focused Task 1 suite.
- Interaction cases: initial panel widths are zero; each notch restores its panel; Cameras hover/focus text changes with state; zero-Camera Present opens both menu choices; Camera-backed presentation still begins at Camera 1.

- [x] Implement the minimum component and style changes from the approved prototype.
- [x] Run the focused suite and review the production diff against Revision C.

## Task 3: Verify and Deliver Revision C

**Outcome:** The new editor defaults ship as an isolated F006 change with current regression and build evidence.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/features/F006-revision-c-editor-shell-defaults.md`

**Change Map:**
- F006 feature and plan: completion status and final verification evidence
- generated plan index: refreshed F006 state

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Tauri/editor smoke for default panel state, both expand controls, toolbar alignment, Cameras tooltip, and zero-/nonzero-Camera Present behavior

- [x] Run the complete Node regression suite and production build once after implementation stabilizes.
- [x] Complete the editor smoke matrix and record any environment limitation.
- [x] Mark F006 complete, refresh the plan index, and create a separate `feat(F006)` commit without staging `AGENTS.md` or `.temp`.

## Delivery Evidence

- TDD red: the first focused Revision C run failed in five expected places because both panels still initialized open, the toolbar retained the old filename/action placement, Cameras lacked shared visible Tooltip wiring, Present was disabled at zero Cameras, and PresentationMode always rendered the Camera position indicator. The later terminology regression failed in the two expected toolbar assertions while `New workspace` / `Open workspace` remained.
- Focused green: 26/26 Revision C panel, toolbar, Cameras, Present, and shared-tooltip contracts passed. The follow-up toolbar terminology and tooltip suite passed 16/16 after changing both visible Tooltip copy and accessible names to `New file` / `Open file`.
- `node --test tests/*.test.mjs` — 125 tests passed after the final terminology change.
- `npm run build` — TypeScript and Vite production build passed; the existing Excalidraw dynamic-import and large-chunk warnings remain informational.
- `git diff --check` — passed against the stabilized implementation.
- Tauri smoke: `npm run tauri dev` built and launched the current `target/debug/idea-slide`. The human-provided native-window screenshot confirmed the Revision C left command cluster, Saved indicator, and collapsed-by-default Workspace layout in the real client, and exposed the `New workspace` wording that was then corrected through Vite HMR. Automated macOS app targeting could not bind to the Cargo debug binary without selecting the separately installed app sharing the bundle id, so it was not used; a normal browser cannot render the Tauri page because native window metadata is intentionally absent. The temporary debug process and browser check tab were closed after verification.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F003-canvas-presentation-controls.md`
- `docs/superplan/plans/features/F004-refine-editor-shell.md`
- `docs/superplan/plans/features/F005-align-workspace-camera-actions.md`
- `.temp/f004-editor-shell-prototype/`
- `src/components/EditorLayout.tsx`
- `src/components/Toolbar.tsx`
- `src/components/SaveIndicator.tsx`
- `src/components/CanvasPresentationControls.tsx`
- `src/components/CameraList.tsx`
- `src/components/PresentationMode.tsx`
- `src/index.css`
