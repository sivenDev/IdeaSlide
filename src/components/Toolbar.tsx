import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ChevronDown,
  FileInput,
  FileOutput,
  FilePenLine,
  FolderOpen,
  House,
  Save,
} from "lucide-react";
import { useEffect, useState } from "react";
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
  fileType?: string;
  isDirty: boolean;
  isSaving: boolean;
  onOpenFile: () => void;
  onOpenWorkspace: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onGoHome: () => void;
}

export function Toolbar({
  fileName,
  fileType,
  isDirty,
  isSaving,
  onOpenFile,
  onOpenWorkspace,
  onSave,
  onSaveAs,
  onGoHome,
}: ToolbarProps) {
  const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
  const isTauriRuntime = "__TAURI_INTERNALS__" in window;
  const [openMenuOpen, setOpenMenuOpen] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);

  useEffect(() => {
    if (!isMac || !isTauriRuntime) return;
    const appWindow = getCurrentWindow();
    let disposed = false;
    let observedFocusChange = false;
    let unlisten: (() => void) | undefined;

    appWindow.onFocusChanged(({ payload: focused }) => {
      observedFocusChange = true;
      if (!disposed) setIsWindowFocused(focused);
    }).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    }).catch(console.error);

    appWindow.isFocused().then((focused) => {
      if (!disposed && !observedFocusChange) setIsWindowFocused(focused);
    }).catch(console.error);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [isMac, isTauriRuntime]);

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
        {isMac && !isWindowFocused && (
          <div className="idea-slide-window-toolbar__traffic-lights" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}
        <div className="idea-slide-window-toolbar__commands">
          <ToolbarAction tooltip="Back to Home" aria-label="Back to Home" onClick={onGoHome}>
            <House {...toolbarIconProps} />
          </ToolbarAction>
          <Separator orientation="vertical" className="idea-slide-window-toolbar__separator" />
          <DropdownMenu open={openMenuOpen} onOpenChange={setOpenMenuOpen}>
            <DropdownMenuTrigger asChild>
              <span>
                <ToolbarAction tooltip={openMenuOpen ? undefined : "Open"} aria-label="Open">
                  <FolderOpen {...toolbarIconProps} />
                </ToolbarAction>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem onSelect={onOpenWorkspace} className="whitespace-nowrap">
                <FolderOpen {...menuIconProps} />
                <span>Open Workspace…</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onOpenFile} className="whitespace-nowrap">
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
              <DropdownMenuItem onSelect={onSaveAs}>
                <FileOutput {...menuIconProps} />
                <span>Save As…</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <SaveIndicator isDirty={isDirty} isSaving={isSaving} />
        </div>
        <div className="idea-slide-window-toolbar__title">
          {fileName && (
            fileType === "ideasketch"
              ? <FilePenLine className="idea-slide-window-toolbar__title-icon is-ideasketch" aria-hidden size={14} strokeWidth={1.8} />
              : <FileInput className="idea-slide-window-toolbar__title-icon" aria-hidden size={14} strokeWidth={1.8} />
          )}
          <span>{fileName || "IdeaNote"}</span>
        </div>
        <div className="idea-slide-window-toolbar__drag-region" data-drag-region />
      </div>
    </TooltipProvider>
  );
}
