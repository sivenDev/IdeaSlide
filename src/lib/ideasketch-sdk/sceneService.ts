import { canonicalPayloadDigest, computeSceneDigest } from "./canonicalDigest.ts";
import { applyIdeaSketchScenePlan, type ExcalidrawSceneAdapterResult } from "./excalidrawSceneAdapter.ts";
import { createSemanticSceneProjection } from "./sceneProjection.ts";
import { validateOperationPlan } from "./operationSchemas.ts";
import type { IdeaSketchOperationLimits } from "./operationSchemas.ts";
import { IDEA_SKETCH_SCENE_OPERATION_KINDS } from "./capabilities.ts";
import { executeSdkMutation } from "./transactions.ts";
import {
  sdkCancelled,
  sdkRejected,
  sdkSucceeded,
  type ConfirmationReceipt,
  type IdeaSketchOperation,
  type IdeaSketchSdkMutationResult,
  type IdeaSketchSdkScope,
  type IdeaSketchSceneElementReadOptions,
  type IdeaSketchSceneReadOptions,
  type IdeaSketchSceneReadResult,
  type IdeaSketchScenePlanValidationResult,
  type IdeaSketchCameraListResult,
  type IdeaSketchAssetMetadataListOptions,
  type IdeaSketchAssetMetadataListResult,
  type IdeaSketchSceneCoverage,
  type PageRef,
  type SnapshotCursor,
  type SceneSnapshotId,
  type SdkResult,
  type SdkSyncResult,
} from "./types.ts";
import type { IdeaSketchRequestLedger } from "./requestLedger.ts";
import type { createSnapshotStore } from "./snapshots.ts";
import type { DocumentMutationScheduler } from "./transactions.ts";
import type { IdeaSketchSdkHostTarget } from "./host.ts";
import { isIdeaSketchDocumentWritable } from "./documentWritability.ts";

interface SceneServiceInput {
  sessionId: string;
  sdkProtocolVersion: Readonly<{ major: number; minor: number }>;
  callerProfile: string;
  getTarget: () => IdeaSketchSdkHostTarget | undefined;
  getScopes: () => readonly IdeaSketchSdkScope[];
  snapshots: ReturnType<typeof createSnapshotStore>;
  ledger: IdeaSketchRequestLedger;
  scheduler: DocumentMutationScheduler;
  isActive: () => boolean;
  getAvailableOperationKinds: () => readonly string[];
  isMethodAvailable: (namespace: string, method: string) => boolean;
  getLimits: () => Partial<IdeaSketchOperationLimits>;
  confirmClear?: (input: { scope: "content-only" | "all-elements"; pageRef: string; snapshotId: SceneSnapshotId }) => Promise<boolean>;
}

interface ReadSession {
  projection: ReturnType<typeof createSemanticSceneProjection>;
  snapshotId: SceneSnapshotId;
  projectionSnapshotId: SceneSnapshotId;
  projectionCursor?: string;
  target: { documentId: string; pageId: string; digest: string; editVersion: number; epoch: number; revision: number; status: string; sourceMarker?: string };
}

const CAMERA_LIMITS = Object.freeze({ maxCameraCount: 200, cameraMinWidth: 16, cameraMinHeight: 16 });
const KNOWN_SCOPES = new Set<IdeaSketchSdkScope>([
  "context.read", "requests.read", "document.read", "document.structure.write", "document.import.parse",
  "scene.read", "scene.write", "scene.destructive-clear", "selection.control", "view.read", "view.control",
  "presentation.control", "io.serialize", "user-mediated-io", "asset.read", "events.read", "host.interaction",
  "legacy.raw-scene",
]);

function opaque(prefix: string) {
  try { return `${prefix}:${globalThis.crypto.randomUUID()}`; } catch { return `${prefix}:${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }
}

function rejected<T>(code: Parameters<typeof sdkRejected>[0], message: string, retryable = false): SdkResult<T> {
  return sdkRejected(code, message, retryable);
}

function object(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  try {
    if (Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    // Snapshot only own enumerable fields. Besides preventing inherited
    // option values from crossing the public boundary, this makes accessor
    // failures deterministic invalid_request results instead of late
    // internal errors from a partially-read payload.
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return undefined;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      // Public envelopes are strict: a hidden field must not silently vanish
      // and change the requested operation. Native host records are ordinary
      // enumerable objects, so rejecting hidden fields is safe here too.
      if (!descriptor?.enumerable || !("value" in descriptor)) return undefined;
      // The descriptor has already established that this is an own data
      // property. Read its value directly so a hostile Proxy/getter cannot
      // re-enter the public boundary or produce a different payload between
      // validation and use.
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return undefined;
  }
}

function denseArray(value: unknown): value is readonly unknown[] {
  try {
    if (!Array.isArray(value)) return false;
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
    }
    return true;
  } catch {
    // Revoked or otherwise hostile Proxies must be classified as malformed
    // caller input instead of escaping as an internal host failure.
    return false;
  }
}

function materializeDenseArray(value: unknown): readonly unknown[] | undefined {
  if (!denseArray(value)) return undefined;
  try {
    return Object.freeze(Array.from(value));
  } catch {
    return undefined;
  }
}

function isAbortSignal(value: unknown): value is AbortSignal {
  if (value === undefined) return true;
  try {
    const constructor = globalThis.AbortSignal;
    if (typeof constructor !== "function" || !(value instanceof constructor)) return false;
    const ownDescriptor = Object.getOwnPropertyDescriptor(value, "aborted");
    if (ownDescriptor && ("get" in ownDescriptor || typeof ownDescriptor.value !== "boolean")) return false;
    const abortedGetter = Object.getOwnPropertyDescriptor(constructor.prototype, "aborted")?.get;
    if (typeof abortedGetter !== "function") return false;
    // Calling the native WebIDL getter is a brand check. It rejects objects
    // that merely inherit AbortSignal.prototype (and proxies around signals)
    // before they can reach the transaction kernel.
    abortedGetter.call(value);
    return true;
  } catch {
    return false;
  }
}

function opaqueToken(value: unknown, prefix: string): value is string {
  return typeof value === "string"
    && value.startsWith(prefix)
    && value.length > prefix.length
    && !/[\u0000-\u0020\u007f]/.test(value.slice(prefix.length));
}

function sceneCoverage(value: { identityRefs: readonly string[]; mutationReadyRefs: readonly string[] }): IdeaSketchSceneCoverage {
  return {
    identityRefs: value.identityRefs as IdeaSketchSceneCoverage["identityRefs"],
    mutationReadyRefs: value.mutationReadyRefs as IdeaSketchSceneCoverage["mutationReadyRefs"],
  };
}

function unknownOptionFields(value: object, allowed: readonly string[], label: string) {
  const unknown = Reflect.ownKeys(value).filter((key) => typeof key !== "string" || !allowed.includes(key));
  return unknown.length > 0 ? rejected<never>("invalid_request", `${label} contains unknown field(s): ${unknown.map((key) => typeof key === "string" ? key : String(key)).join(", ")}.`) : undefined;
}

function referencedStableRefs(operation: IdeaSketchOperation) {
  const record = operation as unknown as Record<string, unknown>;
  const refs: unknown[] = [record.elementRef, record.shapeRef, record.arrowRef, record.textRef, record.containerRef, record.cameraRef, record.start, record.end];
  if (Array.isArray(record.selectedRefs)) refs.push(...record.selectedRefs);
  if (Array.isArray(record.cameraRefs)) refs.push(...record.cameraRefs);
  if (Array.isArray(record.refs)) refs.push(...record.refs);
  return refs.flatMap((ref) => typeof ref === "string"
    ? [ref]
    : object(ref) && typeof object(ref)?.targetRef === "string"
      ? [object(ref)!.targetRef as string]
      : []).filter((ref) => !ref.startsWith("temp:"));
}

/**
 * Operation builders are only a convenience surface. A caller can still
 * construct a versioned operation envelope by hand, so the mutation service
 * must enforce the negotiated per-caller operation allowlist as well.
 */
function validateAvailableOperationKinds(
  operations: readonly IdeaSketchOperation[],
  availableKinds: readonly string[],
): SdkResult<void> {
  const available = new Set(availableKinds);
  for (const operation of operations) {
    if (!available.has(operation.kind)) {
      return rejected(
        "unsupported_operation",
        `The ${operation.kind} operation is not available to this caller.`,
      );
    }
  }
  return sdkSucceeded(undefined);
}

function targetSnapshot(target: IdeaSketchSdkHostTarget) {
  return {
    documentId: target.documentId,
    pageId: target.activePageId,
    digest: "",
    editVersion: target.pageEditVersion,
    epoch: target.nativeInteraction.epoch,
    revision: target.revision,
    status: target.documentStatus,
    ...(target.sourceModified ? { sourceMarker: target.sourceModified } : {}),
  };
}

export function createIdeaSketchSceneService(input: SceneServiceInput) {
  const reads = new Map<string, ReadSession>();
  const cameraCursors = new Map<string, { snapshotId: SceneSnapshotId; offset: number }>();
  const assetCursors = new Map<string, { snapshotId: SceneSnapshotId; offset: number }>();
  const cameraCursorByPosition = new Map<string, SnapshotCursor>();
  const assetCursorByPosition = new Map<string, SnapshotCursor>();
  const confirmations = new Map<string, {
    callerSessionId: string;
    documentId: string;
    pageId: string;
    snapshotId: SceneSnapshotId;
    scope: "content-only" | "all-elements";
    expiresAt: number;
  }>();

  async function currentProjection(target: IdeaSketchSdkHostTarget): Promise<SdkSyncResult<{ digest: string; projection: ReturnType<typeof createSemanticSceneProjection> }>> {
    try {
      const digest = await computeSceneDigest(target.scene, { ephemeralElementIds: new Set() });
      const projection = createSemanticSceneProjection({
        pageRef: `page:${target.activePageId}`,
        elements: target.scene.elements,
        appState: target.scene.appState,
        files: target.scene.files,
        pageEditVersion: target.pageEditVersion,
      });
      return sdkSucceeded({ digest, projection });
    } catch {
      return sdkRejected("internal_error", "The active scene could not be read safely.", true);
    }
  }

  async function verifyReadSession(snapshotId: SceneSnapshotId, target: IdeaSketchSdkHostTarget) {
    const readSession = reads.get(snapshotId);
    if (!readSession) return rejected<never>("snapshot_required", "The scene snapshot does not exist.");
    let digest: string;
    try {
      digest = await computeSceneDigest(target.scene, { ephemeralElementIds: new Set() });
    } catch {
      return rejected<never>("internal_error", "The active scene could not be verified safely.", true);
    }
    const verified = input.snapshots.getScene(snapshotId, {
      documentId: target.documentId,
      pageId: target.activePageId,
      digest,
      editVersion: target.pageEditVersion,
      nativeInteractionEpoch: target.nativeInteraction.epoch,
      revision: target.revision,
      documentStatus: target.documentStatus,
      sourceMarker: target.sourceModified,
    });
    if (verified.status !== "succeeded") return verified;
    return sdkSucceeded({ readSession, snapshot: verified.value });
  }

  function validatePlanCoverage(
    target: IdeaSketchSdkHostTarget,
    snapshot: { complete: boolean; mutationReadyRefs: readonly string[] },
    operations: readonly IdeaSketchOperation[],
  ): SdkResult<void> {
    for (const operation of operations) {
      if (!input.getAvailableOperationKinds().includes(operation.kind)) return rejected("unsupported_operation", `The ${operation.kind} operation is not available for this caller.`);
    }
    const requiresComplete = operations.some((operation) => (
      ["clear-scene", "set-camera-order", "delete-camera"].includes(operation.kind)
      || operation.kind === "create-camera" && operation.atIndex !== undefined
    ));
    if (requiresComplete && !snapshot.complete) return rejected("incomplete_read", "This operation requires a complete scene snapshot.");
    for (const operation of operations) {
      for (const ref of referencedStableRefs(operation)) {
        if (!snapshot.mutationReadyRefs.includes(ref)) return rejected("incomplete_read", `The target ${ref} is not mutation-ready.`);
      }
    }
    if (operations.some((operation) => operation.kind === "set-camera-order" || operation.kind === "delete-camera" || operation.kind === "create-camera" && operation.atIndex !== undefined)) {
      const liveCameraRefs = target.scene.elements.flatMap((element) => {
        const item = object(element);
        return item && item.isDeleted !== true && object(item.customData)?.type === "camera" && typeof item.id === "string" ? [`camera:${item.id}`] : [];
      });
      if (liveCameraRefs.some((ref) => !snapshot.mutationReadyRefs.includes(ref))) return rejected("incomplete_read", "All live Cameras must be mutation-ready.");
    }
    return sdkSucceeded(undefined);
  }

  async function readUnsafe(rawOptions: IdeaSketchSceneReadOptions | unknown = {}): Promise<SdkResult<IdeaSketchSceneReadResult>> {
    const options = object(rawOptions) as IdeaSketchSceneReadOptions | undefined;
    if (!options) return rejected("invalid_request", "Scene read options must be an object.");
    const unknown = unknownOptionFields(options, ["pageRef", "snapshotId", "cursor", "limit", "includeDeleted"], "Scene read options");
    if (unknown) return unknown;
    if (options.pageRef !== undefined && !opaqueToken(options.pageRef, "page:")) return rejected("invalid_request", "pageRef is malformed.");
    if (options.snapshotId !== undefined && !opaqueToken(options.snapshotId, "scene-snapshot:")) return rejected("invalid_request", "snapshotId is malformed.");
    if (options.cursor !== undefined && !opaqueToken(options.cursor, "snapshot-cursor:")) return rejected("invalid_request", "cursor is malformed.");
    if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit <= 0)) return rejected("limit_exceeded", "Scene read limit is invalid.");
    if (options.includeDeleted !== undefined && typeof options.includeDeleted !== "boolean") return rejected("invalid_request", "includeDeleted must be boolean.");
    if (!input.isActive()) return rejected("session_closed", "The IdeaSketch SDK session is closed.");
    if (!input.getScopes().includes("scene.read")) return rejected("capability_denied", "The caller cannot read the scene.");
    if (!input.isMethodAvailable("scene", "read")) return rejected("unsupported_operation", "The scene.read method is not available.");
    const target = input.getTarget();
    if (!target) return rejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
    if (target.mountedPageId !== target.activePageId) return rejected("editor_unavailable", "The active IdeaSketch canvas is unavailable.", true);
    if (options.pageRef && options.pageRef !== `page:${target.activePageId}`) return rejected("cross_page_target", "Scene reads are scoped to the active Page.");
    if (target.nativeInteraction.busy) return rejected("editor_busy", "A native editor interaction is in progress.", true);
    const liveResult = await currentProjection(target);
    if (liveResult.status !== "succeeded") return liveResult;
    const live = liveResult.value;
    let readSession: ReadSession | undefined;
    let projectionCursor: string | undefined;
    if (options.cursor) {
      const cursor = reads.get(options.cursor);
      if (!cursor) return rejected("snapshot_required", "The scene cursor does not exist.");
      if (options.snapshotId && options.snapshotId !== cursor.snapshotId) return rejected("snapshot_required", "The scene cursor does not belong to the requested snapshot.");
      readSession = cursor;
      projectionCursor = cursor.projectionCursor;
    } else if (options.snapshotId) {
      readSession = reads.get(options.snapshotId);
      if (!readSession) return rejected("snapshot_required", "The scene snapshot does not exist.");
      // A snapshot id is an idempotent anchor for the first page. Pagination
      // advances only when the caller supplies the opaque nextCursor.
      projectionCursor = undefined;
    }
    if (!readSession) {
      const issued = input.snapshots.issueScene({
        documentId: target.documentId,
        pageId: target.activePageId,
        digest: live.digest,
        editVersion: target.pageEditVersion,
        nativeInteractionEpoch: target.nativeInteraction.epoch,
        revision: target.revision,
        documentStatus: target.documentStatus,
        sourceMarker: target.sourceModified,
        busy: target.nativeInteraction.busy,
      });
      if (issued.status === "rejected") return issued;
      const projectionRead = live.projection.read({ limit: options.limit, includeDeleted: options.includeDeleted });
      if (projectionRead.status === "rejected") return projectionRead;
      readSession = {
        projection: live.projection,
        snapshotId: issued.value.snapshotId,
        projectionSnapshotId: projectionRead.value.snapshotId,
        projectionCursor: projectionRead.value.nextCursor,
        target: { ...targetSnapshot(target), digest: live.digest },
      };
      reads.set(readSession.snapshotId, readSession);
      const cursor = projectionRead.value.nextCursor;
      if (cursor) reads.set(String(cursor), { ...readSession, projectionSnapshotId: projectionRead.value.snapshotId, projectionCursor: cursor });
      const extended = input.snapshots.extendSceneCoverage({
        snapshotId: readSession.snapshotId,
        identityRefs: projectionRead.value.elements.map((element) => element.ref),
        mutationReadyRefs: projectionRead.value.coverage.mutationReadyRefs,
        complete: projectionRead.value.complete,
      });
      if (extended.status === "rejected") return extended;
      return sdkSucceeded({ ...projectionRead.value, snapshotId: readSession.snapshotId });
    }
    const verified = await verifyReadSession(readSession.snapshotId, target);
    if (verified.status !== "succeeded") return verified;
    const projectionRead = readSession.projection.read({ ...(projectionCursor ? { cursor: projectionCursor as never } : { snapshotId: readSession.projectionSnapshotId }), limit: options.limit, includeDeleted: options.includeDeleted });
    if (projectionRead.status === "rejected") return projectionRead;
    const cursor = projectionRead.value.nextCursor;
    reads.set(readSession.snapshotId, { ...readSession, projectionSnapshotId: projectionRead.value.snapshotId, projectionCursor: cursor });
    if (cursor) reads.set(String(cursor), { ...readSession, projectionSnapshotId: projectionRead.value.snapshotId, projectionCursor: cursor });
    const extended = input.snapshots.extendSceneCoverage({
      snapshotId: readSession.snapshotId,
      identityRefs: projectionRead.value.elements.map((element) => element.ref),
      mutationReadyRefs: projectionRead.value.coverage.mutationReadyRefs,
      complete: projectionRead.value.complete,
    });
    if (extended.status === "rejected") return extended;
    return sdkSucceeded({ ...projectionRead.value, snapshotId: readSession.snapshotId, coverage: sceneCoverage(extended.value) });
  }

  async function getElementsUnsafe(rawOptions: IdeaSketchSceneElementReadOptions | unknown): Promise<SdkResult<IdeaSketchSceneReadResult>> {
    const options = object(rawOptions) as IdeaSketchSceneElementReadOptions | undefined;
    const refs = materializeDenseArray(options?.refs);
    if (!options || typeof options.snapshotId !== "string" || !refs || refs.length === 0) return rejected("invalid_request", "getElements requires snapshotId and refs.");
    const unknown = unknownOptionFields(options, ["snapshotId", "refs", "includeDeleted"], "getElements options");
    if (unknown) return unknown;
    if (!opaqueToken(options.snapshotId, "scene-snapshot:") || refs.some((ref) => !opaqueToken(ref, "element:") && !opaqueToken(ref, "camera:"))) return rejected("invalid_request", "getElements references are malformed.");
    if (options.includeDeleted !== undefined && typeof options.includeDeleted !== "boolean") return rejected("invalid_request", "includeDeleted must be boolean.");
    if (!input.isActive()) return rejected("session_closed", "The IdeaSketch SDK session is closed.");
    if (!input.getScopes().includes("scene.read")) return rejected("capability_denied", "The caller cannot read the scene.");
    if (!input.isMethodAvailable("scene", "getElements")) return rejected("unsupported_operation", "The scene.getElements method is not available.");
    const target = input.getTarget();
    const readSession = reads.get(options.snapshotId);
    if (!target || !readSession) return rejected("snapshot_required", "The scene snapshot does not exist.");
    if (target.mountedPageId !== target.activePageId) return rejected("editor_unavailable", "The active IdeaSketch canvas is unavailable.", true);
    if (target.nativeInteraction.busy) return rejected("editor_busy", "A native editor interaction is in progress.", true);
    const verified = await verifyReadSession(options.snapshotId, target);
    if (verified.status !== "succeeded") return verified;
    const projected = readSession.projection.getElements({ snapshotId: readSession.projectionSnapshotId, refs: refs as never[], includeDeleted: options.includeDeleted });
    if (projected.status === "rejected") return projected;
    const extended = input.snapshots.extendSceneCoverage({ snapshotId: options.snapshotId, identityRefs: projected.value.elements.map((element) => element.ref), mutationReadyRefs: projected.value.coverage.mutationReadyRefs });
    if (extended.status === "rejected") return extended;
    return sdkSucceeded({ ...projected.value, snapshotId: options.snapshotId, coverage: sceneCoverage(extended.value) });
  }

  async function listCamerasUnsafe(rawOptions: unknown = {}): Promise<SdkResult<IdeaSketchCameraListResult>> {
    const options = object(rawOptions) as { snapshotId?: SceneSnapshotId; cursor?: string; limit?: number } | undefined;
    if (!options) return rejected("invalid_request", "Camera list options must be an object.");
    const unknown = unknownOptionFields(options, ["snapshotId", "cursor", "limit"], "Camera list options");
    if (unknown) return unknown;
    if (options.snapshotId !== undefined && !opaqueToken(options.snapshotId, "scene-snapshot:")) return rejected("invalid_request", "Camera list snapshotId is malformed.");
    if (options.cursor !== undefined && !opaqueToken(options.cursor, "camera-cursor:")) return rejected("invalid_request", "Camera list cursor is malformed.");
    if (!input.isActive()) return rejected("session_closed", "The IdeaSketch SDK session is closed.");
    if (!input.getScopes().includes("scene.read")) return rejected("capability_denied", "The caller cannot read Cameras.");
    if (!input.isMethodAvailable("cameras", "list")) return rejected("unsupported_operation", "The cameras.list method is not available.");
    let snapshotId = options.snapshotId;
    let offset = 0;
    if (options.cursor !== undefined) {
      const cursor = cameraCursors.get(options.cursor);
      if (!cursor || snapshotId && cursor.snapshotId !== snapshotId) return rejected("snapshot_required", "The Camera cursor is invalid.");
      snapshotId = cursor.snapshotId;
      offset = cursor.offset;
    }
    if (typeof snapshotId !== "string") return rejected("invalid_request", "Camera list requires a scene snapshotId.");
    const limit = options.limit ?? 50;
    if (!Number.isInteger(limit) || limit <= 0 || limit > 100) return rejected("limit_exceeded", "Camera list limit is invalid.");
    const target = input.getTarget();
    if (!target || target.mountedPageId !== target.activePageId) return rejected("editor_unavailable", "The active IdeaSketch canvas is unavailable.", true);
    if (target.nativeInteraction.busy) return rejected("editor_busy", "A native editor interaction is in progress.", true);
    const verified = await verifyReadSession(snapshotId, target);
    if (verified.status !== "succeeded") return verified;
    const cameras = verified.value.readSession.projection.listCameras();
    if (offset > cameras.length) return rejected("snapshot_stale", "The Camera cursor is stale.", true);
    const page = cameras.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    const positionKey = `${snapshotId}:${nextOffset}`;
    const nextCursor = nextOffset < cameras.length
      ? (cameraCursorByPosition.get(positionKey) ?? opaque("camera-cursor") as SnapshotCursor)
      : undefined;
    if (nextCursor) {
      cameraCursorByPosition.set(positionKey, nextCursor);
      cameraCursors.set(nextCursor, { snapshotId, offset: nextOffset });
    }
    const extended = input.snapshots.extendSceneCoverage({ snapshotId, identityRefs: page.map((camera) => camera.ref) });
    if (extended.status === "rejected") return extended;
    return sdkSucceeded({ snapshotId, pageRef: `page:${target.activePageId}` as PageRef, cameras: page, complete: nextOffset >= cameras.length, ...(nextCursor ? { nextCursor: nextCursor as SnapshotCursor } : {}), coverage: sceneCoverage(extended.value) });
  }

  async function listAssetMetadataUnsafe(rawOptions: unknown = {}): Promise<SdkResult<IdeaSketchAssetMetadataListResult>> {
    const options = object(rawOptions) as IdeaSketchAssetMetadataListOptions | undefined;
    if (!options) return rejected("invalid_request", "Asset metadata options must be an object.");
    const unknown = unknownOptionFields(options, ["snapshotId", "cursor", "limit"], "Asset metadata options");
    if (unknown) return unknown;
    if (options.snapshotId !== undefined && !opaqueToken(options.snapshotId, "scene-snapshot:")) return rejected("invalid_request", "Asset metadata snapshotId is malformed.");
    if (options.cursor !== undefined && !opaqueToken(options.cursor, "asset-cursor:")) return rejected("invalid_request", "Asset metadata cursor is malformed.");
    if (!input.isActive()) return rejected("session_closed", "The IdeaSketch SDK session is closed.");
    if (!input.getScopes().includes("asset.read")) return rejected("capability_denied", "The caller cannot read asset metadata.");
    if (!input.isMethodAvailable("assets", "listMetadata")) return rejected("unsupported_operation", "The assets.listMetadata method is not available.");
    let snapshotId = options.snapshotId;
    let offset = 0;
    if (options.cursor !== undefined) {
      const cursor = assetCursors.get(options.cursor);
      if (!cursor || snapshotId && cursor.snapshotId !== snapshotId) return rejected("snapshot_required", "The asset cursor is invalid.");
      snapshotId = cursor.snapshotId;
      offset = cursor.offset;
    }
    if (typeof snapshotId !== "string") return rejected("invalid_request", "Asset metadata requires a scene snapshotId.");
    const limit = options.limit ?? 50;
    if (!Number.isInteger(limit) || limit <= 0 || limit > 100) return rejected("limit_exceeded", "Asset metadata limit is invalid.");
    const target = input.getTarget();
    if (!target || target.mountedPageId !== target.activePageId) return rejected("editor_unavailable", "The active IdeaSketch canvas is unavailable.", true);
    if (target.nativeInteraction.busy) return rejected("editor_busy", "A native editor interaction is in progress.", true);
    const verified = await verifyReadSession(snapshotId, target);
    if (verified.status !== "succeeded") return verified;
    const assets = verified.value.readSession.projection.listAssetMetadata();
    if (offset > assets.length) return rejected("snapshot_stale", "The asset cursor is stale.", true);
    const page = assets.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    const positionKey = `${snapshotId}:${nextOffset}`;
    const nextCursor = nextOffset < assets.length
      ? (assetCursorByPosition.get(positionKey) ?? opaque("asset-cursor") as SnapshotCursor)
      : undefined;
    if (nextCursor) {
      assetCursorByPosition.set(positionKey, nextCursor);
      assetCursors.set(nextCursor, { snapshotId, offset: nextOffset });
    }
    const extended = input.snapshots.extendSceneCoverage({ snapshotId, identityRefs: page.map((asset) => asset.ref) });
    if (extended.status === "rejected") return extended;
    return sdkSucceeded({
      snapshotId,
      pageRef: `page:${target.activePageId}` as PageRef,
      assets: page,
      complete: nextOffset >= assets.length,
      ...(nextCursor ? { nextCursor: nextCursor as SnapshotCursor } : {}),
      coverage: {
        identityRefs: extended.value.identityRefs as import("./types.ts").IdeaSketchAssetCoverage["identityRefs"],
        mutationReadyRefs: extended.value.mutationReadyRefs as import("./types.ts").IdeaSketchAssetCoverage["mutationReadyRefs"],
      },
    });
  }

  async function validatePlanUnsafe(rawOptions: { snapshotId?: SceneSnapshotId; operations?: readonly IdeaSketchOperation[] } | unknown): Promise<SdkResult<IdeaSketchScenePlanValidationResult>> {
    const options = object(rawOptions) as { snapshotId?: SceneSnapshotId; operations?: readonly IdeaSketchOperation[] } | undefined;
    const operations = materializeDenseArray(options?.operations);
    if (!options || typeof options.snapshotId !== "string" || !operations) return rejected("invalid_request", "validatePlan requires snapshotId and operations.");
    const unknown = unknownOptionFields(options, ["snapshotId", "operations"], "validatePlan options");
    if (unknown) return unknown;
    if (!opaqueToken(options.snapshotId, "scene-snapshot:")) return rejected("invalid_request", "snapshotId is malformed.");
    if (!input.isActive()) return rejected("session_closed", "The IdeaSketch SDK session is closed.");
    if (!input.getScopes().includes("scene.write")) return rejected("capability_denied", "The caller cannot validate scene plans.");
    if (!input.isMethodAvailable("scene", "validatePlan")) return rejected("unsupported_operation", "The scene.validatePlan method is not available.");
    const target = input.getTarget();
    if (!target) return rejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
    if (target.nativeInteraction.busy) return rejected("editor_busy", "A native editor interaction is in progress.", true);
    const validated = validateOperationPlan(operations, input.getLimits());
    if (validated.status === "rejected") return validated;
    if (validated.value.some((operation) => !IDEA_SKETCH_SCENE_OPERATION_KINDS.includes(operation.kind as never))) return rejected("unsupported_operation", "Scene plans may contain only scene operation kinds.");
    const available = validateAvailableOperationKinds(
      validated.value,
      input.getAvailableOperationKinds(),
    );
    if (available.status === "rejected") return available;
    const verified = await verifyReadSession(options.snapshotId, target);
    if (verified.status !== "succeeded") return verified;
    const coverage = validatePlanCoverage(target, verified.value.snapshot, validated.value);
    if (coverage.status === "rejected") return coverage;
    const clearOperations = validated.value.filter((operation): operation is Extract<IdeaSketchOperation, { kind: "clear-scene" }> => operation.kind === "clear-scene");
    if (clearOperations.length > 0) {
      if (clearOperations.length !== 1 || validated.value.length !== 1) return rejected("invalid_request", "clear-scene must be the only operation in its plan.");
      if (input.callerProfile !== "trusted-ui" || !input.getScopes().includes("scene.destructive-clear")) return rejected("capability_denied", "Only trusted UI may clear the scene.");
      if (!isClearReceiptValid(clearOperations[0].confirmationReceipt as string, options.snapshotId, clearOperations[0].scope, target)) return rejected("confirmation_required", "A live matching clear confirmation is required.");
    }
    const adapter = applyIdeaSketchScenePlan({ scene: target.scene, operations: validated.value, pageRef: `page:${target.activePageId}`, limits: input.getLimits(), ...CAMERA_LIMITS });
    if (adapter.status === "rejected") return adapter;
    return sdkSucceeded({ valid: true, snapshotId: options.snapshotId, operationResults: adapter.value.operations, createdRefs: adapter.value.createdRefs, updatedRefs: adapter.value.updatedRefs, deletedRefs: adapter.value.deletedRefs, cascadedRefs: adapter.value.cascadedRefs, diagnostics: adapter.value.diagnostics });
  }

  async function applyPlanUnsafe(rawOptions: unknown): Promise<SdkResult<IdeaSketchSdkMutationResult>> {
    const options = object(rawOptions) as { requestId?: string; snapshotId?: SceneSnapshotId; operations?: readonly IdeaSketchOperation[]; requiredCapabilities?: readonly IdeaSketchSdkScope[]; signal?: AbortSignal } | undefined;
    const operations = materializeDenseArray(options?.operations);
    if (!options || typeof options.requestId !== "string" || options.requestId.trim().length === 0 || typeof options.snapshotId !== "string" || !operations) return rejected("invalid_request", "applyPlan requires requestId, snapshotId, and operations.");
    const unknown = unknownOptionFields(options, ["requestId", "snapshotId", "operations", "requiredCapabilities", "signal"], "applyPlan options");
    if (unknown) return unknown;
    if (!opaqueToken(options.snapshotId, "scene-snapshot:")) return rejected("invalid_request", "snapshotId is malformed.");
    const requiredCapabilitiesInput = options.requiredCapabilities === undefined
      ? undefined
      : materializeDenseArray(options.requiredCapabilities);
    if (options.requiredCapabilities !== undefined && (!requiredCapabilitiesInput || requiredCapabilitiesInput.some((scope) => typeof scope !== "string" || !KNOWN_SCOPES.has(scope as IdeaSketchSdkScope)))) {
      return rejected("invalid_request", "applyPlan.requiredCapabilities must be an array of capability names.");
    }
    if (!isAbortSignal(options.signal)) return rejected("invalid_request", "applyPlan.signal must be an AbortSignal.");
    const requiredCapabilities = requiredCapabilitiesInput ? [...new Set(requiredCapabilitiesInput as readonly IdeaSketchSdkScope[])].sort() : undefined;
    if (!input.isActive()) return rejected("session_closed", "The IdeaSketch SDK session is closed.");
    if (requiredCapabilities && requiredCapabilities.some((scope) => !input.getScopes().includes(scope))) return rejected("capability_denied", "The caller does not hold all required capabilities.");
    if (!input.getScopes().includes("scene.write")) return rejected("capability_denied", "The caller cannot mutate the scene.");
    const validated = validateOperationPlan(operations, input.getLimits());
    if (validated.status === "rejected") return validated;
    if (validated.value.some((operation) => !IDEA_SKETCH_SCENE_OPERATION_KINDS.includes(operation.kind as never))) return rejected("unsupported_operation", "Scene plans may contain only scene operation kinds.");
    let payloadDigest: string;
    try {
      payloadDigest = await canonicalPayloadDigest({
        sdkProtocolVersion: input.sdkProtocolVersion,
        requestId: options.requestId,
        snapshotId: options.snapshotId,
        operations: validated.value,
        ...(requiredCapabilities ? { requiredCapabilities } : {}),
      });
    } catch {
      return rejected("invalid_request", "The mutation payload must be strict JSON data.");
    }
    const existing = input.ledger.lookup({ requestId: options.requestId, payloadDigest });
    if (existing.status === "rejected") return existing;
    if (existing.value?.kind === "replay") return existing.value.result;
    if (existing.value?.kind === "joined") return existing.value.result;
    // Idempotent replays survive transient method availability changes, but
    // never bypass lifecycle or scope authorization above.
    if (!input.isMethodAvailable("scene", "applyPlan")) return rejected("unsupported_operation", "The scene.applyPlan method is not available.");
    const target = input.getTarget();
    if (!target) return rejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
    if (target.nativeInteraction.busy) return rejected("editor_busy", "A native editor interaction is in progress.", true);
    if (!isIdeaSketchDocumentWritable({ ...target, callerProfile: input.callerProfile, servicesWritable: target.services.writable })) return rejected("read_only", "The IdeaSketch document is read-only.");
    if (!target.mountedPageId || target.mountedPageId !== target.activePageId || !target.commitScene) return rejected("editor_unavailable", "The active IdeaSketch canvas is unavailable.", true);
    const available = validateAvailableOperationKinds(
      validated.value,
      input.getAvailableOperationKinds(),
    );
    if (available.status === "rejected") return available;
    const verified = await verifyReadSession(options.snapshotId, target);
    if (verified.status !== "succeeded") return verified;
    const coverage = validatePlanCoverage(target, verified.value.snapshot, validated.value);
    if (coverage.status === "rejected") return coverage;
    const requestId = options.requestId;
    const snapshotId = options.snapshotId;
    const clearOperations = validated.value.filter((operation): operation is Extract<IdeaSketchOperation, { kind: "clear-scene" }> => operation.kind === "clear-scene");
    if (clearOperations.length > 0 && (clearOperations.length !== 1 || validated.value.length !== 1)) return rejected("invalid_request", "clear-scene must be the only operation in its plan.");
    const clearOperation = clearOperations[0];
    if (clearOperation) {
      if (input.callerProfile !== "trusted-ui" || !input.getScopes().includes("scene.destructive-clear")) return rejected("capability_denied", "Only trusted UI may clear the scene.");
    }
    let prepared: ExcalidrawSceneAdapterResult | undefined;
    const result = await executeSdkMutation({
      kind: "scene",
      documentSessionId: target.documentSessionId,
      requestId,
      payload: {
        sdkProtocolVersion: input.sdkProtocolVersion,
        requestId,
        snapshotId,
        operations: validated.value,
        ...(requiredCapabilities ? { requiredCapabilities } : {}),
      },
      scheduler: input.scheduler,
      ledger: input.ledger,
      signal: options.signal,
      ...(clearOperation ? {
        beforeExecute: () => consumeClearReceipt(clearOperation.confirmationReceipt as string, snapshotId, clearOperation.scope, target)
          ? sdkSucceeded(undefined)
          : sdkRejected("confirmation_required", "A live matching clear confirmation is required."),
      } : {}),
      readState: () => input.getTarget()?.scene ?? target.scene,
      computeDigest: (scene) => computeSceneDigest(scene as IdeaSketchSdkHostTarget["scene"], { ephemeralElementIds: new Set() }),
      prepare: (scene) => {
        const adapter = applyIdeaSketchScenePlan({ scene: scene as IdeaSketchSdkHostTarget["scene"], operations: validated.value, pageRef: `page:${target.activePageId}`, limits: input.getLimits(), ...CAMERA_LIMITS });
        if (adapter.status === "rejected") throw {
          code: adapter.error.code,
          message: adapter.error.message,
          retryable: adapter.error.retryable,
          ...(adapter.error.operationIndex !== undefined ? { operationIndex: adapter.error.operationIndex } : {}),
        };
        prepared = adapter.value;
        return adapter.value.scene;
      },
      finalValidate: (_before) => {
        const live = input.getTarget();
        if (!live || live.documentSessionId !== target.documentSessionId || live.activePageId !== target.activePageId) return sdkRejected("external_change", "The active Page changed before commit.", true);
        if (live.revision !== target.revision || live.sourceModified !== target.sourceModified) return sdkRejected("external_change", "The document changed before commit.", true);
        if (live.nativeInteraction.busy) return sdkRejected("editor_busy", "A native editor interaction is in progress.", true);
        if (live.pageEditVersion !== target.pageEditVersion || live.nativeInteraction.epoch !== target.nativeInteraction.epoch) return sdkRejected("snapshot_stale", "The scene changed before commit.", true);
        if (!isIdeaSketchDocumentWritable({ ...live, callerProfile: input.callerProfile, servicesWritable: live.services.writable })) return sdkRejected("read_only", "The document became read-only.");
        return sdkSucceeded(undefined);
      },
      validatePostconditions: (scene) => Boolean(scene && prepared),
      commit: (scene) => liveCommit(target, scene as IdeaSketchSdkHostTarget["scene"], {
        requestId,
        pageRef: `page:${target.activePageId}`,
        operationKinds: (prepared?.operations ?? []).map((operation) => operation.kind),
        affectedRefs: [
          ...(prepared?.createdRefs ? Object.values(prepared.createdRefs) : []),
          ...(prepared?.updatedRefs ?? []),
          ...(prepared?.deletedRefs ?? []),
          ...(prepared?.cascadedRefs ?? []),
        ],
      }),
      getEditVersion: () => input.getTarget()?.pageEditVersion ?? target.pageEditVersion,
      createResult: (mutation) => {
        const pageRef = `page:${target.activePageId}` as import("./types.ts").PageRef;
        const toEntity = (ref: import("./types.ts").ElementRef | import("./types.ts").CameraRef) => ({ pageRef, ref });
        const createdRefs = Object.fromEntries(Object.entries(prepared?.createdRefs ?? {}).map(([ref, created]) => [ref, toEntity(created)]));
        return {
        changeSetId: `change:${requestId}`,
        requestId,
        outcome: mutation.beforeDigest === mutation.afterDigest ? "noop" : "applied",
        beforeDigest: mutation.beforeDigest,
        afterDigest: mutation.afterDigest,
        beforeEditVersion: mutation.beforeEditVersion,
        afterEditVersion: mutation.afterEditVersion,
        createdRefs,
        updatedRefs: (prepared?.updatedRefs ?? []).map(toEntity),
        deletedRefs: (prepared?.deletedRefs ?? []).map(toEntity),
        cascadedRefs: (prepared?.cascadedRefs ?? []).map(toEntity),
        operations: prepared?.operations ?? [],
        diagnostics: prepared?.diagnostics ?? [],
        history: { nativeCanvas: "created", document: "none", agentCustom: "not-supported" },
        };
      },
    });
    return result;
  }

  function requestClearConfirmationUnsafe(rawOptions: unknown): Promise<SdkResult<ConfirmationReceipt>> {
    return (async () => {
      const options = object(rawOptions) as { snapshotId?: SceneSnapshotId; scope?: "content-only" | "all-elements" } | undefined;
      if (!options || typeof options.snapshotId !== "string" || (options.scope !== "content-only" && options.scope !== "all-elements")) return rejected("invalid_request", "Clear confirmation requires snapshotId and a valid scope.");
      const unknown = unknownOptionFields(options, ["snapshotId", "scope"], "Clear confirmation options");
      if (unknown) return unknown;
      if (!opaqueToken(options.snapshotId, "scene-snapshot:")) return rejected("invalid_request", "snapshotId is malformed.");
      if (!input.isActive()) return rejected("session_closed", "The IdeaSketch SDK session is closed.");
      if (input.callerProfile !== "trusted-ui" || !input.getScopes().includes("scene.destructive-clear")) return rejected("capability_denied", "Only trusted UI may request a destructive clear.");
      if (!input.isMethodAvailable("scene", "requestClearConfirmation")) return rejected("unsupported_operation", "The scene.requestClearConfirmation method is not available.");
      const target = input.getTarget();
      if (!target) return rejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
      if (target.mountedPageId !== target.activePageId) return rejected("editor_unavailable", "The active IdeaSketch canvas is unavailable.", true);
      if (target.nativeInteraction.busy) return rejected("editor_busy", "A native editor interaction is in progress.", true);
      if (!isIdeaSketchDocumentWritable({ ...target, callerProfile: input.callerProfile, servicesWritable: target.services.writable })) return rejected("read_only", "The IdeaSketch document is read-only.");
      const verified = await verifyReadSession(options.snapshotId, target);
      if (verified.status !== "succeeded") return verified;
      if (!verified.value.snapshot.complete) return rejected("incomplete_read", "Clear confirmation requires a complete scene snapshot.");
      if (!input.confirmClear) return rejected("editor_unavailable", "The destructive confirmation UI is unavailable.");
      if (!(await input.confirmClear({ scope: options.scope, pageRef: `page:${target.activePageId}`, snapshotId: options.snapshotId }))) return sdkCancelled("The clear confirmation was cancelled.");
      const receipt = opaque("confirmation-receipt") as ConfirmationReceipt;
      confirmations.set(receipt, {
        callerSessionId: input.sessionId,
        documentId: target.documentId,
        pageId: target.activePageId,
        snapshotId: options.snapshotId,
        scope: options.scope,
        expiresAt: Date.now() + 30_000,
      });
      return sdkSucceeded(receipt);
    })();
  }

  function consumeClearReceipt(
    receipt: string,
    snapshotId: SceneSnapshotId,
    scope: string,
    target?: IdeaSketchSdkHostTarget,
  ) {
    const value = confirmations.get(receipt);
    if (!isClearReceiptValid(receipt, snapshotId, scope, target)) return false;
    if (
      !value
      || value.callerSessionId !== input.sessionId
    ) return false;
    confirmations.delete(receipt);
    return true;
  }

  function isClearReceiptValid(
    receipt: string,
    snapshotId: SceneSnapshotId,
    scope: string,
    target?: IdeaSketchSdkHostTarget,
  ) {
    const value = confirmations.get(receipt);
    return Boolean(
      value
      && value.callerSessionId === input.sessionId
      && value.snapshotId === snapshotId
      && value.scope === scope
      && value.expiresAt >= Date.now()
      && (!target || value.documentId === target.documentId && value.pageId === target.activePageId),
    );
  }

  async function safely<Value>(label: string, run: () => Promise<SdkResult<Value>>): Promise<SdkResult<Value>> {
    // Lifecycle is checked before parsing the method payload. Once a caller
    // session is disposed, every async scene/camera/asset method has the
    // RFC-mandated session_closed result, including malformed input. This
    // also prevents disposed facades from probing host availability through
    // validation error differences.
    if (!input.isActive()) return rejected("session_closed", "The IdeaSketch SDK session is closed.");
    try {
      return await run();
    } catch {
      // Unsafe handlers already classify expected malformed input as
      // invalid_request. A throw that escapes those guards is therefore a
      // host/service failure, not another caller validation error.
      return rejected("internal_error", `${label} failed inside the IdeaSketch SDK host.`, true);
    }
  }

  const read = (options?: IdeaSketchSceneReadOptions) => safely("Scene read", () => readUnsafe(options));
  const getElements = (options: IdeaSketchSceneElementReadOptions) => safely("getElements", () => getElementsUnsafe(options));
  const listCameras = (options?: unknown) => safely("Camera list", () => listCamerasUnsafe(options));
  const listAssetMetadata = (options?: IdeaSketchAssetMetadataListOptions) => safely<IdeaSketchAssetMetadataListResult>("Asset metadata list", () => listAssetMetadataUnsafe(options));
  const validatePlan = (options: unknown) => safely("Scene validation", () => validatePlanUnsafe(options));
  const applyPlan = (options: unknown) => safely("Scene application", () => applyPlanUnsafe(options));
  const requestClearConfirmation = (options: unknown) => safely("Clear confirmation", () => requestClearConfirmationUnsafe(options));

  return { read, getElements, listCameras, listAssetMetadata, validatePlan, applyPlan, requestClearConfirmation, consumeClearReceipt };
}

function liveCommit(target: IdeaSketchSdkHostTarget, scene: IdeaSketchSdkHostTarget["scene"], record: import("./editorHostAdapter.ts").IdeaSketchInternalSceneCommitRecord) {
  if (!target.commitScene) throw new Error("The active scene commit adapter is unavailable.");
  const receipt = target.commitScene(scene);
  target.recordSceneCommit?.(record);
  return receipt;
}
