import { useEffect, useRef, useState } from "react";
import type { Slide } from "../types";
import { parseSvgMarkup } from "../lib/cameraThumbnail";
import { buildSlidePreviewKey } from "../lib/previewKeys";
import { previewRendererClient } from "../lib/previewRenderer";

interface UseSlideThumbnailsOptions {
  debounceMs?: number;
  enabled?: boolean;
}

function normalizeOptions(optionsOrDebounceMs: number | UseSlideThumbnailsOptions) {
  if (typeof optionsOrDebounceMs === "number") {
    return {
      debounceMs: optionsOrDebounceMs,
      enabled: true,
    };
  }

  return {
    debounceMs: optionsOrDebounceMs.debounceMs ?? 500,
    enabled: optionsOrDebounceMs.enabled ?? true,
  };
}

export function useSlideThumbnails(
  slides: Slide[],
  optionsOrDebounceMs: number | UseSlideThumbnailsOptions = 500,
) {
  const { debounceMs, enabled } = normalizeOptions(optionsOrDebounceMs);
  const [thumbnails, setThumbnails] = useState<Map<string, SVGSVGElement>>(new Map());
  const timeoutRef = useRef<number | null>(null);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    const cancelPendingWork = () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    requestVersionRef.current += 1;
    const requestVersion = requestVersionRef.current;
    cancelPendingWork();

    if (!enabled) {
      return cancelPendingWork;
    }

    const previewScenes = slides
      .filter((slide) => slide.elements && slide.elements.length > 0)
      .map((slide) => ({
        slideId: slide.id,
        renderKey: buildSlidePreviewKey(slide.elements, slide.files, slide.appState),
        elements: slide.elements,
        appState: slide.appState,
        files: slide.files,
      }));

    if (previewScenes.length === 0) {
      setThumbnails((prev) => (prev.size === 0 ? prev : new Map()));
      return cancelPendingWork;
    }

    timeoutRef.current = window.setTimeout(async () => {
      timeoutRef.current = null;

      try {
        const result = await previewRendererClient.renderSlides(previewScenes);
        if (
          requestVersionRef.current !== requestVersion ||
          result.status === "replaced"
        ) {
          return;
        }

        setThumbnails(() => {
          const next = new Map<string, SVGSVGElement>();

          for (const slide of slides) {
            const svgMarkup = result.value.get(slide.id);
            if (!svgMarkup) {
              continue;
            }

            const svgElement = parseSvgMarkup(svgMarkup);
            if (svgElement instanceof SVGSVGElement) {
              next.set(slide.id, svgElement);
            }
          }

          return next;
        });
      } catch (error) {
        if (requestVersionRef.current !== requestVersion) {
          return;
        }
        console.error("Failed to generate slide thumbnails:", error);
      }
    }, debounceMs);

    return cancelPendingWork;
  }, [debounceMs, enabled, slides]);

  return thumbnails;
}
