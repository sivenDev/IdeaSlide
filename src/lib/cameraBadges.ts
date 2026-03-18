import { extractCameras } from "./cameraUtils.ts";

interface CameraBadgeViewport {
  scrollX: number;
  scrollY: number;
  zoom: number;
  offsetLeft: number;
  offsetTop: number;
}

interface CameraBadgeContainer {
  left: number;
  top: number;
}

interface CameraBadgeLike {
  id: string;
  order: number;
  left: number;
  top: number;
  strokeColor: string;
}

function extractCameraBadgeViewport(appState: Partial<any> | undefined): CameraBadgeViewport {
  return {
    scrollX: appState?.scrollX ?? 0,
    scrollY: appState?.scrollY ?? 0,
    zoom: appState?.zoom?.value ?? 1,
    offsetLeft: appState?.offsetLeft ?? 0,
    offsetTop: appState?.offsetTop ?? 0,
  };
}

export function getCameraBadges(
  elements: readonly any[],
  appState: Partial<any> = {},
  container: CameraBadgeContainer = { left: 0, top: 0 },
): CameraBadgeLike[] {
  const viewport = extractCameraBadgeViewport(appState);
  const localOffsetLeft = viewport.offsetLeft - container.left;
  const localOffsetTop = viewport.offsetTop - container.top;

  return extractCameras(elements).map((camera) => ({
    id: camera.id,
    order: camera.order,
    left: (camera.bounds.x + viewport.scrollX) * viewport.zoom + localOffsetLeft,
    top: (camera.bounds.y + viewport.scrollY) * viewport.zoom + localOffsetTop,
    strokeColor: camera.strokeColor ?? "#f59e0b",
  }));
}

export function buildCameraBadgeSignature(
  elements: readonly any[],
  appState: Partial<any> = {},
  container: CameraBadgeContainer = { left: 0, top: 0 },
) {
  const cameras = extractCameras(elements);
  const viewport = extractCameraBadgeViewport(appState);
  const cameraSignature = cameras
    .map((camera) =>
      `${camera.id}:${camera.order}:${camera.bounds.x},${camera.bounds.y},${camera.bounds.width},${camera.bounds.height}:${camera.strokeColor ?? ""}`,
    )
    .join("|");

  return `${cameraSignature}::${viewport.scrollX}:${viewport.scrollY}:${viewport.zoom}:${viewport.offsetLeft}:${viewport.offsetTop}:${container.left}:${container.top}`;
}
