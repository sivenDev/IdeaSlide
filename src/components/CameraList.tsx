import { useCallback } from "react";
import { moveItemByOffset, type Camera } from "../lib/cameraUtils";

interface CameraListProps {
  cameras: Camera[];
  activeCameraId?: string;
  onCameraSelect: (camera: Camera) => void;
  onCameraDelete: (cameraId: string) => void;
  onReorder: (orderedCameraIds: string[]) => void;
  onAddCamera?: () => void;
}

export function CameraList({
  cameras,
  activeCameraId,
  onCameraSelect,
  onCameraDelete,
  onReorder,
  onAddCamera,
}: CameraListProps) {
  const handleMove = useCallback((index: number, offset: -1 | 1) => {
    const ids = moveItemByOffset(cameras.map((camera) => camera.id), index, offset);
    if (ids.some((id, itemIndex) => id !== cameras[itemIndex]?.id)) onReorder(ids);
  }, [cameras, onReorder]);

  return (
    <aside className="flex h-full min-w-0 flex-col bg-[#fbfbfc]" aria-label="Cameras">
      <div className="flex h-11 items-center border-b border-gray-200 px-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Cameras</div>
        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">{cameras.length}</span>
        <button
          type="button"
          aria-label="Add camera"
          disabled={!onAddCamera}
          onClick={onAddCamera}
          className="ml-auto inline-flex h-7 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-xs font-medium text-gray-600 shadow-sm hover:border-gray-300 hover:text-gray-900 disabled:pointer-events-none disabled:opacity-40"
        >
          <span aria-hidden="true">＋</span>
          Add Camera
        </button>
      </div>

      {cameras.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-5 text-center">
          <div>
            <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-400">⌗</div>
            <p className="text-sm font-medium text-gray-600">No cameras yet</p>
            <p className="mt-1 text-xs leading-5 text-gray-400">Add camera frames on this Canvas to build a presentation sequence.</p>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {cameras.map((camera, index) => {
            const active = camera.id === activeCameraId;
            return (
              <div
                key={camera.id}
                className={`group mb-1 flex h-10 items-center rounded-md border px-1.5 ${active ? "border-amber-300 bg-amber-50" : "border-transparent hover:border-gray-200 hover:bg-white"}`}
              >
                <button type="button" onClick={() => onCameraSelect(camera)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span className={`flex h-6 w-6 items-center justify-center rounded text-xs font-semibold ${active ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-500"}`}>{camera.order}</span>
                  <span className="truncate text-sm font-medium text-gray-700">Camera {camera.order}</span>
                </button>
                <div className="hidden items-center group-hover:flex group-focus-within:flex">
                  <button type="button" aria-label={`Move up camera ${camera.order}`} disabled={index === 0} onClick={() => handleMove(index, -1)} className="rounded px-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30">↑</button>
                  <button type="button" aria-label={`Move down camera ${camera.order}`} disabled={index === cameras.length - 1} onClick={() => handleMove(index, 1)} className="rounded px-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30">↓</button>
                  <button type="button" aria-label={`Delete camera ${camera.order}`} onClick={() => onCameraDelete(camera.id)} className="rounded px-1 text-gray-400 hover:bg-red-50 hover:text-red-600">×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
