import { extractCameras, type Camera } from "../cameraUtils.ts";
import {
  sdkRejected,
  sdkSucceeded,
  type CameraRef,
  type IdeaSketchSdkScope,
  type PageRef,
  type PresentationSessionId,
  type SdkResult,
} from "./types.ts";
import type { IdeaSketchSdkHostTarget } from "./host.ts";
import { calculateViewportTarget } from "../cameraViewport.ts";

export interface IdeaSketchPresentationState {
  running: boolean;
  mode?: "preview" | "fullscreen";
  pageRef?: PageRef;
  presentationSessionId?: PresentationSessionId;
  activeCameraRef?: CameraRef;
  cameraIndex?: number;
  cameraCount?: number;
}

export interface IdeaSketchPresentationServiceInput {
  getTarget: () => IdeaSketchSdkHostTarget | undefined;
  getScopes: () => readonly IdeaSketchSdkScope[];
  isActive: () => boolean;
  isMethodAvailable: (method: string) => boolean;
  onStateChange?: (state: IdeaSketchPresentationState) => void;
  now?: () => number;
}

type StartInput = { mode: "preview" | "fullscreen"; pageRef: PageRef; cameraRef?: CameraRef };

function opaque(value: unknown, prefix: string): value is string {
  return typeof value === "string" && value.startsWith(prefix) && value.length > prefix.length && !/[\u0000-\u0020\u007f]/.test(value);
}

function strictObject(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== "string" || descriptor?.enumerable !== true || !("value" in (descriptor ?? {}))) return undefined;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return undefined;
  }
}

function pageRefFor(id: string): PageRef { return `page:${id}` as PageRef; }
function cameraRefFor(id: string): CameraRef { return `camera:${id}` as CameraRef; }

function parseStart(value: unknown): SdkResult<StartInput> {
  const input = strictObject(value);
  if (!input || (input.mode !== "preview" && input.mode !== "fullscreen") || !opaque(input.pageRef, "page:")) {
    return sdkRejected("invalid_request", "presentation.start requires mode and pageRef.");
  }
  const unknown = Object.keys(input).filter((key) => !["mode", "pageRef", "cameraRef"].includes(key));
  if (unknown.length > 0) return sdkRejected("invalid_request", `presentation.start contains unknown field(s): ${unknown.join(", ")}.`);
  if (input.cameraRef !== undefined && !opaque(input.cameraRef, "camera:")) return sdkRejected("invalid_request", "cameraRef is malformed.");
  return sdkSucceeded({ mode: input.mode, pageRef: input.pageRef as PageRef, ...(input.cameraRef ? { cameraRef: input.cameraRef as CameraRef } : {}) });
}

function parseSession(value: unknown, method: string): SdkResult<PresentationSessionId> {
  const input = strictObject(value);
  if (!input || !opaque(input.presentationSessionId, "presentation-session:")) return sdkRejected("invalid_request", `${method} requires presentationSessionId.`);
  const allowed = method === "goToCamera" ? ["presentationSessionId", "cameraRef"] : ["presentationSessionId"];
  const unknown = Object.keys(input).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) return sdkRejected("invalid_request", `${method} contains unknown field(s): ${unknown.join(", ")}.`);
  if (method === "goToCamera" && !opaque(input.cameraRef, "camera:")) return sdkRejected("invalid_request", "cameraRef is malformed.");
  return sdkSucceeded(input.presentationSessionId as PresentationSessionId);
}

function cameraIds(target: IdeaSketchSdkHostTarget): Camera[] {
  return extractCameras(target.scene.elements as any[]);
}

export function createIdeaSketchPresentationService(input: IdeaSketchPresentationServiceInput) {
  let current: IdeaSketchPresentationState = Object.freeze({ running: false });
  let expiresAt = 0;
  const stoppedSessionIds = new Set<PresentationSessionId>();
  const clock = input.now ?? (() => Date.now());

  const guard = <Value>(method: string): SdkResult<Value> | undefined => {
    if (!input.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
    if (!input.getScopes().includes("presentation.control")) return sdkRejected("capability_denied", "The caller cannot control Presentation.");
    if (!input.isMethodAvailable(method)) return sdkRejected("unsupported_operation", `The presentation.${method} method is not available.`);
    const target = input.getTarget();
    if (!target) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
    if (target.nativeInteraction.busy) return sdkRejected("editor_busy", "A native editor interaction is in progress.", true);
    return undefined;
  };

  const emit = (state: IdeaSketchPresentationState) => {
    current = Object.freeze({ ...state });
    input.onStateChange?.(current);
  };

  const snapshot = () => {
    const target = input.getTarget();
    if (!target) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
    target.flushDraft?.();
    const refreshed = input.getTarget();
    if (!refreshed) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
    if (refreshed.nativeInteraction.busy) return sdkRejected("editor_busy", "A native editor interaction is in progress.", true);
    return sdkSucceeded(refreshed);
  };

  const stateFor = (sessionId: PresentationSessionId) => {
    if (current.presentationSessionId !== sessionId) return sdkRejected("presentation_session_not_found", "The Presentation session does not exist.");
    if (!current.running && !stoppedSessionIds.has(sessionId)) return sdkRejected("presentation_session_not_found", "The Presentation session does not exist.");
    if (current.running && expiresAt <= clock()) return sdkRejected("presentation_session_not_found", "The Presentation session does not exist.");
    return sdkSucceeded(current);
  };

  const moveToCamera = (target: IdeaSketchSdkHostTarget, camera: Camera | undefined) => {
    if (!camera || !target.updateViewport) return;
    const viewport = target.viewportSize;
    if (!viewport || viewport.width <= 0 || viewport.height <= 0) return;
    target.updateViewport(calculateViewportTarget({
      cameraBounds: camera.bounds,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      paddingFactor: 0.86,
    }));
  };

  async function start(rawInput: unknown): Promise<SdkResult<IdeaSketchPresentationState>> {
    const unavailable = guard< IdeaSketchPresentationState>("start");
    if (unavailable) return unavailable;
    if (current.running) return sdkRejected("editor_busy", "A Presentation session is already running.", true);
    const parsed = parseStart(rawInput);
    if (parsed.status !== "succeeded") return parsed;
    const postFlush = snapshot();
    if (postFlush.status !== "succeeded") return postFlush;
    const target = postFlush.value;
    if (parsed.value.pageRef !== pageRefFor(target.activePageId)) return sdkRejected("cross_page_target", "Presentation can only start from the active Page.");
    const cameras = cameraIds(target);
    const activeIndex = parsed.value.cameraRef ? cameras.findIndex((camera) => cameraRefFor(camera.id) === parsed.value.cameraRef) : -1;
    if (parsed.value.cameraRef && activeIndex < 0) return sdkRejected("target_not_found", "The requested Camera does not exist on the active Page.");
    const id = `presentation-session:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}` as PresentationSessionId;
    const next: IdeaSketchPresentationState = {
      running: true,
      mode: parsed.value.mode,
      pageRef: parsed.value.pageRef,
      presentationSessionId: id,
      ...(activeIndex >= 0 ? { activeCameraRef: parsed.value.cameraRef, cameraIndex: activeIndex } : {}),
      cameraCount: cameras.length,
    };
    expiresAt = clock() + 24 * 60 * 60 * 1000;
    stoppedSessionIds.delete(id);
    emit(next);
    if (activeIndex >= 0) moveToCamera(target, cameras[activeIndex]);
    return sdkSucceeded(next);
  }

  async function stop(rawInput: unknown): Promise<SdkResult<{ outcome: "stopped" | "noop" }>> {
    const unavailable = guard<{ outcome: "stopped" | "noop" }>("stop");
    if (unavailable) return unavailable;
    const parsed = parseSession(rawInput, "stop");
    if (parsed.status !== "succeeded") return parsed;
    if (stoppedSessionIds.has(parsed.value)) return sdkSucceeded({ outcome: "noop" });
    if (!current.presentationSessionId || current.presentationSessionId !== parsed.value || expiresAt <= clock()) {
      return sdkRejected("presentation_session_not_found", "The Presentation session does not exist.");
    }
    if (!current.running) {
      return sdkSucceeded({ outcome: "noop" });
    }
    stoppedSessionIds.add(parsed.value);
    emit({ ...current, running: false });
    expiresAt = 0;
    return sdkSucceeded({ outcome: "stopped" });
  }

  async function getState(rawInput?: unknown): Promise<SdkResult<IdeaSketchPresentationState>> {
    const unavailable = guard<IdeaSketchPresentationState>("getState");
    if (unavailable) return unavailable;
    const parsed = parseSession(rawInput, "getState");
    if (parsed.status !== "succeeded") return parsed;
    return stateFor(parsed.value);
  }

  async function step(rawInput: unknown, direction: 1 | -1, method: "next" | "previous") {
    const unavailable = guard<IdeaSketchPresentationState>(method);
    if (unavailable) return unavailable;
    const parsed = parseSession(rawInput, method);
    if (parsed.status !== "succeeded") return parsed;
    const valid = stateFor(parsed.value);
    if (valid.status !== "succeeded") return valid;
    const target = input.getTarget();
    if (!target) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
    const cameras = cameraIds(target);
    const currentIndex = valid.value.cameraIndex ?? (direction > 0 ? -1 : cameras.length);
    const nextIndex = Math.max(0, Math.min(cameras.length - 1, currentIndex + direction));
    if (cameras.length === 0 || nextIndex === currentIndex) return sdkSucceeded(valid.value);
    const camera = cameras[nextIndex];
    const next = { ...valid.value, activeCameraRef: cameraRefFor(camera.id), cameraIndex: nextIndex, cameraCount: cameras.length };
    emit(next);
    moveToCamera(target, camera);
    return sdkSucceeded(next);
  }

  async function goToCamera(rawInput: unknown): Promise<SdkResult<IdeaSketchPresentationState>> {
    const unavailable = guard<IdeaSketchPresentationState>("goToCamera");
    if (unavailable) return unavailable;
    const parsed = parseSession(rawInput, "goToCamera");
    if (parsed.status !== "succeeded") return parsed;
    const valid = stateFor(parsed.value);
    if (valid.status !== "succeeded") return valid;
    const cameraRef = (strictObject(rawInput)?.cameraRef) as string;
    const target = input.getTarget();
    if (!target) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
    const cameras = cameraIds(target);
    const index = cameras.findIndex((camera) => cameraRefFor(camera.id) === cameraRef);
    if (index < 0 || valid.value.cameraCount !== cameras.length) return sdkRejected("presentation_session_not_found", "The Camera is not part of this Presentation session.");
    const camera = cameras[index];
    const next = { ...valid.value, activeCameraRef: cameraRef as CameraRef, cameraIndex: index, cameraCount: cameras.length };
    emit(next);
    moveToCamera(target, camera);
    return sdkSucceeded(next);
  }

  function stopForContextChange() {
    if (!current.running) return false;
    if (current.presentationSessionId) stoppedSessionIds.add(current.presentationSessionId);
    emit({ ...current, running: false });
    expiresAt = 0;
    return true;
  }

  return { getState, start, stop, next: (input: unknown) => step(input, 1, "next"), previous: (input: unknown) => step(input, -1, "previous"), goToCamera, stopForContextChange };
}
