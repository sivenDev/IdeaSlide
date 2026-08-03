import type { DocumentSession } from "../types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/DropdownMenu";

interface DocumentTabsProps {
  documents: DocumentSession[];
  activeSessionId?: string;
  recentlyClosedCount?: number;
  onActivate: (sessionId: string) => void;
  onRequestClose: (sessionId: string) => void;
  onCloseOthers: (sessionId: string) => void;
  onCloseRight: (sessionId: string) => void;
  onReopenLast: () => void;
}

function statusLabel(document: DocumentSession): string | undefined {
  if (document.status === "missing") return "Missing";
  if (document.status === "root-missing") return "Workspace missing";
  if (document.status === "external-change") return "Changed";
  if (document.status === "conflict") return "Conflict";
  if (document.status === "legacy-protected") return "Protected";
  if (document.status === "read-only") return "Read only";
  if (document.status === "error" || document.status === "invalid") return "Error";
  return undefined;
}

export function DocumentTabs({
  documents,
  activeSessionId,
  recentlyClosedCount = 0,
  onActivate,
  onRequestClose,
  onCloseOthers,
  onCloseRight,
  onReopenLast,
}: DocumentTabsProps) {
  return (
    <div className="ideanote-document-tabs" role="tablist" aria-label="Open files">
      <div className="ideanote-document-tabs__scroll">
        {documents.map((document) => {
          const active = document.id === activeSessionId;
          const label = statusLabel(document);
          return (
            <DropdownMenu key={document.id}>
              <DropdownMenuTrigger asChild>
                <div
                  role="tab"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  className={`ideanote-document-tab ${active ? "is-active" : ""}`}
                  onClick={() => onActivate(document.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") onActivate(document.id);
                    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "w") {
                      event.preventDefault();
                      onRequestClose(document.id);
                    }
                  }}
                >
                  <span className={`ideanote-document-tab__icon is-${document.fileType || "file"}`} aria-hidden="true">◇</span>
                  <span className="ideanote-document-tab__name">{document.displayName || "Untitled.is"}</span>
                  {label && <span className="ideanote-document-tab__status">{label}</span>}
                  {document.isDirty && <span className="ideanote-document-tab__dirty" title="Unsaved changes" aria-label="Unsaved changes" />}
                  <button
                    type="button"
                    className="ideanote-document-tab__close"
                    aria-label={`Close ${document.displayName || "file"}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRequestClose(document.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuItem onSelect={() => onRequestClose(document.id)}>Close</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onCloseOthers(document.id)}>Close Others</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onCloseRight(document.id)}>Close to the Right</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={recentlyClosedCount === 0} onSelect={onReopenLast}>
                  Reopen Closed Tab
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
      </div>
      <button
        type="button"
        className="ideanote-document-tabs__reopen"
        disabled={recentlyClosedCount === 0}
        onClick={onReopenLast}
        title="Reopen closed Tab"
        aria-label="Reopen closed Tab"
      >
        ↶
      </button>
    </div>
  );
}
