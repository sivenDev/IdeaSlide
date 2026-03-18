import { memo, useRef, useEffect, useState, useCallback } from "react";
import type { Camera } from "../lib/cameraUtils";

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
      <div className="w-full h-full flex items-center justify-center text-gray-400">
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
      className="w-full h-full overflow-hidden bg-white [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain"
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
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropIndex(index);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (dragIndex === null || dropIndex === null || dragIndex === dropIndex) {
        setDragIndex(null);
        setDropIndex(null);
        return;
      }
      const ids = cameras.map((c) => c.id);
      const [moved] = ids.splice(dragIndex, 1);
      ids.splice(dropIndex, 0, moved);
      onReorder(ids);
      setDragIndex(null);
      setDropIndex(null);
    },
    [dragIndex, dropIndex, cameras, onReorder]
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropIndex(null);
  }, []);

  if (cameras.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
        No cameras yet. Click "Add Camera" to create one.
      </div>
    );
  }

  return (
    <div className="w-full h-[150px] bg-gray-50 flex items-center px-3 gap-3 overflow-x-auto flex-shrink-0">
      {cameras.map((camera, index) => (
        <div
          key={camera.id}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          className={`relative group cursor-pointer border-2 rounded-lg overflow-hidden transition-all flex-shrink-0 w-[160px] h-[100px] ${
            camera.id === activeCameraId
              ? "border-amber-500 shadow-md"
              : dropIndex === index && dragIndex !== null
              ? "border-amber-300 border-dashed"
              : "border-gray-200 hover:border-gray-300"
          } ${dragIndex === index ? "opacity-50" : ""}`}
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

          <button
            onClick={(e) => {
              e.stopPropagation();
              onCameraDelete(camera.id);
            }}
            className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
