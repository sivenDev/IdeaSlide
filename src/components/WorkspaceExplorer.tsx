import { useMemo, useState } from "react";
import type { WorkspaceResource } from "../types";
import { WorkspaceResourceRow } from "./WorkspaceResourceRow";

interface WorkspaceExplorerProps {
  resources: WorkspaceResource[];
  activeResourceId: string;
  readOnly?: boolean;
  onSelect: (resourceId: string) => void;
  onAdd: (resourceType: "folder" | "canvas", parentId: string | null) => void;
  onRename: (resourceId: string, name: string) => void;
  onMove: (resourceId: string, parentId: string | null, index: number) => void;
  onDelete: (resourceId: string) => void;
}

export function WorkspaceExplorer({
  resources,
  activeResourceId,
  readOnly = false,
  onSelect,
  onAdd,
  onRename,
  onMove,
  onDelete,
}: WorkspaceExplorerProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(resources.filter((resource) => resource.type === "folder").map((resource) => resource.id)),
  );
  const childrenByParent = useMemo(() => {
    const result = new Map<string | null, WorkspaceResource[]>();
    for (const resource of resources) {
      const siblings = result.get(resource.parentId) ?? [];
      siblings.push(resource);
      result.set(resource.parentId, siblings);
    }
    for (const siblings of result.values()) {
      siblings.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
    }
    return result;
  }, [resources]);

  const activeResource = resources.find((resource) => resource.id === activeResourceId);
  const createParentId = activeResource?.type === "folder" ? activeResource.id : activeResource?.parentId ?? null;

  const toggleExpanded = (resourceId: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(resourceId)) next.delete(resourceId);
      else next.add(resourceId);
      return next;
    });
  };

  const renderChildren = (parentId: string | null, depth: number): React.ReactNode =>
    (childrenByParent.get(parentId) ?? []).map((resource) => {
      const children = childrenByParent.get(resource.id) ?? [];
      const isExpanded = expandedIds.has(resource.id);
      return (
        <div key={resource.id}>
          <WorkspaceResourceRow
            resource={resource}
            depth={depth}
            isActive={resource.id === activeResourceId}
            isExpanded={isExpanded}
            hasChildren={children.length > 0}
            readOnly={readOnly}
            onSelect={() => onSelect(resource.id)}
            onToggleExpanded={() => toggleExpanded(resource.id)}
            onRename={(name) => onRename(resource.id, name)}
            onDelete={() => onDelete(resource.id)}
            onDropResource={(resourceId, target) => {
              const parent = target.type === "folder" ? target.id : target.parentId;
              const index = target.type === "folder" ? children.length : target.order;
              onMove(resourceId, parent, index);
              if (target.type === "folder") {
                setExpandedIds((previous) => new Set(previous).add(target.id));
              }
            }}
          />
          {resource.type === "folder" && isExpanded && renderChildren(resource.id, depth + 1)}
        </div>
      );
    });

  return (
    <aside className="flex h-full min-w-0 flex-col bg-[#fbfbfc]" aria-label="Workspace explorer">
      <div className="flex h-11 items-center border-b border-gray-200 px-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Workspace</div>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onAdd("folder", createParentId)}
              className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
              title="New Folder"
            >
              + Folder
            </button>
            <button
              type="button"
              onClick={() => onAdd("canvas", createParentId)}
              className="rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-gray-700"
              title="New Canvas"
            >
              + Canvas
            </button>
          </div>
        )}
      </div>
      <div role="tree" className="min-h-0 flex-1 overflow-y-auto py-2">
        {renderChildren(null, 0)}
      </div>
      <div className="border-t border-gray-200 px-3 py-2 text-[11px] text-gray-400">
        Folder and Canvas · more resource types later
      </div>
    </aside>
  );
}
