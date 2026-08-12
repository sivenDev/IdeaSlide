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
import { useVirtualizer } from "@tanstack/react-virtual";
import { GripVertical, Image, List, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { usePageThumbnails, type PageThumbnailView } from "../hooks/usePageThumbnails";
import { cn } from "../lib/cn";
import type { EditorSlideDraft } from "../lib/editorSession";
import { buildPageThumbnailDemands } from "../lib/pageThumbnailScheduler";
import type { IdeaSketchPage } from "../types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/Tooltip";

export type PageViewMode = "name" | "thumbnail";

const NAME_ITEM_SIZE = 36;
const THUMBNAIL_ITEM_SIZE = 160;

interface PageOrganizerProps {
  pages: IdeaSketchPage[];
  activePageId: string;
  activeDraft: EditorSlideDraft;
  canvasInteractionActive?: boolean;
  readOnly?: boolean;
  initialViewMode?: PageViewMode;
  initialViewModeReady?: boolean;
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
  viewMode: PageViewMode;
  thumbnail?: PageThumbnailView;
  onSelect: () => void;
  onEditingTitleChange: (title: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onStartRename: () => void;
  onDelete: () => void;
}

function PageThumbnailPreview({ page, thumbnail }: {
  page: IdeaSketchPage;
  thumbnail?: PageThumbnailView;
}) {
  if (thumbnail?.status === "ready" && thumbnail.url) {
    return (
      <img
        src={thumbnail.url}
        alt=""
        loading="lazy"
        decoding="async"
      />
    );
  }
  if (thumbnail?.status === "error") {
    return <span className="ideanote-page-organizer__preview-state">Preview unavailable</span>;
  }
  if (thumbnail?.status === "empty") {
    return <span className="ideanote-page-organizer__preview-state">Empty Page</span>;
  }
  return (
    <span className="ideanote-page-organizer__preview-state is-loading" aria-label={`Loading preview for ${page.title}`}>
      Generating preview
    </span>
  );
}

function SortablePageRow({
  page,
  index,
  active,
  editing,
  editingTitle,
  pagesCount,
  readOnly,
  viewMode,
  thumbnail,
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

  const renameInput = (
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
  );

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={cn(
        "ideanote-page-organizer__row",
        viewMode === "thumbnail" && "is-thumbnail",
        active && "is-active",
        sortable.isDragging && "is-dragging",
      )}
      data-page-id={page.id}
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

      {viewMode === "thumbnail" ? (
        <>
          <button
            type="button"
            className="ideanote-page-organizer__preview"
            aria-label={"Select " + page.title}
            onClick={onSelect}
          >
            <PageThumbnailPreview page={page} thumbnail={thumbnail} />
          </button>
          <div className="ideanote-page-organizer__caption">
            <span className="ideanote-page-organizer__index">{index + 1}</span>
            {editing ? renameInput : (
              <button type="button" className="ideanote-page-organizer__title" onClick={onSelect}>
                <span className="truncate">{page.title}</span>
              </button>
            )}
          </div>
        </>
      ) : editing ? (
        <div className="ideanote-page-organizer__select">
          <span className="ideanote-page-organizer__index">{index + 1}</span>
          {renameInput}
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
  activeDraft,
  canvasInteractionActive = false,
  readOnly = false,
  initialViewMode = "name",
  initialViewModeReady = true,
  onSelect,
  onAdd,
  onRename,
  onReorder,
  onDelete,
}: PageOrganizerProps) {
  const [viewMode, setViewMode] = useState<PageViewMode>(initialViewMode);
  const initialViewModeApplied = useRef(false);
  const [editingPageId, setEditingPageId] = useState<string>();
  const [editingTitle, setEditingTitle] = useState("");
  const [draggingPageId, setDraggingPageId] = useState<string>();
  const [pointerActive, setPointerActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageIds = useMemo(() => pages.map((page) => page.id), [pages]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const virtualizer = useVirtualizer({
    count: pages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => viewMode === "name" ? NAME_ITEM_SIZE : THUMBNAIL_ITEM_SIZE,
    getItemKey: (index) => pageIds[index] ?? index,
    overscan: 4,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const virtualIndexKey = virtualItems.map((item) => item.index).join(",");
  const visibleStartIndex = virtualizer.range?.startIndex ?? virtualItems[0]?.index ?? 0;
  const visibleEndIndex = virtualizer.range?.endIndex
    ?? virtualItems[virtualItems.length - 1]?.index
    ?? -1;
  const demands = useMemo(() => viewMode === "thumbnail"
    ? buildPageThumbnailDemands(
      pageIds,
      virtualItems.map((item) => item.index),
      { startIndex: visibleStartIndex, endIndex: visibleEndIndex },
      activePageId,
    )
    : [], [activePageId, pageIds, viewMode, virtualIndexKey, visibleEndIndex, visibleStartIndex]);
  const thumbnailPaused = Boolean(
    canvasInteractionActive || editingPageId || draggingPageId || pointerActive,
  );
  const thumbnails = usePageThumbnails({
    pages,
    activePageId,
    activeDraft,
    demands,
    enabled: viewMode === "thumbnail",
    paused: thumbnailPaused,
  });

  useEffect(() => {
    if (!initialViewModeReady || initialViewModeApplied.current) return;
    initialViewModeApplied.current = true;
    setViewMode(initialViewMode);
  }, [initialViewMode, initialViewModeReady]);

  useEffect(() => {
    virtualizer.measure();
    const activeIndex = pageIds.indexOf(activePageId);
    if (activeIndex >= 0) virtualizer.scrollToIndex(activeIndex, { align: "auto" });
  }, [activePageId, pageIds, viewMode, virtualizer]);

  useEffect(() => {
    if (!pointerActive) return;
    const releasePointer = () => setPointerActive(false);
    window.addEventListener("pointerup", releasePointer, { once: true });
    window.addEventListener("pointercancel", releasePointer, { once: true });
    return () => {
      window.removeEventListener("pointerup", releasePointer);
      window.removeEventListener("pointercancel", releasePointer);
    };
  }, [pointerActive]);

  const commitRename = () => {
    if (editingPageId && editingTitle.trim()) onRename(editingPageId, editingTitle);
    setEditingPageId(undefined);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingPageId(undefined);
    if (readOnly || !event.over || event.active.id === event.over.id) return;
    const fromIndex = pages.findIndex((page) => page.id === event.active.id);
    const toIndex = pages.findIndex((page) => page.id === event.over?.id);
    if (fromIndex >= 0 && toIndex >= 0) onReorder(String(event.active.id), toIndex);
  };

  return (
    <section
      className="ideanote-page-organizer"
      aria-label="Pages"
      data-thumbnail-demand-count={demands.length}
      data-thumbnail-paused={thumbnailPaused ? "true" : "false"}
      onPointerDownCapture={() => setPointerActive(true)}
      onPointerUpCapture={() => setPointerActive(false)}
      onPointerCancelCapture={() => setPointerActive(false)}
    >
      <div className="idea-slide-navigator-toolbar">
        <span className="idea-slide-navigator-toolbar__context">View</span>
        <TooltipProvider>
          <div className="ideanote-page-organizer__view-switch" role="group" aria-label="Page view">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Name view"
                  aria-pressed={viewMode === "name"}
                  className={cn(viewMode === "name" && "is-active")}
                  onClick={() => setViewMode("name")}
                >
                  <List aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Name view</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Thumbnail view"
                  aria-pressed={viewMode === "thumbnail"}
                  className={cn(viewMode === "thumbnail" && "is-active")}
                  onClick={() => setViewMode("thumbnail")}
                >
                  <Image aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Thumbnail view</TooltipContent>
            </Tooltip>
          </div>
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(event) => setDraggingPageId(String(event.active.id))}
        onDragCancel={() => setDraggingPageId(undefined)}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={pageIds} strategy={verticalListSortingStrategy}>
          <div ref={scrollRef} className="ideanote-page-organizer__list idea-slide-side-panel__scroll">
            <div
              className="ideanote-page-organizer__virtual-canvas"
              style={{ height: virtualizer.getTotalSize() }}
            >
              {virtualItems.map((virtualItem) => {
                const page = pages[virtualItem.index];
                if (!page) return null;
                return (
                  <div
                    key={page.id}
                    className={cn(
                      "ideanote-page-organizer__virtual-item",
                      viewMode === "thumbnail" && "is-thumbnail",
                    )}
                    style={{
                      height: virtualItem.size,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <SortablePageRow
                      page={page}
                      index={virtualItem.index}
                      active={page.id === activePageId}
                      editing={page.id === editingPageId}
                      editingTitle={editingTitle}
                      pagesCount={pages.length}
                      readOnly={readOnly}
                      viewMode={viewMode}
                      thumbnail={thumbnails.get(page.id)}
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
                  </div>
                );
              })}
            </div>
          </div>
        </SortableContext>
      </DndContext>
      <div className="ideanote-page-organizer__hint">Drag Pages to change their order</div>
    </section>
  );
}
