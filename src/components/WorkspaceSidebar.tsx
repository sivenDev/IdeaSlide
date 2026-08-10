import type { ReactNode } from "react";
import {
  FileInput,
  FilePlus2,
  FileText,
  FolderOpen,
  FolderTree,
  Presentation,
  Settings,
  XCircle,
} from "lucide-react";
import type { ApplicationMode } from "../types";
import { WorkspaceStart } from "./WorkspaceStart";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/DropdownMenu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/Tooltip";

export type WorkspaceSidebarSurface = "workspace" | "start";

interface WorkspaceSidebarProps {
  mode: ApplicationMode;
  detailVisible: boolean;
  surface: WorkspaceSidebarSurface;
  onSurfaceChange: (surface: WorkspaceSidebarSurface) => void;
  onShowDetail: () => void;
  onNewFile: (fileType: string) => Promise<void> | void;
  onOpenWorkspace: (root?: string) => Promise<void> | void;
  onOpenFile: () => Promise<void> | void;
  onOpenRecentWorkspace: (path: string) => Promise<void> | void;
  onOpenRecentFile: (path: string) => Promise<void> | void;
  onOpenSettings: () => void;
  onResetSession: () => Promise<void> | void;
  children?: ReactNode;
}

function RailButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active || undefined}
          className={`ideanote-workspace-rail__button ${active ? "is-active" : ""}`}
          onClick={onClick}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function WorkspaceSidebar({
  mode,
  detailVisible,
  surface,
  onSurfaceChange,
  onShowDetail,
  onNewFile,
  onOpenWorkspace,
  onOpenFile,
  onOpenRecentWorkspace,
  onOpenRecentFile,
  onOpenSettings,
  onResetSession,
  children,
}: WorkspaceSidebarProps) {
  const showSurface = (nextSurface: WorkspaceSidebarSurface) => {
    onSurfaceChange(nextSurface);
    onShowDetail();
  };
  const sessionLabel = mode === "workspace" ? "Close Workspace" : "Close File";

  return (
    <TooltipProvider>
      <aside className="ideanote-workspace-sidebar" aria-label="Workspace">
        <nav className="ideanote-workspace-rail" aria-label="Workspace tools">
          <div className="ideanote-workspace-rail__brand" aria-label="IdeaNote">IN</div>
          <RailButton
            label={mode === "workspace" ? "Workspace Explorer" : "Workspace start"}
            active={detailVisible && surface === (mode === "workspace" ? "workspace" : "start")}
            onClick={() => showSurface(mode === "workspace" ? "workspace" : "start")}
          >
            <FolderTree aria-hidden size={17} />
          </RailButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <span><RailButton label="New file"><FilePlus2 aria-hidden size={17} /></RailButton></span>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-48">
              <DropdownMenuItem onSelect={() => void onNewFile("ideasketch")}><Presentation aria-hidden size={14} />IdeaSketch</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void onNewFile("markdown")}><FileText aria-hidden size={14} />Markdown</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <RailButton label="Choose Workspace" onClick={() => void onOpenWorkspace()}><FolderOpen aria-hidden size={17} /></RailButton>
          <RailButton label="Choose file" onClick={() => void onOpenFile()}><FileInput aria-hidden size={17} /></RailButton>
          <div className="ideanote-workspace-rail__spacer" />
          {mode !== "empty" && (
            <RailButton label={sessionLabel} onClick={() => void onResetSession()}><XCircle aria-hidden size={17} /></RailButton>
          )}
          <RailButton label="Settings" onClick={onOpenSettings}><Settings aria-hidden size={17} /></RailButton>
        </nav>
        <div className={`ideanote-workspace-sidebar__detail ${detailVisible ? "is-visible" : ""}`}>
          {mode === "workspace" && surface === "workspace" && children ? children : (
            <WorkspaceStart
              onNewFile={onNewFile}
              onOpenWorkspace={() => onOpenWorkspace()}
              onOpenFile={onOpenFile}
              onOpenRecentWorkspace={onOpenRecentWorkspace}
              onOpenRecentFile={onOpenRecentFile}
              onOpenSettings={onOpenSettings}
            />
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
