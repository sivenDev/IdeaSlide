import type { Slide } from "../types.ts";
import { buildSceneFingerprint } from "./sceneFingerprint.ts";
import { slideToCanvasContent } from "./workspaceResources.ts";

const PERSISTED_APP_STATE_KEYS = [
  "viewBackgroundColor",
  "gridSize",
  "scrollX",
  "scrollY",
  "zoom",
] as const;
const SAVE_TRIGGER_APP_STATE_KEYS = [
  "viewBackgroundColor",
  "gridSize",
] as const;
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

export interface PersistedDraftProjection {
  elements: readonly any[];
  files: Record<string, any>;
  sceneFingerprint: string;
  appStateFingerprint: string;
}

export interface PersistedDraftProjectionUpdate {
  projection: PersistedDraftProjection;
  sceneFingerprintComputed: boolean;
  summary: DraftChangeSummary;
}

function extractAppStateKeys(
  appState: Partial<any> | undefined,
  keys: readonly string[],
) {
  const persisted: Partial<any> = {};

  if (!appState) {
    return persisted;
  }

  for (const key of keys) {
    if (appState[key] !== undefined) {
      persisted[key] = appState[key];
    }
  }

  return persisted;
}

export function extractPersistedAppState(appState: Partial<any> | undefined) {
  return extractAppStateKeys(appState, PERSISTED_APP_STATE_KEYS);
}

function extractSaveTriggerAppState(appState: Partial<any> | undefined) {
  return extractAppStateKeys(appState, SAVE_TRIGGER_APP_STATE_KEYS);
}

function normalizePersistedAppStateForComparison(appState: Partial<any>) {
  const normalized = { ...appState };

  if (normalized.viewBackgroundColor === DEFAULT_VIEW_BACKGROUND_COLOR) {
    delete normalized.viewBackgroundColor;
  }

  return normalized;
}

function buildSaveTriggerAppStateFingerprint(appState: Partial<any> | undefined) {
  return JSON.stringify(
    normalizePersistedAppStateForComparison(extractSaveTriggerAppState(appState)),
  );
}

export function createPersistedDraftProjection(
  draftLike: Pick<EditorSlideDraft, "elements" | "appState" | "files">,
): PersistedDraftProjection {
  return {
    elements: draftLike.elements,
    files: draftLike.files,
    sceneFingerprint: buildSceneFingerprint(draftLike.elements, draftLike.files),
    appStateFingerprint: buildSaveTriggerAppStateFingerprint(draftLike.appState),
  };
}

export function comparePersistedDraftProjections(
  previous: PersistedDraftProjection,
  next: PersistedDraftProjection,
): DraftChangeSummary {
  const contentChanged = previous.sceneFingerprint !== next.sceneFingerprint;
  const appStateChanged = previous.appStateFingerprint !== next.appStateFingerprint;

  return {
    contentChanged,
    appStateChanged,
    hasPersistedChange: contentChanged || appStateChanged,
  };
}

export function updatePersistedDraftProjection(
  previous: PersistedDraftProjection,
  nextDraftLike: Pick<EditorSlideDraft, "elements" | "appState" | "files">,
): PersistedDraftProjectionUpdate {
  const sceneIdentityUnchanged =
    previous.elements === nextDraftLike.elements && previous.files === nextDraftLike.files;
  const projection: PersistedDraftProjection = {
    elements: nextDraftLike.elements,
    files: nextDraftLike.files,
    sceneFingerprint: sceneIdentityUnchanged
      ? previous.sceneFingerprint
      : buildSceneFingerprint(nextDraftLike.elements, nextDraftLike.files),
    appStateFingerprint: buildSaveTriggerAppStateFingerprint(nextDraftLike.appState),
  };

  return {
    projection,
    sceneFingerprintComputed: !sceneIdentityUnchanged,
    summary: comparePersistedDraftProjections(previous, projection),
  };
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
  previousDraftLike: Pick<EditorSlideDraft, "elements" | "appState" | "files">,
  nextDraftLike: Pick<EditorSlideDraft, "elements" | "appState" | "files">
): DraftChangeSummary {
  return comparePersistedDraftProjections(
    createPersistedDraftProjection(previousDraftLike),
    createPersistedDraftProjection(nextDraftLike),
  );
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
      ...(previousSlide.title !== undefined ? { title: previousSlide.title } : {}),
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

export function flushEditorDraft(
  previousSlide: Slide,
  draft: EditorSlideDraft,
  summary: DraftChangeSummary = createDraftChangeSummary(previousSlide, draft),
) {
  const commitPayload = buildSlideCommitPayload(previousSlide, draft, summary);
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
