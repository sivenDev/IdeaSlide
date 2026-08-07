import { useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/Tooltip";

interface ResizableDividerProps {
  side: "left" | "right";
  isVisible: boolean;
  onToggle: () => void;
  size?: number;
  minSize?: number;
  maxSize?: number;
  keyboardStep?: number;
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
  minSize = 0,
  maxSize = Number.MAX_SAFE_INTEGER,
  keyboardStep = 8,
  onResize,
  onResizeStart,
  onResizeEnd,
}: ResizableDividerProps) {
  const [dragState, setDragState] = useState<DragState>();
  const isLeft = side === "left";
  const canResize = isVisible && Boolean(onResize);
  const tooltipLabel = isLeft
    ? isVisible ? "Hide workspace" : "Show workspace"
    : isVisible ? "Hide navigator" : "Show navigator";
  const arrow = isLeft
    ? isVisible ? "‹" : "›"
    : isVisible ? "›" : "‹";
  const arrowPath = arrow === "‹" ? "m10 4-4 4 4 4" : "m6 4 4 4-4 4";

  const finishResize = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragState(undefined);
    onResizeEnd?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!canResize || !onResize) return;
    if (event.key === "Home") {
      event.preventDefault();
      onResize(minSize);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      onResize(maxSize);
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const sideDirection = isLeft ? direction : -direction;
    onResize(size + sideDirection * (event.shiftKey ? keyboardStep * 3 : keyboardStep));
  };

  return (
    <div
      role={canResize ? "separator" : undefined}
      aria-label={canResize ? isLeft ? "Resize workspace panel" : "Resize right sidebar" : undefined}
      aria-orientation="vertical"
      aria-valuemin={canResize ? minSize : undefined}
      aria-valuemax={canResize ? maxSize : undefined}
      aria-valuenow={canResize ? Math.round(size) : undefined}
      tabIndex={canResize ? 0 : undefined}
      className={`idea-slide-resize-rail ${canResize ? "cursor-col-resize" : ""} ${dragState ? "is-resizing" : ""}`}
      onKeyDown={handleKeyDown}
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
    >
      <span className="idea-slide-resize-rail__line" aria-hidden="true" />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onToggle}
              aria-label={tooltipLabel}
              className="idea-slide-resize-rail__toggle"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d={arrowPath} />
              </svg>
            </button>
          </TooltipTrigger>
          <TooltipContent side={isLeft ? "right" : "left"}>{tooltipLabel}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
