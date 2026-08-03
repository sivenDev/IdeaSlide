import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
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
import type { WorkspaceEntry } from "../types";
import { Input } from "./ui/Input";

const entryIconProps = { "aria-hidden": true, size: 15, strokeWidth: 1.8 } as const;
const chevronIconProps = { "aria-hidden": true, size: 13, strokeWidth: 2 } as const;
const rowActionIconProps = { "aria-hidden": true, size: 13, strokeWidth: 1.9 } as const;

interface WorkspaceResourceRowProps {
  entry: WorkspaceEntry;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  startRenaming?: boolean;
  readOnly?: boolean;
  onRenameStarted?: () => void;
  onSelect: () => void;
  onOpen: () => void;
  onToggleExpanded: () => void;
  onRename: (name: string) => void;
  onTrash: () => void;
  onMove: (sourcePath: string, destinationParentPath: string) => void;
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
  startRenaming = false,
  readOnly = false,
  onRenameStarted,
  onSelect,
  onOpen,
  onToggleExpanded,
  onRename,
  onTrash,
  onMove,
}: WorkspaceResourceRowProps) {
  const canMutate = !readOnly && !entry.readOnly && entry.kind !== "symlink";
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(entry.name);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const destinationParentPath = entry.kind === "directory"
    ? entry.path
    : entry.path.includes("/") ? entry.path.slice(0, entry.path.lastIndexOf("/")) : "";

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const sourcePath = event.dataTransfer.getData("application/x-ideanote-path");
    if (sourcePath && sourcePath !== entry.path) onMove(sourcePath, destinationParentPath);
  };

  return (
    <div
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={entry.kind === "directory" ? isExpanded : undefined}
      tabIndex={0}
      draggable={canMutate}
      className={`idea-slide-resource-row group ${isSelected ? "is-active" : ""}`}
      style={{ paddingLeft: 7 + depth * 15 }}
      onClick={() => {
        onSelect();
        if (entry.kind === "file") onOpen();
      }}
      onDoubleClick={() => entry.kind === "directory" && onToggleExpanded()}
      onKeyDown={handleKeyDown}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/x-ideanote-path", entry.path);
      }}
      onDragOver={(event) => {
        if (entry.kind !== "symlink") event.preventDefault();
      }}
      onDrop={handleDrop}
    >
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
      {isRenaming ? (
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
      ) : (
        <span className="idea-slide-resource-name min-w-0 flex-1 truncate">{entry.name}</span>
      )}
      {entry.kind === "symlink" && <span className="text-[9px] uppercase text-gray-400">Link</span>}
      {!entry.fileType && entry.kind === "file" && <span className="text-[9px] uppercase text-gray-400">Unsupported</span>}
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
