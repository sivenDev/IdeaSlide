import {
  canonicalPayloadDigest,
  canonicalStringify,
  computeDocumentDigest,
  computeSceneDigest,
} from "./canonicalDigest.ts";
import { applyIdeaSketchScenePlan } from "./excalidrawSceneAdapter.ts";
import {
  createIdeaSketchPageFromImport,
  parseExcalidrawImport,
  type ImportedExcalidrawScene,
} from "../excalidrawImport.ts";
import { buildNewPageStyleConversion } from "../excalidrawStyleConversion.ts";
import { extractCameras } from "../cameraUtils.ts";
import { createEmptyIdeaSketchPage } from "../ideaSketchReducer.ts";
import { validateIdeaSketchScenePostconditions } from "./scenePostconditions.ts";
import { validateIdeaSketchPagePlan } from "./pageOperations.ts";
import { executeSdkMutation } from "./transactions.ts";
import {
  sdkRejected,
  sdkSucceeded,
  type DocumentSnapshotId,
  type ElementRef,
  type IdeaSketchEntityRef,
  type IdeaSketchPageApplyPlanInput,
  type IdeaSketchPageListOptions,
  type IdeaSketchPageListResult,
  type IdeaSketchPageOperation,
  type IdeaSketchPagePlanValidationResult,
  type IdeaSketchPageSummary,
  type IdeaSketchSdkCapabilities,
  type IdeaSketchSdkMutationResult,
  type IdeaSketchSdkScope,
  type PageRef,
  type ParsedPageDraftRef,
  type SceneSnapshotId,
  type SdkResult,
  type SdkSyncResult,
  type SnapshotCursor,
} from "./types.ts";
import type { ReservedRequestHandle } from "./requestLedger.ts";
import type { IdeaSketchDocument, IdeaSketchPage } from "../../types.ts";
import type { IdeaSketchRequestLedger } from "./requestLedger.ts";
import type { createSnapshotStore } from "./snapshots.ts";
import type { DocumentMutationScheduler } from "./transactions.ts";
import type { IdeaSketchSdkHostTarget } from "./host.ts";
import { isIdeaSketchDocumentWritable } from "./documentWritability.ts";

interface PagesServiceInput {
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
  getLimits: () => IdeaSketchSdkCapabilities["limits"];
}

const KNOWN_SCOPES = new Set<IdeaSketchSdkScope>([
  "context.read", "requests.read", "document.read", "document.structure.write", "document.import.parse",
  "scene.read", "scene.write", "scene.destructive-clear", "selection.control", "view.read", "view.control",
  "presentation.control", "io.serialize", "user-mediated-io", "asset.read", "events.read", "host.interaction",
  "legacy.raw-scene",
]);

interface DocumentReadSession {
  snapshotId: DocumentSnapshotId;
  digest: string;
  target: {
    documentId: string;
    digest: string;
    editVersion: number;
    epoch: number;
    revision: number;
    status: string;
    sourceMarker?: string;
  };
  document: IdeaSketchDocument;
  summaries: readonly IdeaSketchPageSummary[];
}

interface ParsedDraft {
  callerSessionId: string;
  documentId: string;
  scene: ImportedExcalidrawScene;
  createdAt: number;
  expiresAt: number;
  reserved: boolean;
}

interface PreparedPagePlan {
  document: IdeaSketchDocument;
  createdRefs: Record<string, PageRef | IdeaSketchEntityRef>;
  updatedPageRefs: PageRef[];
  deletedPageRefs: PageRef[];
  operationKinds: string[];
  operationResults: Array<{ index: number; kind: IdeaSketchPageOperation["kind"]; outcome: "created" | "updated" | "deleted" | "noop" }>;
  diagnostics: string[];
  selectedPageId?: string;
  consumedDrafts: string[];
}

function object(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  try {
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

function denseArray(value: unknown): value is readonly unknown[] {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
  }
  return true;
}

function isAbortSignal(value: unknown): value is AbortSignal {
  if (value === undefined) return true;
  try {
    const constructor = globalThis.AbortSignal;
    if (typeof constructor !== "function" || !(value instanceof constructor)) return false;
    const getter = Object.getOwnPropertyDescriptor(constructor.prototype, "aborted")?.get;
    if (typeof getter !== "function") return false;
    getter.call(value);
    return true;
  } catch {
    return false;
  }
}

function unknownFields(value: Record<string, unknown>, allowed: readonly string[], label: string): SdkSyncResult<void> | undefined {
  const unknown = Reflect.ownKeys(value).filter((key) => typeof key !== "string" || !allowed.includes(key));
  return unknown.length > 0
    ? sdkRejected("invalid_request", `${label} contains unknown field(s): ${unknown.map(String).join(", ")}.`)
    : undefined;
}

function opaque(value: unknown, prefix: string): value is string {
  return typeof value === "string"
    && value.startsWith(prefix)
    && value.length > prefix.length
    && !/[\u0000-\u0020\u007f]/.test(value.slice(prefix.length));
}

function clone<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value)) as T;
}

function pageRef(id: string): PageRef {
  return `page:${id}` as PageRef;
}

function pageEntity(ref: PageRef): IdeaSketchEntityRef {
  return { pageRef: ref, ref };
}

function title(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const result = value.trim();
  return result || fallback;
}

function pageSummaries(document: IdeaSketchDocument): IdeaSketchPageSummary[] {
  return document.pages.map((page, index) => ({
    pageRef: pageRef(page.id),
    index,
    title: page.title,
    elementCount: page.elements.length,
    cameraCount: extractCameras(page.elements).length,
  }));
}

function documentTarget(target: IdeaSketchSdkHostTarget, digest: string) {
  return {
    documentId: target.documentId,
    digest,
    editVersion: target.pageEditVersion,
    nativeInteractionEpoch: target.nativeInteraction.epoch,
    revision: target.revision,
    documentStatus: target.documentStatus,
    ...(target.sourceModified ? { sourceMarker: target.sourceModified } : {}),
  };
}

function pageIdFromRef(ref: string): string | undefined {
  return ref.startsWith("page:") ? ref.slice("page:".length) : undefined;
}

function uniquePageId(document: IdeaSketchDocument): string {
  const ids = new Set(document.pages.map((page) => page.id));
  let id: string = globalThis.crypto?.randomUUID?.() ?? `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  while (ids.has(id)) id = `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return id;
}

function persistentAppState(appState: Partial<Record<string, unknown>>) {
  const result: Partial<Record<string, unknown>> = {};
  for (const key of ["viewBackgroundColor", "gridSize"] as const) {
    if (Object.prototype.hasOwnProperty.call(appState, key)) result[key] = appState[key];
  }
  return result;
}

function decodeImportInput(rawInput: unknown): SdkSyncResult<{ value: unknown; sourceName?: string }> {
  let input = rawInput;
  let sourceName: string | undefined;
  const envelope = object(rawInput);
  if (envelope && (Object.prototype.hasOwnProperty.call(envelope, "data") || Object.prototype.hasOwnProperty.call(envelope, "bytes"))) {
    const unknown = unknownFields(envelope, ["data", "bytes", "sourceName"], "parseExcalidraw options");
    if (unknown) return unknown as SdkSyncResult<{ value: unknown; sourceName?: string }>;
    input = envelope.data ?? envelope.bytes;
    if (envelope.sourceName !== undefined && typeof envelope.sourceName !== "string") return sdkRejected("invalid_request", "sourceName must be a string.");
    sourceName = envelope.sourceName as string | undefined;
  }
  if (typeof input === "string") {
    try {
      return sdkSucceeded({ value: JSON.parse(input), ...(sourceName ? { sourceName } : {}) });
    } catch {
      return sdkRejected("invalid_request", "The Excalidraw JSON string is malformed.");
    }
  }
  if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
    try {
      const bytes = input instanceof ArrayBuffer
        ? new Uint8Array(input)
        : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
      return sdkSucceeded({ value: JSON.parse(new TextDecoder().decode(bytes)), ...(sourceName ? { sourceName } : {}) });
    } catch {
      return sdkRejected("invalid_request", "The Excalidraw byte payload is malformed.");
    }
  }
  if (!envelope) return sdkRejected("invalid_request", "parseExcalidraw requires JSON text, bytes, or an object.");
  return sdkSucceeded({ value: input, ...(sourceName ? { sourceName } : {}) });
}

function validateImportedScene(scene: ImportedExcalidrawScene, limits: IdeaSketchSdkCapabilities["limits"]): SdkSyncResult<void> {
  if (scene.elements.length > limits.maxImportElements) return sdkRejected("limit_exceeded", "The Excalidraw import contains too many elements.");
  const ids = new Set<string>();
  for (const [index, item] of scene.elements.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.id !== "string") {
      return sdkRejected("invalid_request", `Excalidraw element ${index + 1} is malformed.`);
    }
    if (ids.has(item.id)) return sdkRejected("invalid_request", `Excalidraw contains duplicate element id ${item.id}.`);
    ids.add(item.id);
  }
  for (const [index, item] of scene.elements.entries()) {
    const reference = (value: unknown) => typeof value === "string" && ids.has(value);
    if (item.containerId !== undefined && item.containerId !== null && !reference(item.containerId)) return sdkRejected("invalid_request", `Excalidraw element ${index + 1} has an invalid container binding.`);
    if (item.boundElements !== undefined && item.boundElements !== null && !Array.isArray(item.boundElements)) return sdkRejected("invalid_request", `Excalidraw element ${index + 1} has malformed boundElements.`);
    for (const binding of item.boundElements ?? []) {
      if (!binding || typeof binding.id !== "string" || !reference(binding.id)) return sdkRejected("invalid_request", `Excalidraw element ${index + 1} has an invalid boundElements reference.`);
    }
    for (const key of ["startBinding", "endBinding"] as const) {
      if (item[key] !== undefined && item[key] !== null && (!item[key] || typeof item[key].elementId !== "string" || !reference(item[key].elementId))) return sdkRejected("invalid_request", `Excalidraw element ${index + 1} has an invalid ${key}.`);
    }
  }
  let totalFileBytes = 0;
  for (const [id, file] of Object.entries(scene.files)) {
    let bytes = 0;
    try { bytes = new TextEncoder().encode(JSON.stringify(file)).byteLength; } catch { return sdkRejected("invalid_request", `Excalidraw file ${id} is malformed.`); }
    if (bytes > limits.maxImportFileBytes) return sdkRejected("limit_exceeded", `Excalidraw file ${id} exceeds the file size limit.`);
    totalFileBytes += bytes;
  }
  if (totalFileBytes > limits.maxImportTotalFileBytes) return sdkRejected("limit_exceeded", "The Excalidraw import files exceed the total size limit.");
  return sdkSucceeded(undefined);
}

function relationClosure(elements: readonly any[], selectedIds: readonly string[]) {
  const live = elements.filter((item) => item && item.isDeleted !== true);
  const byId = new Map(live.map((item) => [item.id, item]));
  const closure = new Set(selectedIds.filter((id) => byId.has(id)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of live) {
      if (!closure.has(item.id)) continue;
      if (item.type === "text" && typeof item.containerId === "string" && byId.has(item.containerId) && !closure.has(item.containerId)) {
        closure.add(item.containerId);
        changed = true;
      }
      for (const binding of item.boundElements ?? []) {
        if (typeof binding?.id === "string" && byId.has(binding.id) && !closure.has(binding.id)) {
          closure.add(binding.id);
          changed = true;
        }
      }
      for (const key of ["startBinding", "endBinding"] as const) {
        const target = item[key]?.elementId;
        if (typeof target === "string" && byId.has(target) && !closure.has(target)) {
          closure.add(target);
          changed = true;
        }
      }
    }
  }
  return closure;
}

export function createIdeaSketchPagesService(input: PagesServiceInput) {
  const reads = new Map<string, DocumentReadSession>();
  const cursorByPosition = new Map<string, SnapshotCursor>();
  const parsedDrafts = new Map<string, ParsedDraft>();

  async function verifyDocumentSnapshot(snapshotId: DocumentSnapshotId, target: IdeaSketchSdkHostTarget) {
    const read = reads.get(snapshotId);
    if (!read) return sdkRejected("snapshot_required", "The document snapshot does not exist.");
    const verified = input.snapshots.getDocument(snapshotId, documentTarget(target, read.digest));
    if (verified.status === "rejected") return verified;
    let digest: string;
    try { digest = await computeDocumentDigest(target.document); } catch { return sdkRejected("internal_error", "The document could not be verified safely.", true); }
    return digest === read.digest
      ? sdkSucceeded({ read, snapshot: verified.value })
      : sdkRejected("snapshot_stale", "The document snapshot is stale.", true);
  }

  async function listUnsafe(rawOptions: unknown = {}): Promise<SdkResult<IdeaSketchPageListResult>> {
    const options = object(rawOptions) as IdeaSketchPageListOptions | undefined;
    if (!options) return sdkRejected("invalid_request", "Page list options must be an object.");
    const unknown = unknownFields(options as Record<string, unknown>, ["cursor", "limit"], "Page list options");
    if (unknown) return unknown as SdkResult<IdeaSketchPageListResult>;
    if (options.cursor !== undefined && !opaque(options.cursor, "snapshot-cursor:")) return sdkRejected("invalid_request", "Page list cursor is malformed.");
    if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit <= 0 || options.limit > input.getLimits().sceneReadPageSize)) return sdkRejected("limit_exceeded", "Page list limit is invalid.");
    if (!input.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
    if (!input.getScopes().includes("document.read")) return sdkRejected("capability_denied", "The caller cannot read Pages.");
    if (!input.isMethodAvailable("pages", "list")) return sdkRejected("unsupported_operation", "The pages.list method is not available.");
    let target = input.getTarget();
    if (!target) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
    if (target.nativeInteraction.busy) return sdkRejected("editor_busy", "A native editor interaction is in progress.", true);
    target.flushDraft?.();
    target = input.getTarget();
    if (!target) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
    if (target.nativeInteraction.busy) return sdkRejected("editor_busy", "A native editor interaction is in progress.", true);

    let read: DocumentReadSession | undefined;
    let offset = 0;
    if (options.cursor) {
      const resolved = input.snapshots.resolveCursor(options.cursor);
      if (resolved.status === "rejected" || resolved.value.kind !== "document") return sdkRejected("snapshot_required", "The Page list cursor is invalid.");
      read = reads.get(resolved.value.snapshotId);
      if (!read) return sdkRejected("snapshot_required", "The document snapshot does not exist.");
      offset = resolved.value.offset;
      const verified = await verifyDocumentSnapshot(read.snapshotId, target);
      if (verified.status === "rejected") return verified;
    }
    if (!read) {
      let digest: string;
      try { digest = await computeDocumentDigest(target.document); } catch { return sdkRejected("internal_error", "The document could not be read safely.", true); }
      const issued = input.snapshots.issueDocument({
        ...documentTarget(target, digest),
        identityRefs: [],
        complete: false,
      });
      if (issued.status === "rejected") return issued;
      read = {
        snapshotId: issued.value.snapshotId,
        digest,
        target: {
          documentId: target.documentId,
          digest,
          editVersion: target.pageEditVersion,
          epoch: target.nativeInteraction.epoch,
          revision: target.revision,
          status: target.documentStatus,
          ...(target.sourceModified ? { sourceMarker: target.sourceModified } : {}),
        },
        document: clone(target.document),
        summaries: pageSummaries(target.document),
      };
      reads.set(read.snapshotId, read);
    }
    const limit = options.limit ?? input.getLimits().sceneReadPageSize;
    const pageItems = read.summaries.slice(offset, offset + limit);
    const nextOffset = offset + pageItems.length;
    const cursorKey = `${read.snapshotId}:${nextOffset}`;
    const nextCursor = nextOffset < read.summaries.length
      ? (cursorByPosition.get(cursorKey)
        ? sdkSucceeded(cursorByPosition.get(cursorKey)!)
        : input.snapshots.issueCursor("document", read.snapshotId, nextOffset))
      : undefined;
    if (nextCursor?.status === "rejected") return nextCursor;
    if (nextCursor?.status === "succeeded") cursorByPosition.set(cursorKey, nextCursor.value);
    const extended = input.snapshots.extendDocumentCoverage({
      snapshotId: read.snapshotId,
      identityRefs: pageItems.map((item) => item.pageRef),
      complete: nextOffset >= read.summaries.length,
    });
    if (extended.status === "rejected") return extended;
    return sdkSucceeded({
      documentSnapshotId: read.snapshotId,
      pages: pageItems,
      complete: nextOffset >= read.summaries.length,
      ...(nextCursor?.status === "succeeded" ? { nextCursor: nextCursor.value } : {}),
      coverage: { identityRefs: extended.value.identityRefs as PageRef[] },
    });
  }

  async function parseUnsafe(rawInput: unknown): Promise<SdkResult<ParsedPageDraftRef>> {
    if (!input.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
    if (!input.getScopes().includes("document.import.parse")) return sdkRejected("capability_denied", "The caller cannot parse Excalidraw imports.");
    if (!input.isMethodAvailable("pages", "parseExcalidraw")) return sdkRejected("unsupported_operation", "The pages.parseExcalidraw method is not available.");
    const target = input.getTarget();
    if (!target) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
    if (target.nativeInteraction.busy) return sdkRejected("editor_busy", "A native editor interaction is in progress.", true);
    const decoded = decodeImportInput(rawInput);
    if (decoded.status === "rejected") return decoded;
    let encodedBytes = 0;
    try { encodedBytes = new TextEncoder().encode(canonicalStringify(decoded.value.value)).byteLength; } catch { return sdkRejected("invalid_request", "The Excalidraw payload must be strict JSON data."); }
    if (encodedBytes > input.getLimits().maxImportBytes) return sdkRejected("limit_exceeded", "The Excalidraw import exceeds the byte limit.");
    let scene: ImportedExcalidrawScene;
    try { scene = parseExcalidrawImport(decoded.value.value, decoded.value.sourceName); } catch (error) { return sdkRejected("invalid_request", error instanceof Error ? error.message : "The Excalidraw import is malformed."); }
    const valid = validateImportedScene(scene, input.getLimits());
    if (valid.status === "rejected") return valid;
    const token = `import:${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}` as ParsedPageDraftRef;
    parsedDrafts.set(token, {
      callerSessionId: input.sessionId,
      documentId: target.documentId,
      scene: clone(scene),
      createdAt: Date.now(),
      expiresAt: Date.now() + 30_000,
      reserved: false,
    });
    return sdkSucceeded(token);
  }

  function resolvePageRef(ref: string, tempPages: Map<string, PageRef>, document: IdeaSketchDocument): IdeaSketchPage | undefined {
    const stableId = ref.startsWith("page:") ? pageIdFromRef(ref) : tempPages.get(ref) ? pageIdFromRef(tempPages.get(ref)!) : undefined;
    return stableId ? document.pages.find((page) => page.id === stableId) : undefined;
  }

  async function validateSceneSnapshotForSelection(snapshotId: SceneSnapshotId, target: IdeaSketchSdkHostTarget, sourcePageRef: PageRef, selectedRefs: readonly ElementRef[]) {
    if (sourcePageRef !== pageRef(target.activePageId)) return sdkRejected("cross_page_target", "Selection-to-Page operations require the active Page.");
    let digest: string;
    try { digest = await computeSceneDigest(target.scene, { ephemeralElementIds: new Set() }); } catch { return sdkRejected("internal_error", "The active scene could not be verified safely.", true); }
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
    if (verified.status === "rejected") return verified;
    if (!verified.value.complete) return sdkRejected("incomplete_read", "Selection-to-Page requires a complete scene snapshot.");
    for (const ref of selectedRefs) {
      if (!verified.value.mutationReadyRefs.includes(ref)) return sdkRejected("incomplete_read", `The selected target ${ref} is not mutation-ready.`);
    }
    return sdkSucceeded(undefined);
  }

  function validatePageRefs(
    operations: readonly IdeaSketchPageOperation[],
    snapshot: DocumentReadSession,
    coveredRefs: readonly string[],
  ): SdkSyncResult<void> {
    const known = new Set<string>(snapshot.document.pages.map((page) => pageRef(page.id)));
    const created = new Set<string>();
    let pageCount = snapshot.document.pages.length;
    for (const operation of operations) {
      const refs: string[] = [];
      if (operation.kind === "duplicate-page" || operation.kind === "create-page-from-selection") refs.push(operation.sourcePageRef);
      if (operation.kind === "rename-page" || operation.kind === "reorder-page" || operation.kind === "delete-page") refs.push(operation.pageRef);
      for (const ref of refs) {
        if (ref.startsWith("temp:")) {
          if (!created.has(ref)) return sdkRejected("invalid_request", `The Page TempRef ${ref} must refer to an earlier Page operation.`);
        } else if (!known.has(ref)) return sdkRejected("target_not_found", `The Page ${ref} does not exist in the document snapshot.`);
        else if (!coveredRefs.includes(ref)) return sdkRejected("incomplete_read", `The Page ${ref} is not covered by the document snapshot.`);
      }
      if (operation.kind === "reorder-page" && (!pageCount || operation.toIndex >= pageCount)) {
        return sdkRejected("invalid_request", "reorder-page.toIndex is outside the document bounds.");
      }
      if (operation.kind === "delete-page" && pageCount <= 1) {
        return sdkRejected("invalid_request", "The document must retain at least one Page.");
      }
      if (["add-page", "import-page", "duplicate-page", "create-page-from-selection"].includes(operation.kind) && "ref" in operation) {
        created.add(operation.ref);
        pageCount += 1;
      }
      if (operation.kind === "delete-page") pageCount -= 1;
    }
    return sdkSucceeded(undefined);
  }

  async function validatePlanUnsafe(rawInput: unknown, enforceMethodAvailability = true): Promise<SdkResult<IdeaSketchPagePlanValidationResult>> {
    const options = object(rawInput);
    const operations = options ? options.operations : undefined;
    if (!options || typeof options.documentSnapshotId !== "string" || !denseArray(operations)) return sdkRejected("invalid_request", "Page validatePlan requires documentSnapshotId and operations.");
    const unknown = unknownFields(options, ["documentSnapshotId", "operations", "sceneSnapshotId"], "Page validatePlan options");
    if (unknown) return unknown as SdkResult<IdeaSketchPagePlanValidationResult>;
    if (!opaque(options.documentSnapshotId, "document-snapshot:")) return sdkRejected("invalid_request", "documentSnapshotId is malformed.");
    if (options.sceneSnapshotId !== undefined && !opaque(options.sceneSnapshotId, "scene-snapshot:")) return sdkRejected("invalid_request", "sceneSnapshotId is malformed.");
    if (!isAbortSignal(options.signal)) return sdkRejected("invalid_request", "signal must be an AbortSignal.");
    if (!input.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
    if (!input.getScopes().includes("document.structure.write")) return sdkRejected("capability_denied", "The caller cannot validate Page plans.");
    if (enforceMethodAvailability && !input.isMethodAvailable("pages", "validatePlan")) return sdkRejected("unsupported_operation", "The pages.validatePlan method is not available.");
    const validated = validateIdeaSketchPagePlan(operations, { maxOperations: input.getLimits().pageOperationsPerPlan, maxPlanBytes: input.getLimits().maxPlanBytes });
    if (validated.status === "rejected") return validated;
    if (validated.value.some((operation) => !input.getAvailableOperationKinds().includes(operation.kind))) return sdkRejected("unsupported_operation", "The Page plan contains an operation unavailable to this caller.");
    const target = input.getTarget();
    if (!target) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
    if (target.nativeInteraction.busy) return sdkRejected("editor_busy", "A native editor interaction is in progress.", true);
    const verified = await verifyDocumentSnapshot(options.documentSnapshotId as DocumentSnapshotId, target);
    if (verified.status === "rejected") return verified;
    const refs = validatePageRefs(validated.value, verified.value.read, verified.value.snapshot.identityRefs);
    if (refs.status === "rejected") return refs;
    const selectionOps = validated.value.filter((operation): operation is Extract<IdeaSketchPageOperation, { kind: "create-page-from-selection" }> => operation.kind === "create-page-from-selection");
    if (selectionOps.length > 0) {
      if (selectionOps.length !== 1 || typeof options.sceneSnapshotId !== "string") return sdkRejected("invalid_request", "create-page-from-selection requires one sceneSnapshotId.");
      const selection = await validateSceneSnapshotForSelection(options.sceneSnapshotId as SceneSnapshotId, target, pageRef(selectionOps[0].sourcePageRef.slice("page:".length)), selectionOps[0].selectedRefs);
      if (selection.status === "rejected") return selection;
    } else if (options.sceneSnapshotId !== undefined) {
      return sdkRejected("invalid_request", "sceneSnapshotId is only valid for create-page-from-selection.");
    }
    if (validated.value.some((operation) => operation.kind === "reorder-page") && !verified.value.snapshot.complete) return sdkRejected("incomplete_read", "reorder-page requires a complete document snapshot.");
    return sdkSucceeded({ valid: true, documentSnapshotId: options.documentSnapshotId as DocumentSnapshotId, ...(typeof options.sceneSnapshotId === "string" ? { sceneSnapshotId: options.sceneSnapshotId as SceneSnapshotId } : {}), operationKinds: validated.value.map((operation) => operation.kind), diagnostics: [] });
  }

  function preparePagePlan(before: IdeaSketchDocument, operations: readonly IdeaSketchPageOperation[], target: IdeaSketchSdkHostTarget): PreparedPagePlan {
    let document = clone(before);
    const tempPages = new Map<string, PageRef>();
    const createdRefs: Record<string, PageRef | IdeaSketchEntityRef> = {};
    const updatedPageRefs: PageRef[] = [];
    const deletedPageRefs: PageRef[] = [];
    const operationKinds: string[] = [];
    const operationResults: PreparedPagePlan["operationResults"] = [];
    const diagnostics: string[] = [];
    const consumedDrafts: string[] = [];
    const reservedDraftTokens = new Set<string>();
    // Existing .is files may contain legacy Excalidraw relations that the
    // current scene validator intentionally rejects.  Page-structure
    // mutations must preserve those untouched payloads instead of failing the
    // whole document because an unrelated Page is legacy-invalid.  Validate
    // only Pages whose scene is created or rewritten by this plan.
    const sceneValidationPageIds = new Set<string>();
    let selectedPageId: string | undefined;

    const addPage = (page: IdeaSketchPage, ref: string, index = document.pages.length) => {
      document.pages.splice(Math.max(0, Math.min(index, document.pages.length)), 0, page);
      const stable = pageRef(page.id);
      tempPages.set(ref, stable);
      createdRefs[ref] = stable;
      selectedPageId = page.id;
    };

    for (const [index, operation] of operations.entries()) {
      operationKinds.push(operation.kind);
      switch (operation.kind) {
        case "add-page": {
          const page = createEmptyIdeaSketchPage(document.pages.length, uniquePageId(document));
          page.title = title(operation.title, page.title);
          if (operation.initialScene) {
            const adapter = applyIdeaSketchScenePlan({
              scene: { elements: page.elements, appState: page.appState, files: page.files },
              operations: operation.initialScene.operations,
              pageRef: pageRef(page.id),
              limits: { maxOperations: input.getLimits().sceneOperationsPerPlan, maxPlanBytes: input.getLimits().maxPlanBytes },
              maxCameraCount: input.getLimits().maxCameraCount,
              cameraMinWidth: input.getLimits().minCameraWidth,
              cameraMinHeight: input.getLimits().minCameraHeight,
            });
            if (adapter.status === "rejected") throw { code: adapter.error.code, message: adapter.error.message, retryable: adapter.error.retryable, operationIndex: index };
            page.elements = adapter.value.scene.elements;
            page.appState = adapter.value.scene.appState;
            page.files = adapter.value.scene.files;
            for (const [temp, stableRef] of Object.entries(adapter.value.createdRefs)) createdRefs[temp] = { pageRef: pageRef(page.id), ref: stableRef };
          }
          addPage(page, operation.ref);
          sceneValidationPageIds.add(page.id);
          operationResults.push({ index, kind: operation.kind, outcome: "created" });
          break;
        }
        case "import-page": {
          const draft = parsedDrafts.get(operation.parsedPageDraftRef);
          if (!draft || draft.callerSessionId !== input.sessionId || draft.documentId !== target.documentId || draft.expiresAt < Date.now()) throw { code: "import_token_expired", message: "The parsed Excalidraw draft is expired or invalid." };
          if (draft.reserved || reservedDraftTokens.has(operation.parsedPageDraftRef)) throw { code: "import_token_expired", message: "The parsed Excalidraw draft is already in use." };
          reservedDraftTokens.add(operation.parsedPageDraftRef);
          consumedDrafts.push(operation.parsedPageDraftRef);
          const page = createIdeaSketchPageFromImport(draft.scene, { pageId: uniquePageId(document), title: title(operation.title, draft.scene.title) });
          addPage(page, operation.ref);
          sceneValidationPageIds.add(page.id);
          operationResults.push({ index, kind: operation.kind, outcome: "created" });
          break;
        }
        case "duplicate-page": {
          const source = resolvePageRef(operation.sourcePageRef, tempPages, document);
          if (!source) throw { code: "target_not_found", message: "The source Page does not exist." };
          const copy = clone(source);
          copy.id = uniquePageId(document);
          copy.title = title(operation.title, `${source.title} (Copy)`);
          const sourceIndex = document.pages.findIndex((page) => page.id === source.id);
          addPage(copy, operation.ref, sourceIndex + 1);
          operationResults.push({ index, kind: operation.kind, outcome: "created" });
          break;
        }
        case "rename-page": {
          const page = resolvePageRef(operation.pageRef, tempPages, document);
          if (!page) throw { code: "target_not_found", message: "The Page does not exist." };
          page.title = operation.title.trim();
          updatedPageRefs.push(pageRef(page.id));
          operationResults.push({ index, kind: operation.kind, outcome: "updated" });
          break;
        }
        case "reorder-page": {
          const page = resolvePageRef(operation.pageRef, tempPages, document);
          if (!page || operation.toIndex < 0 || operation.toIndex >= document.pages.length) throw { code: "invalid_request", message: "reorder-page.toIndex is outside the document bounds." };
          const from = document.pages.findIndex((item) => item.id === page.id);
          if (from !== operation.toIndex) {
            document.pages.splice(from, 1);
            document.pages.splice(operation.toIndex, 0, page);
            for (const item of document.pages) updatedPageRefs.push(pageRef(item.id));
          }
          operationResults.push({ index, kind: operation.kind, outcome: from === operation.toIndex ? "noop" : "updated" });
          break;
        }
        case "delete-page": {
          const page = resolvePageRef(operation.pageRef, tempPages, document);
          if (!page) throw { code: "target_not_found", message: "The Page does not exist." };
          if (document.pages.length <= 1) throw { code: "invalid_request", message: "The document must retain at least one Page." };
          const indexToDelete = document.pages.findIndex((item) => item.id === page.id);
          document.pages.splice(indexToDelete, 1);
          deletedPageRefs.push(pageRef(page.id));
          if (target.activePageId === page.id || selectedPageId === page.id) {
            selectedPageId = document.pages[Math.min(indexToDelete, document.pages.length - 1)]?.id;
          }
          operationResults.push({ index, kind: operation.kind, outcome: "deleted" });
          break;
        }
        case "create-page-from-selection": {
          const source = resolvePageRef(operation.sourcePageRef, tempPages, document);
          if (!source) throw { code: "target_not_found", message: "The source Page does not exist." };
          const selectedIds = operation.selectedRefs.map((ref) => ref.slice("element:".length));
          const closure = relationClosure(source.elements, selectedIds);
          const selectedElementIds = Object.fromEntries([...closure].map((id) => [id, true]));
          const converted = buildNewPageStyleConversion(source.elements, selectedElementIds, source.files);
          const page = createEmptyIdeaSketchPage(document.pages.length, uniquePageId(document));
          page.title = `${source.title} (Copy)`;
          page.elements = converted.elements;
          page.files = converted.files;
          page.appState = persistentAppState(source.appState);
          addPage(page, operation.ref);
          sceneValidationPageIds.add(page.id);
          diagnostics.push(`Created a new Page from ${closure.size} selected elements.`);
          operationResults.push({ index, kind: operation.kind, outcome: "created" });
          break;
        }
        default:
          throw { code: "unsupported_operation", message: "The Page operation is not supported." };
      }
    }
    if (!document.pages.length) throw { code: "invalid_request", message: "The document must retain at least one Page." };
    const postconditions = document.pages
      .filter((page) => sceneValidationPageIds.has(page.id))
      .every((page) => {
        const ids = new Set<string>();
        for (const element of page.elements) {
          if (!element || typeof element.id !== "string" || ids.has(element.id)) return false;
          ids.add(element.id);
        }
        return validateIdeaSketchScenePostconditions({ elements: page.elements, appState: page.appState, files: page.files }, { maxCameraCount: input.getLimits().maxCameraCount, cameraMinWidth: input.getLimits().minCameraWidth, cameraMinHeight: input.getLimits().minCameraHeight }).status === "succeeded";
      });
    if (!postconditions) throw { code: "relation_conflict", message: "The Page plan produced an invalid scene." };
    return { document, createdRefs, updatedPageRefs: [...new Set(updatedPageRefs)], deletedPageRefs: [...new Set(deletedPageRefs)], operationKinds, operationResults, diagnostics, selectedPageId, consumedDrafts };
  }

  async function applyPlanUnsafe(rawInput: unknown): Promise<SdkResult<IdeaSketchSdkMutationResult>> {
    const options = object(rawInput) as (IdeaSketchPageApplyPlanInput & {
      requiredCapabilities?: readonly IdeaSketchSdkScope[];
      reservedRequestHandle?: ReservedRequestHandle;
    }) | undefined;
    const operations = options?.operations;
    if (!options || typeof options.requestId !== "string" || options.requestId.trim().length === 0 || typeof options.documentSnapshotId !== "string" || !denseArray(operations)) return sdkRejected("invalid_request", "Page applyPlan requires requestId, documentSnapshotId, and operations.");
    const unknown = unknownFields(options as unknown as Record<string, unknown>, ["requestId", "documentSnapshotId", "operations", "sceneSnapshotId", "signal", "requiredCapabilities", "reservedRequestHandle"], "Page applyPlan options");
    if (unknown) return unknown as SdkResult<IdeaSketchSdkMutationResult>;
    if (!opaque(options.documentSnapshotId, "document-snapshot:")) return sdkRejected("invalid_request", "documentSnapshotId is malformed.");
    if (options.sceneSnapshotId !== undefined && !opaque(options.sceneSnapshotId, "scene-snapshot:")) return sdkRejected("invalid_request", "sceneSnapshotId is malformed.");
    const validated = validateIdeaSketchPagePlan(operations, { maxOperations: input.getLimits().pageOperationsPerPlan, maxPlanBytes: input.getLimits().maxPlanBytes });
    if (validated.status === "rejected") return validated;
    if (validated.value.some((operation) => !input.getAvailableOperationKinds().includes(operation.kind))) return sdkRejected("unsupported_operation", "The Page plan contains an operation unavailable to this caller.");
    const requiredCapabilities = options.requiredCapabilities === undefined ? undefined : denseArray(options.requiredCapabilities) ? [...new Set(options.requiredCapabilities)] : undefined;
    if (options.requiredCapabilities !== undefined && (!requiredCapabilities || requiredCapabilities.some((scope) => typeof scope !== "string" || !KNOWN_SCOPES.has(scope as IdeaSketchSdkScope)))) return sdkRejected("invalid_request", "requiredCapabilities must contain only known capability names.");
    if (!isAbortSignal(options.signal)) return sdkRejected("invalid_request", "signal must be an AbortSignal.");
    if (requiredCapabilities?.some((scope) => !input.getScopes().includes(scope))) return sdkRejected("capability_denied", "The caller does not hold all required capabilities.");
    if (!input.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
    if (!input.getScopes().includes("document.structure.write")) return sdkRejected("capability_denied", "The caller cannot mutate Page structure.");
    if (!input.isMethodAvailable("pages", "applyPlan")) return sdkRejected("unsupported_operation", "The pages.applyPlan method is not available.");
    const target = input.getTarget();
    if (!target) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
    if (!isIdeaSketchDocumentWritable({ ...target, callerProfile: input.callerProfile, servicesWritable: target.services.writable })) return sdkRejected("read_only", "The IdeaSketch document is read-only.");
    if (target.nativeInteraction.busy) return sdkRejected("editor_busy", "A native editor interaction is in progress.", true);
    if (!target.commitDocument) return sdkRejected("editor_unavailable", "The document commit adapter is unavailable.", true);
    let payloadDigest: string;
    try { payloadDigest = await canonicalPayloadDigest({ sdkProtocolVersion: input.sdkProtocolVersion, requestId: options.requestId, documentSnapshotId: options.documentSnapshotId, operations: validated.value, ...(options.sceneSnapshotId ? { sceneSnapshotId: options.sceneSnapshotId } : {}), ...(requiredCapabilities ? { requiredCapabilities } : {}) }); } catch { return sdkRejected("invalid_request", "The Page mutation payload must be strict JSON data."); }
    if (!options.reservedRequestHandle) {
      const existing = input.ledger.lookup({ requestId: options.requestId, payloadDigest });
      if (existing.status === "rejected") return existing;
      if (existing.value?.kind === "replay" || existing.value?.kind === "joined") return existing.value.result;
    }
    const preflight = await validatePlanUnsafe({
      documentSnapshotId: options.documentSnapshotId,
      operations: validated.value,
      ...(options.sceneSnapshotId ? { sceneSnapshotId: options.sceneSnapshotId } : {}),
    }, false);
    if (preflight.status === "rejected") {
      if (options.reservedRequestHandle) input.ledger.complete(options.reservedRequestHandle, preflight as SdkResult<IdeaSketchSdkMutationResult>);
      return preflight;
    }
    let prepared: PreparedPagePlan | undefined;
    let beforeTarget: IdeaSketchSdkHostTarget | undefined;
    const result = await executeSdkMutation({
      kind: "document",
      documentSessionId: target.documentSessionId,
      requestId: options.requestId,
      payload: { sdkProtocolVersion: input.sdkProtocolVersion, requestId: options.requestId, documentSnapshotId: options.documentSnapshotId, operations: validated.value, ...(options.sceneSnapshotId ? { sceneSnapshotId: options.sceneSnapshotId } : {}), ...(requiredCapabilities ? { requiredCapabilities } : {}) },
      scheduler: input.scheduler,
      ledger: input.ledger,
      ...(options.reservedRequestHandle ? { reservedRequestHandle: options.reservedRequestHandle } : {}),
      signal: options.signal,
      beforeExecute: () => {
        const live = input.getTarget();
        if (!live) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
        if (live.nativeInteraction.busy) return sdkRejected("editor_busy", "A native editor interaction is in progress.", true);
        live.flushDraft?.();
        beforeTarget = input.getTarget();
        if (!beforeTarget) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
        if (!isIdeaSketchDocumentWritable({ ...beforeTarget, callerProfile: input.callerProfile, servicesWritable: beforeTarget.services.writable })) return sdkRejected("read_only", "The IdeaSketch document is read-only.");
        return sdkSucceeded(undefined);
      },
      readState: () => input.getTarget()?.document ?? target.document,
      computeDigest: (document) => computeDocumentDigest(document as IdeaSketchDocument),
      validateSnapshot: async (document) => {
        const live = input.getTarget();
        if (!live) return false;
        const verified = await verifyDocumentSnapshot(options.documentSnapshotId as DocumentSnapshotId, live);
        if (verified.status === "rejected") return false;
        const digest = await computeDocumentDigest(document as IdeaSketchDocument);
        return digest === verified.value.read.digest;
      },
      prepare: (document) => {
        const live = input.getTarget() ?? target;
        prepared = preparePagePlan(document as IdeaSketchDocument, validated.value, live);
        return prepared.document;
      },
      validatePostconditions: (document) => Boolean(document && prepared),
      finalValidate: () => {
        const live = input.getTarget();
        if (!live || !beforeTarget) return sdkRejected("external_change", "The document changed before commit.", true);
        if (live.documentSessionId !== target.documentSessionId || live.documentId !== target.documentId) return sdkRejected("external_change", "The document changed before commit.", true);
        if (live.revision !== beforeTarget.revision || live.sourceModified !== beforeTarget.sourceModified) return sdkRejected("external_change", "The document changed before commit.", true);
        if (live.pageEditVersion !== beforeTarget.pageEditVersion || live.nativeInteraction.epoch !== beforeTarget.nativeInteraction.epoch) return sdkRejected("snapshot_stale", "The Page changed before commit.", true);
        if (live.nativeInteraction.busy) return sdkRejected("editor_busy", "A native editor interaction is in progress.", true);
        if (!isIdeaSketchDocumentWritable({ ...live, callerProfile: input.callerProfile, servicesWritable: live.services.writable })) return sdkRejected("read_only", "The document became read-only.");
        return sdkSucceeded(undefined);
      },
      commit: (document) => {
        const live = input.getTarget();
        if (!live?.commitDocument || !prepared) throw new Error("The document commit adapter is unavailable.");
        for (const token of prepared.consumedDrafts) {
          const draft = parsedDrafts.get(token);
          if (draft) draft.reserved = true;
        }
        const receipt = live.commitDocument(document as IdeaSketchDocument, prepared.selectedPageId);
        live.recordDocumentCommit?.({
          requestId: options.requestId,
          operationKinds: prepared.operationKinds,
          createdPageRefs: Object.values(prepared.createdRefs).filter((value): value is PageRef => typeof value === "string" && value.startsWith("page:")),
          updatedPageRefs: prepared.updatedPageRefs,
          deletedPageRefs: prepared.deletedPageRefs,
        });
        for (const token of prepared.consumedDrafts) parsedDrafts.delete(token);
        return receipt;
      },
      getEditVersion: () => input.getTarget()?.pageEditVersion ?? target.pageEditVersion,
      createResult: (mutation) => {
        const createdPageRefs = prepared?.createdRefs
          ? Object.values(prepared.createdRefs).filter((value): value is PageRef => typeof value === "string" && value.startsWith("page:"))
          : [];
        const createdRefs = Object.fromEntries(Object.entries(prepared?.createdRefs ?? {}));
        const updatedRefs = (prepared?.updatedPageRefs ?? []).map(pageEntity);
        const deletedRefs = (prepared?.deletedPageRefs ?? []).map(pageEntity);
        return {
          changeSetId: `change:${options.requestId}`,
          requestId: options.requestId,
          outcome: mutation.beforeDigest === mutation.afterDigest ? "noop" : "applied",
          beforeDigest: mutation.beforeDigest,
          afterDigest: mutation.afterDigest,
          beforeEditVersion: mutation.beforeEditVersion,
          afterEditVersion: mutation.afterEditVersion,
          createdRefs,
          updatedRefs,
          deletedRefs,
          cascadedRefs: [],
          operations: prepared?.operationResults ?? [],
          diagnostics: prepared?.diagnostics ?? [],
          history: { nativeCanvas: "none", document: "unavailable", agentCustom: "not-supported" },
          createdPageRefs,
          updatedPageRefs: prepared?.updatedPageRefs ?? [],
          deletedPageRefs: prepared?.deletedPageRefs ?? [],
        };
      },
    });
    return result;
  }

  async function selectUnsafe(rawInput: unknown): Promise<SdkResult<{ pageRef: PageRef; active: true | false }>> {
    const options = object(rawInput);
    if (!options || typeof options.pageRef !== "string") return sdkRejected("invalid_request", "pages.select requires pageRef.");
    const unknown = unknownFields(options, ["pageRef"], "Page select options");
    if (unknown) return unknown as SdkResult<{ pageRef: PageRef; active: true | false }>;
    if (!opaque(options.pageRef, "page:")) return sdkRejected("invalid_request", "pageRef is malformed.");
    if (!input.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
    if (!input.getScopes().includes("document.read")) return sdkRejected("capability_denied", "The caller cannot select Pages.");
    if (!input.isMethodAvailable("pages", "select")) return sdkRejected("unsupported_operation", "The pages.select method is not available.");
    let target = input.getTarget();
    if (!target) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
    if (target.nativeInteraction.busy) return sdkRejected("editor_busy", "A native editor interaction is in progress.", true);
    target.flushDraft?.();
    target = input.getTarget();
    if (!target) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
    const id = pageIdFromRef(options.pageRef);
    if (!id || !target.document.pages.some((page) => page.id === id)) return sdkRejected("target_not_found", "The requested Page does not exist.");
    if (id === target.activePageId) return sdkSucceeded({ pageRef: options.pageRef as PageRef, active: true });
    if (!target.selectPage) return sdkRejected("unsupported_operation", "The Page selection adapter is unavailable.");
    // Selection is navigation, not a document mutation. Invalidate receipts
    // before binding the new active context so old scene/document tokens fail
    // closed even if the host reports the same document revision.
    target.stopPresentation?.();
    input.snapshots.invalidateAll();
    parsedDrafts.clear();
    try { target.selectPage(id); } catch { return sdkRejected("internal_error", "The Page could not be selected safely.", true); }
    return sdkSucceeded({ pageRef: options.pageRef as PageRef, active: true });
  }

  async function safely<Value>(label: string, run: () => Promise<SdkResult<Value>>) {
    if (!input.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.") as SdkResult<Value>;
    try { return await run(); } catch { return sdkRejected("internal_error", `${label} failed inside the IdeaSketch SDK host.`, true) as SdkResult<Value>; }
  }

  return {
    list: (options?: IdeaSketchPageListOptions) => safely("Page list", () => listUnsafe(options)),
    select: (options: unknown) => safely("Page selection", () => selectUnsafe(options)),
    parseExcalidraw: (options: unknown) => safely("Excalidraw parse", () => parseUnsafe(options)),
    validatePlan: (options: unknown) => safely("Page validation", () => validatePlanUnsafe(options)),
    applyPlan: (options: IdeaSketchPageApplyPlanInput) => safely("Page application", () => applyPlanUnsafe(options)),
  };
}
