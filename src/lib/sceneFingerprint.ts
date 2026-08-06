interface SceneElementLike {
  id?: string;
  version?: number;
  versionNonce?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  isDeleted?: boolean;
  customData?: {
    type?: unknown;
    order?: unknown;
  };
}

interface SceneFileLike {
  id?: string;
  mimeType?: string;
  size?: number;
}

function normalizeGeometryNumber(value: number | undefined) {
  if (value === undefined) return "";
  if (!Number.isFinite(value)) return String(value);
  return value.toPrecision(15);
}

function buildElementsFingerprint(elements: readonly SceneElementLike[]) {
  return elements
    .map((element) =>
      [
        element.id ?? "",
        element.version ?? "",
        element.versionNonce ?? "",
        normalizeGeometryNumber(element.x),
        normalizeGeometryNumber(element.y),
        normalizeGeometryNumber(element.width),
        normalizeGeometryNumber(element.height),
        element.isDeleted ? "1" : "0",
        element.customData?.type ?? "",
        element.customData?.order ?? "",
      ].join(":")
    )
    .join("|");
}

export function buildFilesFingerprint(files: Record<string, SceneFileLike>) {
  return Object.values(files)
    .map((file) => [file.id ?? "", file.mimeType ?? "", file.size ?? ""].join(":"))
    .sort()
    .join("|");
}

export function buildSceneFingerprint(
  elements: readonly SceneElementLike[],
  files: Record<string, SceneFileLike>
) {
  return `${buildElementsFingerprint(elements)}#${buildFilesFingerprint(files)}`;
}
