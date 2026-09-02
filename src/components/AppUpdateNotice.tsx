import { ArrowDownToLine, RefreshCw, RotateCcw, X } from "lucide-react";
import type { AppUpdateState } from "../lib/appUpdates";

const iconProps = { "aria-hidden": true, size: 14, strokeWidth: 1.9 } as const;

function progressLabel(update: AppUpdateState): string {
  if (update.phase === "downloading") {
    if (update.totalBytes && update.totalBytes > 0) {
      return `Downloading ${Math.min(100, Math.round((update.downloadedBytes / update.totalBytes) * 100))}%`;
    }
    return "Downloading update…";
  }
  if (update.phase === "ready") return "Ready to restart";
  if (update.phase === "installing") return "Installing update…";
  if (update.phase === "error") return update.error ?? "The update could not be completed.";
  return `Version ${update.availableVersion} is available.`;
}

export function AppUpdateNotice({
  update,
  onDismiss,
  onDownload,
  onInstall,
  onRetry,
}: {
  update: AppUpdateState;
  onDismiss: () => void;
  onDownload: () => void;
  onInstall: () => void;
  onRetry: () => void;
}) {
  const progress = update.totalBytes && update.totalBytes > 0
    ? Math.min(100, Math.round((update.downloadedBytes / update.totalBytes) * 100))
    : undefined;
  const primaryAction = update.phase === "ready" || (update.phase === "error" && update.retryAction === "install")
    ? { label: update.phase === "error" ? "Retry" : "Restart to update", icon: RotateCcw, run: update.phase === "error" ? onRetry : onInstall }
    : update.phase === "error"
      ? { label: "Retry", icon: RefreshCw, run: onRetry }
      : { label: "Download update", icon: ArrowDownToLine, run: onDownload };
  const PrimaryIcon = primaryAction.icon;
  const busy = update.phase === "downloading" || update.phase === "installing";

  return (
    <section className={`ideanote-app-update-notice is-${update.phase}`} aria-label="IdeaNote update">
      <div className="ideanote-app-update-notice__heading">
        <div>
          <strong>Update available</strong>
          <span>{update.availableVersion ? `IdeaNote ${update.availableVersion}` : "A newer IdeaNote version"}</span>
        </div>
        <button
          type="button"
          aria-label={busy ? "Download in progress" : "Dismiss update notice"}
          disabled={busy}
          onClick={onDismiss}
        >
          <X {...iconProps} />
        </button>
      </div>
      {update.notes && <p className="ideanote-app-update-notice__notes">{update.notes}</p>}
      <div className="ideanote-app-update-notice__status" role="status" aria-live="polite">
        {progress !== undefined && update.phase === "downloading" && (
          <span className="ideanote-app-update-notice__progress" aria-hidden><span style={{ width: `${progress}%` }} /></span>
        )}
        <span>{progressLabel(update)}</span>
      </div>
      <button
        className="ideanote-app-update-notice__action"
        type="button"
        disabled={busy}
        onClick={primaryAction.run}
      >
        <PrimaryIcon className={busy ? "is-spinning" : undefined} {...iconProps} />
        {busy ? progressLabel(update) : primaryAction.label}
      </button>
    </section>
  );
}
