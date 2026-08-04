import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  File,
  FilePenLine,
  Folder,
  FolderOpen,
  Pencil,
  Trash2,
} from "lucide-react";
import type { DocumentStatus, WorkspaceEntry } from "../types";
import { Input } from "./ui/Input";

const entryIconProps = { "aria-hidden": true, size: 15, strokeWidth: 1.8 } as const;
const chevronIconProps = { "aria-hidden": true, size: 13, strokeWidth: 2 } as const;
const rowActionIconProps = { "aria-hidden": true, size: 13, strokeWidth: 1.9 } as const;

interface WorkspaceResourceRowProps {
  entry: WorkspaceEntry;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  isDocumentActive?: boolean;
  isDocumentProtected?: boolean;
  isDocumentDirty?: boolean;
  documentStatus?: DocumentStatus;
  startRenaming?: boolean;
  readOnly?: boolean;
  onRenameStarted?: () => void;
  onSelect: () => void;
  onOpen: () => void;
  onToggleExpanded: () => void;
  onRename: (name: string) => void;
  onTrash: () => void;
}

function documentStatusLabel(status: DocumentStatus | undefined, dirty: boolean): string {
  switch (status) {
    case "conflict": return "Conflict";
    case "missing": return "Missing";
    case "read-only": return "Read only";
    case "external-change": return "Changed on disk";
    case "root-missing": return "Workspace unavailable";
    case "error": return "Error";
    case "legacy-protected": return "Protected format";
    case "unsupported": return "Unsupported";
    case "invalid": return "Invalid file";
    default: return dirty ? "Unsaved changes" : "Protected session";
  }
}

function documentStatusClassName(status: DocumentStatus | undefined, dirty: boolean): string {
  if (["conflict", "error", "invalid", "missing", "root-missing"].includes(status ?? "")) {
    return `is-${status}`;
  }
  return dirty ? "is-dirty" : `is-${status ?? "protected"}`;
}

function EntryIcon({ entry, expanded }: { entry: WorkspaceEntry; expanded: boolean }) {
  if (entry.kind === "directory") {
    return expanded ? <FolderOpen {...entryIconProps} /> : <Folder {...entryIconProps} />;
  }
  if (entry.kind === "symlink") return <ExternalLink {...entryIconProps} />;
  return entry.fileType === "ideasketch"
    ? <FilePenLine {...entryIconProps} />
    : <File {...entryIconProps} />;
}

export function WorkspaceResourceRow({
  entry,
  depth,
  isSelected,
  isExpanded,
  isDocumentActive = false,
  isDocumentProtected = false,
  isDocumentDirty = false,
  documentStatus,
  startRenaming = false,
  readOnly = false,
  onRenameStarted,
  onSelect,
  onOpen,
  onToggleExpanded,
  onRename,
  onTrash,
}: WorkspaceResourceRowProps) {
  const isMissingEntry = documentStatus === "missing" || documentStatus === "root-missing";
  const canMutate = !readOnly && !entry.readOnly && entry.kind !== "symlink" && !isMissingEntry;
  const hasInsideDrop = !readOnly
    && !isMissingEntry
    && entry.kind === "directory"
    && !entry.readOnly;
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(entry.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const draggable = useDraggable({
    id: `workspace-entry:${entry.path}`,
    data: { sourcePath: entry.path },
    disabled: !canMutate || isRenaming,
  });
  const insideDrop = useDroppable({
    id: `workspace-drop-inside:${entry.path}`,
    data: { targetPath: entry.path, position: "inside" },
    disabled: !hasInsideDrop,
  });
  const dragStyle: CSSProperties = draggable.transform ? {
    transform: CSS.Translate.toString(draggable.transform),
    zIndex: draggable.isDragging ? 5 : undefined,
    opacity: draggable.isDragging ? 0.72 : undefined,
  } : {};

  useEffect(() => setDraftName(entry.name), [entry.name]);
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
    if (name && name !== entry.name) onRename(name);
    setDraftName(name || entry.name);
    setIsRenaming(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "F2" && canMutate) {
      event.preventDefault();
      setIsRenaming(true);
    } else if (event.key === "Enter") {
      event.preventDefault();
      entry.kind === "directory" ? onToggleExpanded() : onOpen();
    } else if (event.key === "ArrowRight" && entry.kind === "directory" && !isExpanded) {
      onToggleExpanded();
    } else if (event.key === "ArrowLeft" && entry.kind === "directory" && isExpanded) {
      onToggleExpanded();
    }
  };

  return (
    <div
      ref={draggable.setNodeRef}
      role="treeitem"
      aria-selected={isSelected}
      aria-current={isDocumentActive ? "page" : undefined}
      aria-expanded={entry.kind === "directory" ? isExpanded : undefined}
      aria-level={depth + 1}
      tabIndex={0}
      className={`idea-slide-resource-row group ${isSelected ? "is-selected" : ""} ${isDocumentActive ? "is-active" : ""} ${insideDrop.isOver ? "is-drop-inside" : ""}`}
      style={{ paddingLeft: 7 + depth * 15, ...dragStyle }}
      onKeyDown={handleKeyDown}
    >
      {hasInsideDrop && (
        <span ref={insideDrop.setNodeRef} className="idea-slide-resource-drop-zone is-inside" aria-hidden="true" />
      )}
      <button
        type="button"
        aria-label={isExpanded ? "Collapse Folder" : "Expand Folder"}
        className={`idea-slide-resource-chevron ${entry.kind !== "directory" ? "invisible" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggleExpanded();
        }}
      >
        {isExpanded
          ? <ChevronDown {...chevronIconProps} />
          : <ChevronRight {...chevronIconProps} />}
      </button>
      {isRenaming ? (
        <div className="idea-slide-resource-main is-renaming">
          <span className={`idea-slide-resource-icon ${entry.kind === "directory" ? "is-folder" : ""}`}>
            <EntryIcon entry={entry} expanded={isExpanded} />
          </span>
          <Input
            ref={inputRef}
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={commitRename}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitRename();
              if (event.key === "Escape") {
                setDraftName(entry.name);
                setIsRenaming(false);
              }
              event.stopPropagation();
            }}
          />
        </div>
      ) : (
        <button
          ref={draggable.setActivatorNodeRef}
          type="button"
          aria-label={`${entry.kind === "directory" ? "Select" : "Open"} ${entry.name}`}
          className={`idea-slide-resource-main ${canMutate ? "is-draggable" : ""}`}
          {...draggable.attributes}
          {...draggable.listeners}
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
            if (entry.kind === "file") onOpen();
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
            if (entry.kind === "directory") onToggleExpanded();
          }}
        >
          <span className={`idea-slide-resource-icon ${
            entry.kind === "directory"
              ? "is-folder"
              : entry.kind === "symlink"
                ? "is-symlink"
                : entry.fileType === "ideasketch"
                  ? "is-ideasketch"
                  : ""
          }`}>
            <EntryIcon entry={entry} expanded={isExpanded} />
          </span>
          <span className="idea-slide-resource-name min-w-0 flex-1 truncate">{entry.name}</span>
          {entry.kind === "symlink" && <span className="text-[9px] uppercase text-gray-400">Link</span>}
          {!entry.fileType && entry.kind === "file" && <span className="text-[9px] uppercase text-gray-400">Unsupported</span>}
          {isDocumentProtected && (
            <span
              className={`idea-slide-resource-status ${documentStatusClassName(documentStatus, isDocumentDirty)}`}
              title={documentStatusLabel(documentStatus, isDocumentDirty)}
              aria-label={documentStatusLabel(documentStatus, isDocumentDirty)}
            />
          )}
        </button>
      )}
      {canMutate && !isRenaming && (
        <div className="hidden items-center gap-0.5 group-hover:flex group-focus-within:flex">
          <button
            type="button"
            aria-label={`Rename ${entry.name}`}
            className="idea-slide-row-action"
            onClick={(event) => {
              event.stopPropagation();
              setIsRenaming(true);
            }}
          >
            <Pencil {...rowActionIconProps} />
          </button>
          <button
            type="button"
            aria-label={`Move ${entry.name} to Trash`}
            className="idea-slide-row-action is-danger"
            onClick={(event) => {
              event.stopPropagation();
              onTrash();
            }}
          >
            <Trash2 {...rowActionIconProps} />
          </button>
        </div>
      )}
    </div>
  );
}
