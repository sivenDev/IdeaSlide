# Excalidraw Camera Playground Design Specification

**Date**: 2026-03-18
**Status**: Draft
**Author**: GPT-5.4

## Overview

Create a standalone frontend-only playground under `.temp/excalidraw-camera-test` to validate the camera viewport animation algorithm outside the Tauri desktop app. The playground is intentionally narrow in scope: it focuses on camera extraction, viewport target calculation, and animated pan/zoom transitions inside Excalidraw.

## Goals

- Validate camera viewport animation behavior in a fast browser-only environment
- Support both hardcoded camera targets and Excalidraw rectangle elements marked as cameras
- Make viewport calculations observable through lightweight debug UI
- Keep the project small enough to iterate quickly and discard safely if needed

## Non-Goals

- No Tauri integration
- No `.is` file loading or persistence
- No slide system
- No thumbnail generation
- No drag-and-drop camera reordering
- No production-grade presentation UI

## Scope

The playground will verify only the camera animation algorithm and its surrounding debug loop.

Included:

- A single Excalidraw canvas with demo content
- Two camera data sources:
  - Hardcoded camera definitions
  - Camera rectangles extracted from Excalidraw elements via `customData.type === "camera"`
- Camera playback controls:
  - Previous
  - Next
  - Jump to specific camera
  - Replay current camera
- Runtime parameters:
  - Transition duration
  - Viewport padding
  - Easing mode
- Debug visibility:
  - Current viewport values
  - Target viewport values
  - Extracted camera list
  - Optional camera border visibility toggle

Excluded:

- Multiple slides
- Presentation overlays
- Thumbnail navigators
- Saving or loading scenes
- Full parity with the desktop app

## Technical Approach

Use a standalone `Vite + React + TypeScript` app in `.temp/excalidraw-camera-test`.

The app should mount a single Excalidraw editor and expose a small control panel alongside it. The control panel drives algorithm verification rather than product UX.

The implementation should separate three concerns clearly:

1. Camera source extraction
2. Viewport target calculation
3. Viewport animation execution

This separation allows the calculation logic to be unit tested and later moved back into the main app with minimal changes.

## Data Model

### Camera Shape

```typescript
interface Camera {
  id: string;
  order: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
```

### Camera Source Modes

```typescript
type CameraSourceMode = "hardcoded" | "element-derived";
```

For `element-derived` mode, camera order must come from `element.customData.order`.

Fallback behavior:

- If `customData.order` is missing or not a finite number, treat that camera as unordered
- Ordered cameras come first, sorted ascending by `customData.order`
- Unordered cameras come after ordered cameras, preserving original element array order

This fallback keeps playback deterministic while still allowing quick manual camera authoring in the playground.

### Viewport Target

```typescript
interface ViewportTarget {
  scrollX: number;
  scrollY: number;
  zoom: number;
}
```

### Fit Rule

The playground will use a single explicit fit rule:

```typescript
type CameraFitMode = "contain";
```

`contain` means the full camera bounds must fit within the visible viewport after applying padding. No alternative fit behavior is in scope for this validation project.

## File Structure

```text
.temp/excalidraw-camera-test/
  src/
    App.tsx
    components/
      CameraPlayground.tsx
      ControlPanel.tsx
    data/
      demoScene.ts
      demoCameras.ts
    lib/
      cameraUtils.ts
      viewport.ts
      animateViewport.ts
    tests/
      cameraUtils.test.ts
      viewport.test.ts
```

## Component Design

### `App.tsx`

Responsibilities:

- Own top-level layout
- Store selected camera index
- Store camera source mode
- Store runtime animation settings
- Pass configuration into canvas and control panel

### `CameraPlayground.tsx`

Responsibilities:

- Render Excalidraw
- Provide initial scene data
- Capture and retain `excalidrawAPI`
- Trigger viewport animation when the selected camera changes
- Optionally hide or show camera rectangles during playback

### `ControlPanel.tsx`

Responsibilities:

- Render source mode switcher
- Render camera list
- Render playback actions
- Render parameter controls
- Show current and target viewport debug values

## Library Design

### `cameraUtils.ts`

Responsibilities:

- Extract camera rectangles from Excalidraw elements
- Normalize negative width and height values
- Sort by `order`
- Filter out camera elements when needed

This file should stay close to the main app's utility shape so successful logic can be ported back easily.

### `viewport.ts`

Responsibilities:

- Convert camera bounds into target `scrollX`, `scrollY`, and `zoom`
- Accept viewport size, padding factor, and fit mode as inputs
- Remain pure and deterministic for unit testing

This is the most important validation target in the playground.

### `animateViewport.ts`

Responsibilities:

- Animate from current viewport to target viewport with `requestAnimationFrame`
- Support cancellation when a new camera is selected
- Accept easing and duration configuration

The animation layer should remain thin; the playground is testing the algorithm, not building a generic animation framework.

## Initial Demo Content

The default scene should include enough geometry to make viewport transitions obvious:

- Several text and shape clusters placed far apart on a large canvas
- A few camera rectangles tagged with `customData.type === "camera"`
- A hardcoded camera list that points at the same regions, allowing side-by-side comparison between hardcoded and extracted modes

This ensures the app is useful immediately on first load without requiring manual setup.

## Testing Strategy

Focus automated tests on deterministic logic.

### Unit tests for `cameraUtils.ts`

- Extracts only camera rectangles
- Ignores deleted elements
- Normalizes negative width and height values
- Sorts extracted cameras by `order`

### Unit tests for `viewport.ts`

- Fits a camera inside the viewport with padding
- Produces expected scroll and zoom values for wide regions
- Produces expected scroll and zoom values for tall regions
- Handles different viewport sizes correctly
- Uses `contain` fit mode semantics consistently

### Unit tests for animation cancellation

- Starting a second animation cancels the first one
- Only the latest animation is allowed to keep updating viewport state
- Cancellation does not leave stale frame callbacks mutating the final target

These tests can target a small animation controller wrapper with mocked frame scheduling instead of trying to test the full Excalidraw runtime.

### Manual verification

- Switching cameras visually centers the intended content
- Hardcoded and element-derived modes land on equivalent viewport targets
- Rapid next/previous interactions cancel in-flight animations cleanly
- Duration, padding, and easing controls visibly affect motion
- After animation completes, the debug panel shows both target and actual viewport values
- Actual `scrollX`, `scrollY`, and `zoom` must land within a small documented tolerance of the computed target

### Runtime validation tolerance

Because this playground exists to verify Excalidraw viewport behavior rather than only the math, the UI must expose:

- Computed target viewport
- Actual viewport read back from Excalidraw after animation settles
- Difference values for `scrollX`, `scrollY`, and `zoom`

Default success tolerance:

- `scrollX` delta <= 1 px
- `scrollY` delta <= 1 px
- `zoom` delta <= 0.01

## Success Criteria

- The playground starts locally with a single frontend dev server
- Demo content is visible on first load
- Camera playback works in both source modes
- Viewport movement feels stable and predictable
- Debug values help explain what the viewport algorithm is doing
- Actual final viewport values are compared against computed targets within the documented tolerance
- Pure logic is covered by focused unit tests

## Implementation Sequence

1. Scaffold the Vite React TypeScript project in `.temp/excalidraw-camera-test`
2. Add Excalidraw and minimal layout
3. Add demo scene and hardcoded cameras
4. Write failing unit tests for viewport calculation and camera extraction
5. Implement calculation and extraction utilities to satisfy tests
6. Add animation execution and cancellation behavior
7. Add control panel and debug output
8. Run final verification in browser and test runner

## Risks and Mitigations

### Excalidraw viewport API behavior differs from assumptions

Mitigation:

- Keep debug values visible at runtime
- Separate target calculation from actual API updates so issues can be isolated

### Hardcoded and extracted camera modes drift apart

Mitigation:

- Use matching regions in demo data
- Expose both target values in the UI for comparison

### Playground scope expands into a second product

Mitigation:

- Keep slides, thumbnails, persistence, and final UI explicitly out of scope
- Treat this project as a disposable validation harness

## Open Questions

None for the initial playground scope. If validation succeeds, the next design step should focus on how to transfer the proven viewport logic back into the main app's presentation mode.
