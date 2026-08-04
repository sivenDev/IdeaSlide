import type { WorkspaceEntry } from "../types.ts";

export type WorkspaceDropPosition = "before" | "inside" | "after";

export interface WorkspaceDropTarget {
  targetPath?: string;
  position: WorkspaceDropPosition;
}

export interface WorkspaceDropRequest extends WorkspaceDropTarget {
  sourcePath: string;
}

export interface WorkspaceDropProjection {
  entries: WorkspaceEntry[];
  entryOrder: string[];
  destinationParentPath: string;
  movedPath: string;
  changed: boolean;
}

export function workspaceParentPath(path: string): string {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
}

function workspaceBasename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function pathWithin(path: string, parent: string): boolean {
  return path === parent || path.startsWith(`${parent}/`);
}

export function flattenWorkspaceEntryOrder(entries: WorkspaceEntry[]): string[] {
  const paths: string[] = [];
  const visit = (items: WorkspaceEntry[]) => items.forEach((entry) => {
    paths.push(entry.path);
    visit(entry.children);
  });
  visit(entries);
  return paths;
}

export function applyWorkspaceEntryOrder(
  entries: WorkspaceEntry[],
  entryOrder: readonly string[],
): WorkspaceEntry[] {
  if (entryOrder.length === 0) return entries;
  const indexByPath = new Map(entryOrder.map((path, index) => [path, index]));
  const orderItems = (items: WorkspaceEntry[]): WorkspaceEntry[] => items
    .map((entry) => ({ ...entry, children: orderItems(entry.children) }))
    .map((entry, originalIndex) => ({ entry, originalIndex }))
    .sort((left, right) => {
      const leftIndex = indexByPath.get(left.entry.path);
      const rightIndex = indexByPath.get(right.entry.path);
      if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;
      if (leftIndex !== undefined) return -1;
      if (rightIndex !== undefined) return 1;
      return left.originalIndex - right.originalIndex;
    })
    .map(({ entry }) => entry);
  return orderItems(entries);
}

export function remapWorkspaceEntryOrder(
  entryOrder: readonly string[],
  fromPath: string,
  toPath: string,
): string[] {
  return entryOrder.map((path) => path === fromPath
    ? toPath
    : path.startsWith(`${fromPath}/`) ? `${toPath}${path.slice(fromPath.length)}` : path);
}

function findEntry(entries: WorkspaceEntry[], path: string): WorkspaceEntry | undefined {
  for (const entry of entries) {
    if (entry.path === path) return entry;
    const nested = findEntry(entry.children, path);
    if (nested) return nested;
  }
  return undefined;
}

function takeEntry(
  entries: WorkspaceEntry[],
  path: string,
): { entries: WorkspaceEntry[]; entry?: WorkspaceEntry } {
  let taken: WorkspaceEntry | undefined;
  const next: WorkspaceEntry[] = [];
  for (const entry of entries) {
    if (!taken && entry.path === path) {
      taken = entry;
      continue;
    }
    if (!taken) {
      const nested = takeEntry(entry.children, path);
      if (nested.entry) {
        taken = nested.entry;
        next.push({ ...entry, children: nested.entries });
        continue;
      }
    }
    next.push(entry);
  }
  return { entries: next, entry: taken };
}

function childrenForParent(entries: WorkspaceEntry[], parentPath: string): WorkspaceEntry[] | undefined {
  if (!parentPath) return entries;
  return findEntry(entries, parentPath)?.children;
}

function insertIntoParent(
  entries: WorkspaceEntry[],
  parentPath: string,
  entry: WorkspaceEntry,
  index: number,
): WorkspaceEntry[] | undefined {
  if (!parentPath) {
    const next = [...entries];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, entry);
    return next;
  }
  let inserted = false;
  const next = entries.map((item) => {
    if (item.path === parentPath && item.kind === "directory") {
      const children = [...item.children];
      children.splice(Math.max(0, Math.min(index, children.length)), 0, entry);
      inserted = true;
      return { ...item, children };
    }
    const children = insertIntoParent(item.children, parentPath, entry, index);
    if (!inserted && children) {
      inserted = true;
      return { ...item, children };
    }
    return item;
  });
  return inserted ? next : undefined;
}

function remapEntryPaths(entry: WorkspaceEntry, fromPath: string, toPath: string): WorkspaceEntry {
  const path = entry.path === fromPath
    ? toPath
    : entry.path.startsWith(`${fromPath}/`) ? `${toPath}${entry.path.slice(fromPath.length)}` : entry.path;
  return {
    ...entry,
    path,
    children: entry.children.map((child) => remapEntryPaths(child, fromPath, toPath)),
  };
}

export function projectWorkspaceEntryDrop(
  entries: WorkspaceEntry[],
  request: WorkspaceDropRequest,
): WorkspaceDropProjection {
  const unchanged = (destinationParentPath = workspaceParentPath(request.sourcePath)): WorkspaceDropProjection => ({
    entries,
    entryOrder: flattenWorkspaceEntryOrder(entries),
    destinationParentPath,
    movedPath: request.sourcePath,
    changed: false,
  });
  const source = findEntry(entries, request.sourcePath);
  if (!source || request.targetPath === request.sourcePath) return unchanged();
  if (source.readOnly || source.kind === "symlink") return unchanged();
  if (request.targetPath && pathWithin(request.targetPath, request.sourcePath)) return unchanged();

  const target = request.targetPath ? findEntry(entries, request.targetPath) : undefined;
  if (request.targetPath && !target) return unchanged();
  if (request.position === "inside" && target && (target.kind !== "directory" || target.readOnly)) return unchanged();

  const destinationParentPath = request.position === "inside"
    ? request.targetPath ?? ""
    : workspaceParentPath(request.targetPath ?? "");
  const taken = takeEntry(entries, request.sourcePath);
  if (!taken.entry) return unchanged(destinationParentPath);
  const siblings = childrenForParent(taken.entries, destinationParentPath);
  if (!siblings) return unchanged(destinationParentPath);

  const movedPath = destinationParentPath
    ? `${destinationParentPath}/${workspaceBasename(request.sourcePath)}`
    : workspaceBasename(request.sourcePath);
  if (siblings.some((entry) => entry.path === movedPath)) return unchanged(destinationParentPath);

  let insertIndex = siblings.length;
  if (request.position !== "inside" && request.targetPath) {
    const targetIndex = siblings.findIndex((entry) => entry.path === request.targetPath);
    if (targetIndex < 0) return unchanged(destinationParentPath);
    insertIndex = targetIndex + (request.position === "after" ? 1 : 0);
  }
  const movedEntry = remapEntryPaths(taken.entry, request.sourcePath, movedPath);
  const projected = insertIntoParent(taken.entries, destinationParentPath, movedEntry, insertIndex);
  if (!projected) return unchanged(destinationParentPath);
  const before = flattenWorkspaceEntryOrder(entries);
  const after = flattenWorkspaceEntryOrder(projected);
  const changed = before.some((path, index) => after[index] !== path);
  return {
    entries: changed ? projected : entries,
    entryOrder: changed ? after : before,
    destinationParentPath,
    movedPath,
    changed,
  };
}
