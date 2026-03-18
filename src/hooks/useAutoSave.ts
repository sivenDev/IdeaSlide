import { useEffect, useRef } from "react";
import { saveFile } from "../lib/tauriCommands";
import type { Slide } from "../types";
import { buildAutoSaveTriggerKey } from "../lib/autoSaveSignature";

interface UseAutoSaveOptions {
  filePath?: string;
  slides: Slide[];
  isDirty: boolean;
  onSaveStart: () => void;
  onSaveComplete: () => void;
  onSaveError: (error: Error) => void;
  debounceMs?: number;
}

export function useAutoSave({
  filePath,
  slides,
  isDirty,
  onSaveStart,
  onSaveComplete,
  onSaveError,
  debounceMs = 2000,
}: UseAutoSaveOptions) {
  const timeoutRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);
  const slidesRef = useRef(slides);
  const filePathRef = useRef(filePath);
  const onSaveStartRef = useRef(onSaveStart);
  const onSaveCompleteRef = useRef(onSaveComplete);
  const onSaveErrorRef = useRef(onSaveError);

  slidesRef.current = slides;
  filePathRef.current = filePath;
  onSaveStartRef.current = onSaveStart;
  onSaveCompleteRef.current = onSaveComplete;
  onSaveErrorRef.current = onSaveError;

  const triggerKey = buildAutoSaveTriggerKey({
    filePath,
    slides,
    isDirty,
    debounceMs,
  });

  useEffect(() => {
    if (!filePath || !isDirty || isSavingRef.current) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(async () => {
      timeoutRef.current = null;
      isSavingRef.current = true;
      onSaveStartRef.current();

      try {
        if (!filePathRef.current) {
          return;
        }

        await saveFile(filePathRef.current, slidesRef.current);
        onSaveCompleteRef.current();
      } catch (error) {
        onSaveErrorRef.current(error as Error);
      } finally {
        isSavingRef.current = false;
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [triggerKey, debounceMs, filePath, isDirty]);
}
