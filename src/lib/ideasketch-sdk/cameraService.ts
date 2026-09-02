import { sdkRejected, type IdeaSketchCameraListResult, type IdeaSketchSdkMutationResult, type IdeaSketchSdkScope, type SdkResult } from "./types.ts";
import type { IdeaSketchSdkHostTarget } from "./host.ts";

export interface CameraServiceInput {
  getTarget: () => IdeaSketchSdkHostTarget | undefined;
  getScopes: () => readonly IdeaSketchSdkScope[];
  isActive: () => boolean;
  isMethodAvailable: (method: string) => boolean;
  listCameras: (input: unknown) => Promise<SdkResult<IdeaSketchCameraListResult>>;
}

export function createIdeaSketchCameraService(input: CameraServiceInput) {
  async function list(options: unknown = {}): Promise<SdkResult<IdeaSketchCameraListResult>> {
    if (!input.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
    if (!input.getScopes().includes("scene.read")) return sdkRejected("capability_denied", "The caller cannot read Cameras.");
    if (!input.isMethodAvailable("list")) return sdkRejected("unsupported_operation", "The cameras.list method is not available.");
    return input.listCameras(options);
  }

  async function select(options: unknown): Promise<SdkResult<unknown>> {
    if (!input.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
    if (!input.getScopes().includes("selection.control")) return sdkRejected("capability_denied", "The caller cannot select Cameras.");
    if (!input.isMethodAvailable("select")) return sdkRejected("unsupported_operation", "The cameras.select method is not available.");
    if (typeof options !== "object" || options === null || Array.isArray(options)) return sdkRejected("invalid_request", "Camera selection options must be an object.");
    return sdkRejected("unsupported_operation", "Camera selection is owned by the selection and view service.");
  }

  async function beginCreate(_options?: unknown): Promise<SdkResult<IdeaSketchSdkMutationResult>> {
    if (!input.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
    if (!input.getScopes().includes("host.interaction")) return sdkRejected("capability_denied", "The caller cannot start Camera creation.");
    if (!input.isMethodAvailable("beginCreate")) return sdkRejected("unsupported_operation", "The cameras.beginCreate method is not available.");
    return sdkRejected("unsupported_operation", "Camera pointer creation is owned by the trusted UI interaction adapter.");
  }

  return { list, select, beginCreate };
}
