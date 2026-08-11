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
import type { DocumentStatus, WorkspaceEntry } from "../types";
import { projectVisibleWorkspaceRows } from "../lib/workspaceState";
import {
  workspaceParentPath,
  type WorkspaceDropRequest,
  type WorkspaceDropTarget,
} from "../lib/workspaceOrdering";
import { WorkspaceResourceRow } from "./WorkspaceResourceRow";

interface WorkspaceExplorerProps {
  entries: WorkspaceEntry[];
  selectedPath?: string;
  expandedPaths: string[];
  documentIndicators?: WorkspaceDocumentIndicator[];
  readOnly?: boolean;
  onSelect: (path: string) => void;
  onOpen: (entry: WorkspaceEntry) => void;
  onCreateFolder: (parentPath: string) => Promise<WorkspaceEntry>;
  onCreateDocument: (parentPath: string, fileType: string) => Promise<WorkspaceEntry | undefined>;
  onRename: (path: string, name: string) => Promise<void>;
  onMove: (request: WorkspaceDropRequest) => Promise<void>;
  onTrash: (path: string) => Promise<void>;
  onReveal: (path: string) => void;
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

function WorkspaceRootDropZone({ readOnly }: { readOnly: boolean }) {
  const rootDrop = useDroppable({
    id: "workspace-drop-root",
    data: { targetPath: "", position: "inside" },
    disabled: readOnly,
  });
  return (
    <div
      ref={rootDrop.setNodeRef}
      aria-label="Move to Workspace root"
      data-workspace-root="true"
      className={`idea-slide-workspace-root-drop ${rootDrop.isOver ? "is-drop-inside" : ""}`}
    />
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
  onReveal,
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
  const indicatorByPath = useMemo(
    () => new Map(documentIndicators.map((indicator) => [indicator.path, indicator])),
    [documentIndicators],
  );

  const setExpanded = (next: Set<string>) => onExpandedPathsChange(Array.from(next));
  const toggleExpanded = (path: string) => {
    const next = new Set(expanded);
    if (next.has(path)) next.delete(path); else next.add(path);
    setExpanded(next);
  };
  const createFolder = async (parentPath: string) => {
    const entry = await onCreateFolder(parentPath);
    setRenamePath(entry.path);
    if (parentPath) setExpanded(new Set(expanded).add(parentPath));
  };
  const createDocument = async (parentPath: string, fileType: string) => {
    const entry = await onCreateDocument(parentPath, fileType);
    if (!entry) return;
    setRenamePath(entry.path);
    if (parentPath) setExpanded(new Set(expanded).add(parentPath));
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
        onReveal={() => onReveal(entry.path)}
        onCreateFolder={() => void createFolder(entry.path)}
        onCreateDocument={(fileType) => void createDocument(entry.path, fileType)}
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
      <div className="idea-slide-workspace-tree" aria-label="Workspace Explorer">
        <WorkspaceRootDropZone readOnly={readOnly} />
        <div role="tree" aria-label="Workspace resources">
          {entries.length > 0 ? renderEntries() : (
            <div className="px-3 py-4 text-xs leading-5 text-gray-400">This Workspace is empty.</div>
          )}
        </div>
        <button className="idea-slide-workspace-refresh" type="button" onClick={() => void onRefresh()}>Refresh</button>
      </div>
    </DndContext>
  );
}
