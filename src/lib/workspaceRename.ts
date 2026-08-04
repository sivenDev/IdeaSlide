import type { WorkspaceEntry } from "../types";

export function getWorkspaceRenameSelectionEnd(
  name: string,
  kind: WorkspaceEntry["kind"],
): number {
  if (kind !== "file" || name.startsWith(".")) return name.length;

  const extensionIndex = name.lastIndexOf(".");
  return extensionIndex > 0 && extensionIndex < name.length - 1
    ? extensionIndex
    : name.length;
}
