interface WorkspaceStatusNoticeProps {
  rootMissing: boolean;
  readOnly: boolean;
  diagnostics: string[];
  diagnosticsHidden: boolean;
  onRetry: () => void;
  onRelocate: () => void;
  onDismissDiagnostics: () => void;
}

export function WorkspaceStatusNotice({
  rootMissing,
  readOnly,
  diagnostics,
  diagnosticsHidden,
  onRetry,
  onRelocate,
  onDismissDiagnostics,
}: WorkspaceStatusNoticeProps) {
  if (rootMissing) {
    return (
      <div className="ideanote-workspace-notice is-error" role="alert">
        <div>
          <strong>Workspace unavailable</strong>
          <span>The Workspace folder was moved or removed. Choose its new location to keep the current Tabs and unsaved content.</span>
        </div>
        <button type="button" onClick={onRelocate}>Relocate Workspace…</button>
      </div>
    );
  }
  if (diagnostics.length > 0 && !diagnosticsHidden) {
    return (
      <div className="ideanote-workspace-notice is-warning" role="alert">
        <div>
          <strong>Workspace state could not be fully restored</strong>
          <span>{diagnostics.join(" ")}</span>
        </div>
        <button type="button" onClick={onRetry}>Retry</button>
        <button type="button" onClick={onDismissDiagnostics}>Dismiss</button>
      </div>
    );
  }
  if (readOnly) {
    return (
      <div className="ideanote-workspace-notice is-warning" role="status">
        <div>
          <strong>Workspace is read only</strong>
          <span>You can browse files, but changes must be saved with Save As.</span>
        </div>
      </div>
    );
  }
  return null;
}
