import { ChevronDown, ChevronUp, Play, Plus, Trash2 } from "lucide-react";
import { useCallback, useState, type DragEvent } from "react";
import { moveItemByOffset, type Camera } from "../lib/cameraUtils";
import { cn } from "../lib/cn";
import { moveItemToIndex, resolveListDropIndex, type ListDropPosition } from "../lib/listReorder";
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

const CAMERA_DRAG_MIME = "application/x-ideanote-camera-id";

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
  const [draggingCameraId, setDraggingCameraId] = useState<string>();
  const [dropTarget, setDropTarget] = useState<{ cameraId: string; position: ListDropPosition }>();
  const handleMove = useCallback((index: number, offset: -1 | 1) => {
    if (readOnly) return;
    const ids = moveItemByOffset(cameras.map((camera) => camera.id), index, offset);
    if (ids.some((id, itemIndex) => id !== cameras[itemIndex]?.id)) onReorder(ids);
  }, [cameras, onReorder, readOnly]);

  const updateDropTarget = (event: DragEvent<HTMLDivElement>, cameraId: string) => {
    if (readOnly || cameraId === draggingCameraId) return;
    if (!draggingCameraId && !event.dataTransfer.types.includes(CAMERA_DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const bounds = event.currentTarget.getBoundingClientRect();
    setDropTarget({ cameraId, position: event.clientY < bounds.top + bounds.height / 2 ? "before" : "after" });
  };

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
                draggable={!readOnly}
                onDragStart={(event) => {
                  if ((event.target as HTMLElement).closest("[data-drag-ignore]")) {
                    event.preventDefault();
                    return;
                  }
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData(CAMERA_DRAG_MIME, camera.id);
                  setDraggingCameraId(camera.id);
                }}
                onDragEnd={() => {
                  setDraggingCameraId(undefined);
                  setDropTarget(undefined);
                }}
                onDragOver={(event) => updateDropTarget(event, camera.id)}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(undefined);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const sourceId = event.dataTransfer.getData(CAMERA_DRAG_MIME) || draggingCameraId;
                  const fromIndex = cameras.findIndex((candidate) => candidate.id === sourceId);
                  const position = dropTarget?.cameraId === camera.id ? dropTarget.position : "after";
                  const toIndex = resolveListDropIndex(cameras.length, fromIndex, index, position);
                  const ids = moveItemToIndex(cameras.map((candidate) => candidate.id), fromIndex, toIndex);
                  if (sourceId && fromIndex >= 0 && fromIndex !== toIndex) onReorder(ids);
                  setDraggingCameraId(undefined);
                  setDropTarget(undefined);
                }}
                className={cn(
                  "idea-slide-camera-row group",
                  active && "is-active",
                  dropTarget?.cameraId === camera.id && `is-drop-${dropTarget.position}`,
                )}
              >
                <button type="button" onClick={() => onCameraSelect(camera)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span className="idea-slide-camera-row__number">{camera.order}</span>
                  <span className="idea-slide-camera-row__name truncate">Camera {camera.order}</span>
                </button>
                {!readOnly && (
                  <div className="hidden items-center group-hover:flex group-focus-within:flex">
                    <button type="button" data-drag-ignore aria-label={"Move up camera " + camera.order} disabled={index === 0} onClick={() => handleMove(index, -1)} className="idea-slide-row-action disabled:opacity-30"><ChevronUp aria-hidden="true" /></button>
                    <button type="button" data-drag-ignore aria-label={"Move down camera " + camera.order} disabled={index === cameras.length - 1} onClick={() => handleMove(index, 1)} className="idea-slide-row-action disabled:opacity-30"><ChevronDown aria-hidden="true" /></button>
                    <button type="button" data-drag-ignore aria-label={"Delete camera " + camera.order} onClick={() => onCameraDelete(camera.id)} className="idea-slide-row-action is-danger"><Trash2 aria-hidden="true" /></button>
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
