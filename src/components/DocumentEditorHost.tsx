import type { DocumentSession } from "../types";
import { getFileTypeDefinition } from "../lib/fileTypeRegistry";
import { ErrorBoundary } from "./ErrorBoundary";
import { UnsupportedFileView } from "./UnsupportedFileView";

interface DocumentEditorHostProps {
  document?: DocumentSession;
  fullPath?: string;
  renderIdeaSketch?: (document: DocumentSession) => React.ReactNode;
}

export function DocumentEditorHost({ document, fullPath, renderIdeaSketch }: DocumentEditorHostProps) {
  if (!document) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f7f8fa] text-sm text-gray-400">
        Open a file from the Workspace Explorer.
      </div>
    );
  }
  if (document.status === "loading") {
    return <div className="flex h-full items-center justify-center bg-[#f7f8fa] text-sm text-gray-500">Loading {document.displayName}…</div>;
  }
  if (document.status === "unsupported" || document.status === "legacy-protected" || document.status === "invalid" || document.status === "error") {
    return <UnsupportedFileView fileName={document.displayName || "file"} fullPath={fullPath} message={document.message} />;
  }
  const definition = getFileTypeDefinition(document.fileType);
  if (definition?.editor === "ideasketch" && document.model && renderIdeaSketch) {
    return <ErrorBoundary>{renderIdeaSketch(document)}</ErrorBoundary>;
  }
  if (definition?.editor === "ideasketch") {
    return (
      <div className="flex h-full items-center justify-center bg-[#f7f8fa] text-sm text-gray-500">
        IdeaSketch editor is ready for this document session.
      </div>
    );
  }
  return <UnsupportedFileView fileName={document.displayName || "file"} fullPath={fullPath} />;
}
