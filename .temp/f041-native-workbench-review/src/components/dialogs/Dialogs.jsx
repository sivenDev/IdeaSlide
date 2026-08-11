import { AlertTriangle, FolderOpen, X } from "lucide-react";

export function DialogShell({ title, description, children, onClose, width = "small" }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <section className={`native-dialog native-dialog--${width}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <header><div><strong id="dialog-title">{title}</strong>{description && <small>{description}</small>}</div>{onClose && <button className="icon-button" type="button" onClick={onClose} aria-label={`Close ${title}`}><X size={16} /></button>}</header>
        {children}
      </section>
    </div>
  );
}

export function TextEntryDialog({ title, description, label, value, setValue, confirmLabel, onConfirm, onClose, danger = false }) {
  return (
    <DialogShell title={title} description={description} onClose={onClose}>
      <form className="dialog-body" onSubmit={(event) => { event.preventDefault(); onConfirm(); }}>
        <label className="field-label">{label}<input autoFocus value={value} onChange={(event) => setValue(event.target.value)} /></label>
        <div className="dialog-actions"><button type="button" onClick={onClose}>Cancel</button><button className={danger ? "danger-button" : "primary-button"} type="submit" disabled={!value.trim()}>{confirmLabel}</button></div>
      </form>
    </DialogShell>
  );
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onClose, danger = false }) {
  return (
    <DialogShell title={title} onClose={onClose}>
      <div className="dialog-body confirm-copy"><AlertTriangle size={22} /><p>{message}</p></div>
      <div className="dialog-actions dialog-actions--footer"><button type="button" onClick={onClose}>Cancel</button><button type="button" className={danger ? "danger-button" : "primary-button"} onClick={onConfirm}>{confirmLabel}</button></div>
    </DialogShell>
  );
}

export function UnsavedChangesDialog({ document, onSave, onDiscard, onCancel }) {
  return (
    <DialogShell title="Save changes before switching?" description={document?.name} onClose={onCancel}>
      <div className="dialog-body"><p className="dialog-copy">The active mock document has unsaved changes. Choose what should happen before another file opens.</p></div>
      <div className="three-action-row"><button type="button" onClick={onCancel}>Cancel</button><button type="button" onClick={onDiscard}>Discard</button><button className="primary-button" type="button" onClick={onSave}>Save changes</button></div>
    </DialogShell>
  );
}

export function MockPickerDialog({ kind, onChoose, onClose }) {
  const isWorkspace = kind === "workspace";
  return (
    <DialogShell title={isWorkspace ? "Add a mock Workspace" : "Open a mock file"} description="This browser review does not access your real filesystem." onClose={onClose} width="medium">
      <div className="picker-list">
        <button type="button" onClick={onChoose}><FolderOpen size={18} /><span><strong>{isWorkspace ? "Research Library" : "personal-notes.md"}</strong><small>{isWorkspace ? "/Mock/Workspaces/Research Library" : "/Mock/Documents/personal-notes.md"}</small></span></button>
      </div>
      <div className="dialog-actions dialog-actions--footer"><button type="button" onClick={onClose}>Cancel</button></div>
    </DialogShell>
  );
}
