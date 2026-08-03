import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ChevronDown,
  FileInput,
  FileOutput,
  FilePlus2,
  FolderOpen,
  House,
  Save,
  SaveAll,
} from "lucide-react";
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

const toolbarIconProps = { "aria-hidden": true, size: 15, strokeWidth: 1.8 } as const;
const menuIconProps = { "aria-hidden": true, size: 14, strokeWidth: 1.8 } as const;

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
          <ToolbarAction tooltip="Back to Home" aria-label="Back to Home" onClick={onGoHome}>
            <House {...toolbarIconProps} />
          </ToolbarAction>
          <Separator orientation="vertical" className="idea-slide-window-toolbar__separator" />
          <ToolbarAction tooltip="New File" aria-label="New File" onClick={onNewFile}>
            <FilePlus2 {...toolbarIconProps} />
          </ToolbarAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <span>
                <ToolbarAction tooltip="Open" aria-label="Open">
                  <FolderOpen {...toolbarIconProps} />
                </ToolbarAction>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem onSelect={onOpenWorkspace}>
                <FolderOpen {...menuIconProps} />
                <span>Open Workspace…</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onOpenFile}>
                <FileInput {...menuIconProps} />
                <span>Open File…</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ToolbarAction tooltip="Save" aria-label="Save" onClick={onSave}>
            <Save {...toolbarIconProps} />
          </ToolbarAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <span>
                <ToolbarAction tooltip="More Save options" aria-label="More Save options">
                  <ChevronDown {...toolbarIconProps} />
                </ToolbarAction>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuItem onSelect={onSave}>
                <Save {...menuIconProps} />
                <span>Save</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onSaveAs}>
                <FileOutput {...menuIconProps} />
                <span>Save As…</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onSaveAll}>
                <SaveAll {...menuIconProps} />
                <span>Save All</span>
              </DropdownMenuItem>
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
