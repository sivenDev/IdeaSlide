import { useCallback, useEffect, useRef, useState } from "react";
import type { Slide } from "../types";
import {
  buildEditorDraftFromSlide,
  buildContentsForPersistence,
  createDraftChangeSummary,
  flushEditorDraft,
  type EditorSlideDraft,
  type SlideCommitPayload,
} from "../lib/editorSession.ts";

interface UseEditorSessionOptions {
  slide: Slide;
  resourceId: string;
  contents: Record<string, unknown>;
  onCommit: (resourceId: string, payload: SlideCommitPayload) => void;
  onDirty: () => void;
}

const PREVIEW_SYNC_DEBOUNCE_MS = 250;

export function useEditorSession({
  slide,
  resourceId,
  contents,
  onCommit,
  onDirty,
}: UseEditorSessionOptions) {
  const initialDraft = buildEditorDraftFromSlide(slide);
  const initialSummary = createDraftChangeSummary(slide, initialDraft);
  const [draft, setDraft] = useState<EditorSlideDraft>(initialDraft);
  const [hasPendingCommit, setHasPendingCommit] = useState(initialSummary.hasPersistedChange);
  const [autoSaveVersion, setAutoSaveVersion] = useState(0);
  const baseSlideRef = useRef(slide);
  const draftRef = useRef(initialDraft);
  const changeSummaryRef = useRef(initialSummary);
  const previewSyncTimeoutRef = useRef<number | null>(null);

  const clearPreviewSyncTimeout = useCallback(() => {
    if (previewSyncTimeoutRef.current !== null) {
      clearTimeout(previewSyncTimeoutRef.current);
      previewSyncTimeoutRef.current = null;
    }
  }, []);

  const syncPreviewDraft = useCallback(() => {
    setDraft(draftRef.current);
    setAutoSaveVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    if (slide === baseSlideRef.current && slide.id === draftRef.current.slideId) {
      return;
    }

    clearPreviewSyncTimeout();
    const nextDraft = buildEditorDraftFromSlide(slide);
    const nextSummary = createDraftChangeSummary(slide, nextDraft);
    baseSlideRef.current = slide;
    draftRef.current = nextDraft;
    changeSummaryRef.current = nextSummary;
    setDraft(nextDraft);
    setHasPendingCommit(nextSummary.hasPersistedChange);
    setAutoSaveVersion((value) => value + 1);
  }, [clearPreviewSyncTimeout, slide]);

  useEffect(() => clearPreviewSyncTimeout, [clearPreviewSyncTimeout]);

  const getContentsForPersistence = useCallback(
    () =>
      buildContentsForPersistence(
        contents,
        resourceId,
        baseSlideRef.current,
        draftRef.current,
        changeSummaryRef.current
      ),
    [contents, resourceId]
  );

  const updateDraft = useCallback(
    (
      elements: readonly any[],
      appState: Partial<any>,
      files: Record<string, any>
    ) => {
      const previousSummary = changeSummaryRef.current;
      const nextDraft = {
        ...draftRef.current,
        elements,
        appState,
        files,
      };
      const nextSummary = createDraftChangeSummary(baseSlideRef.current, nextDraft);

      draftRef.current = nextDraft;
      changeSummaryRef.current = nextSummary;
      setHasPendingCommit((previousValue) =>
        previousValue === nextSummary.hasPersistedChange ? previousValue : nextSummary.hasPersistedChange
      );

      if (!previousSummary.hasPersistedChange && nextSummary.hasPersistedChange) {
        onDirty();
      }

      clearPreviewSyncTimeout();
      previewSyncTimeoutRef.current = window.setTimeout(() => {
        previewSyncTimeoutRef.current = null;
        syncPreviewDraft();
      }, PREVIEW_SYNC_DEBOUNCE_MS);
    },
    [clearPreviewSyncTimeout, onDirty, syncPreviewDraft]
  );

  const flushDraft = useCallback(() => {
    clearPreviewSyncTimeout();

    const flushed = flushEditorDraft(baseSlideRef.current, draftRef.current);
    const { commitPayload } = flushed;

    if (commitPayload) {
      onCommit(resourceId, commitPayload);
    }

    baseSlideRef.current = flushed.baseSlide;
    draftRef.current = flushed.draft;
    changeSummaryRef.current = createDraftChangeSummary(flushed.baseSlide, flushed.draft);
    setDraft(flushed.draft);
    setHasPendingCommit(changeSummaryRef.current.hasPersistedChange);
    setAutoSaveVersion((value) => value + 1);

    return commitPayload;
  }, [clearPreviewSyncTimeout, onCommit, resourceId]);

  return {
    autoSaveVersion,
    draft,
    flushDraft,
    getContentsForPersistence,
    hasPendingCommit,
    updateDraft,
  };
}
