import { useMemo, useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import type { WorkspaceEntry } from "../types";
import { getCreatableFileTypeDefinitions } from "../lib/fileTypeRegistry";
import { projectVisibleWorkspaceRows } from "../lib/workspaceState";
import { WorkspaceResourceRow } from "./WorkspaceResourceRow";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/DropdownMenu";

interface WorkspaceExplorerProps {
  rootName: string;
  entries: WorkspaceEntry[];
  selectedPath?: string;
  expandedPaths: string[];
  readOnly?: boolean;
  onSelect: (path: string) => void;
  onOpen: (entry: WorkspaceEntry) => void;
  onCreateFolder: (parentPath: string) => Promise<WorkspaceEntry>;
  onCreateDocument: (parentPath: string, fileType: string) => Promise<WorkspaceEntry>;
  onRename: (path: string, name: string) => Promise<void>;
  onMove: (path: string, destinationParentPath: string) => Promise<void>;
  onTrash: (path: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onExpandedPathsChange: (paths: string[]) => void;
}

const actionClassName = "idea-slide-panel-icon-button";

function parentPath(path: string): string {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
}

export function WorkspaceExplorer({
  rootName,
  entries,
  selectedPath,
  expandedPaths,
  readOnly = false,
  onSelect,
  onOpen,
  onCreateFolder,
  onCreateDocument,
  onRename,
  onMove,
  onTrash,
  onRefresh,
  onExpandedPathsChange,
}: WorkspaceExplorerProps) {
  const [renamePath, setRenamePath] = useState<string>();
  const expanded = useMemo(() => new Set(expandedPaths), [expandedPaths]);
  const visibleRows = useMemo(() => projectVisibleWorkspaceRows(entries, expanded), [entries, expanded]);
  const creatableTypes = useMemo(() => getCreatableFileTypeDefinitions(), []);

  const selectedEntry = useMemo(() => {
    const find = (items: WorkspaceEntry[]): WorkspaceEntry | undefined => {
      for (const entry of items) {
        if (entry.path === selectedPath) return entry;
        const nested = find(entry.children);
        if (nested) return nested;
      }
      return undefined;
    };
    return find(entries);
  }, [entries, selectedPath]);
  const createParentPath = selectedEntry?.kind === "directory"
    ? selectedEntry.path
    : selectedEntry ? parentPath(selectedEntry.path) : "";

  const setExpanded = (next: Set<string>) => onExpandedPathsChange(Array.from(next));
  const toggleExpanded = (path: string) => {
    const next = new Set(expanded);
    if (next.has(path)) next.delete(path); else next.add(path);
    setExpanded(next);
  };
  const expandAll = () => {
    const paths: string[] = [];
    const visit = (items: WorkspaceEntry[]) => items.forEach((entry) => {
      if (entry.kind === "directory") paths.push(entry.path);
      visit(entry.children);
    });
    visit(entries);
    onExpandedPathsChange(paths);
  };

  const createFolder = async () => {
    const entry = await onCreateFolder(createParentPath);
    setRenamePath(entry.path);
    if (createParentPath) setExpanded(new Set(expanded).add(createParentPath));
  };
  const createDocument = async (fileType: string) => {
    const entry = await onCreateDocument(createParentPath, fileType);
    setRenamePath(entry.path);
    if (createParentPath) setExpanded(new Set(expanded).add(createParentPath));
  };

  const renderEntries = (): React.ReactNode => visibleRows.map(({ entry, depth }) => (
    <div key={entry.path}>
      <WorkspaceResourceRow
        entry={entry}
        depth={depth}
        isSelected={selectedPath === entry.path}
        isExpanded={expanded.has(entry.path)}
        readOnly={readOnly}
        startRenaming={renamePath === entry.path}
        onRenameStarted={() => setRenamePath(undefined)}
        onSelect={() => onSelect(entry.path)}
        onOpen={() => onOpen(entry)}
        onToggleExpanded={() => toggleExpanded(entry.path)}
        onRename={(name) => void onRename(entry.path, name)}
        onTrash={() => void (async () => {
          const confirmed = await ask(`Move “${entry.name}” to Trash?`, {
            title: "Move to Trash",
            kind: "warning",
            okLabel: "Move to Trash",
            cancelLabel: "Cancel",
          });
          if (confirmed) await onTrash(entry.path);
        })()}
        onMove={(sourcePath, destinationParentPath) => void onMove(sourcePath, destinationParentPath)}
      />
    </div>
  ));

  return (
    <aside className="idea-slide-side-panel flex h-full min-w-0 flex-col" aria-label="Workspace Explorer">
      <div className="idea-slide-side-panel__header flex items-center gap-0.5 px-2" aria-label="Workspace actions">
        <span className="min-w-0 flex-1 truncate px-1 text-xs font-semibold text-gray-700" title={rootName}>{rootName}</span>
        {!readOnly && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="New file" title="New file" className={actionClassName}>＋</button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {creatableTypes.map((definition) => (
                  <DropdownMenuItem key={definition.type} onSelect={() => void createDocument(definition.type)}>
                    New {definition.displayName} (.{definition.extensions[0]})
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button type="button" aria-label="New Folder" title="New Folder" className={actionClassName} onClick={() => void createFolder()}>⌑</button>
            <span className="idea-slide-panel-action-separator" aria-hidden="true" />
          </>
        )}
        <button type="button" aria-label="Refresh Workspace" title="Refresh Workspace" className={actionClassName} onClick={() => void onRefresh()}>↻</button>
        <button type="button" aria-label="Collapse all" title="Collapse all" className={actionClassName} onClick={() => onExpandedPathsChange([])}>⌃</button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="More Workspace actions" title="More" className={actionClassName}>•••</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onSelect={expandAll}>Expand all</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div role="tree" className="idea-slide-side-panel__scroll min-h-0 flex-1 overflow-y-auto py-2">
        {entries.length > 0 ? renderEntries() : (
          <div className="px-4 py-8 text-center text-xs leading-5 text-gray-400">This Workspace is empty.</div>
        )}
      </div>
    </aside>
  );
}
