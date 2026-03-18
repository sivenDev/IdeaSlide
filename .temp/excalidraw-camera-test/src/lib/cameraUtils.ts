import type { Camera, CameraElementLike } from "./types";

function isFiniteOrder(order: number | undefined): order is number {
  return Number.isFinite(order);
}

function isCameraElement(element: CameraElementLike): boolean {
  return element.type === "rectangle" && element.customData?.type === "camera";
}

export function extractCameras(elements: readonly CameraElementLike[]): Camera[] {
  const ordered: Camera[] = [];
  const unordered: Camera[] = [];

  for (const element of elements) {
    if (!isCameraElement(element) || element.isDeleted) {
      continue;
    }

    const x = element.width < 0 ? element.x + element.width : element.x;
    const y = element.height < 0 ? element.y + element.height : element.y;
    const camera: Camera = {
      id: element.id,
      order: isFiniteOrder(element.customData?.order) ? element.customData.order : Number.MAX_SAFE_INTEGER,
      bounds: {
        x,
        y,
        width: Math.abs(element.width),
        height: Math.abs(element.height),
      },
    };

    if (isFiniteOrder(element.customData?.order)) {
      ordered.push(camera);
    } else {
      unordered.push(camera);
    }
  }

  ordered.sort((left, right) => left.order - right.order);

  return [...ordered, ...unordered];
}

export function filterCameraElements(elements: readonly CameraElementLike[]): CameraElementLike[] {
  return elements.filter((element) => !isCameraElement(element));
}
