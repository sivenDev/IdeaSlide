import type {
  ApplicationState,
  DocumentSession,
  WorkspaceEntry,
  WorkspaceSession,
} from "../types.ts";

export const WORKSPACE_STATE_SCHEMA_VERSION = 3;
const LEGACY_WORKSPACE_STATE_SCHEMA_VERSION = 1;
const SINGLE_ACTIVE_WORKSPACE_STATE_SCHEMA_VERSION = 2;

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
  if (!persisted || ![
    LEGACY_WORKSPACE_STATE_SCHEMA_VERSION,
    SINGLE_ACTIVE_WORKSPACE_STATE_SCHEMA_VERSION,
    WORKSPACE_STATE_SCHEMA_VERSION,
  ].includes(persisted.schemaVersion)) {
    return { documents: [], skippedPaths: [] };
  }
  const entries = new Map(flattenWorkspaceEntries(workspace.entries).map((entry) => [entry.path, entry]));
  const skippedPaths: string[] = [];
  const candidates = persisted.schemaVersion !== LEGACY_WORKSPACE_STATE_SCHEMA_VERSION
    ? persisted.activePath ? [persisted.activePath] : []
    : [persisted.activePath, ...(persisted.openTabs ?? [])]
        .filter((path): path is string => Boolean(path))
        .filter((path, index, paths) => paths.indexOf(path) === index);
  let restored: DocumentSession | undefined;
  for (const path of candidates) {
    const entry = entries.get(path);
    if (!entry || entry.kind !== "file") {
      skippedPaths.push(path);
      continue;
    }
    const fileType = entry.fileType ?? "unsupported";
    restored = {
      id: `restored-${path}`,
      mode: "workspace" as const,
      filePath: path,
      displayName: entry.name,
      fileType,
      status: entry.fileType ? "loading" as const : "unsupported" as const,
      readOnly: workspace.readOnly || entry.readOnly,
      isDirty: false,
      revision: 0,
      sourceModified: entry.modified ?? undefined,
    };
    break;
  }
  return {
    documents: restored ? [restored] : [],
    activePath: restored?.filePath,
    skippedPaths,
  };
}

export function createWorkspaceStateSnapshot(state: ApplicationState) {
  const active = state.documents.find((document) =>
    document.id === state.activeSessionId && document.mode === "workspace" && document.filePath,
  );
  return {
    schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION,
    activePath: active?.filePath ?? null,
    expandedPaths: state.workspace?.expandedPaths ?? [],
    entryOrder: state.workspace?.entryOrder ?? [],
  };
}

export function mayPersistWorkspaceState(workspace: WorkspaceSession | undefined): boolean {
  return Boolean(workspace && !workspace.readOnly && (workspace.metadata.exists || (workspace.entryOrder?.length ?? 0) > 0));
}
