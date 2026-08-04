import { useCallback, useEffect, useRef, useState } from "react";
import type { Slide } from "../types";
import {
  buildEditorDraftFromSlide,
  createDraftChangeSummary,
  flushEditorDraft,
  type EditorSlideDraft,
  type SlideCommitPayload,
} from "../lib/editorSession.ts";

interface UseEditorSessionOptions {
  documentSessionId: string;
  page: Slide;
  onCommit: (documentSessionId: string, pageId: string, payload: SlideCommitPayload) => void;
  onDirty: () => void;
}

const PREVIEW_SYNC_DEBOUNCE_MS = 250;

export function useEditorSession({
  documentSessionId,
  page,
  onCommit,
  onDirty,
}: UseEditorSessionOptions) {
  const initialDraft = buildEditorDraftFromSlide(page);
  const initialSummary = createDraftChangeSummary(page, initialDraft);
  const [draft, setDraft] = useState<EditorSlideDraft>(initialDraft);
  const [hasPendingCommit, setHasPendingCommit] = useState(initialSummary.hasPersistedChange);
  const [autoSaveVersion, setAutoSaveVersion] = useState(0);
  const baseSlideRef = useRef(page);
  const documentSessionIdRef = useRef(documentSessionId);
  const draftRef = useRef(initialDraft);
  const changeSummaryRef = useRef(initialSummary);
  const editVersionRef = useRef(0);
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
    if (page === baseSlideRef.current && page.id === draftRef.current.slideId && documentSessionId === documentSessionIdRef.current) {
      return;
    }

    clearPreviewSyncTimeout();
    const nextDraft = buildEditorDraftFromSlide(page);
    const nextSummary = createDraftChangeSummary(page, nextDraft);
    baseSlideRef.current = page;
    documentSessionIdRef.current = documentSessionId;
    draftRef.current = nextDraft;
    editVersionRef.current += 1;
    changeSummaryRef.current = nextSummary;
    setDraft(nextDraft);
    setHasPendingCommit(nextSummary.hasPersistedChange);
    setAutoSaveVersion((value) => value + 1);
  }, [clearPreviewSyncTimeout, documentSessionId, page]);

  useEffect(() => clearPreviewSyncTimeout, [clearPreviewSyncTimeout]);

  const updateDraft = useCallback(
    (
      elements: readonly any[],
      appState: Partial<any>,
      files: Record<string, any>
    ) => {
      const previousSummary = changeSummaryRef.current;
      const previousDraft = draftRef.current;
      const nextDraft = {
        ...previousDraft,
        elements,
        appState,
        files,
      };
      const nextSummary = createDraftChangeSummary(baseSlideRef.current, nextDraft);
      const persistedDraftChanged = createDraftChangeSummary(previousDraft, nextDraft).hasPersistedChange;

      draftRef.current = nextDraft;
      changeSummaryRef.current = nextSummary;
      setHasPendingCommit((previousValue) =>
        previousValue === nextSummary.hasPersistedChange ? previousValue : nextSummary.hasPersistedChange
      );

      if (!previousSummary.hasPersistedChange && nextSummary.hasPersistedChange) {
        onDirty();
      }

      if (persistedDraftChanged) {
        editVersionRef.current += 1;
        clearPreviewSyncTimeout();
        previewSyncTimeoutRef.current = window.setTimeout(() => {
          previewSyncTimeoutRef.current = null;
          syncPreviewDraft();
        }, PREVIEW_SYNC_DEBOUNCE_MS);
      }
    },
    [clearPreviewSyncTimeout, onDirty, syncPreviewDraft]
  );

  const flushDraft = useCallback(() => {
    clearPreviewSyncTimeout();

    const flushed = flushEditorDraft(baseSlideRef.current, draftRef.current);
    const { commitPayload } = flushed;

    if (commitPayload) {
      onCommit(documentSessionIdRef.current, baseSlideRef.current.id, commitPayload);
    }

    baseSlideRef.current = flushed.baseSlide;
    draftRef.current = flushed.draft;
    changeSummaryRef.current = createDraftChangeSummary(flushed.baseSlide, flushed.draft);
    setDraft(flushed.draft);
    setHasPendingCommit(changeSummaryRef.current.hasPersistedChange);
    return commitPayload;
  }, [clearPreviewSyncTimeout, onCommit]);

  const flushDraftRef = useRef(flushDraft);
  useEffect(() => {
    flushDraftRef.current = flushDraft;
  }, [flushDraft]);
  useEffect(() => () => {
    flushDraftRef.current();
  }, []);

  return {
    autoSaveVersion,
    draft,
    flushDraft,
    getEditVersion: () => editVersionRef.current,
    hasPendingCommit,
    updateDraft,
  };
}
