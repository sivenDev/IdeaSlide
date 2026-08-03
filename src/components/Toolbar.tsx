import { getCurrentWindow } from "@tauri-apps/api/window";
import { SaveIndicator } from "./SaveIndicator";
import { Separator } from "./ui/Separator";
import { ToolbarAction } from "./ui/ToolbarAction";
import { TooltipProvider } from "./ui/Tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/DropdownMenu";

interface ToolbarProps {
  fileName?: string;
  isDirty: boolean;
  isSaving: boolean;
  onNewFile: () => void;
  onOpenFile: () => void;
  onOpenWorkspace: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onSaveAll: () => void;
  onGoHome: () => void;
}

export function Toolbar({
  fileName,
  isDirty,
  isSaving,
  onNewFile,
  onOpenFile,
  onOpenWorkspace,
  onSave,
  onSaveAs,
  onSaveAll,
  onGoHome,
}: ToolbarProps) {
  const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
  return (
    <TooltipProvider>
      <div
        className={`idea-slide-window-toolbar ${isMac ? "is-mac" : "is-non-mac"}`}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget || (event.target as HTMLElement).closest("[data-drag-region]")) {
            getCurrentWindow().startDragging();
          }
        }}
      >
        <div className="idea-slide-window-toolbar__commands">
          <ToolbarAction tooltip="Back to Home" aria-label="Back to Home" onClick={onGoHome}>⌂</ToolbarAction>
          <Separator orientation="vertical" className="idea-slide-window-toolbar__separator" />
          <ToolbarAction tooltip="New File" aria-label="New File" onClick={onNewFile}>＋</ToolbarAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <span>
                <ToolbarAction tooltip="Open" aria-label="Open">▱</ToolbarAction>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem onSelect={onOpenWorkspace}>Open Workspace…</DropdownMenuItem>
              <DropdownMenuItem onSelect={onOpenFile}>Open File…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ToolbarAction tooltip="Save" aria-label="Save" onClick={onSave}>⌑</ToolbarAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <span>
                <ToolbarAction tooltip="More Save options" aria-label="More Save options">⌄</ToolbarAction>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuItem onSelect={onSave}>Save</DropdownMenuItem>
              <DropdownMenuItem onSelect={onSaveAs}>Save As…</DropdownMenuItem>
              <DropdownMenuItem onSelect={onSaveAll}>Save All</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <SaveIndicator isDirty={isDirty} isSaving={isSaving} />
        </div>
        <div className="idea-slide-window-toolbar__title">{fileName || "IdeaNote"}</div>
        <div className="idea-slide-window-toolbar__drag-region" data-drag-region />
      </div>
    </TooltipProvider>
  );
}
