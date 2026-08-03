import { useEffect, useRef, useState } from "react";
import type { IdeaSketchPage } from "../types";

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
  const [open, setOpen] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string>();
  const [editingTitle, setEditingTitle] = useState("");
  const [draggingPageId, setDraggingPageId] = useState<string>();
  const rootRef = useRef<HTMLDivElement>(null);
  const activePage = pages.find((page) => page.id === activePageId) ?? pages[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, [open]);

  const commitRename = () => {
    if (editingPageId && editingTitle.trim()) onRename(editingPageId, editingTitle);
    setEditingPageId(undefined);
  };

  return (
    <div ref={rootRef} className="ideanote-page-organizer">
      <button
        type="button"
        aria-label="Open Pages"
        aria-expanded={open}
        className="ideanote-page-organizer__trigger"
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="3" y="3" width="10" height="10" rx="1.5" />
          <path d="M6 15h7a2 2 0 0 0 2-2V6" />
        </svg>
        <span className="truncate">{activePage?.title ?? "Pages"}</span>
        <span className="ideanote-page-organizer__count">{pages.length}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="ideanote-page-organizer__popover" role="dialog" aria-label="Pages">
          <div className="ideanote-page-organizer__header">
            <div>
              <strong>Pages</strong>
              <span>Current IdeaSketch file</span>
            </div>
            <button type="button" onClick={onAdd} disabled={readOnly} aria-label="Add Page">＋</button>
          </div>
          <div className="ideanote-page-organizer__list">
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
                  className={`ideanote-page-organizer__row ${active ? "is-active" : ""}`}
                >
                  {editing ? (
                    <div className="ideanote-page-organizer__select">
                      <span className="ideanote-page-organizer__index">{index + 1}</span>
                      <input
                        autoFocus
                        value={editingTitle}
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
                      <button type="button" aria-label={`Rename ${page.title}`} onClick={() => {
                        setEditingPageId(page.id);
                        setEditingTitle(page.title);
                      }}>✎</button>
                      <button type="button" aria-label={`Delete ${page.title}`} disabled={pages.length === 1} onClick={() => onDelete(page.id)}>×</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="ideanote-page-organizer__hint">Drag Pages to change their order</div>
        </div>
      )}
    </div>
  );
}
