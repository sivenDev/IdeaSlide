import { memo, useRef, useEffect, useCallback } from "react";
import { moveItemByOffset, type Camera } from "../lib/cameraUtils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/Tooltip";

interface CameraListProps {
  cameras: Camera[];
  thumbnails: Map<string, SVGSVGElement>;
  activeCameraId?: string;
  onCameraSelect: (camera: Camera) => void;
  onCameraDelete: (cameraId: string) => void;
  onReorder: (orderedCameraIds: string[]) => void;
}

const CameraThumbnail = memo(function CameraThumbnail({
  svgElement,
  order,
}: {
  svgElement: SVGSVGElement | undefined;
  order: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (svgElement) {
      container.replaceChildren(svgElement.cloneNode(true));
    } else {
      container.replaceChildren();
    }
  }, [svgElement]);

  if (!svgElement) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 pointer-events-none select-none">
        <div className="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-1 opacity-40">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <div className="text-xs">Camera {order}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden bg-white pointer-events-none select-none [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain"
    />
  );
});

export function CameraList({
  cameras,
  thumbnails,
  activeCameraId,
  onCameraSelect,
  onCameraDelete,
  onReorder,
}: CameraListProps) {
  const handleMove = useCallback(
    (index: number, offset: -1 | 1) => {
      const ids = moveItemByOffset(
        cameras.map((camera) => camera.id),
        index,
        offset,
      );

      if (ids.some((id, itemIndex) => id !== cameras[itemIndex]?.id)) {
        onReorder(ids);
      }
    },
    [cameras, onReorder],
  );

  if (cameras.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white text-center">
        <div className="flex max-w-[300px] translate-y-2 flex-col items-center gap-2 px-4 text-gray-400">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-4 w-4"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">No cameras yet</p>
            <p className="text-xs leading-5 text-gray-400">
              Click "Add Camera" to create your first view.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={250}>
      <div className="w-full h-[150px] bg-gray-50 flex items-center px-3 gap-3 overflow-x-auto flex-shrink-0">
        {cameras.map((camera, index) => (
          <div
            key={camera.id}
            className={`relative group cursor-pointer border-2 rounded-lg overflow-hidden transition-all flex-shrink-0 w-[160px] h-[100px] ${
              camera.id === activeCameraId
                ? "border-amber-500 bg-amber-50 shadow-md ring-1 ring-amber-200"
                : "border-gray-200 hover:border-gray-300"
            }`}
            onClick={() => onCameraSelect(camera)}
          >
            <div className="w-full h-full bg-white">
              <CameraThumbnail
                svgElement={thumbnails.get(camera.id)}
                order={camera.order}
              />
            </div>

            <span className="absolute bottom-1 left-2 text-[11px] text-gray-400">
              {camera.order}
            </span>

            {cameras.length > 1 && (
              <div className="absolute top-1 left-1 flex items-center gap-1 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMove(index, -1);
                        }}
                        disabled={index === 0}
                        aria-label="Move camera left"
                        className="w-5 h-5 rounded bg-white/95 text-gray-600 shadow-sm ring-1 ring-gray-200 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-35 hover:bg-amber-50 hover:text-amber-600"
                      >
                        {"<"}
                      </button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Move left</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMove(index, 1);
                        }}
                        disabled={index === cameras.length - 1}
                        aria-label="Move camera right"
                        className="w-5 h-5 rounded bg-white/95 text-gray-600 shadow-sm ring-1 ring-gray-200 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-35 hover:bg-amber-50 hover:text-amber-600"
                      >
                        {">"}
                      </button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Move right</TooltipContent>
                </Tooltip>
              </div>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCameraDelete(camera.id);
                  }}
                  aria-label="Delete camera"
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded opacity-0 pointer-events-none transition-opacity flex items-center justify-center text-xs group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
                >
                  ×
                </button>
              </TooltipTrigger>
              <TooltipContent>Delete camera</TooltipContent>
            </Tooltip>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
