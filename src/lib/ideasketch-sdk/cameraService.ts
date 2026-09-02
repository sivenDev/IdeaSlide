import { sdkRejected, type IdeaSketchCameraListResult, type IdeaSketchSdkMutationResult, type IdeaSketchSdkScope, type SdkResult } from "./types.ts";
import type { IdeaSketchSdkHostTarget } from "./host.ts";

export interface CameraServiceInput {
  getTarget: () => IdeaSketchSdkHostTarget | undefined;
  getScopes: () => readonly IdeaSketchSdkScope[];
  isActive: () => boolean;
  isMethodAvailable: (method: string) => boolean;
  listCameras: (input: unknown) => Promise<SdkResult<IdeaSketchCameraListResult>>;
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

  async function select(options: unknown): Promise<SdkResult<unknown>> {
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

  async function beginCreate(_options?: unknown): Promise<SdkResult<IdeaSketchSdkMutationResult>> {
    try {
      if (!input.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
      if (!input.getScopes().includes("host.interaction")) return sdkRejected("capability_denied", "The caller cannot start Camera creation.");
      if (!input.isMethodAvailable("beginCreate")) return sdkRejected("unsupported_operation", "The cameras.beginCreate method is not available.");
      return sdkRejected("unsupported_operation", "Camera pointer creation is owned by the trusted UI interaction adapter.");
    } catch {
      return sdkRejected("internal_error", "Camera creation could not be started safely.", true);
    }
  }

  return { list, select, beginCreate };
}
