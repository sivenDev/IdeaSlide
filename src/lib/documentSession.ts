import type {
  DocumentMode,
  DocumentSession,
  DocumentStatus,
} from "../types";

interface CreateDocumentSessionOptions<TModel> {
  id: string;
  mode: DocumentMode;
  filePath: string;
  fileType: string;
  model?: TModel;
  status?: DocumentStatus;
}

interface CreateProtectedDocumentSessionOptions {
  id: string;
  mode: DocumentMode;
  filePath: string;
  fileType: string;
  version: string;
  message: string;
}

export function normalizeDocumentPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  if (normalized.length > 1 && normalized.endsWith("/")) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

export function createDocumentSession<TModel>({
  id,
  mode,
  filePath,
  fileType,
  model,
  status = "editable",
}: CreateDocumentSessionOptions<TModel>): DocumentSession<TModel> {
  return {
    id,
    mode,
    filePath: normalizeDocumentPath(filePath),
    fileType,
    status,
    model,
    isDirty: false,
    revision: 0,
  };
}

export function createProtectedDocumentSession({
  id,
  mode,
  filePath,
  fileType,
  version,
  message,
}: CreateProtectedDocumentSessionOptions): DocumentSession<never> {
  return {
    ...createDocumentSession<never>({
      id,
      mode,
      filePath,
      fileType,
      status: "legacy-protected",
    }),
    protectedVersion: version,
    message,
  };
}

export function markDocumentSessionDirty<TModel>(
  session: DocumentSession<TModel>,
): DocumentSession<TModel> {
  if (session.status !== "editable") {
    throw new Error("Protected or unsupported documents cannot be marked dirty");
  }
  return {
    ...session,
    isDirty: true,
    revision: session.revision + 1,
  };
}

export function markDocumentSessionSaved<TModel>(
  session: DocumentSession<TModel>,
): DocumentSession<TModel> {
  return { ...session, isDirty: false };
}
