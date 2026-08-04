import { useMemo, useState, type DragEvent } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import {
  ChevronsDown,
  ChevronsUp,
  Ellipsis,
  FilePlus2,
  FolderPlus,
  RefreshCw,
} from "lucide-react";
import type { DocumentStatus, WorkspaceEntry } from "../types";
import { getCreatableFileTypeDefinitions } from "../lib/fileTypeRegistry";
import { projectVisibleWorkspaceRows } from "../lib/workspaceState";
import { WORKSPACE_DRAG_MIME, type WorkspaceDropRequest } from "../lib/workspaceOrdering";
import { WorkspaceResourceRow } from "./WorkspaceResourceRow";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/DropdownMenu";
import { ToolbarAction } from "./ui/ToolbarAction";
import { TooltipProvider } from "./ui/Tooltip";

interface WorkspaceExplorerProps {
  rootName: string;
  entries: WorkspaceEntry[];
  selectedPath?: string;
  expandedPaths: string[];
  documentIndicators?: WorkspaceDocumentIndicator[];
  readOnly?: boolean;
  onSelect: (path: string) => void;
  onOpen: (entry: WorkspaceEntry) => void;
  onCreateFolder: (parentPath: string) => Promise<WorkspaceEntry>;
  onCreateDocument: (parentPath: string, fileType: string) => Promise<WorkspaceEntry>;
  onRename: (path: string, name: string) => Promise<void>;
  onMove: (request: WorkspaceDropRequest) => Promise<void>;
  onTrash: (path: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onExpandedPathsChange: (paths: string[]) => void;
}

export interface WorkspaceDocumentIndicator {
  path: string;
  isActive: boolean;
  isProtected: boolean;
  isDirty: boolean;
  status: DocumentStatus;
}

const actionClassName = "idea-slide-panel-icon-button";
const panelIconProps = { "aria-hidden": true, size: 14, strokeWidth: 1.8 } as const;
const menuIconProps = { "aria-hidden": true, size: 14, strokeWidth: 1.8 } as const;

function parentPath(path: string): string {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
}

export function WorkspaceExplorer({
  rootName,
  entries,
  selectedPath,
  expandedPaths,
  documentIndicators = [],
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
  const [rootDropActive, setRootDropActive] = useState(false);
  const expanded = useMemo(() => new Set(expandedPaths), [expandedPaths]);
  const visibleRows = useMemo(() => projectVisibleWorkspaceRows(entries, expanded), [entries, expanded]);
  const creatableTypes = useMemo(() => getCreatableFileTypeDefinitions(), []);
  const indicatorByPath = useMemo(
    () => new Map(documentIndicators.map((indicator) => [indicator.path, indicator])),
    [documentIndicators],
  );

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
  const collapseAll = () => onExpandedPathsChange([]);

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
        isDocumentActive={indicatorByPath.get(entry.path)?.isActive ?? false}
        isDocumentProtected={indicatorByPath.get(entry.path)?.isProtected ?? false}
        isDocumentDirty={indicatorByPath.get(entry.path)?.isDirty ?? false}
        documentStatus={indicatorByPath.get(entry.path)?.status}
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
        onMove={(request) => void onMove(request)}
      />
    </div>
  ));

  return (
    <TooltipProvider>
      <aside className="idea-slide-side-panel flex h-full min-w-0 flex-col" aria-label="Workspace Explorer">
        <div className="idea-slide-side-panel__header flex items-center gap-0.5 px-2" aria-label="Workspace actions">
          <span className="min-w-0 flex-1 truncate px-1 text-xs font-semibold text-gray-700" title={rootName}>{rootName}</span>
          {!readOnly && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <span className="inline-flex">
                    <ToolbarAction tooltip="New File" aria-label="New File" className={actionClassName}>
                      <FilePlus2 {...panelIconProps} />
                    </ToolbarAction>
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {creatableTypes.map((definition) => (
                    <DropdownMenuItem key={definition.type} onSelect={() => void createDocument(definition.type)}>
                      New {definition.displayName} (.{definition.extensions[0]})
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <ToolbarAction
                tooltip="New Folder"
                aria-label="New Folder"
                className={actionClassName}
                onClick={() => void createFolder()}
              >
                <FolderPlus {...panelIconProps} />
              </ToolbarAction>
              <span className="idea-slide-panel-action-separator" aria-hidden="true" />
            </>
          )}
          <ToolbarAction
            tooltip="Refresh Workspace"
            aria-label="Refresh Workspace"
            className={actionClassName}
            onClick={() => void onRefresh()}
          >
            <RefreshCw {...panelIconProps} />
          </ToolbarAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <span className="inline-flex">
                <ToolbarAction
                  tooltip="Workspace Tree Actions"
                  aria-label="Workspace Tree Actions"
                  className={actionClassName}
                >
                  <Ellipsis {...panelIconProps} />
                </ToolbarAction>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onSelect={expandAll}>
                <ChevronsDown {...menuIconProps} />
                <span>Expand all</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={collapseAll}>
                <ChevronsUp {...menuIconProps} />
                <span>Collapse all</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div role="tree" className="idea-slide-side-panel__scroll min-h-0 flex-1 overflow-y-auto py-2">
          {entries.length > 0 ? renderEntries() : (
            <div className="px-4 py-8 text-center text-xs leading-5 text-gray-400">This Workspace is empty.</div>
          )}
          {!readOnly && (
            <div
              className={`idea-slide-resource-root-drop ${rootDropActive ? "is-active" : ""}`}
              aria-label="Move to Workspace root"
              onDragOver={(event: DragEvent<HTMLDivElement>) => {
                if (event.dataTransfer.types.includes(WORKSPACE_DRAG_MIME)) {
                  event.preventDefault();
                  setRootDropActive(true);
                }
              }}
              onDragLeave={() => setRootDropActive(false)}
              onDrop={(event: DragEvent<HTMLDivElement>) => {
                event.preventDefault();
                event.stopPropagation();
                const sourcePath = event.dataTransfer.getData(WORKSPACE_DRAG_MIME);
                if (sourcePath) void onMove({ sourcePath, position: "inside" });
                setRootDropActive(false);
              }}
            />
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
