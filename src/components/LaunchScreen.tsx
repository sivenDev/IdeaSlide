import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getRecentFiles, removeRecentFile } from "../lib/tauriCommands";
import type { RecentFile } from "../types";

interface LaunchScreenProps {
  onNewFile: () => Promise<void> | void;
  onOpenWorkspace: () => Promise<void> | void;
  onOpenFile: () => Promise<void> | void;
  onOpenRecent: (path: string) => Promise<void> | void;
}

function formatRelativeTime(isoString: string): string {
  const timestamp = new Date(isoString).getTime();
  if (!Number.isFinite(timestamp)) return "unknown";
  const minutes = Math.floor((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function LaunchScreen({ onNewFile, onOpenWorkspace, onOpenFile, onOpenRecent }: LaunchScreenProps) {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);

  useEffect(() => {
    getRecentFiles().then(setRecentFiles).finally(() => setLoading(false));
  }, []);

  const run = async (action: () => Promise<void> | void) => {
    try {
      setError(undefined);
      await action();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (!/cancelled/i.test(message)) setError(message);
    }
  };

  return (
    <div
      className="flex h-screen bg-[#f6f7f9]"
      onMouseDown={(event) => {
        if (!(event.target as HTMLElement).closest("button, a, input, [data-no-drag]")) {
          getCurrentWindow().startDragging();
        }
      }}
    >
      <section className={`relative flex w-[42%] min-w-[360px] flex-col justify-center overflow-hidden bg-gradient-to-br from-[#625dd6] via-[#6d63db] to-[#7b61c8] px-12 text-white ${isMac ? "pt-10" : ""}`}>
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10" />
        <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-white/[0.035]" />
        <div className="relative z-10 max-w-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">Local-first workspace</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">IdeaNote</h1>
          <p className="mt-4 max-w-xs text-sm leading-6 text-white/65">A calm place for visual thinking, real files, and ideas that grow beyond slides.</p>

          {error && <div className="mt-5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs text-white/90">{error}</div>}

          <div className="mt-8 flex flex-col gap-2.5" data-no-drag>
            <button type="button" onClick={() => void run(onNewFile)} className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/15 px-5 py-3 text-left text-sm font-medium backdrop-blur transition hover:bg-white/20">
              <span className="text-lg">＋</span><span>New File</span>
            </button>
            <button type="button" onClick={() => void run(onOpenWorkspace)} className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/[0.09] px-5 py-3 text-left text-sm font-medium transition hover:bg-white/15">
              <span className="text-base">▱</span><span>Open Workspace</span>
            </button>
            <button type="button" onClick={() => void run(onOpenFile)} className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/[0.06] px-5 py-3 text-left text-sm font-medium transition hover:bg-white/12">
              <span className="text-base">◇</span><span>Open File</span>
            </button>
          </div>
        </div>
        <span className="absolute bottom-5 left-12 text-[10px] font-medium tracking-wide text-white/30">IdeaNote 0.1.0</span>
      </section>

      <section className={`flex min-w-0 flex-1 flex-col bg-white px-10 pb-8 ${isMac ? "pt-16" : "pt-12"}`} data-no-drag>
        <div className="flex items-end justify-between border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Recent Files</h2>
            <p className="mt-1 text-xs text-gray-400">Standalone IdeaSketch documents</p>
          </div>
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {loading ? <div className="py-8 text-sm text-gray-400">Loading…</div> : recentFiles.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">No recent files yet.</div>
          ) : recentFiles.map((file) => (
            <div key={file.path} className="group flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-gray-50">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void run(() => onOpenRecent(file.path))}>
                <div className="truncate text-sm font-medium text-gray-800">{file.name}</div>
                <div className="mt-1 truncate text-xs text-gray-400">{file.path}</div>
              </button>
              <span className="text-[11px] text-gray-400">{formatRelativeTime(file.opened_at)}</span>
              <button
                type="button"
                aria-label={`Remove ${file.name} from recent files`}
                className="invisible flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600 group-hover:visible"
                onClick={() => void removeRecentFile(file.path).then(() => setRecentFiles((files) => files.filter((item) => item.path !== file.path)))}
              >×</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
