interface AutoSaveTriggerInput {
  enabled: boolean;
  sessionId: string;
  filePath?: string;
  revision: number;
  isDirty: boolean;
  debounceMs: number;
}

export function buildAutoSaveTriggerKey({
  enabled,
  sessionId,
  filePath,
  revision,
  isDirty,
  debounceMs,
}: AutoSaveTriggerInput) {
  return JSON.stringify({
    enabled,
    sessionId,
    filePath: filePath ?? "",
    revision,
    isDirty,
    debounceMs,
  });
}
