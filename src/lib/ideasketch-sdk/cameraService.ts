import { sdkRejected, type IdeaSketchCameraListResult, type IdeaSketchCameraSelectResult, type IdeaSketchSdkMutationResult, type IdeaSketchSdkScope, type SceneSnapshotId, type SdkResult } from "./types.ts";
import type { IdeaSketchSdkHostTarget } from "./host.ts";

export interface CameraServiceInput {
  getTarget: () => IdeaSketchSdkHostTarget | undefined;
  getScopes: () => readonly IdeaSketchSdkScope[];
  isActive: () => boolean;
  isMethodAvailable: (method: string) => boolean;
  listCameras: (input: unknown) => Promise<SdkResult<IdeaSketchCameraListResult>>;
  beginCreate?: (input: {
    requestId: string;
    snapshotId: SceneSnapshotId;
    atIndex?: number;
    signal?: AbortSignal;
  }) => Promise<SdkResult<IdeaSketchSdkMutationResult>>;
}

function strictOptions(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  try {
    if (Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return undefined;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !("value" in descriptor)) return undefined;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return undefined;
  }
}

export function createIdeaSketchCameraService(input: CameraServiceInput) {
  async function list(options: unknown = {}): Promise<SdkResult<IdeaSketchCameraListResult>> {
    try {
      if (!input.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
      if (!input.getScopes().includes("scene.read")) return sdkRejected("capability_denied", "The caller cannot read Cameras.");
      if (!input.isMethodAvailable("list")) return sdkRejected("unsupported_operation", "The cameras.list method is not available.");
      return await input.listCameras(options);
    } catch {
      return sdkRejected("internal_error", "The Camera list could not be read safely.", true);
    }
  }

  async function select(options: unknown): Promise<SdkResult<IdeaSketchCameraSelectResult>> {
    try {
      if (!input.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
      if (!input.getScopes().includes("selection.control")) return sdkRejected("capability_denied", "The caller cannot select Cameras.");
      if (!input.isMethodAvailable("select")) return sdkRejected("unsupported_operation", "The cameras.select method is not available.");
      if (!strictOptions(options)) return sdkRejected("invalid_request", "Camera selection options must be an object.");
      return sdkRejected("unsupported_operation", "Camera selection is owned by the selection and view service.");
    } catch {
      return sdkRejected("internal_error", "The Camera selection could not be handled safely.", true);
    }
  }

  async function beginCreate(rawOptions?: unknown): Promise<SdkResult<IdeaSketchSdkMutationResult>> {
    try {
      if (!input.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
      if (!input.getScopes().includes("host.interaction")) return sdkRejected("capability_denied", "The caller cannot start Camera creation.");
      if (!input.isMethodAvailable("beginCreate")) return sdkRejected("unsupported_operation", "The cameras.beginCreate method is not available.");
      const options = strictOptions(rawOptions);
      if (!options) return sdkRejected("invalid_request", "Camera creation options must be an object.");
      const unknown = Object.keys(options).filter((key) => !["requestId", "snapshotId", "atIndex", "signal"].includes(key));
      if (unknown.length > 0) return sdkRejected("invalid_request", `Unknown Camera creation option field(s): ${unknown.join(", ")}.`);
      if (typeof options.requestId !== "string" || options.requestId.trim().length === 0) return sdkRejected("invalid_request", "requestId must be a non-empty string.");
      if (typeof options.snapshotId !== "string" || !options.snapshotId.startsWith("scene-snapshot:") || options.snapshotId.length <= "scene-snapshot:".length || /[\u0000-\u0020\u007f]/.test(options.snapshotId)) return sdkRejected("invalid_request", "snapshotId is malformed.");
      if (options.atIndex !== undefined && (!Number.isInteger(options.atIndex) || (options.atIndex as number) < 0)) return sdkRejected("invalid_request", "atIndex must be a non-negative integer.");
      if (options.signal !== undefined && !isAbortSignal(options.signal)) return sdkRejected("invalid_request", "signal must be an AbortSignal.");
      if (!input.beginCreate) return sdkRejected("unsupported_operation", "Camera pointer creation is unavailable in this host.");
      return await input.beginCreate({
        requestId: options.requestId,
        snapshotId: options.snapshotId as SceneSnapshotId,
        ...(options.atIndex !== undefined ? { atIndex: options.atIndex as number } : {}),
        ...(options.signal !== undefined ? { signal: options.signal as AbortSignal } : {}),
      });
    } catch {
      return sdkRejected("internal_error", "Camera creation could not be started safely.", true);
    }
  }

  return { list, select, beginCreate };
}

function isAbortSignal(value: unknown): value is AbortSignal {
  if (typeof AbortSignal !== "function" || !(value instanceof AbortSignal)) return false;
  try {
    return typeof value.aborted === "boolean" && typeof value.addEventListener === "function";
  } catch {
    return false;
  }
}
