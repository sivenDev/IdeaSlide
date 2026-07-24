import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import type { WorkspaceResource } from "../types";
import { Input } from "./ui/Input";
import { getResourceTypeDefinition, isRegisteredResourceType } from "../lib/resourceTypeRegistry";

interface WorkspaceResourceRowProps {
  resource: WorkspaceResource;
  depth: number;
  isActive: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  readOnly?: boolean;
  startRenaming?: boolean;
  onRenameStarted?: () => void;
  onSelect: () => void;
  onToggleExpanded: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onDropResource: (resourceId: string, target: WorkspaceResource) => void;
}

function ResourceIcon({ type, expanded }: { type: string; expanded: boolean }) {
  const icon = getResourceTypeDefinition(type)?.icon ?? "file";
  if (icon === "folder") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d={expanded ? "M3 7h7l2 2h9l-2 10H4L3 7Z" : "M3 6h7l2 2h9v11H3V6Z"} />
      </svg>
    );
  }
  if (icon === "canvas") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="m7 16 3-3 2 2 4-5 2 3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M6 3h9l4 4v14H6V3Z" />
      <path d="M15 3v5h5" />
    </svg>
  );
}

export function WorkspaceResourceRow({
  resource,
  depth,
  isActive,
  isExpanded,
  hasChildren,
  readOnly = false,
  startRenaming = false,
  onRenameStarted,
  onSelect,
  onToggleExpanded,
  onRename,
  onDelete,
  onDropResource,
}: WorkspaceResourceRowProps) {
  const canMutate = !readOnly && isRegisteredResourceType(resource.type);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(resource.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraftName(resource.name), [resource.name]);
  useEffect(() => {
    if (!startRenaming || !canMutate) return;
    setIsRenaming(true);
    onRenameStarted?.();
  }, [canMutate, onRenameStarted, startRenaming]);
  useEffect(() => {
    if (isRenaming) inputRef.current?.select();
  }, [isRenaming]);

  const commitRename = () => {
    const name = draftName.trim();
    if (name && name !== resource.name) onRename(name);
    setDraftName(name || resource.name);
    setIsRenaming(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "F2" && canMutate) {
      event.preventDefault();
      setIsRenaming(true);
    } else if (event.key === "Enter") {
      event.preventDefault();
      onSelect();
    } else if (event.key === "ArrowRight" && resource.type === "folder" && !isExpanded) {
      onToggleExpanded();
    } else if (event.key === "ArrowLeft" && resource.type === "folder" && isExpanded) {
      onToggleExpanded();
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const resourceId = event.dataTransfer.getData("application/x-ideaslide-resource");
    if (resourceId && resourceId !== resource.id) onDropResource(resourceId, resource);
  };

  return (
    <div
      role="treeitem"
      aria-selected={isActive}
      aria-expanded={resource.type === "folder" ? isExpanded : undefined}
      tabIndex={0}
      draggable={canMutate}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/x-ideaslide-resource", resource.id);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      onDoubleClick={() => canMutate && setIsRenaming(true)}
      className={`idea-slide-resource-row group ${isActive ? "is-active" : ""}`}
      style={{ paddingLeft: 6 + depth * 16 }}
    >
      <button
        type="button"
        aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
        onClick={(event) => {
          event.stopPropagation();
          if (resource.type === "folder") onToggleExpanded();
        }}
        className={`idea-slide-resource-chevron ${
          resource.type !== "folder" || !hasChildren ? "invisible" : ""
        }`}
      >
        {isExpanded ? "⌄" : "›"}
      </button>

      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className={`idea-slide-resource-icon ${resource.type === "folder" ? "is-folder" : ""}`}>
          <ResourceIcon type={resource.type} expanded={isExpanded} />
        </span>
        {isRenaming ? (
          <Input
            ref={inputRef}
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitRename();
              if (event.key === "Escape") {
                setDraftName(resource.name);
                setIsRenaming(false);
              }
              event.stopPropagation();
            }}
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <span className="idea-slide-resource-name truncate">{resource.name}</span>
        )}
      </button>

      {canMutate && !isRenaming && (
        <div className="hidden items-center gap-0.5 group-hover:flex group-focus-within:flex">
          <button
            type="button"
            aria-label={`Rename ${resource.name}`}
            onClick={(event) => {
              event.stopPropagation();
              setIsRenaming(true);
            }}
            className="idea-slide-row-action"
          >
            ✎
          </button>
          <button
            type="button"
            aria-label={`Delete ${resource.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="idea-slide-row-action is-danger"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
