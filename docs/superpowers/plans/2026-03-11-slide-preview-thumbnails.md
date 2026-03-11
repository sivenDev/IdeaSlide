# Slide Preview Thumbnails Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the numbered placeholder boxes in the left slide preview panel with live Excalidraw thumbnail renders of each slide's actual content.

**Architecture:** Use `exportToSvg` from `@excalidraw/excalidraw` to render each slide's elements into an SVG, then display that SVG by appending it as a DOM child via a ref. Thumbnails are generated on-demand with debouncing to avoid re-rendering on every keystroke. A dedicated `useSlideThumbnails` hook manages the thumbnail cache (Map of slideId to SVGSVGElement), regenerating when slide elements change.

**Tech Stack:** React 19, `@excalidraw/excalidraw` exportToSvg, Tailwind CSS v4

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/hooks/useSlideThumbnails.ts` | Create | Hook that manages thumbnail generation and caching |
| `src/components/SlideThumbnail.tsx` | Create | Renders a single slide's SVG thumbnail via DOM ref |
| `src/components/SlidePreviewPanel.tsx` | Modify | Replace placeholder boxes with `SlideThumbnail` components |
| `src/components/EditorLayout.tsx` | Modify | Wire up `useSlideThumbnails` and pass to panel |

## Design Decisions

- **exportToSvg over exportToCanvas**: SVG scales cleanly to any preview size without pixelation. No canvas element needed per thumbnail.
- **Debounced regeneration**: The active slide changes on every Excalidraw `onChange` event (every stroke). Debounce thumbnail regeneration by 500ms to avoid constant re-exports.
- **DOM ref for SVG injection**: `exportToSvg` returns an `SVGSVGElement`. We append it directly to a container div via a React ref and `replaceChildren()`. This avoids any string-based HTML injection.
- **Empty slide fallback**: When a slide has no elements, show the existing slide number placeholder instead of an empty white box.

---

## Chunk 1: Thumbnail Generation and Display

### Task 1: Create `useSlideThumbnails` hook

**Files:**
- Create: `src/hooks/useSlideThumbnails.ts`

- [x] **Step 1: Create the hook file**

```typescript
import { useState, useEffect, useRef } from "react";
import { exportToSvg } from "@excalidraw/excalidraw";
import type { Slide } from "../types";

export function useSlideThumbnails(slides: Slide[], debounceMs = 500) {
  const [thumbnails, setThumbnails] = useState<Map<string, SVGSVGElement>>(new Map());
  const timeoutsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    for (const slide of slides) {
      if (!slide.elements || slide.elements.length === 0) {
        setThumbnails((prev) => {
          if (!prev.has(slide.id)) return prev;
          const next = new Map(prev);
          next.delete(slide.id);
          return next;
        });
        continue;
      }

      const existingTimeout = timeoutsRef.current.get(slide.id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeout = window.setTimeout(async () => {
        try {
          const svg = await exportToSvg({
            elements: slide.elements as any,
            appState: {
              viewBackgroundColor: "#ffffff",
              exportBackground: true,
              exportPadding: 10,
            },
            files: null,
          });

          svg.setAttribute("width", "100%");
          svg.setAttribute("height", "100%");

          setThumbnails((prev) => {
            const next = new Map(prev);
            next.set(slide.id, svg);
            return next;
          });
        } catch (err) {
          console.error(`Failed to generate thumbnail for slide ${slide.id}:`, err);
        }
      }, debounceMs);

      timeoutsRef.current.set(slide.id, timeout);
    }

    return () => {
      for (const timeout of timeoutsRef.current.values()) {
        clearTimeout(timeout);
      }
    };
  }, [slides, debounceMs]);

  return thumbnails;
}
```

- [x] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors related to `useSlideThumbnails.ts`

- [ ] **Step 3: Commit** (deferred — all changes committed together)

```bash
git add src/hooks/useSlideThumbnails.ts
git commit -m "feat: add useSlideThumbnails hook for debounced SVG thumbnail generation"
```

---

### Task 2: Create `SlideThumbnail` component

**Files:**
- Create: `src/components/SlideThumbnail.tsx`

- [x] **Step 1: Create the component file**

The component uses a ref to safely mount the SVG element into the DOM. Uses `replaceChildren()` to clear and set content safely without string-based injection.

```typescript
import { memo, useRef, useEffect } from "react";

interface SlideThumbnailProps {
  svgElement: SVGSVGElement | undefined;
  slideIndex: number;
}

export const SlideThumbnail = memo(function SlideThumbnail({
  svgElement,
  slideIndex,
}: SlideThumbnailProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Safe DOM manipulation: replaceChildren clears and sets new content
    if (svgElement) {
      container.replaceChildren(svgElement.cloneNode(true));
    } else {
      container.replaceChildren();
    }
  }, [svgElement]);

  if (!svgElement) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="text-2xl font-bold">{slideIndex + 1}</div>
          <div className="text-xs">Slide {slideIndex + 1}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden bg-white [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain"
    />
  );
});
```

- [x] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors related to `SlideThumbnail.tsx`

- [ ] **Step 3: Commit** (deferred — all changes committed together)

```bash
git add src/components/SlideThumbnail.tsx
git commit -m "feat: add SlideThumbnail component for rendering SVG previews via DOM ref"
```

---

### Task 3: Integrate thumbnails into SlidePreviewPanel and EditorLayout

**Files:**
- Modify: `src/components/SlidePreviewPanel.tsx`
- Modify: `src/components/EditorLayout.tsx`

- [x] **Step 1: Update SlidePreviewPanel to accept and render thumbnails**

Changes to `src/components/SlidePreviewPanel.tsx`:
1. Add import for `SlideThumbnail`
2. Add `thumbnails: Map<string, SVGSVGElement>` to the props interface
3. Replace the placeholder `<div className="aspect-video bg-white flex items-center justify-center text-gray-400">` block with `<SlideThumbnail>`

The updated preview item inner content becomes:
```tsx
<div className="aspect-video bg-white">
  <SlideThumbnail
    svgElement={thumbnails.get(slide.id)}
    slideIndex={index}
  />
</div>
```

- [x] **Step 2: Wire up useSlideThumbnails in EditorLayout**

Changes to `src/components/EditorLayout.tsx`:
1. Add import: `import { useSlideThumbnails } from "../hooks/useSlideThumbnails";`
2. Add hook call after existing hooks: `const thumbnails = useSlideThumbnails(state.slides);`
3. Pass `thumbnails={thumbnails}` to `<SlidePreviewPanel>`

- [x] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [x] **Step 4: Manual test in dev environment**

Run: `npm run tauri dev` (or `npm run dev` for browser-only)

Test these scenarios:
1. Quick Start -> draw something -> left panel shows thumbnail (after ~500ms delay)
2. Add a new slide -> panel shows numbered fallback for the empty slide
3. Switch slides -> each slide shows its own thumbnail
4. Draw on second slide -> its thumbnail updates independently
5. Delete a slide -> thumbnails update correctly

- [ ] **Step 5: Commit** (pending — all changes not yet committed)

```bash
git add src/components/SlidePreviewPanel.tsx src/components/EditorLayout.tsx
git commit -m "feat: integrate live Excalidraw thumbnails into slide preview panel"
```
