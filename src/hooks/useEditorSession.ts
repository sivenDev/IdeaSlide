import { useCallback, useEffect, useRef, useState } from "react";
import type { Slide } from "../types";
import {
  buildEditorDraftFromSlide,
  comparePersistedDraftProjections,
  createPersistedDraftProjection,
  flushEditorDraft,
  updatePersistedDraftProjection,
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
  const initialSessionRef = useRef<{
    draft: EditorSlideDraft;
    projection: ReturnType<typeof createPersistedDraftProjection>;
    summary: ReturnType<typeof comparePersistedDraftProjections>;
  } | null>(null);
  if (initialSessionRef.current === null) {
    const initialDraft = buildEditorDraftFromSlide(page);
    const initialProjection = createPersistedDraftProjection(initialDraft);
    initialSessionRef.current = {
      draft: initialDraft,
      projection: initialProjection,
      summary: comparePersistedDraftProjections(initialProjection, initialProjection),
    };
  }
  const initialSession = initialSessionRef.current;
  const [draft, setDraft] = useState<EditorSlideDraft>(() => initialSession.draft);
  const [hasPendingCommit, setHasPendingCommit] = useState(
    () => initialSession.summary.hasPersistedChange,
  );
  const [autoSaveVersion, setAutoSaveVersion] = useState(0);
  const baseSlideRef = useRef(page);
  const documentSessionIdRef = useRef(documentSessionId);
  const draftRef = useRef(initialSession.draft);
  const changeSummaryRef = useRef(initialSession.summary);
  const baseProjectionRef = useRef(initialSession.projection);
  const liveProjectionRef = useRef(initialSession.projection);
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
    const nextProjection = createPersistedDraftProjection(nextDraft);
    const nextSummary = comparePersistedDraftProjections(nextProjection, nextProjection);
    baseSlideRef.current = page;
    documentSessionIdRef.current = documentSessionId;
    draftRef.current = nextDraft;
    baseProjectionRef.current = nextProjection;
    liveProjectionRef.current = nextProjection;
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
      const previousDraft = draftRef.current;
      const nextDraft = {
        ...previousDraft,
        elements,
        appState,
        files,
      };
      const projectionUpdate = updatePersistedDraftProjection(
        liveProjectionRef.current,
        nextDraft,
      );
      const nextProjection = projectionUpdate.projection;
      const nextSummary = comparePersistedDraftProjections(
        baseProjectionRef.current,
        nextProjection,
      );
      const persistedDraftChanged = projectionUpdate.summary.hasPersistedChange;
      const previousSummary = changeSummaryRef.current;

      draftRef.current = nextDraft;
      liveProjectionRef.current = nextProjection;
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

    const flushed = flushEditorDraft(
      baseSlideRef.current,
      draftRef.current,
      changeSummaryRef.current,
    );
    const { commitPayload } = flushed;

    if (commitPayload) {
      onCommit(documentSessionIdRef.current, baseSlideRef.current.id, commitPayload);
    }

    baseSlideRef.current = flushed.baseSlide;
    draftRef.current = flushed.draft;
    const flushedProjection = {
      ...liveProjectionRef.current,
      elements: flushed.draft.elements,
      files: flushed.draft.files,
    };
    liveProjectionRef.current = flushedProjection;
    if (commitPayload) {
      baseProjectionRef.current = flushedProjection;
    }
    changeSummaryRef.current = comparePersistedDraftProjections(
      baseProjectionRef.current,
      flushedProjection,
    );
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
  const getEditVersion = useCallback(() => editVersionRef.current, []);

  return {
    autoSaveVersion,
    draft,
    flushDraft,
    getEditVersion,
    hasPendingCommit,
    updateDraft,
  };
}
