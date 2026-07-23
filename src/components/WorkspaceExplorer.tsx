import { useMemo, useState } from "react";
import type { WorkspaceResource } from "../types";
import { getCreatableResourceTypeDefinitions } from "../lib/resourceTypeRegistry";
import { WorkspaceResourceRow } from "./WorkspaceResourceRow";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/DropdownMenu";

interface WorkspaceExplorerProps {
  resources: WorkspaceResource[];
  activeResourceId: string;
  readOnly?: boolean;
  onSelect: (resourceId: string) => void;
  onAdd: (resourceType: string, parentId: string | null) => string;
  onRename: (resourceId: string, name: string) => void;
  onMove: (resourceId: string, parentId: string | null, index: number) => void;
  onDelete: (resourceId: string) => void;
}

const actionClassName =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 outline-none transition-colors hover:bg-gray-200 hover:text-gray-800 focus-visible:ring-2 focus-visible:ring-blue-300 disabled:pointer-events-none disabled:opacity-40";

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
  const [renameResourceId, setRenameResourceId] = useState<string>();
  const creatableResourceTypes = useMemo(
    () => getCreatableResourceTypeDefinitions(),
    [],
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
  const createParentId = activeResource?.type === "folder"
    ? activeResource.id
    : activeResource?.parentId ?? null;

  const toggleExpanded = (resourceId: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(resourceId)) next.delete(resourceId);
      else next.add(resourceId);
      return next;
    });
  };

  const createResource = (resourceType: string) => {
    const createdResourceId = onAdd(resourceType, createParentId);
    setRenameResourceId(createdResourceId);
    if (createParentId) {
      setExpandedIds((previous) => new Set(previous).add(createParentId));
    }
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
            startRenaming={resource.id === renameResourceId}
            onRenameStarted={() => setRenameResourceId(undefined)}
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
      <div
        className="flex h-10 items-center gap-0.5 border-b border-gray-200 px-2"
        aria-label="Workspace actions"
      >
        {!readOnly && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="New resource" title="New resource" className={actionClassName}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                    <path d="M6 3h8l4 4v14H6V3Z" />
                    <path d="M14 3v5h5M9 14h6M12 11v6" />
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                {creatableResourceTypes.map((definition) => (
                  <DropdownMenuItem
                    key={definition.type}
                    onSelect={() => createResource(definition.type)}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                      <path d="m7 16 3-3 2 2 4-5 2 3" />
                    </svg>
                    {definition.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              aria-label="New folder"
              title="New folder"
              onClick={() => createResource("folder")}
              className={actionClassName}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <path d="M3 6h7l2 2h9v11H3V6Z" />
                <path d="M9 14h6M12 11v6" />
              </svg>
            </button>
          </>
        )}

        <button
          type="button"
          aria-label="Collapse all"
          title="Collapse all"
          onClick={() => setExpandedIds(new Set())}
          className={`${actionClassName} ml-auto`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d="m7 9 5-5 5 5M7 15l5 5 5-5" />
          </svg>
        </button>
      </div>

      <div role="tree" className="min-h-0 flex-1 overflow-y-auto py-2">
        {renderChildren(null, 0)}
      </div>
    </aside>
  );
}
