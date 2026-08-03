import type { DocumentSession, WorkspaceChangeEvent, WorkspaceEntry } from "../types.ts";

export type ExternalDocumentDecision =
  | { kind: "none" }
  | { kind: "modified"; status: "external-change" | "conflict"; message: string; sourceModified?: string; readOnly?: boolean }
  | { kind: "missing"; message: string }
  | { kind: "relocated"; fromPath: string; toPath: string }
  | { kind: "root-missing"; message: string }
  | { kind: "read-only"; message: string }
  | { kind: "writable" };

export interface InspectedFileState {
  exists: boolean;
  modified?: string | null;
  readOnly: boolean;
}

function pathWithin(path: string, parent: string): boolean {
  return path === parent || path.startsWith(`${parent}/`);
}

export function classifyExternalDocumentChange(document: DocumentSession, event: WorkspaceChangeEvent): ExternalDocumentDecision {
  if (document.mode !== "workspace") return { kind: "none" };
  if (event.kind === "rootMissing") {
    return { kind: "root-missing", message: "The Workspace folder is no longer available. Relocate it or save this file elsewhere." };
  }
  if (event.kind === "rename" && event.oldPath && event.newPath && pathWithin(document.filePath, event.oldPath)) {
    return {
      kind: "relocated",
      fromPath: document.filePath,
      toPath: document.filePath === event.oldPath ? event.newPath : `${event.newPath}${document.filePath.slice(event.oldPath.length)}`,
    };
  }
  if (event.kind === "remove" && event.path && pathWithin(document.filePath, event.path)) {
    return { kind: "missing", message: "This file was removed outside IdeaNote. Its in-memory content is still available." };
  }
  if ((event.kind === "modify" || event.kind === "create") && event.path === document.filePath) {
    if (event.entry?.readOnly) {
      return { kind: "read-only", message: "This file became read-only outside IdeaNote. Use Save As to keep your changes." };
    }
    if (document.status === "read-only" && document.readOnly && event.entry && !event.entry.readOnly) {
      return { kind: "writable" };
    }
    if (document.status === "missing") {
      return {
        kind: "modified",
        status: document.isDirty ? "conflict" : "external-change",
        message: document.isDirty
          ? "This file reappeared on disk while you have unsaved edits. Reload or use Save As; IdeaNote will not overwrite it silently."
          : "This file reappeared on disk. Reload it to use the restored disk version.",
        sourceModified: event.entry?.modified ?? undefined,
        readOnly: event.entry?.readOnly,
      };
    }
    if (event.entry?.modified && document.sourceModified === event.entry.modified) {
      return { kind: "none" };
    }
    return {
      kind: "modified",
      status: document.isDirty ? "conflict" : "external-change",
      message: document.isDirty
        ? "This file changed on disk while you have unsaved edits. Reload or use Save As; IdeaNote will not overwrite it silently."
        : "This file changed outside IdeaNote. Reload it to use the latest disk version.",
      sourceModified: event.entry?.modified ?? undefined,
      readOnly: event.entry?.readOnly,
    };
  }
  return { kind: "none" };
}

export function classifyInspectedDocument(
  document: DocumentSession,
  inspection: InspectedFileState,
): ExternalDocumentDecision {
  if (!inspection.exists) {
    return { kind: "missing", message: "This file is no longer available on disk. Its in-memory content is still available." };
  }
  if (inspection.readOnly) {
    return { kind: "read-only", message: "This file is read-only. Use Save As to keep your changes." };
  }
  if (document.status === "missing") {
    return {
      kind: "modified",
      status: document.isDirty ? "conflict" : "external-change",
      message: document.isDirty
        ? "This file reappeared on disk while you have unsaved edits. Reload or use Save As; IdeaNote will not overwrite it silently."
        : "This file reappeared on disk. Reload it to use the restored disk version.",
      sourceModified: inspection.modified ?? undefined,
      readOnly: false,
    };
  }
  if (document.sourceModified && inspection.modified && document.sourceModified !== inspection.modified) {
    return {
      kind: "modified",
      status: document.isDirty ? "conflict" : "external-change",
      message: document.isDirty
        ? "This file changed on disk while you have unsaved edits. Reload or use Save As; IdeaNote will not overwrite it silently."
        : "This file changed outside IdeaNote. Reload it to use the latest disk version.",
      sourceModified: inspection.modified,
      readOnly: false,
    };
  }
  if (document.status === "read-only" && document.readOnly) {
    return { kind: "writable" };
  }
  return { kind: "none" };
}

function sortEntries(entries: WorkspaceEntry[]): WorkspaceEntry[] {
  const rank = (entry: WorkspaceEntry) => entry.kind === "directory" ? 0 : entry.kind === "file" ? 1 : 2;
  return [...entries].sort((left, right) => rank(left) - rank(right)
    || left.name.toLowerCase().localeCompare(right.name.toLowerCase())
    || left.name.localeCompare(right.name));
}

function removePath(entries: WorkspaceEntry[], path: string): WorkspaceEntry[] {
  return entries
    .filter((entry) => !pathWithin(entry.path, path))
    .map((entry) => ({ ...entry, children: removePath(entry.children, path) }));
}

function insertEntry(entries: WorkspaceEntry[], entry: WorkspaceEntry): WorkspaceEntry[] {
  const parent = entry.path.includes("/") ? entry.path.slice(0, entry.path.lastIndexOf("/")) : "";
  if (!parent) return sortEntries([...entries.filter((item) => item.path !== entry.path), entry]);
  return entries.map((item) => item.path === parent
    ? { ...item, children: sortEntries([...item.children.filter((child) => child.path !== entry.path), entry]) }
    : { ...item, children: insertEntry(item.children, entry) });
}

export function applyWorkspaceTreeEvent(entries: WorkspaceEntry[], event: WorkspaceChangeEvent): WorkspaceEntry[] {
  if (event.kind === "rootMissing" || event.kind === "rootStatus") return entries;
  if (event.kind === "remove" && event.path) return removePath(entries, event.path);
  if (event.kind === "rename" && event.oldPath) {
    const removed = removePath(entries, event.oldPath);
    return event.entry ? insertEntry(removed, event.entry) : removed;
  }
  if ((event.kind === "create" || event.kind === "modify") && event.path) {
    const removed = removePath(entries, event.path);
    return event.entry ? insertEntry(removed, event.entry) : removed;
  }
  return entries;
}
