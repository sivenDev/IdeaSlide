import { AlertTriangle, FileX2, Info } from "lucide-react";

export function DocumentProblemNotice({ document, onClose, onSaveAs, onDismiss }) {
  if (!document) return null;
  if (document.missing) return (
    <section className="editor-notice is-danger" role="alert"><FileX2 size={15} /><div><strong>The source file is missing</strong><p>The editor session is preserved. Close it, or save the current content to a new mock path.</p></div><div className="notice-actions">{document.dirty && <button className="primary-button" type="button" onClick={onSaveAs}>Save As</button>}<button type="button" onClick={onClose}>Close document</button></div></section>
  );
  if (document.metadataWarning) return (
    <section className="editor-notice is-warning" role="status"><Info size={15} /><div><strong>Document saved; Workspace state needs attention</strong><p>{document.metadataWarning}</p></div><div className="notice-actions"><button type="button" onClick={onDismiss}>Dismiss</button></div></section>
  );
  if (document.readOnly) return (
    <section className="editor-notice is-warning" role="status"><AlertTriangle size={15} /><div><strong>Read-only source</strong><p>Editing and Agent mutations are disabled. Use Save As to create a writable mock copy.</p></div><div className="notice-actions"><button type="button" onClick={onSaveAs}>Save As</button></div></section>
  );
  return null;
}
