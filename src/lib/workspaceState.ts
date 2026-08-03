import type {
  ApplicationState,
  DocumentSession,
  WorkspaceEntry,
  WorkspaceSession,
} from "../types.ts";

export const WORKSPACE_STATE_SCHEMA_VERSION = 1;

export function flattenWorkspaceEntries(entries: WorkspaceEntry[]): WorkspaceEntry[] {
  const flattened: WorkspaceEntry[] = [];
  const visit = (entry: WorkspaceEntry) => {
    flattened.push(entry);
    entry.children.forEach(visit);
  };
  entries.forEach(visit);
  return flattened;
}

export interface WorkspaceVisibleRow {
  entry: WorkspaceEntry;
  depth: number;
}

export function projectVisibleWorkspaceRows(
  entries: WorkspaceEntry[],
  expandedPaths: Iterable<string>,
): WorkspaceVisibleRow[] {
  const expanded = expandedPaths instanceof Set ? expandedPaths : new Set(expandedPaths);
  const rows: WorkspaceVisibleRow[] = [];
  const visit = (items: WorkspaceEntry[], depth: number) => items.forEach((entry) => {
    rows.push({ entry, depth });
    if (entry.kind === "directory" && expanded.has(entry.path)) visit(entry.children, depth + 1);
  });
  visit(entries, 0);
  return rows;
}

export function findWorkspaceEntry(
  entries: WorkspaceEntry[],
  path: string,
): WorkspaceEntry | undefined {
  return flattenWorkspaceEntries(entries).find((entry) => entry.path === path);
}

export function restoreWorkspaceDocuments(workspace: WorkspaceSession): {
  documents: DocumentSession[];
  activePath?: string;
  skippedPaths: string[];
} {
  const persisted = workspace.metadata.state;
  if (!persisted || persisted.schemaVersion !== WORKSPACE_STATE_SCHEMA_VERSION) {
    return { documents: [], skippedPaths: [] };
  }
  const entries = new Map(flattenWorkspaceEntries(workspace.entries).map((entry) => [entry.path, entry]));
  const skippedPaths: string[] = [];
  const documents = persisted.openTabs.flatMap((path, index) => {
    const entry = entries.get(path);
    if (!entry || entry.kind !== "file") {
      skippedPaths.push(path);
      return [];
    }
    const fileType = entry.fileType ?? "unsupported";
    return [{
      id: `restored-${index}-${path}`,
      mode: "workspace" as const,
      filePath: path,
      displayName: entry.name,
      fileType,
      status: entry.fileType ? "loading" as const : "unsupported" as const,
      readOnly: workspace.readOnly || entry.readOnly,
      isDirty: false,
      revision: 0,
      sourceModified: entry.modified ?? undefined,
    }];
  });
  const activePath = documents.some((document) => document.filePath === persisted.activePath)
    ? persisted.activePath ?? undefined
    : documents[0]?.filePath;
  return { documents, activePath, skippedPaths };
}

export function createWorkspaceStateSnapshot(state: ApplicationState) {
  const workspaceDocuments = state.documents.filter((document) => document.mode === "workspace" && document.filePath);
  const active = workspaceDocuments.find((document) => document.id === state.activeSessionId);
  return {
    schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION,
    openTabs: workspaceDocuments.map((document) => document.filePath),
    activePath: active?.filePath ?? null,
    expandedPaths: state.workspace?.expandedPaths ?? [],
  };
}

export function mayPersistWorkspaceState(workspace: WorkspaceSession | undefined): boolean {
  return Boolean(workspace?.metadata.exists && !workspace.readOnly);
}
