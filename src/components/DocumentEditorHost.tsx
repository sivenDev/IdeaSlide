import type { DocumentSession } from "../types";
import type { ReactNode } from "react";
import { getFileTypeDefinition } from "../lib/fileTypeRegistry";
import { getEditorContribution, type DocumentEditorContributionProps } from "../lib/editorRegistry";
import { ErrorBoundary } from "./ErrorBoundary";
import { UnsupportedFileView } from "./UnsupportedFileView";

interface DocumentEditorHostProps {
  document?: DocumentSession;
  fullPath?: string;
  editorProps: Omit<DocumentEditorContributionProps, "document">;
  emptyState?: ReactNode;
}

export function DocumentEditorHost({ document, fullPath, editorProps, emptyState }: DocumentEditorHostProps) {
  if (!document) {
    return <div className="ideanote-editor-surface h-full">{emptyState}</div>;
  }
  if (document.status === "loading") {
    return <div className="ideanote-editor-surface flex h-full items-center justify-center text-sm">Loading {document.displayName}…</div>;
  }
  if (document.status === "unsupported" || document.status === "legacy-protected" || document.status === "invalid" || document.status === "error") {
    return <UnsupportedFileView fileName={document.displayName || "file"} fullPath={fullPath} message={document.message} />;
  }
  const isMissing = document.status === "missing";
  const definition = getFileTypeDefinition(document.fileType);
  const contribution = definition ? getEditorContribution(definition.editor) : undefined;
  if (contribution && document.model) {
    const Editor = contribution.component;
    return (
      <div className="ideanote-editor-surface relative h-full min-h-0">
        <div className="h-full min-h-0" hidden={isMissing} aria-hidden={isMissing}>
          <ErrorBoundary><Editor document={document} {...editorProps} /></ErrorBoundary>
        </div>
      </div>
    );
  }
  if (contribution) {
    return (
      <div className="ideanote-editor-surface flex h-full items-center justify-center text-sm">
        {definition?.displayName} editor is ready for this document session.
      </div>
    );
  }
  return <UnsupportedFileView fileName={document.displayName || "file"} fullPath={fullPath} />;
}
