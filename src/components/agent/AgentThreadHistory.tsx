import { Archive, Check, LoaderCircle, Pencil, X } from "lucide-react";
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
  onLoadMore: () => void;
  onClose: () => void;
}) {
  const [editingId, setEditingId] = useState<string>();
  const [draftTitle, setDraftTitle] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => closeButtonRef.current?.focus(), []);

  const beginRename = (threadId: string, title: string) => {
    setEditingId(threadId);
    setDraftTitle(title);
  };

  const finishRename = () => {
    if (editingId && draftTitle.trim()) onRename(editingId, draftTitle.trim());
    setEditingId(undefined);
  };

  return (
    <section className="ideanote-agent-history" aria-label="Agent Thread history">
      <div className="ideanote-agent-history__heading">
        <div>
          <h3>Thread history</h3>
          <p>Stored locally in IdeaNote application data.</p>
        </div>
        <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close Thread history">
          <X aria-hidden size={13} />
        </button>
      </div>
      <div className="ideanote-agent-history__list" role="list">
        {page.threads.map((thread) => {
          const active = thread.id === currentThreadId;
          return (
            <div className={`ideanote-agent-history__item ${active ? "is-active" : ""}`} role="listitem" key={thread.id}>
              {editingId === thread.id ? (
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
                  </button>
                  <div className="ideanote-agent-history__actions">
                    <button type="button" disabled={disabled} onClick={() => beginRename(thread.id, thread.title)} aria-label={`Rename ${thread.title}`}>
                      <Pencil aria-hidden size={11} />
                    </button>
                    <button type="button" disabled={disabled} onClick={() => onArchive(thread.id)} aria-label={`Archive ${thread.title}`}>
                      <Archive aria-hidden size={11} />
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
