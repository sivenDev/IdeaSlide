import { useEffect, useRef } from "react";
import { saveFile } from "../lib/tauriCommands";
import type { Slide, WorkspaceDocument } from "../types";
import { buildAutoSaveTriggerKey } from "../lib/autoSaveSignature";

interface UseAutoSaveOptions {
  filePath?: string;
  workspace: WorkspaceDocument;
  slides: Slide[];
  isDirty: boolean;
  onSaveStart: () => WorkspaceDocument | void;
  onSaveComplete: () => void;
  onSaveError: (error: Error) => void;
  debounceMs?: number;
}

export function useAutoSave({
  filePath,
  workspace,
  slides,
  isDirty,
  onSaveStart,
  onSaveComplete,
  onSaveError,
  debounceMs = 2000,
}: UseAutoSaveOptions) {
  const timeoutRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);
  const workspaceRef = useRef(workspace);
  const filePathRef = useRef(filePath);
  const onSaveStartRef = useRef(onSaveStart);
  const onSaveCompleteRef = useRef(onSaveComplete);
  const onSaveErrorRef = useRef(onSaveError);

  workspaceRef.current = workspace;
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
      const nextWorkspace = onSaveStartRef.current() ?? workspaceRef.current;

      try {
        if (!filePathRef.current) {
          return;
        }

        await saveFile(filePathRef.current, nextWorkspace);
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
