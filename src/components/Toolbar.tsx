import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Camera } from "../lib/cameraUtils";
import { SaveIndicator } from "./SaveIndicator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/DropdownMenu";
import { Separator } from "./ui/Separator";
import { ToolbarAction } from "./ui/ToolbarAction";
import { TooltipProvider } from "./ui/Tooltip";

interface ToolbarProps {
  fileName?: string;
  isDirty: boolean;
  isSaving: boolean;
  currentSlideIndex: number;
  slideCount: number;
  cameras: Camera[];
  activeCameraId?: string;
  onNewIdea: () => void;
  onOpenFile: () => void;
  onSave: () => void;
  onGoHome: () => void;
  onSelectSlide: (index: number) => void;
  onAddSlide: () => void;
  onDeleteSlide: (index: number) => void;
  onSelectCamera: (camera: Camera) => void;
  onDeleteCamera: (cameraId: string) => void;
  onReorderCamera: (cameraId: string, offset: -1 | 1) => void;
  onStartPreview: () => void;
  onStartFullscreen: () => void;
  onStartFromBeginning: () => void;
}

export function Toolbar({
  fileName,
  isDirty,
  isSaving,
  currentSlideIndex,
  slideCount,
  cameras,
  activeCameraId,
  onNewIdea,
  onOpenFile,
  onSave,
  onGoHome,
  onSelectSlide,
  onAddSlide,
  onDeleteSlide,
  onSelectCamera,
  onDeleteCamera,
  onReorderCamera,
  onStartPreview,
  onStartFullscreen,
  onStartFromBeginning,
}: ToolbarProps) {
  const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
  const hasMultipleSlides = slideCount > 1;
  const slideSummaryLabel = hasMultipleSlides
    ? `${currentSlideIndex + 1} / ${slideCount}`
    : String(currentSlideIndex + 1);
  const cameraCountLabel = String(cameras.length);

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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ToolbarAction
                aria-label="Slide"
                variant="secondary"
                className="gap-1.5 px-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                </svg>
                <span className="text-xs font-medium">Slide</span>
                <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">
                  {slideSummaryLabel}
                </span>
              </ToolbarAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2">
              <div className="space-y-1 py-1">
                {Array.from({ length: slideCount }, (_, index) => {
                  const isCurrent = index === currentSlideIndex;

                  return (
                    <div
                      key={index}
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${isCurrent ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"}`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectSlide(index)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className={`flex h-5 min-w-5 items-center justify-center rounded-full text-[11px] font-semibold ${isCurrent ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 text-sm font-medium text-inherit">Slide {index + 1}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete slide ${index + 1}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSlide(index);
                        }}
                        disabled={!hasMultipleSlides}
                        className="rounded px-1.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>

              <DropdownMenuSeparator />
              <div className="grid gap-1 pt-2">
                <button
                  type="button"
                  onClick={onAddSlide}
                  className="rounded-md border border-gray-200 px-2 py-1.5 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Add Slide
                </button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ToolbarAction
                aria-label="Cameras"
                variant="secondary"
                className="gap-1.5 px-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span className="text-xs font-medium">Cameras</span>
                <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">
                  {cameraCountLabel}
                </span>
              </ToolbarAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 p-2">
              {cameras.length === 0 ? (
                <DropdownMenuItem disabled>
                  No cameras yet
                </DropdownMenuItem>
              ) : (
                <div className="space-y-1">
                  {cameras.map((camera, index) => {
                    const isActive = camera.id === activeCameraId;

                    return (
                      <div
                        key={camera.id}
                        className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 ${isActive ? "bg-amber-50 text-amber-700" : "text-gray-700 hover:bg-gray-50"}`}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectCamera(camera)}
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                        >
                          <span className={`flex h-5 min-w-5 items-center justify-center rounded-full text-[11px] font-semibold ${isActive ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600"}`}>
                            {camera.order}
                          </span>
                          <span className="min-w-0 flex-1 text-sm font-medium text-inherit">
                            Camera {camera.order}
                          </span>
                        </button>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            aria-label={`Move left camera ${camera.order}`}
                            onClick={() => onReorderCamera(camera.id, -1)}
                            disabled={index === 0}
                            className="rounded px-1 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700 disabled:opacity-40"
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            aria-label={`Move right camera ${camera.order}`}
                            onClick={() => onReorderCamera(camera.id, 1)}
                            disabled={index === cameras.length - 1}
                            className="rounded px-1 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700 disabled:opacity-40"
                          >
                            →
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete camera ${camera.order}`}
                            onClick={() => onDeleteCamera(camera.id)}
                            className="rounded px-1 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

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
