import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type DragEvent } from "react";
import type { IdeaSketchPage } from "../types";
import { cn } from "../lib/cn";
import { resolveListDropIndex, type ListDropPosition } from "../lib/listReorder";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/Tooltip";

interface PageOrganizerProps {
  pages: IdeaSketchPage[];
  activePageId: string;
  readOnly?: boolean;
  onSelect: (pageId: string) => void;
  onAdd: () => void;
  onRename: (pageId: string, title: string) => void;
  onReorder: (pageId: string, toIndex: number) => void;
  onDelete: (pageId: string) => void;
}

const PAGE_DRAG_MIME = "application/x-ideanote-page-id";

export function PageOrganizer({
  pages,
  activePageId,
  readOnly = false,
  onSelect,
  onAdd,
  onRename,
  onReorder,
  onDelete,
}: PageOrganizerProps) {
  const [editingPageId, setEditingPageId] = useState<string>();
  const [editingTitle, setEditingTitle] = useState("");
  const [draggingPageId, setDraggingPageId] = useState<string>();
  const [dropTarget, setDropTarget] = useState<{ pageId: string; position: ListDropPosition }>();

  const commitRename = () => {
    if (editingPageId && editingTitle.trim()) onRename(editingPageId, editingTitle);
    setEditingPageId(undefined);
  };

  const updateDropTarget = (event: DragEvent<HTMLDivElement>, pageId: string) => {
    if (readOnly || pageId === draggingPageId) return;
    if (!draggingPageId && !event.dataTransfer.types.includes(PAGE_DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const bounds = event.currentTarget.getBoundingClientRect();
    setDropTarget({ pageId, position: event.clientY < bounds.top + bounds.height / 2 ? "before" : "after" });
  };

  return (
    <section className="ideanote-page-organizer" aria-label="Pages">
      <div className="idea-slide-navigator-toolbar">
        <span className="idea-slide-navigator-toolbar__context">Current document</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onAdd}
                disabled={readOnly}
                aria-label="Add Page"
                className="idea-slide-panel-add-button"
              >
                <Plus aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Add Page</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="ideanote-page-organizer__list idea-slide-side-panel__scroll">
        {pages.map((page, index) => {
          const active = page.id === activePageId;
          const editing = page.id === editingPageId;
          return (
            <div
              key={page.id}
              draggable={!readOnly && !editing}
              onDragStart={(event) => {
                if ((event.target as HTMLElement).closest("[data-drag-ignore]")) {
                  event.preventDefault();
                  return;
                }
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(PAGE_DRAG_MIME, page.id);
                setDraggingPageId(page.id);
              }}
              onDragEnd={() => {
                setDraggingPageId(undefined);
                setDropTarget(undefined);
              }}
              onDragOver={(event) => updateDropTarget(event, page.id)}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(undefined);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const sourceId = event.dataTransfer.getData(PAGE_DRAG_MIME) || draggingPageId;
                const fromIndex = pages.findIndex((candidate) => candidate.id === sourceId);
                const position = dropTarget?.pageId === page.id ? dropTarget.position : "after";
                const toIndex = resolveListDropIndex(pages.length, fromIndex, index, position);
                if (sourceId && fromIndex >= 0 && fromIndex !== toIndex) onReorder(sourceId, toIndex);
                setDraggingPageId(undefined);
                setDropTarget(undefined);
              }}
              className={cn(
                "ideanote-page-organizer__row",
                active && "is-active",
                dropTarget?.pageId === page.id && `is-drop-${dropTarget.position}`,
              )}
            >
              {editing ? (
                <div className="ideanote-page-organizer__select">
                  <span className="ideanote-page-organizer__index">{index + 1}</span>
                  <input
                    autoFocus
                    data-drag-ignore
                    value={editingTitle}
                    aria-label={"Rename " + page.title}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    onBlur={commitRename}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") commitRename();
                      if (event.key === "Escape") setEditingPageId(undefined);
                    }}
                  />
                </div>
              ) : (
                <button type="button" className="ideanote-page-organizer__select" onClick={() => onSelect(page.id)}>
                  <span className="ideanote-page-organizer__index">{index + 1}</span>
                  <span className="truncate">{page.title}</span>
                </button>
              )}
              {!readOnly && !editing && (
                <div className="ideanote-page-organizer__actions">
                  <button
                    type="button"
                    data-drag-ignore
                    aria-label={"Rename " + page.title}
                    onClick={() => {
                      setEditingPageId(page.id);
                      setEditingTitle(page.title);
                    }}
                  >
                    <Pencil aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    data-drag-ignore
                    aria-label={"Delete " + page.title}
                    disabled={pages.length === 1}
                    onClick={() => onDelete(page.id)}
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="ideanote-page-organizer__hint">Drag Pages to change their order</div>
    </section>
  );
}
