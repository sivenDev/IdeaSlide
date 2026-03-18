# Editor Workspace Layout Design Specification

**Date**: 2026-03-19
**Status**: Approved
**Author**: Codex

## Overview

Redesign the editor workspace so Excalidraw keeps as much editable area as possible. The current bottom `Cameras / Slides` tab strip consumes too much vertical space and treats low-frequency `Slides` navigation as equal to higher-frequency `Cameras` work. The new layout removes the bottom preview region and redistributes navigation into a lightweight top strip plus a right-side camera work rail.

## Goal

- Maximize the visible Excalidraw editing area.
- Remove the large bottom preview region from the main editor.
- Treat `Slides` as low-frequency global navigation.
- Treat `Cameras` as high-frequency editing context.
- Keep the interface simple when there is only one slide or a very small camera set.
- Allow users to manually hide supporting panels without persisting that preference across launches.

## Selected Direction

Use a "top slides strip + right camera rail" workspace layout, with the `C1` camera treatment:

- Move `Slides` into a thin strip near the top of the editor.
- Move `Cameras` into a dedicated right-side rail.
- Keep cameras in their existing list order.
- In the right rail, whichever camera is selected should enlarge in place.
- All non-selected cameras should remain smaller in the same list.
- Remove the current bottom `Cameras / Slides` tabbed preview area entirely.

This keeps the central canvas dominant while preserving fast navigation for both slides and cameras.

## Visibility Rules

### Slides

- Show the top slide strip only when `slides.length > 1`.
- Hide the slide strip completely when there is only one slide.
- When visible, the strip can be manually collapsed and expanded.
- Collapse state is session-local UI state only and must not be persisted to the file or restored on relaunch.

### Cameras

- Show the right camera rail whenever `cameras.length > 0`.
- The rail remains useful even for a single camera because it represents the current editable camera context.
- When visible, the rail can be manually collapsed and expanded.
- Collapse state is session-local UI state only and must not be persisted.

## Layout Structure

### Main Regions

- **Center**: Excalidraw canvas, always the dominant region.
- **Top**: thin slide navigation strip.
- **Right**: camera work rail with current-camera emphasis.
- **Bottom**: no dedicated preview panel in the normal editor workspace.

### Size Baseline

- Slide strip target height: approximately `52px`
- Camera rail target width: approximately `236px`
- If the rail is collapsed, replace it with a slim edge handle/toggle rather than preserving empty width.

These values are starting points, not rigid tokens, but the intent is to keep the top strip very thin and to spend width rather than height on supporting UI.

## Component Design

### Slide Strip

- A thin horizontal filmstrip-like row near the top of the editor.
- Primary responsibilities:
  - switch current slide
  - indicate active slide
  - add slide
- It should not try to become a large thumbnail gallery.
- It should visually read as lightweight navigation, not as a second workspace.
- If collapsed, only a small affordance should remain for reopening it.

### Camera Rail

- A dedicated right-side column optimized for many cameras.
- The rail is a single scrollable camera list rather than a split "current card + remaining list" structure.
- The selected camera should appear larger than surrounding items, but stay in its original list position.
- Non-selected cameras remain smaller and keep the list compact.
- Each camera item should still preserve thumbnail-first recognition, because the user explicitly prefers card-based navigation over a denser list treatment.
- The rail should feel like a navigator / work queue rather than a passive gallery.

### Current Camera Emphasis

- The selected camera should expand in place within the list.
- The list order must remain stable when selection changes.
- Selecting a camera must not pin it to the top or otherwise reorder the rail.
- This is intentional because stable spatial memory matters more than a pinned "current" region when many cameras exist.

## Interaction Details

### Slides

- Clicking a slide in the strip changes the active slide.
- Adding a slide remains available from the strip and/or toolbar.
- If the strip is hidden because only one slide exists, slide switching controls should not reserve space.
- Manual collapse only affects visibility of the strip, not slide data or behavior.

### Cameras

- Clicking a camera in the rail selects that camera.
- The selected camera expands in place and becomes visually emphasized.
- Non-selected cameras remain smaller in the same list.
- Selection changes must not reorder the list or move the selected camera to a special pinned section.
- Reordering, deletion, and other camera actions should continue to live with the camera UI, but the exact button placement can be refined during implementation.
- Manual collapse only affects visibility of the rail, not camera state.

### Collapse / Expand Affordances

- `Slides` and `Cameras` each need a direct manual toggle.
- The toggles should be lightweight and spatially attached to the region they control.
- When collapsed:
  - the associated panel should free its space
  - a minimal reopen handle should remain visible
- Collapse state resets on fresh open/relaunch.

## State Model

New UI state will likely be needed in the editor shell for:

- whether the slide strip is manually collapsed
- whether the camera rail is manually collapsed

These must be derived and resolved alongside visibility rules:

- a region cannot expand if its item-count rule says it should be hidden
- a manual collapse only matters when the region is otherwise eligible to show

This state belongs to transient editor UI and should not be serialized into slide data or the `.is` file format.

## Responsive Behavior

- The desktop workspace remains the primary target because this is a Tauri editor.
- On narrower widths:
  - prefer shrinking the camera rail before sacrificing canvas height
  - keep the slide strip thin
  - allow the camera rail to collapse quickly if space becomes constrained
- Do not reintroduce a large bottom panel as the responsive fallback unless implementation constraints make that unavoidable.

## In Scope

- Removing the current bottom `Cameras / Slides` tab region from the normal editor layout
- Adding a top slide strip that follows the new visibility rule
- Adding a right camera rail that follows the new visibility rule
- Adding non-persistent collapse / expand behavior for both regions
- Updating selection presentation so the current camera is visually prominent

## Out of Scope

- Reworking presentation mode layouts
- Persisting panel visibility preferences
- Changing the underlying slide or camera data model
- Introducing a brand-new docking system or arbitrary user-resizable panel framework
- Redesigning all toolbar actions unrelated to this workspace change

## Error Handling and Edge Cases

- If slide count drops from `> 1` to `1`, the slide strip should disappear cleanly and return space to the canvas.
- If camera count drops to `0`, the camera rail should disappear cleanly and return space to the canvas.
- If the currently selected camera is deleted:
  - the enlarged list item should disappear immediately
  - the rail should fall back to the next valid camera if one exists
  - otherwise the rail should disappear because camera count is now `0`
- Collapse toggles must not create stale empty gutters when the associated region is hidden.

## Testing Strategy

### Manual Verification

- Confirm the bottom preview area is gone in the normal editor.
- Confirm the slide strip appears only when there are more than one slides.
- Confirm the camera rail appears whenever there is at least one camera.
- Confirm both regions can be manually collapsed and expanded.
- Confirm collapsed regions free their space and enlarge the canvas.
- Confirm collapse state is not remembered after reopening the app/file.
- Confirm the selected camera enlarges in place within the right rail.
- Confirm camera list order remains unchanged when the selection changes.

### Automated Verification

- Add focused source-level or state-level coverage for:
  - slide strip visibility rule
  - camera rail visibility rule
  - non-persistent collapse behavior
  - in-place selected-camera emphasis wiring
  - no-reorder behavior when selection changes
- Re-run targeted UI/source tests and a production build after implementation.

## Implementation Notes

- `EditorLayout.tsx` is the likely integration point for the overall region reshuffle.
- `CameraList.tsx` will likely need to support two visual card sizes inside one ordered list.
- The existing slide preview component may need a thinner variant rather than a full reuse of the current bottom thumbnail panel.
- Keep the implementation incremental: first establish the new regions and visibility rules, then refine collapse affordances and styling.
