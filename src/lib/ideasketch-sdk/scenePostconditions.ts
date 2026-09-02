import {
  sdkRejected,
  sdkSucceeded,
  type IdeaSketchSdkErrorCode,
  type SdkSyncResult,
} from "./types.ts";

export interface ScenePostconditionOptions {
  maxCameraCount?: number;
  cameraMinWidth?: number;
  cameraMinHeight?: number;
}

function rejected(code: IdeaSketchSdkErrorCode, message: string): SdkSyncResult<never> {
  return sdkRejected(code, message);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function liveElements(elements: readonly unknown[]) {
  return elements.filter((element) => {
    const item = record(element);
    return Boolean(item && item.isDeleted !== true);
  });
}

function liveMap(elements: readonly unknown[]) {
  return new Map(liveElements(elements).flatMap((element) => {
    const item = record(element);
    return item && typeof item.id === "string" ? [[item.id, item] as const] : [];
  }));
}

function validBindingField(value: unknown): boolean {
  const item = record(value);
  if (!item || typeof item.elementId !== "string" || item.elementId.length === 0) return false;
  if (item.focus !== undefined && (typeof item.focus !== "number" || !Number.isFinite(item.focus))) return false;
  if (item.gap !== undefined && (typeof item.gap !== "number" || !Number.isFinite(item.gap) || item.gap < 0)) return false;
  if (item.fixedPoint !== undefined) {
    if (!Array.isArray(item.fixedPoint) || item.fixedPoint.length !== 2 || item.fixedPoint.some((part) => typeof part !== "number" || !Number.isFinite(part) || part < 0 || part > 1)) return false;
  }
  return true;
}

export function validateIdeaSketchScenePostconditions(
  scene: { elements: readonly unknown[]; appState?: Record<string, unknown>; files?: Record<string, unknown> },
  options: ScenePostconditionOptions = {},
): SdkSyncResult<void> {
  const all = scene.elements;
  const ids = new Set<string>();
  for (const element of all) {
    const item = record(element);
    if (!item || typeof item.id !== "string" || item.id.length === 0) return rejected("relation_conflict", "Every scene element must have a stable id.");
    if (ids.has(item.id)) return rejected("relation_conflict", `Duplicate scene element id: ${item.id}.`);
    ids.add(item.id);
  }
  const byId = liveMap(all);
  const cameras = [...byId.values()].filter((element) => record(element.customData)?.type === "camera");
  if (options.maxCameraCount !== undefined && cameras.length > options.maxCameraCount) return rejected("limit_exceeded", "The Page exceeds the Camera limit.");
  const orders = new Set<number>();
  for (const camera of cameras) {
    if (camera.type !== "rectangle" || camera.angle !== undefined && camera.angle !== 0) return rejected("relation_conflict", "Camera must remain an unrotated rectangle.");
    const cameraBoundElements = camera.boundElements;
    const cameraHasBindings = Array.isArray(cameraBoundElements)
      ? cameraBoundElements.length > 0
      : cameraBoundElements !== undefined && cameraBoundElements !== null;
    if (camera.locked === true || (Array.isArray(camera.groupIds) && camera.groupIds.length > 0) || camera.frameId !== undefined && camera.frameId !== null || cameraHasBindings) {
      return rejected("relation_conflict", "Camera cannot be locked, grouped, framed, or bound.");
    }
    if (camera.strokeColor !== "#1e90ff" || camera.backgroundColor !== "transparent" || camera.fillStyle !== "solid" || camera.strokeWidth !== 2 || camera.strokeStyle !== "dashed" || camera.roughness !== 0 || camera.opacity !== 60 || camera.roundness !== null) {
      return rejected("relation_conflict", "Camera style must remain host-controlled.");
    }
    const order = record(camera.customData)?.order;
    if (typeof order !== "number" || !Number.isFinite(order) || order <= 0 || orders.has(order)) return rejected("relation_conflict", "Camera order must be finite and unique.");
    orders.add(order);
    if (typeof camera.width !== "number" || typeof camera.height !== "number" || camera.width <= 0 || camera.height <= 0) return rejected("relation_conflict", "Camera bounds must be positive.");
    if (options.cameraMinWidth !== undefined && camera.width < options.cameraMinWidth) return rejected("limit_exceeded", "Camera width is below the supported minimum.");
    if (options.cameraMinHeight !== undefined && camera.height < options.cameraMinHeight) return rejected("limit_exceeded", "Camera height is below the supported minimum.");
  }
  const boundTextByContainer = new Map<string, string>();
  for (const element of byId.values()) {
    if (typeof element.x !== "number" || !Number.isFinite(element.x) || typeof element.y !== "number" || !Number.isFinite(element.y)) {
      return rejected("relation_conflict", "Every live element must have finite x/y coordinates.");
    }
    if (element.angle !== undefined && (typeof element.angle !== "number" || !Number.isFinite(element.angle))) return rejected("relation_conflict", "Every live element must have a finite angle.");
    if (typeof element.width !== "number" || !Number.isFinite(element.width) || typeof element.height !== "number" || !Number.isFinite(element.height)) return rejected("relation_conflict", "Every live element must have numeric dimensions.");
    if (element.type === "arrow") {
      if (!Array.isArray(element.points) || element.points.length < 2 || element.points.some((point: unknown) => !Array.isArray(point) || point.length !== 2 || point.some((value) => typeof value !== "number" || !Number.isFinite(value)))) {
        return rejected("relation_conflict", "Arrow points must contain at least two finite coordinate pairs.");
      }
      if (element.width < 0 || element.height < 0) return rejected("relation_conflict", "Arrow dimensions must be non-negative.");
    } else if (element.width <= 0 || element.height <= 0) {
      return rejected("relation_conflict", "Non-arrow element dimensions must be positive.");
    }
    if (element.type === "text" && element.containerId !== undefined && element.containerId !== null && typeof element.containerId !== "string") return rejected("relation_conflict", "Text containerId is malformed.");
    if (element.type !== "text" && element.containerId !== undefined && element.containerId !== null) return rejected("relation_conflict", "Only text may have a containerId.");
    for (const key of ["startBinding", "endBinding"] as const) {
      const binding = element[key];
      if (binding !== undefined && binding !== null && !validBindingField(binding)) return rejected("relation_conflict", "Arrow binding is malformed.");
    }
    if (element.boundElements !== undefined && element.boundElements !== null && !Array.isArray(element.boundElements)) return rejected("relation_conflict", "boundElements is malformed.");
    if (typeof element.version !== "number" || !Number.isFinite(element.version) || element.version < 1 || typeof element.versionNonce !== "number" || !Number.isFinite(element.versionNonce) || typeof element.updated !== "number" || !Number.isFinite(element.updated)) {
      return rejected("relation_conflict", "Every live element must have valid native version metadata.");
    }
    if (element.type === "text" && typeof element.containerId === "string") {
      const container = byId.get(element.containerId);
      if (!container || !["rectangle", "ellipse", "diamond", "arrow"].includes(String(container.type))) return rejected("relation_conflict", "Text points to a missing or unsupported container.");
      if (boundTextByContainer.has(element.containerId)) return rejected("relation_conflict", "A container has more than one live bound text.");
      boundTextByContainer.set(element.containerId, element.id as string);
      if (element.verticalAlign !== undefined && !["top", "middle", "bottom"].includes(String(element.verticalAlign))) return rejected("relation_conflict", "Text vertical alignment is malformed.");
      const reverse = Array.isArray(container.boundElements) && container.boundElements.some((binding) => record(binding)?.id === element.id && record(binding)?.type === "text");
      if (!reverse) return rejected("relation_conflict", "Text/container binding is not symmetric.");
    } else if (element.type === "text" && element.verticalAlign !== undefined && element.verticalAlign !== "top") {
      return rejected("relation_conflict", "Standalone text must use top vertical alignment.");
    }
    if (Array.isArray(element.boundElements)) {
      const relationKeys = new Set<string>();
      for (const binding of element.boundElements) {
        const item = record(binding);
        if (!item || typeof item.id !== "string" || (item.type !== "text" && item.type !== "arrow")) return rejected("relation_conflict", "A boundElements record is malformed.");
        const relationKey = `${item.type}:${item.id}`;
        if (relationKeys.has(relationKey)) return rejected("relation_conflict", "A boundElements record is duplicated.");
        relationKeys.add(relationKey);
        const target = byId.get(item.id);
        if (!target) return rejected("relation_conflict", "A live element points to a missing relationship target.");
        if (item.type === "text" && (target.type !== "text" || target.containerId !== element.id)) return rejected("relation_conflict", "Text/container binding is not symmetric.");
        if (item.type === "arrow") {
          const pointsTo = record(target.startBinding)?.elementId === element.id || record(target.endBinding)?.elementId === element.id;
          if (!pointsTo) return rejected("relation_conflict", "Arrow/shape binding is not symmetric.");
        }
      }
    }
    for (const key of ["startBinding", "endBinding"] as const) {
      const binding = record(element[key]);
      if (!binding) continue;
      if (element.type !== "arrow") return rejected("relation_conflict", "Only arrows may own endpoint bindings.");
      if (typeof binding.elementId !== "string" || !byId.has(binding.elementId)) return rejected("relation_conflict", "Arrow binding points to a missing target.");
      const target = byId.get(binding.elementId)!;
      if (!["rectangle", "ellipse", "diamond"].includes(String(target.type)) || record(target.customData)?.type === "camera") return rejected("relation_conflict", "Arrow binding target must be a live supported shape.");
      const reverse = Array.isArray(target.boundElements) && target.boundElements.some((item) => record(item)?.id === element.id && record(item)?.type === "arrow");
      if (!reverse) return rejected("relation_conflict", "Arrow/shape binding is not symmetric.");
    }
  }
  return sdkSucceeded(undefined);
}

export const validateScenePostconditions = validateIdeaSketchScenePostconditions;
