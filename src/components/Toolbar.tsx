import { getCurrentWindow } from "@tauri-apps/api/window";
import { SaveIndicator } from "./SaveIndicator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/DropdownMenu";
import { Separator } from "./ui/Separator";
import { ToolbarAction } from "./ui/ToolbarAction";
import { TooltipProvider } from "./ui/Tooltip";

interface ToolbarProps {
  fileName?: string;
  isDirty: boolean;
  isSaving: boolean;
  showPreview: boolean;
  onNewIdea: () => void;
  onOpenFile: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onGoHome: () => void;
  onTogglePreview: () => void;
  onAddSlide: () => void;
  onStartPreview: () => void;
  onStartFullscreen: () => void;
  onStartFromBeginning: () => void;
}

export function Toolbar({
  fileName,
  isDirty,
  isSaving,
  onNewIdea,
  onOpenFile,
  onSave,
  onGoHome,
  onAddSlide,
  onStartPreview,
  onStartFullscreen,
  onStartFromBeginning,
}: ToolbarProps) {
  const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);

  return (
    <TooltipProvider>
      <div
        className={`h-12 bg-white border-b border-gray-200 flex items-center px-3 gap-1 ${isMac ? "pl-20" : "pr-36"}`}
        onMouseDown={(e) => {
          // Only drag when clicking the toolbar background itself, not buttons/inputs
          if (e.target === e.currentTarget || (e.target as HTMLElement).closest('[data-drag-region]')) {
            getCurrentWindow().startDragging();
          }
        }}
      >
        {/* Left: Home + filename */}
        <ToolbarAction
          tooltip="Back to home"
          aria-label="Back to home"
          onClick={onGoHome}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </ToolbarAction>
        <Separator orientation="vertical" className="mx-1" />
        <span className="text-sm font-medium text-gray-800 mr-1">
          {fileName || "Untitled"}
        </span>
        <SaveIndicator isDirty={isDirty} isSaving={isSaving} />

        {/* Spacer */}
        <div className="flex-1" data-drag-region />

        {/* Right: file ops + slide + present */}
        <div className="flex items-center gap-1">
          <ToolbarAction
            tooltip="New file"
            aria-label="New file"
            onClick={onNewIdea}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </ToolbarAction>
          <ToolbarAction
            tooltip="Open file"
            aria-label="Open file"
            onClick={onOpenFile}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </ToolbarAction>
          <ToolbarAction
            tooltip="Save"
            aria-label="Save"
            onClick={onSave}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
          </ToolbarAction>

          <Separator orientation="vertical" className="mx-1" />

          <ToolbarAction
            aria-label="Add slide"
            variant="secondary"
            onClick={onAddSlide}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Slide
          </ToolbarAction>

          <div className="w-2" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ToolbarAction
                aria-label="Present"
                variant="primary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                Present
              </ToolbarAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={onStartPreview}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Preview
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onStartFullscreen}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                Fullscreen
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onStartFromBeginning}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
                From Beginning
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </TooltipProvider>
  );
}
