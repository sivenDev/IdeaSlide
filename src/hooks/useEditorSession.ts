import { useCallback, useEffect, useMemo, useState } from "react";
import type { Slide } from "../types";
import {
  applySlideCommitToSlides,
  buildEditorDraftFromSlide,
  buildSlideCommitPayload,
  flushEditorDraft,
  type EditorSlideDraft,
  type SlideCommitPayload,
} from "../lib/editorSession.ts";

interface UseEditorSessionOptions {
  slide: Slide;
  slideIndex: number;
  slides: Slide[];
  onCommit: (slideIndex: number, payload: SlideCommitPayload) => void;
  onDirty: () => void;
}

export function useEditorSession({
  slide,
  slideIndex,
  slides,
  onCommit,
  onDirty,
}: UseEditorSessionOptions) {
  const [baseSlide, setBaseSlide] = useState(slide);
  const [draft, setDraft] = useState<EditorSlideDraft>(() =>
    buildEditorDraftFromSlide(slide)
  );

  useEffect(() => {
    if (slide === baseSlide && slide.id === draft.slideId) {
      return;
    }

    setBaseSlide(slide);
    setDraft(buildEditorDraftFromSlide(slide));
  }, [baseSlide, draft.slideId, slide]);

  const pendingCommit = useMemo(
    () => buildSlideCommitPayload(baseSlide, draft),
    [baseSlide, draft]
  );

  const slidesForPersistence = useMemo(
    () => applySlideCommitToSlides(slides, slideIndex, pendingCommit),
    [pendingCommit, slideIndex, slides]
  );

  const updateDraft = useCallback(
    (
      elements: readonly any[],
      appState: Partial<any>,
      files: Record<string, any>
    ) => {
      setDraft((previousDraft) => {
        const nextDraft = {
          ...previousDraft,
          elements,
          appState,
          files,
        };

        if (buildSlideCommitPayload(baseSlide, nextDraft)) {
          onDirty();
        }

        return nextDraft;
      });
    },
    [baseSlide, onDirty]
  );

  const flushDraft = useCallback(() => {
    const flushed = flushEditorDraft(baseSlide, draft);
    const { commitPayload } = flushed;
    if (!commitPayload) {
      return null;
    }

    onCommit(slideIndex, commitPayload);
    setBaseSlide(flushed.baseSlide);
    setDraft(flushed.draft);
    return commitPayload;
  }, [baseSlide, draft, onCommit, slideIndex]);

  return {
    draft,
    flushDraft,
    hasPendingCommit: pendingCommit !== null,
    pendingCommit,
    slidesForPersistence,
    updateDraft,
  };
}
