import {
  ChevronRight,
  ExternalLink,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  PanelLeftClose,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { NativeWindowFrame } from "../hooks/useNativeWindowFrame";
import { groupRecentFiles } from "../lib/recentFiles";
import type { RecentFile, RecentWorkspace } from "../types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/DropdownMenu";
import { Input } from "./ui/Input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/Tooltip";
import { DocumentFileGlyph } from "./DocumentFileGlyph";

const iconProps = { "aria-hidden": true, size: 14, strokeWidth: 1.8 } as const;

function CreateMenu({
  label,
  onCreate,
}: {
  label: string;
  onCreate: (fileType: "ideasketch" | "markdown" | "directory") => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="ideanote-tree-action" type="button" aria-label={`Create in ${label}`}>
          <Plus {...iconProps} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="ideanote-compact-menu">
        <DropdownMenuItem onSelect={() => onCreate("ideasketch")}><DocumentFileGlyph fileType="ideasketch" />New IdeaSketch</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onCreate("markdown")}><DocumentFileGlyph fileType="markdown" />New Markdown</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onCreate("directory")}><FolderPlus {...iconProps} />New Folder</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function WorkspaceSidebar({
  frame,
  activeRoot,
  workspaces,
  recents,
  loading,
  error,
  activeWorkspaceTree,
  onToggle,
  onOpenWorkspace,
  onCreateInWorkspace,
  onRefreshWorkspace,
  onRenameWorkspace,
  onRemoveWorkspace,
  onOpenRecent,
  onRenameRecent,
  onRemoveRecent,
  onRevealWorkspace,
  onRevealRecent,
  onRetry,
  onOpenSettings,
}: {
  frame: NativeWindowFrame;
  activeRoot?: string;
  workspaces: RecentWorkspace[];
  recents: RecentFile[];
  loading: boolean;
  error?: string;
  activeWorkspaceTree?: ReactNode;
  onToggle: () => void;
  onOpenWorkspace: (path?: string) => void;
  onCreateInWorkspace: (root: string, fileType: "ideasketch" | "markdown" | "directory") => void;
  onRefreshWorkspace: () => void;
  onRenameWorkspace: (root: string, name: string) => void;
  onRemoveWorkspace: (root: string) => void;
  onOpenRecent: (path: string) => void;
  onRenameRecent: (path: string, name: string) => void;
  onRemoveRecent: (path: string) => void;
  onRevealWorkspace: (path: string) => void;
  onRevealRecent: (path: string) => void;
  onRetry: () => void;
  onOpenSettings: () => void;
}) {
  const [renaming, setRenaming] = useState<{ kind: "workspace" | "recent"; path: string }>();
  const [draftName, setDraftName] = useState("");
  const [collapsedWorkspaceRoots, setCollapsedWorkspaceRoots] = useState<Set<string>>(() => new Set());
  const timeline = useMemo(() => groupRecentFiles(recents), [recents]);

  const beginRename = (kind: "workspace" | "recent", path: string, name: string) => {
    setRenaming({ kind, path });
    setDraftName(name);
  };
  const commitRename = () => {
    if (!renaming) return;
    const name = draftName.trim();
    if (name) {
      if (renaming.kind === "workspace") onRenameWorkspace(renaming.path, name);
      else onRenameRecent(renaming.path, name);
    }
    setRenaming(undefined);
  };
  const toggleWorkspaceRoot = (path: string, active: boolean) => {
    if (!active) {
      setCollapsedWorkspaceRoots((current) => {
        if (!current.has(path)) return current;
        const next = new Set(current);
        next.delete(path);
        return next;
      });
      onOpenWorkspace(path);
      return;
    }
    setCollapsedWorkspaceRoots((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  return (
    <aside className={`ideanote-workspace-sidebar ${frame.className}`} aria-label="Workspaces">
      <header className={`ideanote-workspace-crown ${frame.className}`} data-tauri-drag-region>
        <button type="button" aria-label="Hide Workspaces" onClick={onToggle}>
          <PanelLeftClose aria-hidden size={16} />
        </button>
      </header>
      <div className="ideanote-workspace-section-header">
        <div className="ideanote-workspace-section-title">Workspaces</div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="ideanote-workspace-section-add"
                type="button"
                aria-label="Add Workspace"
                onClick={() => onOpenWorkspace()}
              >
                <Plus {...iconProps} />
              </button>
            </TooltipTrigger>
            <TooltipContent>Add Workspace</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <nav className="ideanote-workspace-scroll" aria-label="Workspaces and recent files">
        {error && (
          <div className="ideanote-navigation-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={onRetry}>Retry</button>
          </div>
        )}
        {loading && workspaces.length === 0 && <p className="ideanote-sidebar-empty">Loading…</p>}
        {!loading && workspaces.length === 0 && (
          <button className="ideanote-open-workspace-empty" type="button" onClick={() => onOpenWorkspace()}>
            <FolderPlus {...iconProps} /> Open Workspace
          </button>
        )}
        {workspaces.map((workspace) => {
          const active = workspace.path === activeRoot;
          const expanded = active && !collapsedWorkspaceRoots.has(workspace.path);
          const isRenaming = renaming?.kind === "workspace" && renaming.path === workspace.path;
          return (
            <section className={`ideanote-workspace-root ${active ? "is-active" : ""}`} key={workspace.path}>
              <div className="ideanote-workspace-root__row">
                {isRenaming ? (
                  <div className="ideanote-workspace-root__main is-renaming">
                    <ChevronRight className={`ideanote-workspace-root__chevron ${expanded ? "is-open" : ""}`} {...iconProps} />
                    {expanded ? <FolderOpen className="ideanote-workspace-root__folder" {...iconProps} /> : <Folder className="ideanote-workspace-root__folder" {...iconProps} />}
                    <Input
                      autoFocus
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitRename();
                        if (event.key === "Escape") setRenaming(undefined);
                        event.stopPropagation();
                      }}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="ideanote-workspace-root__main"
                    aria-current={active ? "page" : undefined}
                    aria-expanded={expanded}
                    onClick={() => toggleWorkspaceRoot(workspace.path, active)}
                  >
                    <ChevronRight className={`ideanote-workspace-root__chevron ${expanded ? "is-open" : ""}`} {...iconProps} />
                    {expanded ? <FolderOpen className="ideanote-workspace-root__folder" {...iconProps} /> : <Folder className="ideanote-workspace-root__folder" {...iconProps} />}
                    <span>{workspace.name}</span>
                  </button>
                )}
                {!isRenaming && (
                  <div className="ideanote-tree-actions">
                    <CreateMenu label={workspace.name} onCreate={(fileType) => onCreateInWorkspace(workspace.path, fileType)} />
                    {active && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className="ideanote-tree-action"
                              type="button"
                              aria-label={`Refresh ${workspace.name}`}
                              onClick={onRefreshWorkspace}
                            >
                              <RefreshCw {...iconProps} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{`Refresh ${workspace.name}`}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="ideanote-tree-action" type="button" aria-label={`Actions for ${workspace.name}`}>
                          <MoreHorizontal {...iconProps} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" sideOffset={3} className="ideanote-compact-menu ideanote-workspace-menu">
                        <DropdownMenuItem onSelect={() => beginRename("workspace", workspace.path, workspace.name)}><Pencil {...iconProps} />Rename</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onRevealWorkspace(workspace.path)}><ExternalLink {...iconProps} />Show in Finder</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="is-danger" onSelect={() => onRemoveWorkspace(workspace.path)}><Trash2 {...iconProps} />Remove from Workspaces</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
              {expanded && activeWorkspaceTree}
            </section>
          );
        })}

        <section className="ideanote-recents" aria-labelledby="ideanote-recents-title">
          <div className="ideanote-recents__title" id="ideanote-recents-title">Recents</div>
          {timeline.map((group) => (
            <div className="ideanote-recent-group" key={group.id}>
              <div className="ideanote-recent-group__label"><span>{group.label}</span></div>
              {group.items.map((recent) => {
                const isRenaming = renaming?.kind === "recent" && renaming.path === recent.path;
                return (
                  <div className="ideanote-recent-row" key={recent.path}>
                    {isRenaming ? (
                      <div className="ideanote-recent-row__main is-renaming">
                        <DocumentFileGlyph path={recent.path} />
                        <Input
                          autoFocus
                          value={draftName}
                          onChange={(event) => setDraftName(event.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") commitRename();
                            if (event.key === "Escape") setRenaming(undefined);
                            event.stopPropagation();
                          }}
                        />
                      </div>
                    ) : (
                      <button className="ideanote-recent-row__main" type="button" onClick={() => onOpenRecent(recent.path)}>
                        <DocumentFileGlyph path={recent.path} />
                        <span>{recent.name}</span>
                      </button>
                    )}
                    {!isRenaming && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="ideanote-tree-action" type="button" aria-label={`Actions for ${recent.name}`}><MoreHorizontal {...iconProps} /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" align="start" sideOffset={3} className="ideanote-compact-menu">
                          <DropdownMenuItem onSelect={() => beginRename("recent", recent.path, recent.name)}><Pencil {...iconProps} />Rename</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => onRevealRecent(recent.path)}><ExternalLink {...iconProps} />Show in Finder</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="is-danger" onSelect={() => onRemoveRecent(recent.path)}><Trash2 {...iconProps} />Remove</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {!loading && recents.length === 0 && <p className="ideanote-sidebar-empty">Standalone files you open will appear here.</p>}
        </section>
      </nav>
      <footer className="ideanote-workspace-footer">
        <button type="button" onClick={onOpenSettings}><Settings {...iconProps} /><span>Settings</span><kbd>⌘,</kbd></button>
      </footer>
    </aside>
  );
}
