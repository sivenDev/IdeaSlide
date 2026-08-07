import { useEffect, useRef, useState } from "react";
import type { EditorSlideDraft } from "../lib/editorSession";
import { PageThumbnailCache } from "../lib/pageThumbnailCache";
import {
  exportPageThumbnail,
  type PageThumbnailExportResult,
} from "../lib/pageThumbnailExport";
import {
  PageThumbnailScheduler,
  type PageThumbnailDemand,
} from "../lib/pageThumbnailScheduler";
import { buildSlidePreviewKey } from "../lib/previewKeys";
import type { IdeaSketchPage } from "../types";

export const ACTIVE_PAGE_THUMBNAIL_DEBOUNCE_MS = 650;

export interface PageThumbnailView {
  pageId: string;
  renderKey: string;
  status: "loading" | "ready" | "empty" | "error";
  url?: string;
  durationMs?: number;
}

interface PageThumbnailJobMeta {
  renderKey: string;
  transient: boolean;
}

interface UsePageThumbnailsOptions {
  pages: IdeaSketchPage[];
  activePageId: string;
  activeDraft: EditorSlideDraft;
  demands: PageThumbnailDemand[];
  enabled: boolean;
  paused: boolean;
}

function sameViews(left: Map<string, PageThumbnailView>, right: Map<string, PageThumbnailView>) {
  if (left.size !== right.size) return false;
  for (const [pageId, view] of left) {
    const other = right.get(pageId);
    if (
      !other
      || other.renderKey !== view.renderKey
      || other.status !== view.status
      || other.url !== view.url
      || other.durationMs !== view.durationMs
    ) return false;
  }
  return true;
}

export function usePageThumbnails({
  pages,
  activePageId,
  activeDraft,
  demands,
  enabled,
  paused,
}: UsePageThumbnailsOptions) {
  const [thumbnails, setThumbnails] = useState<Map<string, PageThumbnailView>>(new Map());
  const [debouncedActiveDraft, setDebouncedActiveDraft] = useState(activeDraft);
  const cacheRef = useRef<PageThumbnailCache | null>(null);
  if (!cacheRef.current) cacheRef.current = new PageThumbnailCache();
  const cache = cacheRef.current;
  const schedulerRef = useRef<PageThumbnailScheduler<PageThumbnailExportResult, PageThumbnailJobMeta> | null>(null);

  if (!schedulerRef.current) {
    schedulerRef.current = new PageThumbnailScheduler({
      onResult: (job, result) => {
        const meta = job.meta;
        if (!meta) return;
        if (!result.blob) {
          setThumbnails((previous) => {
            const next = new Map(previous);
            next.set(job.pageId, {
              pageId: job.pageId,
              renderKey: meta.renderKey,
              status: "empty",
              durationMs: result.durationMs,
            });
            return next;
          });
          return;
        }
        const entry = meta.transient
          ? cache.setTransient(job.pageId, meta.renderKey, result.blob)
          : cache.setStable(job.pageId, meta.renderKey, result.blob);
        setThumbnails((previous) => {
          const next = new Map(previous);
          next.set(job.pageId, {
            pageId: job.pageId,
            renderKey: meta.renderKey,
            status: "ready",
            url: entry.url,
            durationMs: result.durationMs,
          });
          return next;
        });
      },
      onError: (job) => {
        const renderKey = job.meta?.renderKey;
        if (!renderKey) return;
        setThumbnails((previous) => {
          const next = new Map(previous);
          next.set(job.pageId, {
            pageId: job.pageId,
            renderKey,
            status: "error",
          });
          return next;
        });
      },
    });
  }
  const scheduler = schedulerRef.current;

  useEffect(() => {
    if (!enabled || activeDraft === debouncedActiveDraft) {
      if (!enabled && activeDraft !== debouncedActiveDraft) setDebouncedActiveDraft(activeDraft);
      return;
    }
    if (activeDraft.slideId !== debouncedActiveDraft.slideId) {
      setDebouncedActiveDraft(activeDraft);
      return;
    }
    const timer = window.setTimeout(
      () => setDebouncedActiveDraft(activeDraft),
      ACTIVE_PAGE_THUMBNAIL_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [activeDraft, debouncedActiveDraft, enabled]);

  useEffect(() => {
    scheduler.setPaused(paused || !enabled);
  }, [enabled, paused, scheduler]);

  useEffect(() => {
    cache.retainPages(new Set(pages.map((page) => page.id)));
    if (cache.transientEntry && cache.transientEntry.pageId !== activePageId) {
      cache.clearTransient();
    }
  }, [activePageId, cache, pages]);

  useEffect(() => {
    if (!enabled) {
      scheduler.replace([]);
      setThumbnails((previous) => previous.size === 0 ? previous : new Map());
      return;
    }

    const pagesById = new Map(pages.map((page) => [page.id, page]));
    const nextViews = new Map<string, PageThumbnailView>();
    const jobs = demands.flatMap((demand) => {
      const page = pagesById.get(demand.pageId);
      if (!page) return [];
      const transient = demand.pageId === activePageId
        && debouncedActiveDraft.slideId === demand.pageId;
      const scene = transient
        ? {
          ...page,
          elements: debouncedActiveDraft.elements,
          appState: debouncedActiveDraft.appState,
          files: debouncedActiveDraft.files,
        }
        : page;
      const renderKey = buildSlidePreviewKey(scene.elements, scene.files, scene.appState);
      const cached = transient
        ? cache.getActive(page.id, renderKey)
        : cache.getStable(page.id, renderKey);
      if (cached) {
        nextViews.set(page.id, {
          pageId: page.id,
          renderKey,
          status: "ready",
          url: cached.url,
        });
        return [];
      }
      nextViews.set(page.id, {
        pageId: page.id,
        renderKey,
        status: "loading",
      });
      return [{
        pageId: page.id,
        priority: demand.priority,
        meta: { renderKey, transient },
        run: () => exportPageThumbnail(scene),
      }];
    });

    setThumbnails((previous) => sameViews(previous, nextViews) ? previous : nextViews);
    scheduler.replace(jobs);
  }, [activePageId, cache, debouncedActiveDraft, demands, enabled, pages, scheduler]);

  useEffect(() => () => {
    scheduler.clear();
    cache.clear();
  }, [cache, scheduler]);

  return thumbnails;
}
