# Slide Presentation Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add slide presentation mode to IdeaSlide with preview and fullscreen modes, keyboard navigation, and thumbnail navigator.

**Architecture:** Extend existing React component tree with a `PresentationMode` component at the same level as `EditorLayout` in `App.tsx`. Reuse existing `SlideCanvas` with a new `viewMode` prop for Excalidraw read-only rendering. Use Tauri v2 built-in fullscreen API (no custom Rust commands needed).

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Excalidraw 0.18, Tauri v2 Window API

**Spec:** `docs/superpowers/specs/2026-03-12-slide-presentation-design.md`

---

## File Structure

### New Files
- `src/components/PresentationMode.tsx` — Container component managing slide navigation, keyboard events, and mode switching
- `src/components/ThumbnailNavigator.tsx` — Grid overlay for thumbnail-based slide navigation

### Modified Files
- `src/hooks/useSlideStore.tsx` — Add `presentationMode` state and `START_PRESENTATION`/`EXIT_PRESENTATION` actions
- `src/components/SlideCanvas.tsx` — Add `viewMode` prop for read-only Excalidraw rendering
- `src/components/Toolbar.tsx` — Add presentation trigger button with dropdown menu
- `src/components/SlidePreviewPanel.tsx` — Add play button for quick presentation launch
- `src/App.tsx` — Route between EditorLayout and PresentationMode based on store state

---

## Chunk 1: State Management & SlideCanvas Extension

### Task 1: Extend useSlideStore with presentation state

**Files:**
- Modify: `src/hooks/useSlideStore.tsx`

- [ ] **Step 1: Add presentationMode to state type and initial state**

Add `presentationMode` field to `SlideStoreState` and update `initialState`:

```typescript
// In SlideStoreState interface (after the existing fields):
interface SlideStoreState extends Presentation {
  presentationMode: 'none' | 'preview' | 'fullscreen';
}

// In initialState:
const initialState: SlideStoreState = {
  slides: [{ id: crypto.randomUUID(), elements: [], appState: {} }],
  currentSlideIndex: 0,
  isDirty: false,
  presentationMode: 'none',
};
```

- [ ] **Step 2: Add new action types**

Add to the `SlideStoreAction` union type:

```typescript
  | { type: 'START_PRESENTATION'; payload: { mode: 'preview' | 'fullscreen' } }
  | { type: 'EXIT_PRESENTATION' }
```

- [ ] **Step 3: Add reducer cases**

Add two new cases to `slideStoreReducer`:

```typescript
    case 'START_PRESENTATION':
      return {
        ...state,
        presentationMode: action.payload.mode,
      };

    case 'EXIT_PRESENTATION':
      return {
        ...state,
        presentationMode: 'none',
      };
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSlideStore.tsx
git commit -m "feat: add presentationMode state to slide store"
```

---

### Task 2: Extend SlideCanvas with viewMode prop

**Files:**
- Modify: `src/components/SlideCanvas.tsx`

- [ ] **Step 1: Read current SlideCanvas implementation**

Read `src/components/SlideCanvas.tsx` to understand current props and Excalidraw configuration.

- [ ] **Step 2: Add viewMode prop to component interface**

Add `viewMode?: boolean` to the component's props. When `viewMode` is true:
- Set `viewModeEnabled: true` in Excalidraw's appState
- Set `zenModeEnabled: true` to hide all UI
- Skip the `onChange` callback (no need to track changes in view mode)

In the component signature, add the prop:

```typescript
interface SlideCanvasProps {
  slideId: string;
  elements: readonly any[];
  appState: Partial<any>;
  onChange: (elements: readonly any[], appState: Partial<any>) => void;
  viewMode?: boolean;
}
```

- [ ] **Step 3: Apply viewMode to Excalidraw configuration**

In the Excalidraw component's `initialData.appState`, conditionally add:

```typescript
...(viewMode && {
  viewModeEnabled: true,
  zenModeEnabled: true,
}),
```

When `viewMode` is true, pass a no-op onChange handler or skip the onChange entirely to avoid dispatching updates.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/zhengxiwan/ide-workspace/idea-slide && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/SlideCanvas.tsx
git commit -m "feat: add viewMode prop to SlideCanvas for read-only rendering"
```

---

## Chunk 2: PresentationMode Core Component

### Task 3: Create PresentationMode component with keyboard navigation

**Files:**
- Create: `src/components/PresentationMode.tsx`

- [ ] **Step 1: Create PresentationMode component skeleton**

Create `src/components/PresentationMode.tsx` with:

```typescript
import { useState, useEffect, useCallback, useRef } from "react";
import { SlideCanvas } from "./SlideCanvas";
import { ErrorBoundary } from "./ErrorBoundary";
import type { Slide } from "../types";

interface PresentationModeProps {
  slides: Slide[];
  startIndex: number;
  mode: 'preview' | 'fullscreen';
  onExit: () => void;
}

export function PresentationMode({ slides, startIndex, mode, onExit }: PresentationModeProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentSlide = slides[currentIndex];

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, slides.length - 1));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const goFirst = useCallback(() => {
    setCurrentIndex(0);
  }, []);

  const goLast = useCallback(() => {
    setCurrentIndex(slides.length - 1);
  }, [slides.length]);

  // Keyboard navigation - use capture phase to intercept before Excalidraw
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // When thumbnail navigator is open, Esc closes it instead of exiting
      if (showThumbnails && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowThumbnails(false);
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          goNext();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'Backspace':
          e.preventDefault();
          e.stopPropagation();
          goPrev();
          break;
        case 'Home':
          e.preventDefault();
          e.stopPropagation();
          goFirst();
          break;
        case 'End':
          e.preventDefault();
          e.stopPropagation();
          goLast();
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onExit();
          break;
        case 'Tab':
        case 'g':
          e.preventDefault();
          e.stopPropagation();
          setShowThumbnails((prev) => !prev);
          break;
      }
    }

    // Use capture phase to intercept before Excalidraw handles events
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [goNext, goPrev, goFirst, goLast, onExit, showThumbnails]);

  // Auto-focus container on mount
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const noopOnChange = useCallback(() => {}, []);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label="幻灯片放映模式"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: '#1a1a1a' }}
    >
      {/* Slide content */}
      <div className="w-full h-full">
        <ErrorBoundary>
          <SlideCanvas
            key={currentSlide.id}
            slideId={currentSlide.id}
            elements={currentSlide.elements}
            appState={currentSlide.appState}
            onChange={noopOnChange}
            viewMode={true}
          />
        </ErrorBoundary>
      </div>

      {/* Page indicator */}
      <div
        role="status"
        aria-live="polite"
        aria-label={`第 ${currentIndex + 1} 张，共 ${slides.length} 张`}
        className="absolute bottom-6 right-6 px-4 py-2 rounded-lg text-sm font-medium text-white"
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        {currentIndex + 1} / {slides.length}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/zhengxiwan/ide-workspace/idea-slide && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/PresentationMode.tsx
git commit -m "feat: create PresentationMode component with keyboard navigation"
```

---

### Task 4: Add fullscreen support to PresentationMode

**Files:**
- Modify: `src/components/PresentationMode.tsx`

- [ ] **Step 1: Add fullscreen effect**

Add a `useEffect` that calls Tauri's fullscreen API when `mode === 'fullscreen'`:

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';

// Inside PresentationMode component, add this useEffect:
useEffect(() => {
  if (mode !== 'fullscreen') return;

  let cancelled = false;

  getCurrentWindow().setFullscreen(true).catch((err) => {
    if (!cancelled) {
      console.error('Failed to enter fullscreen:', err);
    }
  });

  return () => {
    cancelled = true;
    getCurrentWindow().setFullscreen(false).catch((err) => {
      console.error('Failed to exit fullscreen:', err);
    });
  };
}, [mode]);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/zhengxiwan/ide-workspace/idea-slide && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/PresentationMode.tsx
git commit -m "feat: add Tauri fullscreen integration to PresentationMode"
```

---

## Chunk 3: ThumbnailNavigator Component

### Task 5: Create ThumbnailNavigator component

**Files:**
- Create: `src/components/ThumbnailNavigator.tsx`

- [ ] **Step 1: Create ThumbnailNavigator component**

Create `src/components/ThumbnailNavigator.tsx`:

```typescript
import { useEffect, useRef } from "react";
import { useSlideThumbnails } from "../hooks/useSlideThumbnails";
import type { Slide } from "../types";

interface ThumbnailNavigatorProps {
  slides: Slide[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

export function ThumbnailNavigator({ slides, currentIndex, onSelect, onClose }: ThumbnailNavigatorProps) {
  const thumbnails = useSlideThumbnails(slides);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus the container on mount
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="dialog"
      aria-label="幻灯片导航"
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      onClick={(e) => {
        // Close when clicking the backdrop
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="grid gap-4 p-8 overflow-y-auto max-h-[90vh]"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          maxWidth: '1400px',
          width: '100%',
        }}
      >
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            aria-label={`跳转到第 ${index + 1} 张幻灯片`}
            className="relative rounded-lg overflow-hidden cursor-pointer transition-all duration-150"
            style={{
              border: `2px solid ${index === currentIndex ? '#3b82f6' : 'transparent'}`,
              backgroundColor: '#2a2a2a',
              aspectRatio: '16/9',
            }}
            onClick={() => onSelect(index)}
            onMouseEnter={(e) => {
              if (index !== currentIndex) {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (index !== currentIndex) {
                (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
              }
            }}
          >
            {/* Thumbnail image */}
            <div className="w-full h-full flex items-center justify-center p-2">
              {thumbnails[slide.id] ? (
                <img
                  src={thumbnails[slide.id]}
                  alt={`幻灯片 ${index + 1}`}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-gray-500 text-sm">加载中...</div>
              )}
            </div>

            {/* Page number badge */}
            <div
              className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-medium text-white"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
            >
              {index + 1}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/zhengxiwan/ide-workspace/idea-slide && npx tsc --noEmit`
Expected: No errors. Note: `useSlideThumbnails` may return a different type than expected — check and adapt the `thumbnails[slide.id]` access pattern to match the actual hook return type.

- [ ] **Step 3: Commit**

```bash
git add src/components/ThumbnailNavigator.tsx
git commit -m "feat: create ThumbnailNavigator component for slide grid navigation"
```

---

### Task 6: Integrate ThumbnailNavigator into PresentationMode

**Files:**
- Modify: `src/components/PresentationMode.tsx`

- [ ] **Step 1: Import and render ThumbnailNavigator**

Add import at top:

```typescript
import { ThumbnailNavigator } from "./ThumbnailNavigator";
```

Add the ThumbnailNavigator rendering inside the container div, after the page indicator:

```typescript
{/* Thumbnail navigator overlay */}
{showThumbnails && (
  <ThumbnailNavigator
    slides={slides}
    currentIndex={currentIndex}
    onSelect={(index) => {
      setCurrentIndex(index);
      setShowThumbnails(false);
    }}
    onClose={() => setShowThumbnails(false)}
  />
)}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/zhengxiwan/ide-workspace/idea-slide && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/PresentationMode.tsx
git commit -m "feat: integrate ThumbnailNavigator into PresentationMode"
```

---

## Chunk 4: UI Trigger Buttons & App Integration

### Task 7: Add presentation buttons to Toolbar

**Files:**
- Modify: `src/components/Toolbar.tsx`

- [ ] **Step 1: Read current Toolbar implementation**

Read `src/components/Toolbar.tsx` to understand current props and button patterns.

- [ ] **Step 2: Add presentation callbacks to Toolbar props**

Add these to the Toolbar's props interface:

```typescript
onStartPreview: () => void;
onStartFullscreen: () => void;
onStartFromBeginning: () => void;
```

- [ ] **Step 3: Add presentation button with dropdown**

Add a presentation button group after the existing buttons. Use a simple state-controlled dropdown:

```typescript
const [showPresentMenu, setShowPresentMenu] = useState(false);
```

Render a "放映" button that toggles the dropdown, with three menu items:
- "预览模式" → calls `onStartPreview()`
- "全屏放映" → calls `onStartFullscreen()`
- "从头放映" → calls `onStartFromBeginning()`

Use the same Tailwind styling patterns as existing toolbar buttons. Close dropdown on item click or when clicking outside.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/zhengxiwan/ide-workspace/idea-slide && npx tsc --noEmit`
Expected: Errors in EditorLayout.tsx because the new props aren't passed yet — that's expected at this stage.

- [ ] **Step 5: Commit**

```bash
git add src/components/Toolbar.tsx
git commit -m "feat: add presentation trigger button with dropdown to Toolbar"
```

---

### Task 8: Add play button to SlidePreviewPanel

**Files:**
- Modify: `src/components/SlidePreviewPanel.tsx`

- [ ] **Step 1: Read current SlidePreviewPanel implementation**

Read `src/components/SlidePreviewPanel.tsx` to understand current structure.

- [ ] **Step 2: Add onStartPresentation prop**

Add to the component's props:

```typescript
onStartPresentation?: () => void;
```

- [ ] **Step 3: Add play button to panel header**

Add a small play button (▶) next to the panel header area. Style it as a 32x32 icon button with hover tooltip "放映幻灯片". Use an inline SVG play triangle or text character "▶".

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/zhengxiwan/ide-workspace/idea-slide && npx tsc --noEmit`
Expected: No errors (prop is optional)

- [ ] **Step 5: Commit**

```bash
git add src/components/SlidePreviewPanel.tsx
git commit -m "feat: add presentation play button to SlidePreviewPanel"
```

---

### Task 9: Integrate PresentationMode into App.tsx and EditorLayout

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/EditorLayout.tsx`

- [ ] **Step 1: Read current App.tsx**

Read `src/App.tsx` to understand current routing logic.

- [ ] **Step 2: Update App.tsx to render PresentationMode**

Import PresentationMode and add conditional rendering. When `state.presentationMode !== 'none'`, render PresentationMode instead of EditorLayout:

```typescript
import { PresentationMode } from "./components/PresentationMode";

// Inside App component, after getting state from useSlideStore:
if (state.presentationMode !== 'none') {
  return (
    <PresentationMode
      slides={state.slides}
      startIndex={state.currentSlideIndex}
      mode={state.presentationMode as 'preview' | 'fullscreen'}
      onExit={() => dispatch({ type: 'EXIT_PRESENTATION' })}
    />
  );
}
```

- [ ] **Step 3: Update EditorLayout to pass presentation callbacks**

In EditorLayout, add handlers that dispatch START_PRESENTATION and pass them to Toolbar and SlidePreviewPanel:

```typescript
function handleStartPreview() {
  dispatch({ type: 'START_PRESENTATION', payload: { mode: 'preview' } });
}

function handleStartFullscreen() {
  dispatch({ type: 'START_PRESENTATION', payload: { mode: 'fullscreen' } });
}

function handleStartFromBeginning() {
  dispatch({ type: 'SET_CURRENT_SLIDE', payload: { index: 0 } });
  dispatch({ type: 'START_PRESENTATION', payload: { mode: 'fullscreen' } });
}
```

Pass these to `<Toolbar>` and `<SlidePreviewPanel>`:
- Toolbar: `onStartPreview`, `onStartFullscreen`, `onStartFromBeginning`
- SlidePreviewPanel: `onStartPresentation={handleStartFullscreen}`

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/zhengxiwan/ide-workspace/idea-slide && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/EditorLayout.tsx
git commit -m "feat: integrate PresentationMode into app routing and EditorLayout"
```

---

## Chunk 5: Manual Testing & Polish

### Task 10: Manual testing and bug fixes

- [ ] **Step 1: Start the development server**

Run: `cd /Users/zhengxiwan/ide-workspace/idea-slide && npm run tauri dev`

- [ ] **Step 2: Test basic preview mode**

1. Create a new presentation or open an existing one
2. Draw something on a few slides
3. Click the "放映" button in toolbar → select "预览模式"
4. Verify: dark background, Excalidraw in view mode, page indicator visible
5. Press arrow keys to navigate between slides
6. Press Esc to exit

Fix any issues found.

- [ ] **Step 3: Test fullscreen mode**

1. Click "放映" → "全屏放映"
2. Verify: window enters system fullscreen
3. Navigate with keyboard
4. Press Esc to exit
5. Verify: window returns to normal size

Fix any issues found.

- [ ] **Step 4: Test thumbnail navigator**

1. Enter presentation mode
2. Press Tab or g key
3. Verify: thumbnail grid overlay appears with all slides
4. Click a thumbnail to jump to that slide
5. Press Tab again to close
6. Verify: current slide highlighted in grid

Fix any issues found.

- [ ] **Step 5: Test preview panel play button**

1. Click play button in preview panel
2. Verify: enters fullscreen presentation from current slide

Fix any issues found.

- [ ] **Step 6: Test edge cases**

1. Single slide presentation — navigate keys should not crash
2. Test "从头放映" — should start from slide 1
3. Test starting from middle slide
4. Test Home/End keys
5. Verify page indicator shows correct numbers

Fix any issues found.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "fix: polish presentation mode based on manual testing"
```
