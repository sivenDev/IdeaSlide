import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type CSSProperties } from "react";
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

interface SortablePageRowProps {
  page: IdeaSketchPage;
  index: number;
  active: boolean;
  editing: boolean;
  editingTitle: string;
  pagesCount: number;
  readOnly: boolean;
  onSelect: () => void;
  onEditingTitleChange: (title: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onStartRename: () => void;
  onDelete: () => void;
}

function SortablePageRow({
  page,
  index,
  active,
  editing,
  editingTitle,
  pagesCount,
  readOnly,
  onSelect,
  onEditingTitleChange,
  onCommitRename,
  onCancelRename,
  onStartRename,
  onDelete,
}: SortablePageRowProps) {
  const sortable = useSortable({ id: page.id, disabled: readOnly || editing });
  const style: CSSProperties = {
    transform: sortable.transform
      ? `translate3d(${sortable.transform.x}px, ${sortable.transform.y}px, 0) scaleX(${sortable.transform.scaleX}) scaleY(${sortable.transform.scaleY})`
      : undefined,
    transition: sortable.transition,
    zIndex: sortable.isDragging ? 5 : undefined,
    opacity: sortable.isDragging ? 0.72 : undefined,
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={cn(
        "ideanote-page-organizer__row",
        active && "is-active",
        sortable.isDragging && "is-dragging",
      )}
    >
      {!readOnly && !editing && (
        <button
          ref={sortable.setActivatorNodeRef}
          type="button"
          aria-label={"Drag " + page.title}
          className="idea-slide-drag-handle"
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <GripVertical aria-hidden="true" />
        </button>
      )}
      {editing ? (
        <div className="ideanote-page-organizer__select">
          <span className="ideanote-page-organizer__index">{index + 1}</span>
          <input
            autoFocus
            value={editingTitle}
            aria-label={"Rename " + page.title}
            onChange={(event) => onEditingTitleChange(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onBlur={onCommitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") onCommitRename();
              if (event.key === "Escape") onCancelRename();
            }}
          />
        </div>
      ) : (
        <button type="button" className="ideanote-page-organizer__select" onClick={onSelect}>
          <span className="ideanote-page-organizer__index">{index + 1}</span>
          <span className="truncate">{page.title}</span>
        </button>
      )}
      {!readOnly && !editing && (
        <div className="ideanote-page-organizer__actions">
          <button type="button" aria-label={"Rename " + page.title} onClick={onStartRename}>
            <Pencil aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={"Delete " + page.title}
            disabled={pagesCount === 1}
            onClick={onDelete}
          >
            <Trash2 aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const commitRename = () => {
    if (editingPageId && editingTitle.trim()) onRename(editingPageId, editingTitle);
    setEditingPageId(undefined);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (readOnly || !event.over || event.active.id === event.over.id) return;
    const fromIndex = pages.findIndex((page) => page.id === event.active.id);
    const toIndex = pages.findIndex((page) => page.id === event.over?.id);
    if (fromIndex >= 0 && toIndex >= 0) onReorder(String(event.active.id), toIndex);
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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={pages.map((page) => page.id)} strategy={verticalListSortingStrategy}>
          <div className="ideanote-page-organizer__list idea-slide-side-panel__scroll">
            {pages.map((page, index) => (
              <SortablePageRow
                key={page.id}
                page={page}
                index={index}
                active={page.id === activePageId}
                editing={page.id === editingPageId}
                editingTitle={editingTitle}
                pagesCount={pages.length}
                readOnly={readOnly}
                onSelect={() => onSelect(page.id)}
                onEditingTitleChange={setEditingTitle}
                onCommitRename={commitRename}
                onCancelRename={() => setEditingPageId(undefined)}
                onStartRename={() => {
                  setEditingPageId(page.id);
                  setEditingTitle(page.title);
                }}
                onDelete={() => onDelete(page.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <div className="ideanote-page-organizer__hint">Drag Pages to change their order</div>
    </section>
  );
}
