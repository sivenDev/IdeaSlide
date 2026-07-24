import { getCurrentWindow } from "@tauri-apps/api/window";
import { SaveIndicator } from "./SaveIndicator";
import { Separator } from "./ui/Separator";
import { ToolbarAction } from "./ui/ToolbarAction";
import { TooltipProvider } from "./ui/Tooltip";

interface ToolbarProps {
  fileName?: string;
  isDirty: boolean;
  isSaving: boolean;
  onNewIdea: () => void;
  onOpenFile: () => void;
  onSave: () => void;
  onGoHome: () => void;
}

export function Toolbar({
  fileName,
  isDirty,
  isSaving,
  onNewIdea,
  onOpenFile,
  onSave,
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
          <ToolbarAction tooltip="Back to home" aria-label="Back to home" onClick={onGoHome}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" /><path d="M9 22V12h6v10" /></svg>
          </ToolbarAction>
          <Separator orientation="vertical" className="idea-slide-window-toolbar__separator" />
          <ToolbarAction tooltip="New file" aria-label="New file" onClick={onNewIdea}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></svg>
          </ToolbarAction>
          <ToolbarAction tooltip="Open file" aria-label="Open file" onClick={onOpenFile}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2Z" /></svg>
          </ToolbarAction>
          <ToolbarAction tooltip="Save" aria-label="Save" onClick={onSave}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>
          </ToolbarAction>
          <SaveIndicator isDirty={isDirty} isSaving={isSaving} />
        </div>

        <div className="idea-slide-window-toolbar__title">
          {fileName || "Untitled"}
        </div>

        <div className="idea-slide-window-toolbar__drag-region" data-drag-region />
      </div>
    </TooltipProvider>
  );
}
