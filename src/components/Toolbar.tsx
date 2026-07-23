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
        className={`flex h-12 items-center gap-1 border-b border-gray-200 bg-white px-3 ${isMac ? "pl-20" : "pr-36"}`}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget || (event.target as HTMLElement).closest("[data-drag-region]")) {
            getCurrentWindow().startDragging();
          }
        }}
      >
        <ToolbarAction tooltip="Back to home" aria-label="Back to home" onClick={onGoHome}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" /><path d="M9 22V12h6v10" /></svg>
        </ToolbarAction>
        <Separator orientation="vertical" className="mx-1" />
        <span className="mr-1 text-sm font-medium text-gray-800">{fileName || "Untitled"}</span>
        <SaveIndicator isDirty={isDirty} isSaving={isSaving} />

        <div className="flex-1" data-drag-region />

        <div className="flex items-center gap-1">
          <ToolbarAction tooltip="New workspace" aria-label="New workspace" onClick={onNewIdea}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></svg>
          </ToolbarAction>
          <ToolbarAction tooltip="Open workspace" aria-label="Open workspace" onClick={onOpenFile}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2Z" /></svg>
          </ToolbarAction>
          <ToolbarAction tooltip="Save" aria-label="Save" onClick={onSave}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>
          </ToolbarAction>
        </div>
      </div>
    </TooltipProvider>
  );
}
