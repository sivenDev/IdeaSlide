import { useState, type PointerEvent } from "react";

interface ResizableDividerProps {
  side: "left" | "right";
  isVisible: boolean;
  onToggle: () => void;
  size?: number;
  onResize?: (nextSize: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}

interface DragState {
  pointerId: number;
  startClientX: number;
  startSize: number;
}

export function ResizableDivider({
  side,
  isVisible,
  onToggle,
  size = 0,
  onResize,
  onResizeStart,
  onResizeEnd,
}: ResizableDividerProps) {
  const [dragState, setDragState] = useState<DragState>();
  const isLeft = side === "left";
  const canResize = isVisible && Boolean(onResize);
  const title = isLeft
    ? isVisible ? "Hide workspace" : "Show workspace"
    : isVisible ? "Hide cameras" : "Show cameras";
  const arrow = isLeft
    ? isVisible ? "‹" : "›"
    : isVisible ? "›" : "‹";

  const finishResize = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragState(undefined);
    onResizeEnd?.();
  };

  return (
    <div className="relative z-20 h-full w-px flex-shrink-0 bg-gray-200">
      <div
        aria-hidden="true"
        className={`absolute inset-y-0 left-1/2 z-10 w-3 -translate-x-1/2 ${canResize ? "cursor-col-resize" : ""}`}
        onPointerDown={(event) => {
          if (!canResize) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragState({
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startSize: size,
          });
          onResizeStart?.();
        }}
        onPointerMove={(event) => {
          if (!dragState || event.pointerId !== dragState.pointerId || !onResize) return;
          const pointerDelta = event.clientX - dragState.startClientX;
          onResize(dragState.startSize + (isLeft ? pointerDelta : -pointerDelta));
        }}
        onPointerUp={finishResize}
        onPointerCancel={finishResize}
      />
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onToggle}
        title={title}
        aria-label={title}
        className="absolute left-1/2 top-1/2 z-20 flex h-12 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-gray-300 bg-white text-sm font-semibold text-gray-500 shadow-sm hover:border-gray-400 hover:bg-gray-50 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
      >
        {arrow}
      </button>
    </div>
  );
}
