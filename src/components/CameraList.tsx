import { useCallback } from "react";
import { moveItemByOffset, type Camera } from "../lib/cameraUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/DropdownMenu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/Tooltip";

interface CameraListProps {
  cameras: Camera[];
  activeCameraId?: string;
  onCameraSelect: (camera: Camera) => void;
  onCameraDelete: (cameraId: string) => void;
  onReorder: (orderedCameraIds: string[]) => void;
  onAddCamera?: () => void;
  onStartPreview: () => void;
  onStartFullscreen: () => void;
}

export function CameraList({
  cameras,
  activeCameraId,
  onCameraSelect,
  onCameraDelete,
  onReorder,
  onAddCamera,
  onStartPreview,
  onStartFullscreen,
}: CameraListProps) {
  const handleMove = useCallback((index: number, offset: -1 | 1) => {
    const ids = moveItemByOffset(cameras.map((camera) => camera.id), index, offset);
    if (ids.some((id, itemIndex) => id !== cameras[itemIndex]?.id)) onReorder(ids);
  }, [cameras, onReorder]);

  return (
    <aside className="idea-slide-side-panel flex h-full min-w-0 flex-col" aria-label="Cameras">
      <div className="idea-slide-side-panel__header flex items-center px-3">
        <div className="idea-slide-side-panel__title">Cameras</div>
        <span className="idea-slide-panel-count">{cameras.length}</span>
        <div className="idea-slide-camera-header-actions">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Add camera"
                  disabled={!onAddCamera}
                  onClick={onAddCamera}
                  className="idea-slide-panel-add-button"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M8 3v10M3 8h10" />
                  </svg>
                </button>
              </TooltipTrigger>
              <TooltipContent>Add camera</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Present"
                className="idea-slide-camera-present-button"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m8 5 11 7-11 7V5Z" />
                </svg>
                <span>Present</span>
                <svg className="idea-slide-camera-present-button__chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="m4 6 4 4 4-4" />
                </svg>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onSelect={onStartPreview}>Preview</DropdownMenuItem>
              <DropdownMenuItem onSelect={onStartFullscreen}>Fullscreen</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {cameras.length === 0 ? (
        <div className="idea-slide-camera-empty min-h-0 flex-1">
          <div className="idea-slide-camera-empty__frame" aria-hidden="true">
            <span />
          </div>
          <p className="idea-slide-camera-empty__title">No cameras yet</p>
          <p className="idea-slide-camera-empty__copy">Add a camera frame to turn this Canvas into a focused sequence.</p>
        </div>
      ) : (
        <div className="idea-slide-side-panel__scroll min-h-0 flex-1 overflow-y-auto p-2">
          {cameras.map((camera, index) => {
            const active = camera.id === activeCameraId;
            return (
              <div
                key={camera.id}
                className={`idea-slide-camera-row group ${active ? "is-active" : ""}`}
              >
                <button type="button" onClick={() => onCameraSelect(camera)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span className="idea-slide-camera-row__number">{camera.order}</span>
                  <span className="idea-slide-camera-row__name truncate">Camera {camera.order}</span>
                </button>
                <div className="hidden items-center group-hover:flex group-focus-within:flex">
                  <button type="button" aria-label={`Move up camera ${camera.order}`} disabled={index === 0} onClick={() => handleMove(index, -1)} className="idea-slide-row-action disabled:opacity-30">↑</button>
                  <button type="button" aria-label={`Move down camera ${camera.order}`} disabled={index === cameras.length - 1} onClick={() => handleMove(index, 1)} className="idea-slide-row-action disabled:opacity-30">↓</button>
                  <button type="button" aria-label={`Delete camera ${camera.order}`} onClick={() => onCameraDelete(camera.id)} className="idea-slide-row-action is-danger">×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
