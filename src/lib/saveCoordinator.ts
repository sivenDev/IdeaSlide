import type { DocumentSession } from "../types.ts";

export interface SaveResult {
  sessionId: string;
  name: string;
  saved: boolean;
}

export interface ExitSaveResult {
  kind: "none" | "single" | "batch";
  saved: boolean;
  results: SaveResult[];
}

function resultFor(document: DocumentSession, saved: boolean): SaveResult {
  return {
    sessionId: document.id,
    name: document.displayName || document.filePath || "Untitled.is",
    saved,
  };
}

export async function saveAllDocuments(
  documents: DocumentSession[],
  save: (document: DocumentSession) => Promise<boolean>,
): Promise<SaveResult[]> {
  const results: SaveResult[] = [];
  for (const document of documents.filter((candidate) => candidate.isDirty)) {
    let saved = false;
    try { saved = await save(document); } catch { saved = false; }
    results.push(resultFor(document, saved));
  }
  return results;
}

export async function saveDocumentsForExit(
  documents: DocumentSession[],
  save: (document: DocumentSession) => Promise<boolean>,
): Promise<ExitSaveResult> {
  const dirtyDocuments = documents.filter((document) => document.isDirty);
  if (dirtyDocuments.length === 0) return { kind: "none", saved: true, results: [] };
  if (dirtyDocuments.length === 1) {
    const saved = await save(dirtyDocuments[0]);
    return { kind: "single", saved, results: [resultFor(dirtyDocuments[0], saved)] };
  }
  const results = await saveAllDocuments(dirtyDocuments, save);
  return { kind: "batch", saved: results.every((result) => result.saved), results };
}
