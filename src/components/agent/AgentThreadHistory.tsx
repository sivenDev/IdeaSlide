import { Archive, Check, LoaderCircle, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AgentThreadPage } from "../../lib/agent/protocol";

function relativeDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function AgentThreadHistory({
  page,
  currentThreadId,
  loading,
  disabled,
  onResume,
  onRename,
  onArchive,
  onDelete,
  showArchived,
  onToggleArchived,
  onLoadMore,
  onClose,
}: {
  page: AgentThreadPage;
  currentThreadId: string;
  loading: boolean;
  disabled: boolean;
  onResume: (threadId: string) => void;
  onRename: (threadId: string, title: string) => void;
  onArchive: (threadId: string) => void;
  onDelete: (threadId: string) => Promise<void>;
  showArchived: boolean;
  onToggleArchived: (visible: boolean) => void;
  onLoadMore: () => void;
  onClose: () => void;
}) {
  const [editingId, setEditingId] = useState<string>();
  const [draftTitle, setDraftTitle] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<{ id: string; title: string }>();
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const confirmDeleteRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => closeButtonRef.current?.focus(), []);
  useEffect(() => confirmDeleteRef.current?.focus(), [deleteCandidate]);

  const beginRename = (threadId: string, title: string) => {
    setEditingId(threadId);
    setDraftTitle(title);
  };

  const finishRename = () => {
    if (editingId && draftTitle.trim()) onRename(editingId, draftTitle.trim());
    setEditingId(undefined);
  };

  const cancelDelete = () => {
    const threadId = deleteCandidate?.id;
    setDeleteCandidate(undefined);
    setDeleteError(undefined);
    if (threadId) window.requestAnimationFrame(() => deleteButtonRefs.current.get(threadId)?.focus());
  };

  const confirmDelete = async () => {
    if (!deleteCandidate || deletePending) return;
    setDeletePending(true);
    setDeleteError(undefined);
    try {
      await onDelete(deleteCandidate.id);
      setDeleteCandidate(undefined);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <section className="ideanote-agent-history" aria-label="Agent Thread history">
      <div className="ideanote-agent-history__heading">
        <div>
          <h3>Thread history</h3>
          <p>Stored locally in IdeaNote application data.</p>
        </div>
        <div className="ideanote-agent-history__heading-actions">
          <button
            type="button"
            disabled={loading || disabled}
            aria-pressed={showArchived}
            onClick={() => onToggleArchived(!showArchived)}
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </button>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close Thread history">
            <X aria-hidden size={13} />
          </button>
        </div>
      </div>
      <div className="ideanote-agent-history__list" role="list">
        {page.threads.map((thread) => {
          const active = thread.id === currentThreadId;
          return (
            <div className={`ideanote-agent-history__item ${active ? "is-active" : ""}`} role="listitem" key={thread.id}>
              {deleteCandidate?.id === thread.id ? (
                <div className="ideanote-agent-history__delete-confirmation" role="alertdialog" aria-labelledby={`delete-thread-${thread.id}`}>
                  <div>
                    <strong id={`delete-thread-${thread.id}`}>Delete “{thread.title}” permanently?</strong>
                    <small>This removes the local conversation history and cannot be undone.</small>
                    {deleteError && <small className="is-error" role="status">{deleteError}</small>}
                  </div>
                  <button ref={confirmDeleteRef} type="button" className="is-danger" disabled={deletePending} onClick={() => void confirmDelete()}>
                    {deletePending ? "Deleting…" : "Delete"}
                  </button>
                  <button type="button" disabled={deletePending} onClick={cancelDelete}>Cancel</button>
                </div>
              ) : editingId === thread.id ? (
                <form onSubmit={(event) => { event.preventDefault(); finishRename(); }}>
                  <input
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    aria-label="Thread title"
                    maxLength={160}
                    autoFocus
                  />
                  <button type="submit" aria-label="Save Thread title"><Check aria-hidden size={12} /></button>
                  <button type="button" onClick={() => setEditingId(undefined)} aria-label="Cancel rename"><X aria-hidden size={12} /></button>
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    className="ideanote-agent-history__resume"
                    disabled={disabled || active}
                    onClick={() => onResume(thread.id)}
                    aria-current={active ? "page" : undefined}
                  >
                    <span>{thread.title}</span>
                    <small>{relativeDate(thread.updatedAt)} · {thread.turnCount} Turns · {thread.runtime.label}</small>
                    {thread.archivedAt && <small>Archived</small>}
                  </button>
                  <div className="ideanote-agent-history__actions">
                    <button type="button" disabled={disabled} onClick={() => beginRename(thread.id, thread.title)} aria-label={`Rename ${thread.title}`}>
                      <Pencil aria-hidden size={11} />
                    </button>
                    <button type="button" disabled={disabled} onClick={() => onArchive(thread.id)} aria-label={`Archive ${thread.title}`}>
                      <Archive aria-hidden size={11} />
                    </button>
                    <button
                      ref={(element) => {
                        if (element) deleteButtonRefs.current.set(thread.id, element);
                        else deleteButtonRefs.current.delete(thread.id);
                      }}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setDeleteError(undefined);
                        setDeleteCandidate({ id: thread.id, title: thread.title });
                      }}
                      aria-label={`Delete ${thread.title} permanently`}
                    >
                      <Trash2 aria-hidden size={11} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
        {!loading && page.threads.length === 0 && (
          <p className="ideanote-agent-history__empty">No saved Threads yet.</p>
        )}
      </div>
      {page.nextCursor && (
        <button type="button" className="ideanote-agent-history__more" disabled={loading} onClick={onLoadMore}>
          {loading ? <LoaderCircle className="ideanote-agent-spin" aria-hidden size={12} /> : null}
          Load earlier Threads
        </button>
      )}
    </section>
  );
}
