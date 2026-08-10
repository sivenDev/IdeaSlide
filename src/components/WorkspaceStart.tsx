import { useEffect, useState } from "react";
import { FileInput, FileText, FolderOpen, Presentation, Settings, X } from "lucide-react";
import {
  getRecentFiles,
  getRecentWorkspaces,
  removeRecentFile,
  removeRecentWorkspace,
} from "../lib/tauriCommands";
import type { RecentFile, RecentWorkspace } from "../types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/Tabs";

type RecentTab = "workspaces" | "files";

interface WorkspaceStartProps {
  onNewFile: (fileType: string) => Promise<void> | void;
  onOpenWorkspace: () => Promise<void> | void;
  onOpenFile: () => Promise<void> | void;
  onOpenRecentWorkspace: (path: string) => Promise<void> | void;
  onOpenRecentFile: (path: string) => Promise<void> | void;
  onOpenSettings: () => void;
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

export function WorkspaceStart({
  onNewFile,
  onOpenWorkspace,
  onOpenFile,
  onOpenRecentWorkspace,
  onOpenRecentFile,
  onOpenSettings,
}: WorkspaceStartProps) {
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>([]);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [activeRecentTab, setActiveRecentTab] = useState<RecentTab>("files");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    Promise.all([getRecentWorkspaces(), getRecentFiles()])
      .then(([workspaces, files]) => {
        if (!active) return;
        setRecentWorkspaces(workspaces);
        setRecentFiles(files);
        if (files.length === 0 && workspaces.length > 0) setActiveRecentTab("workspaces");
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const run = async (action: () => Promise<void> | void) => {
    try {
      setError(undefined);
      await action();
    } catch (cause) {
      const nextError = cause instanceof Error ? cause.message : String(cause);
      if (!/cancelled/i.test(nextError)) setError(nextError);
    }
  };

  const renderRecentFile = (file: RecentFile) => (
    <div key={file.path} className="ideanote-workspace-start__recent-row">
      <button type="button" className="ideanote-workspace-start__recent-main" onClick={() => void run(() => onOpenRecentFile(file.path))}>
        <span className="ideanote-workspace-start__recent-name">{file.name}</span>
        <span className="ideanote-workspace-start__recent-path">{file.path}</span>
      </button>
      <span className="ideanote-workspace-start__recent-time">{formatRelativeTime(file.opened_at)}</span>
      <button
        type="button"
        aria-label={`Remove ${file.name} from recent files`}
        className="ideanote-workspace-start__remove"
        onClick={() => void run(async () => {
          await removeRecentFile(file.path);
          const remaining = recentFiles.filter((item) => item.path !== file.path);
          setRecentFiles(remaining);
          if (remaining.length === 0 && recentWorkspaces.length > 0) setActiveRecentTab("workspaces");
        })}
      >
        <X aria-hidden size={13} />
      </button>
    </div>
  );

  const renderRecentWorkspace = (workspace: RecentWorkspace) => (
    <div key={workspace.path} className="ideanote-workspace-start__recent-row">
      <button type="button" className="ideanote-workspace-start__recent-main" onClick={() => void run(() => onOpenRecentWorkspace(workspace.path))}>
        <span className="ideanote-workspace-start__recent-name">{workspace.name}</span>
        <span className="ideanote-workspace-start__recent-path">{workspace.path}</span>
      </button>
      <span className="ideanote-workspace-start__recent-time">{formatRelativeTime(workspace.opened_at)}</span>
      <button
        type="button"
        aria-label={`Remove ${workspace.name} from recent Workspaces`}
        className="ideanote-workspace-start__remove"
        onClick={() => void run(async () => {
          await removeRecentWorkspace(workspace.path);
          setRecentWorkspaces((items) => items.filter((item) => item.path !== workspace.path));
        })}
      >
        <X aria-hidden size={13} />
      </button>
    </div>
  );

  return (
    <section className="ideanote-workspace-start" aria-label="Workspace start">
      <header className="ideanote-workspace-start__header">
        <div>
          <span className="ideanote-workspace-start__eyebrow">Local workspace</span>
          <h2>Start working</h2>
        </div>
        <button type="button" className="ideanote-workspace-start__settings" onClick={onOpenSettings} aria-label="Open Settings">
          <Settings aria-hidden size={15} />
        </button>
      </header>

      <div className="ideanote-workspace-start__actions">
        <button type="button" onClick={() => void run(() => onNewFile("ideasketch"))}>
          <Presentation aria-hidden size={16} /><span><strong>New IdeaSketch</strong><small>Create a local visual document</small></span>
        </button>
        <button type="button" onClick={() => void run(() => onNewFile("markdown"))}>
          <FileText aria-hidden size={16} /><span><strong>New Markdown</strong><small>Write in a portable text file</small></span>
        </button>
        <button type="button" onClick={() => void run(onOpenWorkspace)}>
          <FolderOpen aria-hidden size={16} /><span><strong>Open Workspace</strong><small>Use a real local folder</small></span>
        </button>
        <button type="button" onClick={() => void run(onOpenFile)}>
          <FileInput aria-hidden size={16} /><span><strong>Open File</strong><small>Work with one standalone file</small></span>
        </button>
      </div>

      {error && <div className="ideanote-workspace-start__error" role="status">{error}</div>}

      <Tabs value={activeRecentTab} onValueChange={(value) => setActiveRecentTab(value as RecentTab)} className="ideanote-workspace-start__recents">
        <TabsList aria-label="Recent items">
          <TabsTrigger value="files">Files <span>{recentFiles.length}</span></TabsTrigger>
          <TabsTrigger value="workspaces">Workspaces <span>{recentWorkspaces.length}</span></TabsTrigger>
        </TabsList>
        <TabsContent value="files">
          {loading ? <p className="ideanote-workspace-start__empty">Loading…</p>
            : recentFiles.length > 0 ? recentFiles.map(renderRecentFile)
              : <p className="ideanote-workspace-start__empty">No recent files yet.</p>}
        </TabsContent>
        <TabsContent value="workspaces">
          {loading ? <p className="ideanote-workspace-start__empty">Loading…</p>
            : recentWorkspaces.length > 0 ? recentWorkspaces.map(renderRecentWorkspace)
              : <p className="ideanote-workspace-start__empty">No recent Workspaces yet.</p>}
        </TabsContent>
      </Tabs>
    </section>
  );
}
