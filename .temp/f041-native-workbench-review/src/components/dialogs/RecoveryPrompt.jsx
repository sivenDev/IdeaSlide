import { ArchiveRestore, ShieldAlert } from "lucide-react";

export function RecoveryPrompt({ document, onRestore, onDiscard }) {
  if (!document?.recoveryAvailable && !document?.recoveryError) return null;
  return (
    <section className={`editor-decision-card ${document.recoveryError ? "is-danger" : ""}`} role="dialog" aria-labelledby="recovery-title">
      <span className="decision-icon">{document.recoveryError ? <ShieldAlert size={17} /> : <ArchiveRestore size={17} />}</span>
      <div><strong id="recovery-title">{document.recoveryError ? "Recovery cannot be read" : "Unsaved recovery is available"}</strong><p>{document.recoveryError ?? "Restore the deterministic draft as unsaved changes, or discard the recovery record and keep the source document."}</p></div>
      <div className="decision-actions">{!document.recoveryError && <button type="button" className="primary-button" onClick={onRestore}>Restore draft</button>}<button type="button" onClick={onDiscard}>{document.recoveryError ? "Dismiss" : "Discard recovery"}</button></div>
    </section>
  );
}
