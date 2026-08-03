import type { DocumentSession } from "../types.ts";

export interface SaveResult {
  sessionId: string;
  name: string;
  saved: boolean;
}

export async function saveAllDocuments(
  documents: DocumentSession[],
  save: (document: DocumentSession) => Promise<boolean>,
): Promise<SaveResult[]> {
  const results: SaveResult[] = [];
  for (const document of documents.filter((candidate) => candidate.isDirty)) {
    let saved = false;
    try { saved = await save(document); } catch { saved = false; }
    results.push({
      sessionId: document.id,
      name: document.displayName || document.filePath || "Untitled.is",
      saved,
    });
  }
  return results;
}
