import type { DocumentSession } from "../types";

export type UnsavedDocumentResolution = "saved" | "discarded" | "cancelled";

export interface SequentialResolution {
  proceed: boolean;
  discarded: DocumentSession[];
}

export async function saveDirtyDocumentBeforeTransition(
  document: DocumentSession | undefined,
  save: (document: DocumentSession) => Promise<boolean>,
): Promise<boolean> {
  if (!document?.isDirty) return true;
  return save(document);
}

export async function resolveDirtyDocumentsSequentially(
  documents: DocumentSession[],
  activeSessionId: string | undefined,
  resolve: (document: DocumentSession) => Promise<UnsavedDocumentResolution>,
): Promise<SequentialResolution> {
  const dirtyDocuments = documents.filter((document) => document.isDirty);
  const ordered = activeSessionId
    ? [
      ...dirtyDocuments.filter((document) => document.id === activeSessionId),
      ...dirtyDocuments.filter((document) => document.id !== activeSessionId),
    ]
    : dirtyDocuments;
  const discarded: DocumentSession[] = [];
  for (const document of ordered) {
    const resolution = await resolve(document);
    if (resolution === "cancelled") return { proceed: false, discarded };
    if (resolution === "discarded") discarded.push(document);
  }
  return { proceed: true, discarded };
}
