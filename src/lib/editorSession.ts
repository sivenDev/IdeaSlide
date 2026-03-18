import type { Slide } from "../types.ts";
import { buildSceneFingerprint } from "./sceneFingerprint.ts";

const PERSISTED_APP_STATE_KEYS = ["viewBackgroundColor", "gridSize"] as const;
const DEFAULT_VIEW_BACKGROUND_COLOR = "#ffffff";

export interface EditorSlideDraft {
  slideId: string;
  elements: readonly any[];
  appState: Partial<any>;
  files: Record<string, any>;
  baseSceneFingerprint: string;
}

export interface SlideCommitPayload {
  slide: Slide;
  contentChanged: boolean;
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
    baseSceneFingerprint: buildSceneFingerprint(slide.elements, slide.files),
  };
}

export function buildSlideCommitPayload(
  previousSlide: Slide,
  draft: EditorSlideDraft
): SlideCommitPayload | null {
  const nextAppState = extractPersistedAppState(draft.appState);
  const previousAppState = extractPersistedAppState(previousSlide.appState);
  const normalizedNextAppState = normalizePersistedAppStateForComparison(nextAppState);
  const normalizedPreviousAppState = normalizePersistedAppStateForComparison(previousAppState);
  const sceneFingerprint = buildSceneFingerprint(draft.elements, draft.files);
  const contentChanged = sceneFingerprint !== draft.baseSceneFingerprint;
  const appStateChanged =
    JSON.stringify(normalizedPreviousAppState) !== JSON.stringify(normalizedNextAppState);

  if (!contentChanged && !appStateChanged) {
    return null;
  }

  return {
    slide: {
      id: previousSlide.id,
      elements: draft.elements,
      appState: nextAppState,
      files: draft.files,
    },
    contentChanged,
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
