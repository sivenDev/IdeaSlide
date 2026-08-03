import { useEffect, useRef } from "react";
import type { DocumentModel } from "../types";
import { buildAutoSaveTriggerKey } from "../lib/autoSaveSignature";

interface UseAutoSaveOptions {
  enabled: boolean;
  sessionId: string;
  filePath?: string;
  revision: number;
  isDirty: boolean;
  getModel: () => DocumentModel;
  getEditVersion: () => number;
  onSave: (model: DocumentModel) => Promise<void>;
  onSaveComplete: () => void;
  onSaveError: (error: Error) => void;
  debounceMs?: number;
}

export function useAutoSave({
  enabled,
  sessionId,
  filePath,
  revision,
  isDirty,
  getModel,
  getEditVersion,
  onSave,
  onSaveComplete,
  onSaveError,
  debounceMs = 2000,
}: UseAutoSaveOptions) {
  const callbacksRef = useRef({ getModel, getEditVersion, onSave, onSaveComplete, onSaveError });
  callbacksRef.current = { getModel, getEditVersion, onSave, onSaveComplete, onSaveError };
  const triggerKey = buildAutoSaveTriggerKey({ enabled, sessionId, filePath, revision, isDirty, debounceMs });
  const triggerKeyRef = useRef(triggerKey);
  triggerKeyRef.current = triggerKey;

  useEffect(() => {
    if (!enabled || !filePath || !isDirty) return;
    const scheduledKey = triggerKey;
    const timeout = window.setTimeout(async () => {
      try {
        const editVersion = callbacksRef.current.getEditVersion();
        await callbacksRef.current.onSave(callbacksRef.current.getModel());
        if (
          triggerKeyRef.current === scheduledKey
          && callbacksRef.current.getEditVersion() === editVersion
        ) callbacksRef.current.onSaveComplete();
      } catch (cause) {
        callbacksRef.current.onSaveError(cause instanceof Error ? cause : new Error(String(cause)));
      }
    }, debounceMs);
    return () => window.clearTimeout(timeout);
  }, [debounceMs, enabled, filePath, isDirty, triggerKey]);
}
