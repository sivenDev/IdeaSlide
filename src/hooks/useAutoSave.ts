import { useEffect, useRef } from "react";
import { saveFile } from "../lib/tauriCommands";
import type { Slide } from "../types";

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

  useEffect(() => {
    if (!filePath || !isDirty || isSavingRef.current) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(async () => {
      isSavingRef.current = true;
      onSaveStart();

      try {
        await saveFile(filePath, slides);
        onSaveComplete();
      } catch (error) {
        onSaveError(error as Error);
      } finally {
        isSavingRef.current = false;
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [filePath, slides, isDirty, debounceMs, onSaveStart, onSaveComplete, onSaveError]);
}
