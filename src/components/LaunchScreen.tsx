import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { FileInput, FolderOpen, Settings, X } from "lucide-react";
import {
  getRecentFiles,
  getRecentWorkspaces,
  removeRecentFile,
  removeRecentWorkspace,
} from "../lib/tauriCommands";
import type { RecentFile, RecentWorkspace } from "../types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/Tabs";

type RecentTab = "workspaces" | "files";

interface LaunchScreenProps {
  onNewFile: () => Promise<void> | void;
  onOpenWorkspace: () => Promise<void> | void;
  onOpenFile: () => Promise<void> | void;
  onOpenRecentWorkspace: (path: string) => Promise<void> | void;
  onOpenRecentFile: (path: string) => Promise<void> | void;
  onOpenSettings: () => void;
}

const launchActionIconProps = {
  "aria-hidden": true,
  size: 18,
  strokeWidth: 1.8,
} as const;

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

export function LaunchScreen({
  onNewFile,
  onOpenWorkspace,
  onOpenFile,
  onOpenRecentWorkspace,
  onOpenRecentFile,
  onOpenSettings,
}: LaunchScreenProps) {
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>([]);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [activeRecentTab, setActiveRecentTab] = useState<RecentTab>("files");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);

  useEffect(() => {
    let active = true;
    Promise.all([getRecentWorkspaces(), getRecentFiles()])
      .then(([workspaces, files]) => {
        if (!active) return;
        setRecentWorkspaces(workspaces);
        setRecentFiles(files);
        if (files.length === 0 && workspaces.length > 0) setActiveRecentTab("workspaces");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
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
              <FolderOpen {...launchActionIconProps} /><span>Open Workspace</span>
            </button>
            <button type="button" onClick={() => void run(onOpenFile)} className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/[0.06] px-5 py-3 text-left text-sm font-medium transition hover:bg-white/12">
              <FileInput {...launchActionIconProps} /><span>Open File</span>
            </button>
            <button type="button" onClick={onOpenSettings} className="mt-2 flex items-center gap-3 rounded-xl px-5 py-2.5 text-left text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white">
              <Settings {...launchActionIconProps} /><span>Settings</span>
            </button>
          </div>
        </div>
        <span className="absolute bottom-5 left-12 text-[10px] font-medium tracking-wide text-white/30">IdeaNote 0.1.0</span>
      </section>

      <section className={`flex min-w-0 flex-1 flex-col bg-white px-10 pb-8 ${isMac ? "pt-16" : "pt-12"}`} data-no-drag>
        <Tabs
          value={activeRecentTab}
          onValueChange={(value) => setActiveRecentTab(value as RecentTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="border-b border-gray-100">
            <TabsList className="gap-6" aria-label="Recent items">
              <TabsTrigger
                value="files"
                className="-mb-px gap-2 rounded-none border-x-0 border-t-0 border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 shadow-none hover:bg-transparent data-[state=active]:border-[#665fd8] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                <span>Recent Files</span>
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">{recentFiles.length}</span>
              </TabsTrigger>
              <TabsTrigger
                value="workspaces"
                className="-mb-px gap-2 rounded-none border-x-0 border-t-0 border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 shadow-none hover:bg-transparent data-[state=active]:border-[#665fd8] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                <span>Recent Workspaces</span>
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">{recentWorkspaces.length}</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="files" className="mt-0 min-h-0 flex-1 overflow-y-auto pt-3">
            {loading ? <div className="py-8 text-sm text-gray-400">Loading…</div> : recentFiles.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">No recent files yet.</div>
            ) : recentFiles.map((file) => (
              <div key={file.path} className="group flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-gray-50 focus-within:bg-gray-50">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void run(() => onOpenRecentFile(file.path))}>
                  <div className="truncate text-sm font-medium text-gray-800">{file.name}</div>
                  <div className="mt-1 truncate text-xs text-gray-400">{file.path}</div>
                </button>
                <span className="shrink-0 text-[11px] text-gray-400">{formatRelativeTime(file.opened_at)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name} from recent files`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
                  onClick={() => void run(async () => {
                    await removeRecentFile(file.path);
                    const remaining = recentFiles.filter((item) => item.path !== file.path);
                    setRecentFiles(remaining);
                    if (remaining.length === 0 && recentWorkspaces.length > 0) setActiveRecentTab("workspaces");
                  })}
                >
                  <X aria-hidden="true" size={14} strokeWidth={1.8} />
                </button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="workspaces" className="mt-0 min-h-0 flex-1 overflow-y-auto pt-3">
            {loading ? <div className="py-8 text-sm text-gray-400">Loading…</div> : recentWorkspaces.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">No recent Workspaces yet.</div>
            ) : recentWorkspaces.map((workspace) => (
              <div key={workspace.path} className="group flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-gray-50 focus-within:bg-gray-50">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void run(() => onOpenRecentWorkspace(workspace.path))}>
                  <div className="truncate text-sm font-medium text-gray-800">{workspace.name}</div>
                  <div className="mt-1 truncate text-xs text-gray-400">{workspace.path}</div>
                </button>
                <span className="shrink-0 text-[11px] text-gray-400">{formatRelativeTime(workspace.opened_at)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${workspace.name} from recent Workspaces`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
                  onClick={() => void run(async () => {
                    await removeRecentWorkspace(workspace.path);
                    setRecentWorkspaces((items) => items.filter((item) => item.path !== workspace.path));
                  })}
                >
                  <X aria-hidden="true" size={14} strokeWidth={1.8} />
                </button>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
