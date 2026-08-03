import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { IdeaSketchPage } from "../types";
import { cn } from "../lib/cn";
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

  const commitRename = () => {
    if (editingPageId && editingTitle.trim()) onRename(editingPageId, editingTitle);
    setEditingPageId(undefined);
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
              onDragStart={() => setDraggingPageId(page.id)}
              onDragEnd={() => setDraggingPageId(undefined)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggingPageId && draggingPageId !== page.id) onReorder(draggingPageId, index);
                setDraggingPageId(undefined);
              }}
              className={cn("ideanote-page-organizer__row", active && "is-active")}
            >
              {editing ? (
                <div className="ideanote-page-organizer__select">
                  <span className="ideanote-page-organizer__index">{index + 1}</span>
                  <input
                    autoFocus
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
