export interface Camera {
  id: string;
  order: number;
  bounds: { x: number; y: number; width: number; height: number };
}

export function extractCameras(elements: readonly any[]): Camera[] {
  return elements
    .filter(
      (el) => el.type === "rectangle" && el.customData?.type === "camera" && !el.isDeleted
    )
    .map((el) => ({
      id: el.id,
      order: el.customData.order ?? 0,
      bounds: { x: el.x, y: el.y, width: el.width, height: el.height },
    }))
    .sort((a, b) => a.order - b.order);
}

export function getNextCameraOrder(elements: readonly any[]): number {
  const cameras = extractCameras(elements);
  if (cameras.length === 0) return 1;
  return Math.max(...cameras.map((c) => c.order)) + 1;
}

export function createCameraElement(
  centerX: number,
  centerY: number,
  order: number
): Record<string, any> {
  return {
    id: crypto.randomUUID(),
    type: "rectangle",
    x: centerX - 200,
    y: centerY - 150,
    width: 400,
    height: 300,
    angle: 0,
    strokeColor: "#1e90ff",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "dashed",
    roughness: 0,
    opacity: 60,
    roundness: null,
    seed: Math.floor(Math.random() * 2147483647),
    version: 1,
    versionNonce: Math.floor(Math.random() * 2147483647),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    customData: { type: "camera", order },
  };
}

/** Check if an element intersects with a rectangular region */
export function intersectsRegion(
  el: { x: number; y: number; width: number; height: number },
  region: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    el.x < region.x + region.width &&
    el.x + el.width > region.x &&
    el.y < region.y + region.height &&
    el.y + el.height > region.y
  );
}

/** Filter elements visible within a camera's bounds (excluding camera elements) */
export function getElementsInCamera(
  elements: readonly any[],
  camera: Camera
): any[] {
  return elements.filter(
    (el) =>
      el.customData?.type !== "camera" &&
      !el.isDeleted &&
      intersectsRegion(el, camera.bounds)
  );
}

/** Filter out camera elements for presentation rendering */
export function filterCameraElements(elements: readonly any[]): any[] {
  return elements.filter((el) => el.customData?.type !== "camera");
}

/** Reassign camera orders sequentially (1, 2, 3...) */
export function reorderCameras(
  elements: readonly any[],
  orderedCameraIds: string[]
): any[] {
  return elements.map((el) => {
    if (el.customData?.type !== "camera") return el;
    const newOrder = orderedCameraIds.indexOf(el.id);
    if (newOrder === -1) return el;
    return {
      ...el,
      customData: { ...el.customData, order: newOrder + 1 },
      version: (el.version ?? 1) + 1,
      versionNonce: Math.floor(Math.random() * 2147483647),
    };
  });
}
