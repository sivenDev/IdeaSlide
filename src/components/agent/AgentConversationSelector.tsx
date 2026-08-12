import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import { Bot, ChevronDown, LoaderCircle, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { AgentThreadPage } from "../../lib/agent/protocol";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/DropdownMenu";

function relativeDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    .format(new Date(timestamp));
}

export function AgentConversationSelector({
  page,
  currentThreadId,
  currentTitle,
  currentTurnCount,
  loading,
  running,
  onResume,
  onRename,
  onDelete,
  onLoadMore,
}: {
  page: AgentThreadPage;
  currentThreadId: string;
  currentTitle: string;
  currentTurnCount: number;
  loading: boolean;
  running: boolean;
  onResume: (threadId: string) => Promise<void>;
  onRename: (threadId: string, title: string) => Promise<void>;
  onDelete: (threadId: string) => Promise<void>;
  onLoadMore: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();
  const [renameCandidate, setRenameCandidate] = useState<{ id: string; value: string }>();
  const [deleteCandidate, setDeleteCandidate] = useState<{ id: string; title: string }>();

  const resume = async (threadId: string) => {
    setBusyId(threadId);
    setError(undefined);
    try {
      await onResume(threadId);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(undefined);
    }
  };

  const rename = async () => {
    const candidate = renameCandidate;
    if (!candidate?.value.trim()) return;
    setBusyId(candidate.id);
    setError(undefined);
    try {
      await onRename(candidate.id, candidate.value.trim());
      setRenameCandidate(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(undefined);
    }
  };

  const remove = async () => {
    const candidate = deleteCandidate;
    if (!candidate) return;
    setBusyId(candidate.id);
    setError(undefined);
    try {
      await onDelete(candidate.id);
      setDeleteCandidate(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button type="button" className="ideanote-agent-conversation-trigger" aria-label={`Conversation history. Current conversation: ${currentTitle}`}>
            <Bot aria-hidden size={14} />
            <span>
              <strong>{currentTitle}</strong>
              <small>{running ? "Working" : `${currentTurnCount} Turns`}</small>
            </span>
            <ChevronDown aria-hidden size={12} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} collisionPadding={8} className="ideanote-agent-conversation-popover">
            <div className="ideanote-agent-conversation-list" role="list">
              {page.threads.map((thread) => {
                const active = thread.id === currentThreadId;
                const busy = busyId === thread.id;
                return (
                  <div key={thread.id} role="listitem" className={`ideanote-agent-conversation-row ${active ? "is-active" : ""}`}>
                    <button
                      type="button"
                      className="ideanote-agent-conversation-main"
                      disabled={running || active || busy}
                      aria-current={active ? "page" : undefined}
                      onClick={() => void resume(thread.id)}
                    >
                      <strong>{thread.title}</strong>
                      <small>{relativeDate(thread.updatedAt)} · {thread.turnCount} Turns</small>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className="ideanote-agent-conversation-actions" disabled={running || busy} aria-label={`Actions for ${thread.title}`}>
                          <MoreHorizontal aria-hidden size={14} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" sideOffset={4} collisionPadding={8} className="ideanote-agent-conversation-menu">
                        <DropdownMenuItem onSelect={() => { setOpen(false); setRenameCandidate({ id: thread.id, value: thread.title }); }}>
                          <Pencil aria-hidden size={12} /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem className="is-danger" onSelect={() => { setOpen(false); setDeleteCandidate({ id: thread.id, title: thread.title }); }}>
                          <Trash2 aria-hidden size={12} /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
              {!loading && page.threads.length === 0 && <p className="ideanote-agent-conversation-empty">No saved conversations.</p>}
              {error && <p className="ideanote-agent-conversation-error" role="status">{error}</p>}
            </div>
            {page.nextCursor && (
              <button type="button" className="ideanote-agent-conversation-more" disabled={loading} onClick={() => void onLoadMore()}>
                {loading && <LoaderCircle className="ideanote-agent-spin" aria-hidden size={12} />}
                Load earlier
              </button>
            )}
            <Popover.Arrow className="ideanote-agent-conversation-arrow" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <Dialog.Root open={Boolean(renameCandidate)} onOpenChange={(nextOpen) => { if (!nextOpen && !busyId) setRenameCandidate(undefined); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="ideanote-agent-dialog-overlay" />
          <Dialog.Content className="ideanote-agent-dialog">
            <header><Dialog.Title>Rename conversation</Dialog.Title><Dialog.Close aria-label="Close rename dialog"><X aria-hidden size={15} /></Dialog.Close></header>
            <Dialog.Description className="sr-only">Enter a new name for this conversation.</Dialog.Description>
            <input
              autoFocus
              aria-label="Conversation name"
              maxLength={160}
              value={renameCandidate?.value ?? ""}
              onChange={(event) => setRenameCandidate((current) => current ? { ...current, value: event.target.value } : current)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void rename(); } }}
            />
            {error && <p role="status">{error}</p>}
            <footer>
              <Dialog.Close disabled={Boolean(busyId)}>Cancel</Dialog.Close>
              <button type="button" className="is-primary" disabled={Boolean(busyId) || !renameCandidate?.value.trim()} onClick={() => void rename()}>Rename</button>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <AlertDialog.Root open={Boolean(deleteCandidate)} onOpenChange={(nextOpen) => { if (!nextOpen && !busyId) setDeleteCandidate(undefined); }}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="ideanote-agent-dialog-overlay" />
          <AlertDialog.Content className="ideanote-agent-dialog">
            <header><AlertDialog.Title>Delete conversation?</AlertDialog.Title></header>
            <AlertDialog.Description>“{deleteCandidate?.title}” will be permanently removed from local history.</AlertDialog.Description>
            {error && <p role="status">{error}</p>}
            <footer>
              <AlertDialog.Cancel disabled={Boolean(busyId)}>Cancel</AlertDialog.Cancel>
              <button type="button" className="is-danger" disabled={Boolean(busyId)} onClick={() => void remove()}>Delete</button>
            </footer>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
