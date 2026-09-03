import {
  sdkRejected,
  sdkSucceeded,
  type CameraRef,
  type ElementRef,
  type IdeaSketchSceneReadOptions,
  type IdeaSketchSceneReadResult,
  type IdeaSketchSelectionResult,
  type IdeaSketchViewportSummary,
  type IdeaSketchSdkScope,
  type PageRef,
  type SceneSnapshotId,
  type SdkResult,
  type SdkSyncResult,
} from "./types.ts";
import type { IdeaSketchSdkHostScene } from "./host.ts";

export type IdeaSketchSelectionSummary = IdeaSketchSelectionResult;

export interface IdeaSketchSelectionViewServiceInput {
  getTarget: () => {
    activePageId: string;
    mountedPageId?: string;
    nativeInteraction: { busy: boolean };
    scene: IdeaSketchSdkHostScene;
  } | undefined;
  getScopes: () => readonly IdeaSketchSdkScope[];
  isActive: () => boolean;
  isMethodAvailable: (namespace: string, method: string) => boolean;
  readScene: (options: IdeaSketchSceneReadOptions) => Promise<SdkResult<IdeaSketchSceneReadResult>>;
  getSceneElements?: (options: { snapshotId: SceneSnapshotId; refs: readonly (ElementRef | CameraRef)[] }) => Promise<SdkResult<IdeaSketchSceneReadResult>>;
  /** Host adapter using Excalidraw updateScene({ captureUpdate: NEVER }). */
  updateSelection?: (refs: readonly (ElementRef | CameraRef)[]) => void | Promise<void>;
  onSelectionChange?: (selection: IdeaSketchSelectionResult) => void;
  /** Host adapter using a NEVER capture.  The patch is semantic and contains
   * no raw DOM/AppState values. */
  updateViewport?: (
    viewport: Pick<IdeaSketchViewportSummary, "scrollX" | "scrollY" | "zoom">,
    options?: { animate?: boolean; durationMs?: number },
  ) => void | Promise<void>;
}

type SelectionOptions = { snapshotId: SceneSnapshotId };
type SelectionTarget = {
  activePageId: string;
  mountedPageId?: string;
  nativeInteraction: { busy: boolean };
  scene: IdeaSketchSdkHostScene;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  try {
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function strictObject(value: unknown): Record<string, unknown> | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  try {
    const prototype = Object.getPrototypeOf(record);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(record)) {
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
      if (typeof key !== "string" || !descriptor?.enumerable || !("value" in descriptor)) return undefined;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return undefined;
  }
}

function unknownFields(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).filter((key) => !allowed.includes(key));
}

function opaque(value: unknown, prefix: string): value is string {
  return typeof value === "string"
    && value.startsWith(prefix)
    && value.length > prefix.length
    && !/[\u0000-\u0020\u007f]/.test(value);
}

function denseRefs(value: unknown): value is readonly string[] {
  if (!Array.isArray(value)) return false;
  return value.every((ref) => typeof ref === "string");
}

function refsForScene(scene: IdeaSketchSceneReadResult): Set<string> {
  return new Set(scene.coverage.identityRefs.map(String));
}

function selectedRefsFromTarget(target: SelectionTarget | undefined) {
  if (!target) return [] as (ElementRef | CameraRef)[];
  const selected = asRecord(target?.scene.appState.selectedElementIds);
  if (!selected) return [] as (ElementRef | CameraRef)[];
  const cameraIds = new Set(
    target.scene.elements.flatMap((value) => {
      const element = asRecord(value);
      return element?.isDeleted !== true
        && typeof element?.id === "string"
        && asRecord(element.customData)?.type === "camera"
        ? [element.id]
        : [];
    }),
  );
  return Object.entries(selected)
    .filter(([, isSelected]) => isSelected === true)
    .map(([id]) => (cameraIds.has(id) ? `camera:${id}` : `element:${id}`) as ElementRef | CameraRef);
}

function normalizeRefs(refs: readonly string[]) {
  return Object.freeze([...new Set(refs)].sort()) as readonly (ElementRef | CameraRef)[];
}

function viewportFromTarget(
  target: SelectionTarget,
  pageRef: PageRef,
  visibleRefs: readonly (ElementRef | CameraRef)[] = [],
): IdeaSketchViewportSummary {
  const appState = target.scene.appState;
  const rawScrollX = typeof appState.scrollX === "number" && Number.isFinite(appState.scrollX) ? appState.scrollX : 0;
  const rawScrollY = typeof appState.scrollY === "number" && Number.isFinite(appState.scrollY) ? appState.scrollY : 0;
  const scrollX = Object.is(rawScrollX, -0) ? 0 : rawScrollX;
  const scrollY = Object.is(rawScrollY, -0) ? 0 : rawScrollY;
  const zoomValue = asRecord(appState.zoom)?.value;
  const zoom = typeof zoomValue === "number" && Number.isFinite(zoomValue) && zoomValue > 0 ? zoomValue : 1;
  const width = typeof appState.width === "number" && Number.isFinite(appState.width) && appState.width > 0 ? appState.width : undefined;
  const height = typeof appState.height === "number" && Number.isFinite(appState.height) && appState.height > 0 ? appState.height : undefined;
  return Object.freeze({
    pageRef,
    scrollX,
    scrollY,
    zoom,
    ...(width !== undefined && height !== undefined
      ? { bounds: Object.freeze({ x: scrollX === 0 ? 0 : -scrollX, y: scrollY === 0 ? 0 : -scrollY, width: width / zoom, height: height / zoom }) }
      : {}),
    visibleRefs: Object.freeze([...visibleRefs]),
  });
}

function boundsOfElement(element: IdeaSketchSceneReadResult["elements"][number]) {
  return element.bounds;
}

function intersects(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
) {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

function parseSnapshotOptions(value: unknown): SdkSyncResult<SelectionOptions> {
  const options = strictObject(value);
  if (!options) return sdkRejected("invalid_request", "Selection or viewport options must be an object.");
  const unknown = unknownFields(options, ["snapshotId"]);
  if (unknown.length > 0) return sdkRejected("invalid_request", `Unknown option field(s): ${unknown.join(", ")}.`);
  if (!opaque(options.snapshotId, "scene-snapshot:")) return sdkRejected("invalid_request", "snapshotId is malformed.");
  return sdkSucceeded({ snapshotId: options.snapshotId as SceneSnapshotId });
}

function parseRefs(value: unknown, label: string): SdkSyncResult<readonly (ElementRef | CameraRef)[]> {
  if (!denseRefs(value)) return sdkRejected("invalid_request", `${label} must be a dense array of SDK references.`);
  const refs = value as readonly string[];
  for (const ref of refs) {
    if (!opaque(ref, "element:") && !opaque(ref, "camera:")) return sdkRejected("invalid_request", `${label} contains a malformed reference.`);
  }
  if (new Set(refs).size !== refs.length) return sdkRejected("invalid_request", `${label} must not contain duplicate references.`);
  return sdkSucceeded(normalizeRefs(refs));
}

function ensureLiveRefs(
  scene: IdeaSketchSceneReadResult,
  refs: readonly (ElementRef | CameraRef)[],
) {
  const identity = refsForScene(scene);
  for (const ref of refs) {
    if (!identity.has(ref)) return sdkRejected("incomplete_read", `The reference ${ref} is not covered by this scene snapshot.`);
    const element = scene.elements.find((candidate) => candidate.ref === ref);
    if (!element) return sdkRejected("target_not_found", `The reference ${ref} does not exist.`);
    if (element.deleted) return sdkRejected("target_not_found", `The reference ${ref} is deleted.`);
  }
  return sdkSucceeded(undefined);
}

export function createIdeaSketchSelectionViewService(input: IdeaSketchSelectionViewServiceInput) {
  let selectionVersion = 0;
  let lastSelectionSignature = "";
  const currentPageRef = () => `page:${input.getTarget()?.activePageId ?? ""}` as PageRef;

  const guard = <Value>(namespace: string, method: string, scope: IdeaSketchSdkScope): SdkResult<Value> | undefined => {
    if (!input.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
    if (!input.getScopes().includes(scope)) return sdkRejected("capability_denied", "The caller is not authorized for this method.");
    if (!input.isMethodAvailable(namespace, method)) return sdkRejected("unsupported_operation", `The ${namespace}.${method} method is not available.`);
    const target = input.getTarget();
    if (!target) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
    if (target.mountedPageId !== target.activePageId) return sdkRejected("editor_unavailable", "The active IdeaSketch canvas is unavailable.", true);
    if (target.nativeInteraction.busy) return sdkRejected("editor_busy", "A native editor interaction is in progress.", true);
    return undefined;
  };

  async function readSnapshot(snapshotId: SceneSnapshotId) {
    return input.readScene({ snapshotId });
  }

  async function getSelection(rawOptions: unknown): Promise<SdkResult<IdeaSketchSelectionSummary>> {
    try {
      const unavailable = guard<IdeaSketchSelectionSummary>("selection", "get", "selection.control");
      if (unavailable) return unavailable;
      const options = parseSnapshotOptions(rawOptions);
      if (options.status === "rejected") return options;
      const target = input.getTarget();
      if (!target) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
      const scene = await readSnapshot(options.value.snapshotId);
      if (scene.status !== "succeeded") return scene;
      const refs = selectedRefsFromTarget(target);
      let currentScene = scene.value;
      const uncovered = refs.filter((ref) => !refsForScene(currentScene).has(ref));
      if (uncovered.length > 0 && input.getSceneElements) {
        const expanded = await input.getSceneElements({ snapshotId: options.value.snapshotId, refs: uncovered });
        if (expanded.status !== "succeeded") return expanded;
        currentScene = {
          ...currentScene,
          elements: Object.freeze([...currentScene.elements, ...expanded.value.elements.filter((candidate) => !currentScene.elements.some((existing) => existing.ref === candidate.ref))]),
          coverage: {
            identityRefs: Object.freeze([...new Set([...currentScene.coverage.identityRefs, ...expanded.value.coverage.identityRefs])]),
            mutationReadyRefs: Object.freeze([...new Set([...currentScene.coverage.mutationReadyRefs, ...expanded.value.coverage.mutationReadyRefs])]),
          },
        };
      }
      const live = ensureLiveRefs(currentScene, refs);
      if (live.status === "rejected") return live;
      const normalized = normalizeRefs(refs);
      const signature = normalized.join("|");
      if (signature !== lastSelectionSignature) {
        lastSelectionSignature = signature;
        selectionVersion += 1;
      }
      return sdkSucceeded(Object.freeze({ pageRef: currentPageRef(), selectionVersion, refs: normalized }));
    } catch {
      return sdkRejected("internal_error", "The selection could not be read safely.", true);
    }
  }

  async function setSelection(rawOptions: unknown): Promise<SdkResult<IdeaSketchSelectionSummary>> {
    try {
      const unavailable = guard<IdeaSketchSelectionSummary>("selection", "set", "selection.control");
      if (unavailable) return unavailable;
      const options = strictObject(rawOptions);
      if (!options) return sdkRejected("invalid_request", "Selection options must be an object.");
      const unknown = unknownFields(options, ["snapshotId", "refs"]);
      if (unknown.length > 0) return sdkRejected("invalid_request", `Unknown selection option field(s): ${unknown.join(", ")}.`);
      const snapshot = parseSnapshotOptions({ snapshotId: options.snapshotId });
      if (snapshot.status === "rejected") return snapshot;
      const refsResult = parseRefs(options.refs, "refs");
      if (refsResult.status === "rejected") return refsResult;
      const scene = await readSnapshot(snapshot.value.snapshotId);
      if (scene.status !== "succeeded") return scene;
      const live = ensureLiveRefs(scene.value, refsResult.value);
      if (live.status === "rejected") return live;
      if (!input.updateSelection) return sdkRejected("unsupported_operation", "The selection control adapter is unavailable.");
      await input.updateSelection(refsResult.value);
      const signature = refsResult.value.join("|");
      if (signature !== lastSelectionSignature) {
        lastSelectionSignature = signature;
        selectionVersion += 1;
      }
      const result = Object.freeze({ pageRef: currentPageRef(), selectionVersion, refs: refsResult.value });
      try {
        input.onSelectionChange?.(result);
      } catch {
        // Event diagnostics must never alter the already-applied selection.
      }
      return sdkSucceeded(result);
    } catch {
      return sdkRejected("internal_error", "The selection could not be changed safely.", true);
    }
  }

  async function clearSelection(rawOptions: unknown): Promise<SdkResult<IdeaSketchSelectionSummary>> {
    const unavailable = guard<IdeaSketchSelectionSummary>("selection", "clear", "selection.control");
    if (unavailable) return unavailable;
    const options = parseSnapshotOptions(rawOptions);
    if (options.status === "rejected") return options;
    return setSelection({ snapshotId: options.value.snapshotId, refs: [] });
  }

  async function getViewport(rawOptions: unknown): Promise<SdkResult<IdeaSketchViewportSummary>> {
    try {
      const unavailable = guard<IdeaSketchViewportSummary>("view", "getViewport", "view.read");
      if (unavailable) return unavailable;
      const options = parseSnapshotOptions(rawOptions);
      if (options.status === "rejected") return options;
      const target = input.getTarget();
      if (!target) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
      const scene = await readSnapshot(options.value.snapshotId);
      if (scene.status !== "succeeded") return scene;
      const base = viewportFromTarget(target, currentPageRef());
      if (!base.bounds) return sdkSucceeded(base);
      const visibleRefs = scene.value.elements
        .filter((element) => !element.deleted && element.bounds && intersects(element.bounds, base.bounds!))
        .map((element) => element.ref);
      return sdkSucceeded(viewportFromTarget(target, currentPageRef(), visibleRefs));
    } catch {
      return sdkRejected("internal_error", "The viewport could not be read safely.", true);
    }
  }

  async function focusElements(rawOptions: unknown): Promise<SdkResult<{ pageRef: PageRef; refs: readonly (ElementRef | CameraRef)[]; viewport: IdeaSketchViewportSummary }>> {
    try {
      const unavailable = guard<{ pageRef: PageRef; refs: readonly (ElementRef | CameraRef)[]; viewport: IdeaSketchViewportSummary }>("view", "focusElements", "view.control");
      if (unavailable) return unavailable;
      const options = strictObject(rawOptions);
      if (!options) return sdkRejected("invalid_request", "Focus options must be an object.");
      const unknown = unknownFields(options, ["snapshotId", "refs", "fit", "animate", "durationMs"]);
      if (unknown.length > 0) return sdkRejected("invalid_request", `Unknown focus option field(s): ${unknown.join(", ")}.`);
      const snapshot = parseSnapshotOptions({ snapshotId: options.snapshotId });
      if (snapshot.status === "rejected") return snapshot;
      const refsResult = parseRefs(options.refs, "refs");
      if (refsResult.status === "rejected") return refsResult;
      if (refsResult.value.length === 0) return sdkRejected("invalid_request", "At least one reference is required to focus the view.");
      if (options.fit !== undefined && typeof options.fit !== "boolean") return sdkRejected("invalid_request", "fit must be boolean.");
      if (options.animate !== undefined && typeof options.animate !== "boolean") return sdkRejected("invalid_request", "animate must be boolean.");
      if (options.durationMs !== undefined && (!Number.isInteger(options.durationMs) || (options.durationMs as number) < 0 || (options.durationMs as number) > 2_000)) return sdkRejected("invalid_request", "durationMs must be an integer from 0 to 2000.");
      const target = input.getTarget();
      if (!target) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
      const scene = await readSnapshot(snapshot.value.snapshotId);
      if (scene.status !== "succeeded") return scene;
      const live = ensureLiveRefs(scene.value, refsResult.value);
      if (live.status === "rejected") return live;
      const selected = scene.value.elements.filter((element) => refsResult.value.includes(element.ref) && element.bounds);
      if (selected.length === 0) return sdkRejected("target_not_found", "The requested references have no focusable bounds.");
      const union = selected.reduce((acc, element) => {
        const bounds = boundsOfElement(element)!;
        const right = Math.max(acc.x + acc.width, bounds.x + bounds.width);
        const bottom = Math.max(acc.y + acc.height, bounds.y + bounds.height);
        return { x: Math.min(acc.x, bounds.x), y: Math.min(acc.y, bounds.y), width: right - Math.min(acc.x, bounds.x), height: bottom - Math.min(acc.y, bounds.y) };
      }, { ...boundsOfElement(selected[0])! });
      const appState = target.scene.appState;
      const viewportWidth = typeof appState.width === "number" && appState.width > 0 ? appState.width : 800;
      const viewportHeight = typeof appState.height === "number" && appState.height > 0 ? appState.height : 600;
      const currentZoom = viewportFromTarget(target, currentPageRef()).zoom;
      const fit = options.fit !== false;
      const zoom = fit
        ? Math.min(viewportWidth / Math.max(union.width, 1), viewportHeight / Math.max(union.height, 1)) * 0.9
        : currentZoom;
      const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : currentZoom;
      const nextViewport = Object.freeze({
        scrollX: viewportWidth / (2 * safeZoom) - (union.x + union.width / 2),
        scrollY: viewportHeight / (2 * safeZoom) - (union.y + union.height / 2),
        zoom: safeZoom,
      });
      if (!input.updateViewport) return sdkRejected("unsupported_operation", "The viewport control adapter is unavailable.");
      await input.updateViewport(nextViewport, {
        ...(options.animate !== undefined ? { animate: options.animate } : {}),
        ...(options.durationMs !== undefined ? { durationMs: options.durationMs as number } : {}),
      });
      return sdkSucceeded(Object.freeze({ pageRef: currentPageRef(), refs: refsResult.value, viewport: viewportFromTarget({ ...target, scene: { ...target.scene, appState: { ...target.scene.appState, ...nextViewport, zoom: { value: safeZoom } } } }, currentPageRef(), refsResult.value) }));
    } catch {
      return sdkRejected("internal_error", "The viewport could not be changed safely.", true);
    }
  }

  async function selectCamera(rawOptions: unknown): Promise<SdkResult<{ cameraRef: CameraRef; selected: true; focused: true }>> {
    try {
      const unavailable = guard<{ cameraRef: CameraRef; selected: true; focused: true }>("cameras", "select", "selection.control");
      if (unavailable) return unavailable;
      const options = strictObject(rawOptions);
      if (!options) return sdkRejected("invalid_request", "Camera selection options must be an object.");
      const unknown = unknownFields(options, ["snapshotId", "cameraRef"]);
      if (unknown.length > 0) return sdkRejected("invalid_request", `Unknown camera option field(s): ${unknown.join(", ")}.`);
      if (!opaque(options.snapshotId, "scene-snapshot:") || !opaque(options.cameraRef, "camera:")) return sdkRejected("invalid_request", "Camera selection references are malformed.");
      const scene = await readSnapshot(options.snapshotId as SceneSnapshotId);
      if (scene.status !== "succeeded") return scene;
      const live = ensureLiveRefs(scene.value, [options.cameraRef as CameraRef]);
      if (live.status === "rejected") return live;
      const camera = scene.value.elements.find((element) => element.ref === options.cameraRef && element.isCamera);
      if (!camera) return sdkRejected("target_not_found", "The requested Camera does not exist.");
      if (!input.updateSelection || !input.updateViewport || !camera.bounds) return sdkRejected("unsupported_operation", "The Camera selection adapter is unavailable.");
      await input.updateSelection([options.cameraRef as CameraRef]);
      const cameraRefs = Object.freeze([options.cameraRef as CameraRef]);
      if (lastSelectionSignature !== options.cameraRef) {
        lastSelectionSignature = options.cameraRef;
        selectionVersion += 1;
        const cameraSelection = Object.freeze({ pageRef: currentPageRef(), selectionVersion, refs: cameraRefs });
        try {
          input.onSelectionChange?.(cameraSelection);
        } catch {
          // Event diagnostics must never alter the already-applied selection.
        }
      }
      const target = input.getTarget();
      if (!target) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
      const width = typeof target.scene.appState.width === "number" && target.scene.appState.width > 0 ? target.scene.appState.width : 800;
      const height = typeof target.scene.appState.height === "number" && target.scene.appState.height > 0 ? target.scene.appState.height : 600;
      const zoom = Math.min(width / Math.max(camera.bounds.width, 1), height / Math.max(camera.bounds.height, 1)) * 0.9;
      const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
      await input.updateViewport({
        scrollX: width / (2 * safeZoom) - (camera.bounds.x + camera.bounds.width / 2),
        scrollY: height / (2 * safeZoom) - (camera.bounds.y + camera.bounds.height / 2),
        zoom: safeZoom,
      });
      return sdkSucceeded({ cameraRef: options.cameraRef as CameraRef, selected: true, focused: true });
    } catch {
      return sdkRejected("internal_error", "The Camera could not be selected safely.", true);
    }
  }

  return {
    selection: { get: getSelection, set: setSelection, clear: clearSelection },
    view: { getViewport, focusElements },
    cameras: { select: selectCamera },
  };
}
