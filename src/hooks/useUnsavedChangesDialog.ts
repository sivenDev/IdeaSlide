import { useCallback, useEffect, useRef, useState } from "react";

export type UnsavedChangesDecision = "save" | "discard" | "cancel";
export type UnsavedChangesIntent = "closing" | "leaving";

export interface UnsavedChangesDialogRequest {
  fileName: string;
  intent: UnsavedChangesIntent;
}

export function useUnsavedChangesDialog() {
  const [unsavedChangesDialog, setUnsavedChangesDialog] = useState<UnsavedChangesDialogRequest>();
  const pendingResolverRef = useRef<((decision: UnsavedChangesDecision) => void) | null>(null);

  const requestUnsavedChangesDecision = useCallback((
    fileName: string,
    intent: UnsavedChangesIntent,
  ): Promise<UnsavedChangesDecision> => {
    if (pendingResolverRef.current) return Promise.resolve("cancel");

    return new Promise<UnsavedChangesDecision>((resolve) => {
      pendingResolverRef.current = resolve;
      setUnsavedChangesDialog({ fileName, intent });
    });
  }, []);

  const resolveUnsavedChangesDecision = useCallback((decision: UnsavedChangesDecision) => {
    const resolve = pendingResolverRef.current;
    if (!resolve) return;
    pendingResolverRef.current = null;
    setUnsavedChangesDialog(undefined);
    resolve(decision);
  }, []);

  useEffect(() => {
    return () => {
      const resolve = pendingResolverRef.current;
      pendingResolverRef.current = null;
      resolve?.("cancel");
    };
  }, []);

  return {
    unsavedChangesDialog,
    requestUnsavedChangesDecision,
    resolveUnsavedChangesDecision,
  };
}
