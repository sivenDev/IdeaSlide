---
id: "F014"
title: "Simplify File and Navigator Controls"
type: "feature"
status: "complete"
summary: "Remove redundant New File and Canvas Navigator controls, repair the Open menu layout, and make the right divider the single tooltip-labeled navigator toggle."
source: "docs/superplan/human/features.md"
created: "2026-08-04"
order: 14
depends_on: ["F010", "F013"]
parent: ""
---

# Simplify File and Navigator Controls Plan

**Goal:** Reduce duplicated editor controls while making the remaining Open and Navigator actions visually stable and self-explanatory.
**Scope:** Remove the New File button from the top editor toolbar and its now-unused toolbar prop/handler, while retaining creation from the Launch Screen and Workspace root. Keep one Open dropdown with `Open Workspace…` and `Open File…` on single aligned rows; widen the menu and suppress the trigger tooltip while the menu is open so it never overlaps the content. Remove the custom `Navigator` item and separator from Excalidraw's Main Menu, along with the redundant `SlideCanvas` navigator-state props and memo-comparison fields. Keep the right-side divider toggle as the only direct IdeaSketch navigator open/close control and replace its native `title` hint with the shared Radix Tooltip using the existing `Hide navigator` / `Show navigator` labels. Preserve the current neutral/violet shell, icon system, keyboard focus treatment, and compact dimensions.
**Non-Goals:** This feature does not remove New File from the Launch Screen or Workspace root, remove Open Workspace/Open File, change file dialogs or unsaved-change coordination, remove Save/Save As, change navigator default visibility or width, move the divider, add navigator persistence or keyboard shortcuts, change Page/Camera lists or sorting, change Camera creation, or customize Excalidraw's private toolbar DOM.
**Architecture:** `Toolbar` remains the window-level file-command boundary but no longer owns document creation. It will locally control the Open menu state only to hide the trigger tooltip during menu presentation, and will use a wider non-wrapping Radix menu without changing callbacks. `EditorLayout` removes only the toolbar-specific New File path; Workspace and Launch Screen creation remain separate existing entry points. `IdeaSketchEditor` remains the navigator visibility owner, but only the sibling `ResizableDivider` receives `toggleNavigator`; `SlideCanvas` returns to a static default-items Main Menu and drops the obsolete state/callback surface from both its props and comparator. `ResizableDivider` reuses the shared Tooltip primitives around its toggle, preserving ARIA labels and resize behavior.
**Baseline:** The top toolbar still shows a New File icon even though Workspace and Launch Screen already provide creation. The Open menu is only 176px wide, so `Open Workspace…` wraps, and the Open trigger's tooltip remains visible above the opened menu. IdeaSketch exposes Navigator twice: a custom Excalidraw Main Menu item and the right-side divider notch. The divider has an accessible label but only a browser-native `title`, so it lacks the application's shared tooltip treatment.
**Exit Criteria:** The top toolbar contains Home, Open, Save, save options, and save state, with no New File button or empty gap. Opening the Open menu immediately removes the Open tooltip; both menu items stay on one line with aligned leading icons and no clipping at the shown macOS window size. Excalidraw's Main Menu begins with its normal export/theme/background commands and contains no custom Navigator item or separator. The right divider is the single direct navigator open/close control, shows the shared `Hide navigator` or `Show navigator` tooltip on hover/focus, preserves its ARIA label, and still collapses/restores the 220px panel. New File remains available from Home and the Workspace root. Page/Camera sorting, Camera creation, file opening/saving, panel resizing, focused UI contracts, the full frontend suite, production build, diff checks, and browser visual/interaction verification pass.

## Task 1: Lock the Reduced Control Contract

**Outcome:** Focused regressions describe the exact toolbar, Open menu, Excalidraw menu, and divider tooltip behavior before production edits.
**Files:**
- Modify: `tests/editorChromeNavigation.test.mjs`
- Modify: `tests/tooltipWiring.test.mjs`
- Modify: `tests/excalidrawMainMenu.test.mjs`
- Modify: `tests/panelDividerWiring.test.mjs`
- Modify: `tests/slideCanvasProps.test.mjs`

**Change Map:**
- toolbar contract: reject the top New File action/prop while retaining Home, Open, Save, Save As, centered title, and Launch/Workspace creation boundaries
- Open-menu contract: require controlled open state, a wider menu, non-wrapping item labels, and no active trigger tooltip during menu presentation
- Canvas menu contract: reject `PanelRight`, custom `MainMenu.Item`, Navigator text/state/callbacks, and the leading custom separator while retaining Excalidraw default items
- divider contract: require shared Tooltip primitives and dynamic Hide/Show navigator content without a native `title`
- memo contract: remove navigator menu props while continuing to compare the Camera drawing request token

**Verification:**
- `node --test tests/editorChromeNavigation.test.mjs tests/tooltipWiring.test.mjs tests/excalidrawMainMenu.test.mjs tests/panelDividerWiring.test.mjs tests/slideCanvasProps.test.mjs`

- [x] Add focused failing source contracts for the three requested control/layout changes.
- [x] Confirm the failures distinguish the current duplicated controls and wrapping/tooltip behavior.

## Task 2: Simplify the Toolbar and Repair the Open Menu

**Outcome:** The title bar has no redundant creation command and its Open dropdown is a clean, stable two-row menu.
**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/EditorLayout.tsx`

**Change Map:**
- `Toolbar`: remove `FilePlus2`, `onNewFile`, and the New File button; track Open menu state; suppress the Open tooltip while open; widen the menu and keep both labels/icons on one line
- `EditorLayout`: stop forwarding `onNewFile` and remove the toolbar-only standalone/Workspace New File handler without changing `handleCreateDocument`, Launch Screen creation, or file-open/save coordination

**Verification:**
- Run the focused Task 1 suite.
- Browser cases: toolbar command spacing after removal; Open tooltip before opening but absent while open; menu width, one-line rows, icon alignment, and both callbacks at the screenshot window size.

- [x] Remove only the top-toolbar creation path and keep remaining command spacing continuous.
- [x] Stabilize the Radix Open menu without changing its two actions.

## Task 3: Make the Divider the Sole Navigator Toggle

**Outcome:** Navigator visibility has one obvious editor control with a consistent shared tooltip.
**Files:**
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/ResizableDivider.tsx`
- Modify: `src/lib/slideCanvasProps.ts`

**Change Map:**
- `SlideCanvas`: remove the custom Navigator Main Menu item, `PanelRight`, custom separator, and navigator state/callback props while retaining the default Main Menu and Camera drawing token
- `IdeaSketchEditor`: stop forwarding navigator state/callbacks into Canvas; keep `toggleNavigator` on the right divider and `openNavigator("cameras")` for Camera creation
- `ResizableDivider`: wrap the toggle with shared Tooltip primitives, render the existing dynamic label as tooltip content, preserve ARIA and resize event isolation, and remove native `title`
- prop comparator: delete obsolete Navigator menu fields so local panel toggles no longer remount/re-render Canvas unnecessarily

**Verification:**
- Run the focused Task 1 suite.
- Interaction cases: Main Menu has no Navigator row; right toggle tooltip changes between Hide/Show; collapse/restore remains synchronized; Camera Add still opens Cameras and starts one drawing request; left Workspace divider behavior remains intact.

- [x] Remove the duplicate Canvas menu entry and redundant prop surface.
- [x] Give the remaining divider toggle shared hover/focus guidance without changing panel behavior.

## Task 4: Verify and Deliver F014

**Outcome:** The simplified controls ship without regressions to file workflows, navigator behavior, or editor interactions.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F014-simplify-file-and-navigator-controls.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- F014 feature/plan: completion state and current focused, full-suite, build, and browser evidence
- generated plan index: refreshed F014 status

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Browser/Tauri acceptance at the screenshot size: toolbar spacing; Open menu tooltip suppression and one-line rows; Excalidraw Main Menu defaults; right divider Tooltip plus collapse/restore; Launch/Workspace New File availability; Page/Camera drag and Camera creation continuity.

- [x] Run focused and complete frontend verification once the implementation stabilizes.
- [x] Review the final diff, complete F014, refresh progress, and create a separate `feat(F014)` commit.

## Completion Evidence

- Focused toolbar, Tooltip, Excalidraw Main Menu, divider, and Canvas-prop contracts passed all 29 tests after first proving seven failures against the previous duplicated-control implementation.
- The contracts confirm the editor toolbar has no New File prop/button while Launch Screen and Workspace root creation remain, the Open menu is controlled at 208px with non-wrapping rows and an unmounted trigger Tooltip while open, and the Canvas Main Menu has no custom Navigator item or separator.
- Navigator contracts confirm the right divider remains the sole direct toggle, keeps dynamic `Hide navigator` / `Show navigator` ARIA labels, uses the shared Radix Tooltip, and preserves the 220px open-by-default panel plus Camera creation wiring.
- `node --test tests/*.test.mjs` passed all 182 frontend tests; `npm run build` and `git diff --check` passed with only the existing Excalidraw mixed-import and large-chunk warnings.
- Automated Browser/Tauri visual inspection could not run because the shared Browser and Computer Use transport closed during connection and reset attempts. The focused source contracts and generated Tailwind CSS verification cover the requested width, no-wrap, Tooltip suppression, and single-toggle layout rules without claiming an interactive screenshot run.

## Post-delivery Visual Calibration

- The user explicitly approved a follow-up IdeaNote chrome palette that extends F014's neutral/violet control language to Excalidraw's visible Main Menu trigger. The scoped `.main-menu-trigger` override uses a mist-violet surface (`#f0eff7`), violet-gray border and icon color, restrained elevation, and stronger violet hover/focus feedback without changing the control's dimensions or placement.
- The Home/Open toolbar separator now uses `#c4c5ce` so it remains visible on the calibrated cool-gray title surface. This is the single approved exception to the original no-private-toolbar-DOM boundary and is limited to Excalidraw's bundled `main-menu-trigger` class.
- `tests/editorChromeNavigation.test.mjs` locks the trigger palette, hover/focus treatment, and visible separator. The focused editor-chrome suite passed 10/10 tests, the complete frontend suite passed 245/245, and the production and Tauri debug builds succeeded.
- The user reviewed successive native screenshots and explicitly accepted the final control and title-bar appearance before requesting this delivery commit.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F007-framework-title-bar-icons.md`
- `docs/superplan/plans/features/F009-tabbed-ideasketch-navigator.md`
- `docs/superplan/plans/features/F010-clarify-save-and-workspace-actions.md`
- `docs/superplan/plans/features/F013-compact-workspace-and-navigator-layout.md`
- `docs/superplan/plans/bugs/B005-integrate-navigator-into-excalidraw-toolbar.md`
- `src/components/Toolbar.tsx`
- `src/components/EditorLayout.tsx`
- `src/components/SlideCanvas.tsx`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/ResizableDivider.tsx`
- `src/lib/slideCanvasProps.ts`
