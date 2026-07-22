import type { Slide } from "../types.ts";
import { buildSceneFingerprint } from "./sceneFingerprint.ts";
import { slideToCanvasContent } from "./workspaceResources.ts";

const PERSISTED_APP_STATE_KEYS = ["viewBackgroundColor", "gridSize"] as const;
const DEFAULT_VIEW_BACKGROUND_COLOR = "#ffffff";

export interface EditorSlideDraft {
  slideId: string;
  elements: readonly any[];
  appState: Partial<any>;
  files: Record<string, any>;
}

export interface SlideCommitPayload {
  slide: Slide;
  contentChanged: boolean;
}

export interface DraftChangeSummary {
  contentChanged: boolean;
  appStateChanged: boolean;
  hasPersistedChange: boolean;
}

export function extractPersistedAppState(appState: Partial<any> | undefined) {
  const persisted: Partial<any> = {};

  if (!appState) {
    return persisted;
  }

  for (const key of PERSISTED_APP_STATE_KEYS) {
    if (appState[key] !== undefined) {
      persisted[key] = appState[key];
    }
  }

  return persisted;
}

function normalizePersistedAppStateForComparison(appState: Partial<any>) {
  const normalized = { ...appState };

  if (normalized.viewBackgroundColor === DEFAULT_VIEW_BACKGROUND_COLOR) {
    delete normalized.viewBackgroundColor;
  }

  return normalized;
}

export function buildEditorDraftFromSlide(slide: Slide): EditorSlideDraft {
  return {
    slideId: slide.id,
    elements: slide.elements,
    appState: slide.appState,
    files: slide.files,
  };
}

export function createDraftChangeSummary(
  previousSlide: Slide,
  nextDraftLike: Pick<EditorSlideDraft, "elements" | "appState" | "files">
): DraftChangeSummary {
  const previousAppState = normalizePersistedAppStateForComparison(
    extractPersistedAppState(previousSlide.appState)
  );
  const nextAppState = normalizePersistedAppStateForComparison(
    extractPersistedAppState(nextDraftLike.appState)
  );
  const previousSceneFingerprint = buildSceneFingerprint(previousSlide.elements, previousSlide.files);
  const nextSceneFingerprint = buildSceneFingerprint(nextDraftLike.elements, nextDraftLike.files);

  const contentChanged = previousSceneFingerprint !== nextSceneFingerprint;
  const appStateChanged =
    JSON.stringify(previousAppState) !== JSON.stringify(nextAppState);

  return {
    contentChanged,
    appStateChanged,
    hasPersistedChange: contentChanged || appStateChanged,
  };
}

export function buildSlideCommitPayload(
  previousSlide: Slide,
  draft: EditorSlideDraft,
  summary: DraftChangeSummary = createDraftChangeSummary(previousSlide, draft)
): SlideCommitPayload | null {
  if (!summary.hasPersistedChange) {
    return null;
  }

  return {
    slide: {
      id: previousSlide.id,
      elements: draft.elements,
      appState: extractPersistedAppState(draft.appState),
      files: draft.files,
    },
    contentChanged: summary.contentChanged,
  };
}

export function applySlideCommitToSlides(
  slides: Slide[],
  slideIndex: number,
  commitPayload: SlideCommitPayload | null
) {
  if (!commitPayload) {
    return slides;
  }

  const nextSlides = [...slides];
  nextSlides[slideIndex] = commitPayload.slide;
  return nextSlides;
}

export function applyCanvasCommitToContents(
  contents: Record<string, unknown>,
  resourceId: string,
  commitPayload: SlideCommitPayload | null,
) {
  if (!commitPayload) return contents;
  return {
    ...contents,
    [resourceId]: {
      ...((contents[resourceId] as Record<string, unknown> | undefined) ?? {}),
      ...slideToCanvasContent(commitPayload.slide),
    },
  };
}

export function buildContentsForPersistence(
  contents: Record<string, unknown>,
  resourceId: string,
  previousSlide: Slide,
  draft: EditorSlideDraft,
  summary: DraftChangeSummary = createDraftChangeSummary(previousSlide, draft),
) {
  return applyCanvasCommitToContents(
    contents,
    resourceId,
    buildSlideCommitPayload(previousSlide, draft, summary),
  );
}

export function buildSlidesForPersistence(
  slides: Slide[],
  slideIndex: number,
  previousSlide: Slide,
  draft: EditorSlideDraft,
  summary: DraftChangeSummary = createDraftChangeSummary(previousSlide, draft)
) {
  return applySlideCommitToSlides(
    slides,
    slideIndex,
    buildSlideCommitPayload(previousSlide, draft, summary)
  );
}

export function flushEditorDraft(previousSlide: Slide, draft: EditorSlideDraft) {
  const commitPayload = buildSlideCommitPayload(previousSlide, draft);
  const baseSlide = commitPayload?.slide ?? previousSlide;
  const nextDraft = buildEditorDraftFromSlide(baseSlide);

  return {
    commitPayload,
    baseSlide,
    draft: {
      ...nextDraft,
      // Preserve transient editor-only appState like selection and viewport
      // while still resetting the persisted baseline after a flush.
      appState: draft.appState,
    },
  };
}
