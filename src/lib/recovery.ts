import type { DocumentModel, DocumentSession } from "../types.ts";

export const RECOVERY_SCHEMA_VERSION = 1;

export type RecoveryScope =
  | { mode: "workspace"; root: string; path: string }
  | { mode: "standalone"; path: string; sessionId: string };

export interface RecoveryDraft {
  schemaVersion: number;
  sourcePath: string;
  sourceModified?: string | null;
  timestamp: string;
  model: DocumentModel;
}

export function recoveryScopeForDocument(document: DocumentSession, workspaceRoot?: string): RecoveryScope | undefined {
  if (document.mode === "workspace") {
    return workspaceRoot ? { mode: "workspace", root: workspaceRoot, path: document.filePath } : undefined;
  }
  return { mode: "standalone", path: document.filePath, sessionId: document.id };
}

export function createRecoveryDraft(document: DocumentSession, model: DocumentModel): RecoveryDraft {
  return {
    schemaVersion: RECOVERY_SCHEMA_VERSION,
    sourcePath: document.filePath,
    sourceModified: document.sourceModified ?? null,
    timestamp: new Date().toISOString(),
    model,
  };
}

export function classifyRecoveryDraft(draft: RecoveryDraft, document: DocumentSession): "current" | "source-changed" | "invalid" {
  if (draft.schemaVersion !== RECOVERY_SCHEMA_VERSION || draft.model?.type !== "ideasketch") return "invalid";
  if (draft.sourcePath !== document.filePath) return "invalid";
  return draft.sourceModified && document.sourceModified && draft.sourceModified !== document.sourceModified
    ? "source-changed"
    : "current";
}
