import { useEffect, useRef, useState } from "react";
import type { Slide } from "../types";
import { parseSvgMarkup } from "../lib/cameraThumbnail";
import { buildSlidePreviewKey } from "../lib/previewKeys";
import { previewRendererClient } from "../lib/previewRenderer";

export interface UseSlideThumbnailsArgs {
  slides: Slide[];
  currentSlideIndex?: number;
  draftOverride?: Slide | null;
  debounceMs?: number;
  enabled?: boolean;
}

interface UseSlideThumbnailsOptions {
  debounceMs?: number;
  enabled?: boolean;
}

export interface RenderedThumbnail {
  renderKey: string;
  svgMarkup: string;
}

interface ParsedThumbnail {
  renderKey: string;
  svgElement: SVGSVGElement;
}

interface EffectiveSlide {
  slideId: string;
  renderKey: string;
  elements: Slide["elements"];
  appState: Slide["appState"];
  files: Slide["files"];
}

function createSlideWithOverride(slide: Slide, draftOverride?: Slide | null) {
  if (!draftOverride || draftOverride.id !== slide.id) {
    return slide;
  }

  return draftOverride;
}

export function buildEffectiveSlides(slides: Slide[], draftOverride?: Slide | null) {
  return slides
    .map((slide) => createSlideWithOverride(slide, draftOverride))
    .filter((slide) => slide.elements && slide.elements.length > 0)
    .map((slide) => ({
      slideId: slide.id,
      renderKey: buildSlidePreviewKey(slide.elements, slide.files, slide.appState),
      elements: slide.elements,
      appState: slide.appState,
      files: slide.files,
    })) satisfies EffectiveSlide[];
}

export function collectSlidesNeedingRender(
  effectiveSlides: EffectiveSlide[],
  previousRenderKeys: Map<string, string> | Map<string, RenderedThumbnail>,
  liveEditSlideId?: string,
) {
  const changedSlides = effectiveSlides.filter((slide) => {
    const previous = previousRenderKeys.get(slide.slideId);
    const previousRenderKey = typeof previous === "string" ? previous : previous?.renderKey;
    return previousRenderKey !== slide.renderKey;
  });

  if (!liveEditSlideId) {
    return changedSlides;
  }

  return changedSlides.filter((slide) => slide.slideId === liveEditSlideId);
}

export function mergeRenderedThumbnails(
  previous: Map<string, RenderedThumbnail>,
  effectiveSlides: EffectiveSlide[],
  renderedSlides: Map<string, string>,
) {
  const next = new Map<string, RenderedThumbnail>();

  for (const slide of effectiveSlides) {
    const renderedMarkup = renderedSlides.get(slide.slideId);
    if (renderedMarkup) {
      next.set(slide.slideId, {
        renderKey: slide.renderKey,
        svgMarkup: renderedMarkup,
      });
      continue;
    }

    const cachedThumbnail = previous.get(slide.slideId);
    if (cachedThumbnail && cachedThumbnail.renderKey === slide.renderKey) {
      next.set(slide.slideId, cachedThumbnail);
    }
  }

  return next;
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

function normalizeArgs(
  slidesOrArgs: Slide[] | UseSlideThumbnailsArgs,
  optionsOrDebounceMs: number | UseSlideThumbnailsOptions,
) {
  if (Array.isArray(slidesOrArgs)) {
    const { debounceMs, enabled } = normalizeOptions(optionsOrDebounceMs);
    return {
      slides: slidesOrArgs,
      currentSlideIndex: undefined,
      draftOverride: null,
      debounceMs,
      enabled,
    };
  }

  return {
    slides: slidesOrArgs.slides,
    currentSlideIndex: slidesOrArgs.currentSlideIndex,
    draftOverride: slidesOrArgs.draftOverride ?? null,
    debounceMs: slidesOrArgs.debounceMs ?? 500,
    enabled: slidesOrArgs.enabled ?? true,
  };
}

function toSvgElementMap(
  renderedThumbnails: Map<string, RenderedThumbnail>,
  parsedThumbnails: Map<string, ParsedThumbnail>,
  slides: Slide[]
) {
  const next = new Map<string, SVGSVGElement>();

  for (const slide of slides) {
    const renderedThumbnail = renderedThumbnails.get(slide.id);
    const parsedThumbnail = parsedThumbnails.get(slide.id);
    if (!renderedThumbnail || !parsedThumbnail) {
      continue;
    }

    if (parsedThumbnail.renderKey !== renderedThumbnail.renderKey) {
      continue;
    }

    next.set(slide.id, parsedThumbnail.svgElement);
  }

  return next;
}

export function parseRenderedThumbnails(
  renderedThumbnails: Map<string, RenderedThumbnail>,
  previousParsedThumbnails: Map<string, ParsedThumbnail>
) {
  const next = new Map<string, ParsedThumbnail>();

  for (const [slideId, renderedThumbnail] of renderedThumbnails) {
    const previousParsedThumbnail = previousParsedThumbnails.get(slideId);
    if (previousParsedThumbnail?.renderKey === renderedThumbnail.renderKey) {
      next.set(slideId, previousParsedThumbnail);
      continue;
    }

    const svgElement = parseSvgMarkup(renderedThumbnail.svgMarkup);
    if (svgElement instanceof SVGSVGElement) {
      next.set(slideId, {
        renderKey: renderedThumbnail.renderKey,
        svgElement,
      });
    }
  }

  return next;
}

export function useSlideThumbnails(
  slidesOrArgs: Slide[] | UseSlideThumbnailsArgs,
  optionsOrDebounceMs: number | UseSlideThumbnailsOptions = 500,
) {
  const { slides, currentSlideIndex, draftOverride, debounceMs, enabled } = normalizeArgs(
    slidesOrArgs,
    optionsOrDebounceMs,
  );
  const [thumbnails, setThumbnails] = useState<Map<string, SVGSVGElement>>(new Map());
  const renderedThumbnailsRef = useRef<Map<string, RenderedThumbnail>>(new Map());
  const parsedThumbnailsRef = useRef<Map<string, ParsedThumbnail>>(new Map());
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
      renderedThumbnailsRef.current = new Map();
      parsedThumbnailsRef.current = new Map();
      setThumbnails((prev) => (prev.size === 0 ? prev : new Map()));
      return cancelPendingWork;
    }

    const effectiveSlides = buildEffectiveSlides(slides, draftOverride);
    const liveEditSlideId =
      draftOverride?.id ??
      (currentSlideIndex === undefined ? undefined : slides[currentSlideIndex]?.id);
    const slidesNeedingRender = collectSlidesNeedingRender(
      effectiveSlides,
      renderedThumbnailsRef.current,
      draftOverride ? liveEditSlideId : undefined,
    );

    if (effectiveSlides.length === 0) {
      renderedThumbnailsRef.current = new Map();
      parsedThumbnailsRef.current = new Map();
      setThumbnails((prev) => (prev.size === 0 ? prev : new Map()));
      return cancelPendingWork;
    }

    if (slidesNeedingRender.length === 0) {
      const prunedThumbnails = mergeRenderedThumbnails(
        renderedThumbnailsRef.current,
        effectiveSlides,
        new Map(),
      );
      const didPrune = prunedThumbnails.size !== renderedThumbnailsRef.current.size;
      renderedThumbnailsRef.current = prunedThumbnails;
      parsedThumbnailsRef.current = parseRenderedThumbnails(
        prunedThumbnails,
        parsedThumbnailsRef.current,
      );
      if (didPrune) {
        setThumbnails(toSvgElementMap(prunedThumbnails, parsedThumbnailsRef.current, slides));
      }
      return cancelPendingWork;
    }

    timeoutRef.current = window.setTimeout(async () => {
      timeoutRef.current = null;

      try {
        const result = await previewRendererClient.renderSlides(slidesNeedingRender);
        if (
          requestVersionRef.current !== requestVersion ||
          result.status === "replaced"
        ) {
          return;
        }

        const mergedThumbnails = mergeRenderedThumbnails(
          renderedThumbnailsRef.current,
          effectiveSlides,
          result.value,
        );
        renderedThumbnailsRef.current = mergedThumbnails;
        parsedThumbnailsRef.current = parseRenderedThumbnails(
          mergedThumbnails,
          parsedThumbnailsRef.current,
        );
        setThumbnails(toSvgElementMap(mergedThumbnails, parsedThumbnailsRef.current, slides));
      } catch (error) {
        if (requestVersionRef.current !== requestVersion) {
          return;
        }
        console.error("Failed to generate slide thumbnails:", error);
      }
    }, debounceMs);

    return cancelPendingWork;
  }, [currentSlideIndex, debounceMs, draftOverride, enabled, slides]);

  return thumbnails;
}
