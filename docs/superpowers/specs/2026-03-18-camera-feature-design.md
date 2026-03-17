# Camera Feature Design Specification

**Date**: 2026-03-18
**Status**: Approved
**Author**: Claude Opus 4.6

## Overview

Add a "camera" feature to IdeaSlide that enables Prezi-style presentation navigation. Cameras are rectangular viewport markers on the Excalidraw canvas that define presentation view regions. During presentation mode, the viewport smoothly transitions (pan + zoom) between cameras in sequence.

## Core Concept

**Camera**: A rectangular region marker on the canvas that defines a viewport area for presentation mode. Cameras are ordered and the presentation navigates through them with smooth animated transitions.

**Architecture**: Cameras and slides coexist. Each slide can have multiple cameras. Presentation mode navigates through slides, and within each slide, navigates through cameras in order.

## 1. Camera Element Implementation

### Technical Approach

Use Excalidraw's native `rectangle` element with `customData` marking:

```typescript
{
  type: "rectangle",
  strokeStyle: "dashed",
  strokeColor: "#1e90ff",
  backgroundColor: "transparent",
  strokeWidth: 2,
  opacity: 60,
  customData: {
    type: "camera",
    order: 1  // Presentation sequence
  },
  x, y, width, height,
  // ... other Excalidraw standard fields
}
```

### Creation

- Toolbar button "Add Camera" (next to "Add Slide")
- Clicking inserts a 400x300 dashed rectangle at canvas center
- Auto-assigns `order` (current slide's max order + 1)
- Users can move and resize the camera rectangle
- Camera doesn't affect other canvas elements (not a container)

### Styling

- Default: dashed border, semi-transparent blue
- Style set at creation time, users can modify freely afterward
- No style enforcement (no forced reset on onChange)

## 2. Bottom Panel Redesign

### Layout Structure

- Keep existing ResizableDivider + collapsible panel architecture
- Panel height: 150px (same as current SlidePreviewPanel)
- Panel interior: Tab switcher with two tabs

### Cameras Tab (Default)

- Horizontal scrolling camera thumbnail list
- Each thumbnail shows preview of the camera's framed region
- Thumbnail size: 160x100px (consistent with slide thumbnails)
- Drag-and-drop reordering support (shows insertion indicator while dragging)
- Current active camera highlighted with blue border
- Clicking thumbnail: smoothly moves canvas viewport to that camera region (edit mode quick navigation)

### Slides Tab

- Preserves existing SlidePreviewPanel functionality
- Slide thumbnails, add/delete buttons, click-to-switch behavior unchanged

### Thumbnail Generation

- Use Excalidraw's `exportToSvg()` API
- Filter elements that intersect with camera bounds (exclude camera itself)
- Set SVG viewBox to crop to camera coordinates
- 500ms debounce update (consistent with existing slide thumbnail logic)

## 3. Presentation Mode Redesign

### Navigation Logic

- Presentation proceeds by slide order
- Within each slide:
  - If cameras exist: navigate through cameras by `order` (ascending)
  - If no cameras: display full canvas (traditional full-page mode)
- After viewing all cameras in current slide, next navigation enters next slide's first camera (or full page)
- Keyboard navigation: Arrow keys/Space (next), Backspace (previous), Home/End (first/last)

### Camera Navigator

- Tab or 'g' key: displays camera thumbnail navigator for current slide (overlay, similar to ThumbnailNavigator)
- Shows grid of all cameras in current slide
- Click to jump to specific camera
- Press Tab/g/Esc again to close

### Viewport Transition Animation

- Camera-to-camera transition: smooth pan + zoom (1500-2000ms, ease-in-out)
- Slide-to-slide transition: fade in/out (300ms) + viewport reset
- During presentation, press 's' to open settings panel, adjust transition speed (fast/medium/slow)

### Rendering

- Filter out all camera elements (`customData.type === "camera"`) in presentation mode

### Presentation Settings

- "Present" dropdown menu adds new option: "Settings"
- Opens floating settings panel during presentation
- Adjustable options:
  - Transition speed: Fast (500ms) / Medium (1000ms) / Slow (1800ms)
  - Show camera borders (debug mode)
- Settings stored in sessionStorage (not persisted)

## 4. Data Model

### Slide Type

```typescript
// src/types.ts - no changes needed
interface Slide {
  id: string;
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
}

// Cameras extracted from elements, no separate storage
// Identified by: element.customData?.type === "camera"
```

### Camera Extraction Utility

```typescript
// src/lib/cameraUtils.ts
interface Camera {
  id: string;
  order: number;
  bounds: { x: number; y: number; width: number; height: number };
}

function extractCameras(elements: readonly ExcalidrawElement[]): Camera[] {
  return elements
    .filter(el => el.type === "rectangle" && el.customData?.type === "camera")
    .map(el => ({
      id: el.id,
      order: el.customData.order,
      bounds: { x: el.x, y: el.y, width: el.width, height: el.height }
    }))
    .sort((a, b) => a.order - b.order);
}
```

### Presentation State Extension

```typescript
// src/hooks/useSlideStore.tsx
interface PresentationState {
  mode: 'none' | 'preview' | 'fullscreen';
  currentSlideIndex: number;
  currentCameraIndex: number; // Camera index within current slide
  transitionSpeed: 'fast' | 'medium' | 'slow'; // Runtime configuration
}
```

### File Format

- `.is` file format unchanged
- Camera information stored in `slides/{id}.json` within `elements` array
- Backward compatible: old files open without cameras, present in traditional full-page mode

## 5. Component Architecture

### New Components

**CameraList.tsx**:
- Displays camera thumbnail list for current slide
- Horizontal scroll, 160x100px thumbnails
- Drag-and-drop reordering (react-dnd or native drag API)
- Click thumbnail: smoothly moves canvas viewport to camera region in edit mode
- Highlights current active camera

**CameraNavigator.tsx**:
- Camera navigation overlay in presentation mode (similar to ThumbnailNavigator)
- Grid layout showing all cameras in current slide
- Tab/g key toggles show/hide
- Click to jump to specific camera

**PresentationSettings.tsx**:
- Settings panel in presentation mode (press 's' to open)
- Adjust transition speed, display options
- Floating panel, doesn't affect presentation content

### Modified Components

**EditorLayout.tsx**:
- Bottom panel becomes tab container
- Manages Cameras/Slides tab switching state
- Toolbar adds "Add Camera" button callback

**Toolbar.tsx**:
- Add "Add Camera" button (next to "Add Slide")
- "Present" dropdown menu adds "Settings" option
- Click triggers `onAddCamera` callback

**PresentationMode.tsx**:
- Navigation logic becomes slide + camera two-level
- Integrates CameraNavigator and PresentationSettings
- Implements viewport transition animation
- Filters camera elements before rendering SlideCanvas

## 6. Interaction Details

### Edit Mode

**Create Camera**:
- Click Toolbar "Add Camera" button
- Inserts 400x300 dashed rectangle at canvas center
- Auto-assigns `order` (current slide's max order + 1)
- Camera auto-selected after creation, user can immediately adjust position and size

**Adjust Camera Order**:
- Drag thumbnails in Cameras tab
- Shows insertion indicator line while dragging
- On drop, updates all cameras' `customData.order`
- Triggers `onChange` callback, marks as dirty

**Delete Camera**:
- Select camera element on canvas, press Delete key (Excalidraw native behavior)
- Or hover over thumbnail in Cameras tab to show delete button (×)

**Quick Navigation**:
- Click thumbnail in Cameras tab
- Canvas viewport smoothly moves to camera region (300ms transition)
- Doesn't change selection state, only viewport movement

### Presentation Mode

**Enter Presentation**:
- Click Toolbar "Present" button
- Starts from current slide's first camera (if cameras exist)
- If current slide has no cameras, displays full page

**Navigation**:
- Right arrow/Space/Enter: next camera or next slide
- Left arrow/Backspace: previous camera or previous slide
- Home: first slide's first camera
- End: last slide's last camera
- Tab/g: show current slide's camera navigator
- s: open settings panel
- Esc: exit presentation

**Camera Navigator**:
- Semi-transparent black background overlay
- Grid displays all cameras in current slide
- Current camera highlighted
- Click to jump, press Tab/g/Esc to close

## 7. Implementation Details

### Camera Element Creation

```typescript
// In EditorLayout or dedicated cameraUtils
function createCameraElement(
  canvasCenter: { x: number; y: number },
  nextOrder: number
): ExcalidrawRectangleElement {
  return {
    id: nanoid(),
    type: "rectangle",
    x: canvasCenter.x - 200,
    y: canvasCenter.y - 150,
    width: 400,
    height: 300,
    angle: 0,
    strokeColor: "#1e90ff",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "dashed",
    roughness: 0,
    opacity: 60,
    customData: { type: "camera", order: nextOrder },
    // ... other required fields
  };
}
```

### Thumbnail Generation

```typescript
// Similar to useSlideThumbnails, create useCameraThumbnails
function generateCameraThumbnail(
  camera: Camera,
  elements: readonly ExcalidrawElement[],
  files: BinaryFiles
): Promise<SVGSVGElement> {
  // 1. Filter elements that intersect camera region (exclude camera itself)
  const visibleElements = elements.filter(el =>
    el.id !== camera.id &&
    intersects(el, camera.bounds)
  );

  // 2. Use exportToSvg, set viewBox to camera region
  return exportToSvg({
    elements: visibleElements,
    files,
    exportPadding: 0,
    // Control viewport via appState
  });
}
```

### Viewport Transition Animation

```typescript
// Implement in PresentationMode
function animateToCamera(camera: Camera, duration: number) {
  const startViewport = getCurrentViewport();
  const targetViewport = calculateViewport(camera.bounds);

  // Use requestAnimationFrame + easing function for interpolation
  // Update appState.scrollX, scrollY, zoom
}
```

### Drag-and-Drop Reordering

- Use native HTML5 Drag & Drop API
- Or use `@dnd-kit/core` library (more modern, touch-friendly)
- Update visual feedback while dragging, batch update all cameras' `order` on drop

## 8. Edge Cases

**Empty Camera List**:
- If current slide has no cameras, Cameras tab shows empty state: "No cameras yet. Click 'Add Camera' to create one."
- In presentation mode, that slide displays in traditional full-page mode

**Camera Region Outside Canvas**:
- Allow camera rectangle to be partially or completely outside current visible canvas
- Viewport moves to camera region during presentation, even if it's "off-canvas"
- This is reasonable — users may layout content on large canvas

**Overlapping Cameras**:
- Allow multiple cameras to overlap or contain each other
- Present in order sequence, no conflict detection
- Users control camera layout themselves

**Order Conflicts**:
- Drag reordering reassigns order (1, 2, 3...)
- If manual JSON editing causes duplicate orders, fall back to element array order

**Order After Camera Deletion**:
- Deleting camera doesn't auto-reorder remaining cameras (keeps other cameras' order unchanged)
- Next new camera creation: order = max(existing orders) + 1
- This way deletion doesn't trigger mass element updates

**Slide Switching in Presentation Mode**:
- Switching from slide A camera 3 to slide B
- Reset `currentCameraIndex = 0`, start from slide B's first camera
- Use fade in/out transition between slides, not pan+zoom

**Rapid Sequential Navigation**:
- If user presses next/previous during animation
- Cancel current animation, immediately start new transition
- Avoid animation queue buildup

## 9. Performance Optimization

**Thumbnail Generation**:
- Use 500ms debounce to avoid frequent regeneration
- Cache generated thumbnails (Map<cameraId, SVGElement>)
- Only regenerate when camera region or content changes
- Use Web Worker for thumbnail generation (if performance becomes bottleneck)

**Drag-and-Drop Reordering**:
- Only update visual feedback while dragging, don't trigger onChange
- Batch update all cameras' order on drop
- Reduce Excalidraw reconciliation overhead

**Presentation Mode Rendering**:
- Filter camera elements before passing to SlideCanvas
- Avoid repeated filtering on every render
- Use useMemo to cache filtered elements

**Viewport Animation**:
- Use CSS transform instead of JavaScript frame-by-frame updates (if feasible)
- Or use requestAnimationFrame + interpolation function
- Disable Excalidraw interaction during animation (viewMode)

**Large Canvas Scenarios**:
- Excalidraw has built-in virtualized rendering, only renders visible region
- Suggested camera limit: 20 cameras per slide
- Show UI hint when exceeded (not enforced)

## Success Criteria

- Users can create cameras on canvas with one click
- Camera list displays real-time previews of framed regions
- Drag-and-drop reordering works smoothly
- Presentation mode navigates through slides and cameras with smooth transitions
- Animation speed is configurable during presentation
- Camera navigator provides quick jump capability
- Performance remains smooth with 10+ cameras per slide
- Backward compatible with existing .is files

## Future Enhancements (Out of Scope)

- Camera naming/labeling
- Camera groups or sections
- Custom transition effects per camera
- Camera-specific presenter notes
- Export presentation as video with camera transitions
