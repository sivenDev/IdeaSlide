import { FileClock } from "lucide-react";

export function ExternalChangeNotice({ document, onReload, onKeep, onSaveAs, onCancel }) {
  if (!document?.sourceModified && !document?.conflict) return null;
  const conflict = Boolean(document.conflict);
  return (
    <section className={`editor-notice ${conflict ? "is-danger" : "is-warning"}`} role="status">
      <FileClock size={15} />
      <div><strong>{conflict ? "External change conflicts with your edits" : document.renamedFrom ? "File moved outside the application" : "Source changed outside the application"}</strong><p>{conflict ? "No overwrite will occur until you choose what to keep." : document.renamedFrom ? `${document.renamedFrom} is now ${document.path}.` : "Reload the mock source, or keep the current editor state."}</p></div>
      <div className="notice-actions">{conflict && <button type="button" className="primary-button" onClick={onSaveAs}>Save As</button>}<button type="button" onClick={onReload}>{conflict ? "Reload and discard" : "Reload source"}</button><button type="button" onClick={conflict ? onCancel : onKeep}>{conflict ? "Cancel" : "Keep current"}</button></div>
    </section>
  );
}
