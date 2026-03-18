interface BoundsLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SvgViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ThumbnailElementLike {
  id?: string;
  isDeleted?: boolean;
  customData?: {
    type?: unknown;
  };
}

interface CameraThumbnailGenerationState {
  showPreview: boolean;
  bottomTab: "cameras" | "slides";
}

interface CameraSignatureLike {
  id: string;
  bounds: BoundsLike;
}

export function getCameraThumbnailRenderableElements<T extends ThumbnailElementLike>(
  elements: readonly T[]
) {
  return elements.filter(
    (element) => !element.isDeleted && element.customData?.type !== "camera"
  );
}

export function isCameraThumbnailGenerationEnabled({
  showPreview,
  bottomTab,
}: CameraThumbnailGenerationState) {
  return showPreview && bottomTab === "cameras";
}

export function buildCameraSignature(cameras: readonly CameraSignatureLike[]) {
  return cameras
    .map((camera) =>
      `${camera.id}:${camera.bounds.x},${camera.bounds.y},${camera.bounds.width},${camera.bounds.height}`
    )
    .join("|");
}

export function buildCameraThumbnailRenderKey(
  sceneFingerprint: string,
  cameraSignature: string
) {
  return `${sceneFingerprint}::${cameraSignature}`;
}

export function parseSvgMarkup(
  svgMarkup: string,
  createParser: (() => Pick<DOMParser, "parseFromString">) | null = null
) {
  if (!svgMarkup.trim()) {
    return null;
  }

  const parserFactory =
    createParser ??
    (() => {
      if (typeof DOMParser === "undefined") {
        return null;
      }
      return new DOMParser();
    });

  const parser = parserFactory();
  if (!parser) {
    return null;
  }

  const document = parser.parseFromString(svgMarkup, "image/svg+xml");
  return document.querySelector("svg");
}

export function parseSvgViewBox(value: string | null): SvgViewBox | null {
  if (!value) {
    return null;
  }

  const parts = value
    .trim()
    .split(/\s+/)
    .map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  const [x, y, width, height] = parts;
  return { x, y, width, height };
}

export function calculateCameraThumbnailViewBox({
  cameraBounds,
  sceneBounds,
  sourceViewBox,
}: {
  cameraBounds: BoundsLike;
  sceneBounds: readonly [number, number, number, number];
  sourceViewBox: SvgViewBox;
}): SvgViewBox {
  const [minX, minY, maxX, maxY] = sceneBounds;
  const sceneWidth = maxX - minX;
  const sceneHeight = maxY - minY;
  const insetX = sourceViewBox.x + (sourceViewBox.width - sceneWidth) / 2;
  const insetY = sourceViewBox.y + (sourceViewBox.height - sceneHeight) / 2;

  return {
    x: insetX + cameraBounds.x - minX,
    y: insetY + cameraBounds.y - minY,
    width: cameraBounds.width,
    height: cameraBounds.height,
  };
}

export function formatSvgViewBox(viewBox: SvgViewBox) {
  return `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
}
