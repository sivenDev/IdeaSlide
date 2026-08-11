import { Bot, File, FilePenLine, PanelLeft, X } from "lucide-react";
import type { DocumentSession } from "../types";
import type { NativeWindowFrame } from "../hooks/useNativeWindowFrame";

function condition(document: DocumentSession, isSaving: boolean): { label: string; tone: string } {
  if (isSaving) return { label: "Saving", tone: "saving" };
  if (["error", "conflict", "missing", "root-missing", "invalid"].includes(document.status)) {
    return { label: document.message || "Document needs attention", tone: "danger" };
  }
  if (document.isDirty) return { label: "Unsaved changes", tone: "dirty" };
  if (document.readOnly || document.status === "read-only") return { label: "Read only", tone: "readonly" };
  return { label: "Saved", tone: "saved" };
}

export function WorkbenchCrown({
  document,
  isSaving,
  workspaceOpen,
  agentOpen,
  agentAvailable,
  frame,
  onToggleWorkspace,
  onToggleAgent,
  onCloseDocument,
}: {
  document?: DocumentSession;
  isSaving: boolean;
  workspaceOpen: boolean;
  agentOpen: boolean;
  agentAvailable: boolean;
  frame: NativeWindowFrame;
  onToggleWorkspace: () => void;
  onToggleAgent: () => void;
  onCloseDocument: () => void;
}) {
  const state = document ? condition(document, isSaving) : undefined;
  const Icon = document?.fileType === "ideasketch" ? FilePenLine : File;
  return (
    <header className={`ideanote-workbench-crown ${workspaceOpen ? "has-workspace" : "without-workspace"} ${frame.className}`} data-tauri-drag-region>
      {!workspaceOpen && (
        <button className="ideanote-crown-action is-workspace" type="button" aria-label="Show Workspaces" onClick={onToggleWorkspace}>
          <PanelLeft aria-hidden size={16} />
        </button>
      )}
      <div className="ideanote-document-identity">
        {document ? (
          <>
            <button
              type="button"
              className={`ideanote-document-status-close is-${state?.tone}`}
              aria-label={`${state?.label}. Close ${document.displayName}`}
              title={`${state?.label} · Close document`}
              onClick={onCloseDocument}
            >
              <span className="ideanote-document-status-close__state" aria-hidden="true" />
              <X className="ideanote-document-status-close__close" aria-hidden size={13} />
            </button>
            <Icon className="ideanote-document-identity__icon" aria-hidden size={14} />
            <strong>{document.displayName}</strong>
          </>
        ) : <strong>Welcome</strong>}
      </div>
      <div className="ideanote-workbench-crown__drag" data-tauri-drag-region />
      {document && agentAvailable && !agentOpen && (
        <button className="ideanote-crown-action is-agent" type="button" aria-label="Show Agent" onClick={onToggleAgent}>
          <Bot aria-hidden size={16} />
        </button>
      )}
      {document && <span className="sr-only" role="status" aria-live="polite">{state?.label}</span>}
    </header>
  );
}
