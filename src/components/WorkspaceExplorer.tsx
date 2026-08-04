import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import {
  ChevronsDown,
  ChevronsUp,
  Ellipsis,
  FilePlus2,
  FolderOpen,
  FolderPlus,
  RefreshCw,
} from "lucide-react";
import type { DocumentStatus, WorkspaceEntry } from "../types";
import { getCreatableFileTypeDefinitions } from "../lib/fileTypeRegistry";
import { projectVisibleWorkspaceRows } from "../lib/workspaceState";
import {
  workspaceParentPath,
  type WorkspaceDropRequest,
  type WorkspaceDropTarget,
} from "../lib/workspaceOrdering";
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

function WorkspaceRootRow({
  rootName,
  readOnly,
  children,
}: {
  rootName: string;
  readOnly: boolean;
  children: React.ReactNode;
}) {
  const rootDrop = useDroppable({
    id: "workspace-drop-root",
    data: { targetPath: "", position: "inside" },
    disabled: readOnly,
  });
  return (
    <div
      ref={rootDrop.setNodeRef}
      role="treeitem"
      aria-level={1}
      aria-expanded={true}
      data-workspace-root="true"
      className={`idea-slide-workspace-root-row ${rootDrop.isOver ? "is-drop-inside" : ""}`}
    >
      <FolderOpen {...panelIconProps} />
      <span className="min-w-0 flex-1 truncate" title={rootName}>{rootName}</span>
      {children}
    </div>
  );
}

const workspaceCollisionDetection: CollisionDetection = (args) => {
  const sourcePath = args.active.data.current?.sourcePath;
  if (typeof sourcePath !== "string") return [];
  const currentParentPath = workspaceParentPath(sourcePath);
  const droppableContainers = args.droppableContainers.filter((container) => {
    const target = container.data.current as WorkspaceDropTarget | undefined;
    const targetPath = target?.targetPath ?? "";
    return target?.position === "inside"
      && targetPath !== currentParentPath
      && targetPath !== sourcePath
      && !targetPath.startsWith(`${sourcePath}/`);
  });
  const narrowedArgs = { ...args, droppableContainers };
  return args.pointerCoordinates
    ? pointerWithin(narrowedArgs)
    : closestCenter(narrowedArgs);
};

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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );
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
        depth={depth + 1}
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
      />
    </div>
  ));

  const handleDragEnd = (event: DragEndEvent) => {
    const sourcePath = event.active.data.current?.sourcePath;
    const target = event.over?.data.current as WorkspaceDropTarget | undefined;
    if (typeof sourcePath !== "string" || target?.position !== "inside") return;
    if (workspaceParentPath(sourcePath) === (target.targetPath ?? "")) return;
    void onMove({ sourcePath, targetPath: target.targetPath, position: target.position });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={workspaceCollisionDetection}
      onDragEnd={handleDragEnd}
    >
      <TooltipProvider>
        <aside className="idea-slide-side-panel flex h-full min-w-0 flex-col" aria-label="Workspace Explorer">
          <div role="tree" aria-label="Workspace resources" className="idea-slide-side-panel__scroll min-h-0 flex-1 overflow-y-auto py-2">
            <WorkspaceRootRow rootName={rootName} readOnly={readOnly}>
              <div className="idea-slide-workspace-root-actions" aria-label="Workspace actions">
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
            </WorkspaceRootRow>
            {entries.length > 0 ? renderEntries() : (
              <div className="px-7 py-6 text-xs leading-5 text-gray-400">This Workspace is empty.</div>
            )}
          </div>
        </aside>
      </TooltipProvider>
    </DndContext>
  );
}
