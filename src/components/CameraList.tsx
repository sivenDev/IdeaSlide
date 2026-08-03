import { ChevronDown, ChevronUp, Play, Plus, Trash2 } from "lucide-react";
import { useCallback } from "react";
import { moveItemByOffset, type Camera } from "../lib/cameraUtils";
import { cn } from "../lib/cn";
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
  readOnly?: boolean;
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
  readOnly = false,
  onCameraSelect,
  onCameraDelete,
  onReorder,
  onAddCamera,
  onStartPreview,
  onStartFullscreen,
}: CameraListProps) {
  const handleMove = useCallback((index: number, offset: -1 | 1) => {
    if (readOnly) return;
    const ids = moveItemByOffset(cameras.map((camera) => camera.id), index, offset);
    if (ids.some((id, itemIndex) => id !== cameras[itemIndex]?.id)) onReorder(ids);
  }, [cameras, onReorder, readOnly]);

  return (
    <section className="idea-slide-side-panel idea-slide-navigator-list" aria-label="Cameras">
      <div className="idea-slide-navigator-toolbar">
        <span className="idea-slide-navigator-toolbar__context">Current Page</span>
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
                  <Plus aria-hidden="true" />
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
                <Play aria-hidden="true" />
                <span>Present</span>
                <ChevronDown className="idea-slide-camera-present-button__chevron" aria-hidden="true" />
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
                className={cn("idea-slide-camera-row group", active && "is-active")}
              >
                <button type="button" onClick={() => onCameraSelect(camera)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span className="idea-slide-camera-row__number">{camera.order}</span>
                  <span className="idea-slide-camera-row__name truncate">Camera {camera.order}</span>
                </button>
                {!readOnly && (
                  <div className="hidden items-center group-hover:flex group-focus-within:flex">
                    <button type="button" aria-label={"Move up camera " + camera.order} disabled={index === 0} onClick={() => handleMove(index, -1)} className="idea-slide-row-action disabled:opacity-30"><ChevronUp aria-hidden="true" /></button>
                    <button type="button" aria-label={"Move down camera " + camera.order} disabled={index === cameras.length - 1} onClick={() => handleMove(index, 1)} className="idea-slide-row-action disabled:opacity-30"><ChevronDown aria-hidden="true" /></button>
                    <button type="button" aria-label={"Delete camera " + camera.order} onClick={() => onCameraDelete(camera.id)} className="idea-slide-row-action is-danger"><Trash2 aria-hidden="true" /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
