import type { DocumentStatus } from "../types";

interface ExternalChangeNoticeProps {
  status: DocumentStatus;
  message?: string;
  hidden?: boolean;
  onReload: () => void;
  onSaveAs: () => void;
  onKeepEditing: () => void;
  onClose: () => void;
  onRelocateWorkspace: () => void;
}

export function ExternalChangeNotice({ status, message, hidden, onReload, onSaveAs, onKeepEditing, onClose, onRelocateWorkspace }: ExternalChangeNoticeProps) {
  if (hidden || !["external-change", "conflict", "missing", "read-only", "root-missing"].includes(status)) return null;
  const canReload = status === "external-change" || status === "conflict";
  const canSaveAs = status !== "external-change";
  return (
    <div className={`ideanote-external-notice is-${status}`} role="alert">
      <div className="min-w-0 flex-1">
        <strong>{status === "conflict" ? "File conflict" : status === "missing" ? "File missing" : status === "root-missing" ? "Workspace missing" : status === "read-only" ? "Read only" : "File changed"}</strong>
        <span>{message}</span>
      </div>
      <div className="ideanote-external-notice__actions">
        {canReload && <button type="button" onClick={onReload}>Reload</button>}
        {canSaveAs && <button type="button" onClick={onSaveAs}>Save As…</button>}
        {status === "root-missing" && <button type="button" onClick={onRelocateWorkspace}>Open Workspace…</button>}
        {(status === "missing" || status === "root-missing") && <button type="button" onClick={onClose}>Close</button>}
        {(status === "conflict" || status === "external-change" || status === "read-only") && <button type="button" onClick={onKeepEditing}>Keep editing</button>}
      </div>
    </div>
  );
}
