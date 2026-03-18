export interface Camera {
  id: string;
  order: number;
  bounds: { x: number; y: number; width: number; height: number };
}

function normalizeBounds(bounds: { x: number; y: number; width: number; height: number }) {
  const x = bounds.width < 0 ? bounds.x + bounds.width : bounds.x;
  const y = bounds.height < 0 ? bounds.y + bounds.height : bounds.y;

  return {
    x,
    y,
    width: Math.abs(bounds.width),
    height: Math.abs(bounds.height),
  };
}

export function extractCameras(elements: readonly any[]): Camera[] {
  return elements
    .filter(
      (el) => el.type === "rectangle" && el.customData?.type === "camera" && !el.isDeleted
    )
    .map((el) => {
      const bounds = normalizeBounds(el);

      return {
        id: el.id,
        order: el.customData.order ?? 0,
        bounds,
      };
    })
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
  const normalizedElement = normalizeBounds(el);
  const normalizedRegion = normalizeBounds(region);

  return (
    normalizedElement.x < normalizedRegion.x + normalizedRegion.width &&
    normalizedElement.x + normalizedElement.width > normalizedRegion.x &&
    normalizedElement.y < normalizedRegion.y + normalizedRegion.height &&
    normalizedElement.y + normalizedElement.height > normalizedRegion.y
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

export function getSelectedCameraId(
  cameras: readonly Camera[],
  selectedElementIds?: Record<string, boolean>,
): string | undefined {
  if (!selectedElementIds) {
    return undefined;
  }

  const selectedIds = new Set(
    Object.entries(selectedElementIds)
      .filter(([, isSelected]) => Boolean(isSelected))
      .map(([id]) => id),
  );

  return cameras.find((camera) => selectedIds.has(camera.id))?.id;
}

export function moveItemByOffset<T>(
  items: readonly T[],
  fromIndex: number,
  offset: number,
): T[] {
  const targetIndex = fromIndex + offset;

  if (
    fromIndex < 0 ||
    fromIndex >= items.length ||
    targetIndex < 0 ||
    targetIndex >= items.length ||
    offset === 0
  ) {
    return [...items];
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);

  if (movedItem === undefined) {
    return [...items];
  }

  nextItems.splice(targetIndex, 0, movedItem);
  return nextItems;
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
