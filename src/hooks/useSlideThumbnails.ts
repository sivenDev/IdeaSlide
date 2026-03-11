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
