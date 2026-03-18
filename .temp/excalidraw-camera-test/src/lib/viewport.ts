import type { CameraBounds, ViewportTarget } from "./types";

interface CalculateViewportTargetInput {
  cameraBounds: CameraBounds;
  viewportWidth: number;
  viewportHeight: number;
  paddingFactor: number;
}

export function calculateViewportTarget({
  cameraBounds,
  viewportWidth,
  viewportHeight,
  paddingFactor,
}: CalculateViewportTargetInput): ViewportTarget {
  const zoomX = (viewportWidth * paddingFactor) / cameraBounds.width;
  const zoomY = (viewportHeight * paddingFactor) / cameraBounds.height;
  const zoom = Math.min(zoomX, zoomY);
  const centerX = cameraBounds.x + cameraBounds.width / 2;
  const centerY = cameraBounds.y + cameraBounds.height / 2;

  return {
    scrollX: viewportWidth / (2 * zoom) - centerX,
    scrollY: viewportHeight / (2 * zoom) - centerY,
    zoom,
  };
}
