import {
  createCapabilityProjection,
  IDEA_SKETCH_SDK_METHOD_CATALOG,
  negotiateSdkProtocols,
  type IdeaSketchSdkServiceAvailability,
} from "./capabilities.ts";
import { createContextNamespace } from "./context.ts";
import { createRequestLedger } from "./requestLedger.ts";
import { createSessionController } from "./session.ts";
import { createSnapshotStore } from "./snapshots.ts";
import { buildIdeaSketchOperation, type IdeaSketchOperationLimits } from "./operationSchemas.ts";
import { createIdeaSketchSceneService } from "./sceneService.ts";
import { createIdeaSketchCameraService } from "./cameraService.ts";
import { createIdeaSketchSelectionViewService } from "./selectionViewService.ts";
import { createIdeaSketchTransformsService } from "./transformsService.ts";
import { createIdeaSketchEventHub } from "./events.ts";
import { createIdeaSketchPagesService } from "./pagesService.ts";
import {
  createDocumentMutationScheduler,
  type DocumentMutationScheduler,
  type IdeaSketchMutationCommitReceipt,
} from "./transactions.ts";
import {
  sdkRejected,
  sdkSucceeded,
  type CallerSessionId,
  type IdeaSketchAssetsNamespace,
  type IdeaSketchCamerasNamespace,
  type IdeaSketchEventsNamespace,
  type IdeaSketchIoNamespace,
  type IdeaSketchOperationsNamespace,
  type IdeaSketchOperationBuilder,
  type IdeaSketchOperationInput,
  type IdeaSketchOperationOf,
  type IdeaSketchPagesNamespace,
  type IdeaSketchPresentationNamespace,
  type IdeaSketchRequestsNamespace,
  type IdeaSketchSceneNamespace,
  type IdeaSketchSdk,
  type IdeaSketchSdkCapabilities,
  type IdeaSketchAssetMetadataListOptions,
  type IdeaSketchAssetMetadataListResult,
  type IdeaSketchSdkCallerProfile,
  type IdeaSketchSdkContext,
  type IdeaSketchSdkEvent,
  type IdeaSketchSdkEventHandler,
  type IdeaSketchSdkScope,
  type IdeaSketchSdkSessionFactory,
  type IdeaSketchSelectionNamespace,
  type IdeaSketchTransformsNamespace,
  type IdeaSketchViewNamespace,
  type ReconciliationToken,
  type SdkProtocolVersion,
  type SdkResult,
  type SdkSyncResult,
  type DocumentRef,
  type IdeaSketchDocumentCommittedEvent,
  type IdeaSketchSceneCommittedEvent,
} from "./types.ts";
import type { IdeaSketchOperationKind } from "./operationSchemas.ts";
import type { IdeaSketchDocument } from "../../types.ts";
import type {
  IdeaSketchInternalDocumentCommitRecord,
  IdeaSketchInternalSceneCommitRecord,
} from "./editorHostAdapter.ts";
import { createIdeaSketchPresentationService } from "./presentationService.ts";
import { createIdeaSketchIoService } from "./ioService.ts";
import { isIdeaSketchDocumentWritable } from "./documentWritability.ts";

const hostCallerBrand = Symbol("IdeaSketchSdkHostCaller");
const issuedHostCallers = new WeakSet<object>();
const KNOWN_SCOPES = new Set<IdeaSketchSdkScope>([
  "context.read", "requests.read", "document.read", "document.structure.write", "document.import.parse",
  "scene.read", "scene.write", "scene.destructive-clear", "selection.control", "view.read", "view.control",
  "presentation.control", "io.serialize", "user-mediated-io", "asset.read", "events.read", "host.interaction",
  "legacy.raw-scene",
]);
const KNOWN_CALLER_PROFILES = new Set<IdeaSketchSdkCallerProfile>([
  "trusted-ui",
  "agent-v1",
  "agent-v2",
  "future-external",
  "host-internal",
  "legacy",
]);

function publicEnvelope(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  try {
    if (Array.isArray(value)) return undefined;
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

function unknownEnvelopeFields(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).filter((key) => !allowed.includes(key));
}

function denseArray(value: unknown): value is readonly unknown[] {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
  }
  return true;
}

function operationLimitsFromCapabilities(limits: IdeaSketchSdkCapabilities["limits"]): Partial<IdeaSketchOperationLimits> {
  return {
    maxOperations: limits.sceneOperationsPerPlan,
    maxPlanBytes: limits.maxPlanBytes,
    maxCoordinate: limits.maxCoordinate,
    maxTextLength: limits.maxTextLength,
    minFontSize: limits.minFontSize,
    maxFontSize: limits.maxFontSize,
    maxDimension: limits.maxDimension,
    minLineHeight: limits.minLineHeight,
    maxLineHeight: limits.maxLineHeight,
  };
}

export type IdeaSketchNativeInteractionReason =
  | "pointer"
  | "text"
  | "ime"
  | "history"
  | "native-action"
  | "camera-preview";

export interface IdeaSketchSdkNativeInteractionState {
  epoch: number;
  busy: boolean;
  reasons: readonly IdeaSketchNativeInteractionReason[];
}

export interface IdeaSketchSdkHostScene {
  elements: readonly unknown[];
  appState: Partial<Record<string, unknown>>;
  files: Record<string, unknown>;
}

export interface IdeaSketchSdkHostTarget {
  documentSessionId: string;
  documentId: string;
  activePageId: string;
  documentStatus: IdeaSketchSdkContext["documentStatus"];
  revision: number;
  sourceModified?: string;
  readOnly: boolean;
  mountedPageId?: string;
  pageEditVersion: number;
  nativeInteraction: IdeaSketchSdkNativeInteractionState;
  document: IdeaSketchDocument;
  scene: IdeaSketchSdkHostScene;
  services: IdeaSketchSdkServiceAvailability;
  flushDraft?: () => void;
  commitScene?: (scene: IdeaSketchSdkHostScene) => void | IdeaSketchMutationCommitReceipt;
  recordSceneCommit?: (record: IdeaSketchInternalSceneCommitRecord) => void;
  commitDocument?: (document: IdeaSketchDocument, preferredPageId?: string) => void | IdeaSketchMutationCommitReceipt;
  selectPage?: (pageId: string) => void;
  stopPresentation?: () => void;
  recordDocumentCommit?: (record: IdeaSketchInternalDocumentCommitRecord) => void;
  cleanupSession?: (sessionId: CallerSessionId) => Promise<void>;
  /** Non-persistent selection and viewport adapters.  Hosts must implement
   * these with a NEVER capture; they are intentionally separate from the
   * canonical scene/document mutation callbacks. */
  updateSelection?: (refs: readonly string[]) => void | Promise<void>;
  updateViewport?: (viewport: { scrollX: number; scrollY: number; zoom: number }) => void | Promise<void>;
  viewportSize?: { width: number; height: number };
  beginCreateCamera?: (input: {
    requestId: string;
    snapshotId: import("./types.ts").SceneSnapshotId;
    atIndex?: number;
    signal?: AbortSignal;
  }) => Promise<SdkResult<import("./types.ts").IdeaSketchSdkMutationResult>>;
  openImageExportDialog?: () => void | Promise<void>;
  chooseExcalidrawImport?: () => Promise<{ path: string; text: string }>;
  confirmClear?: (input: { scope: "content-only" | "all-elements"; pageRef: string; snapshotId: import("./types.ts").SceneSnapshotId }) => Promise<boolean>;
}

export interface IdeaSketchHostCaller {
  readonly id: string;
  readonly profile: IdeaSketchSdkCallerProfile;
  readonly grantedScopes?: readonly IdeaSketchSdkScope[];
  readonly [hostCallerBrand]: true;
}

export function createIdeaSketchHostCaller(input: {
  id: string;
  profile: IdeaSketchSdkCallerProfile;
  grantedScopes?: readonly IdeaSketchSdkScope[];
}): IdeaSketchHostCaller {
  const caller = Object.freeze({
    id: input.id,
    profile: input.profile,
    ...(input.grantedScopes
      ? { grantedScopes: Object.freeze([...new Set(input.grantedScopes)].sort()) }
      : {}),
    [hostCallerBrand]: true as const,
  });
  issuedHostCallers.add(caller);
  return caller;
}

export interface CreateIdeaSketchSdkSessionInput {
  caller: IdeaSketchHostCaller;
  sdkProtocolVersion: SdkProtocolVersion;
  agentToolProtocolVersion?: SdkProtocolVersion;
  expectedAgentSchemaDigest?: string;
  requiredCapabilities?: readonly IdeaSketchSdkScope[];
}

export interface IdeaSketchSdkHost {
  readonly mutationScheduler: DocumentMutationScheduler;
  createSession(input: CreateIdeaSketchSdkSessionInput): Promise<SdkResult<IdeaSketchSdk>>;
  createSessionFactory(caller: IdeaSketchHostCaller): IdeaSketchSdkSessionFactory;
}

function sessionId(): CallerSessionId {
  return `caller-session:${globalThis.crypto.randomUUID()}` as CallerSessionId;
}

function targetAvailability(target: IdeaSketchSdkHostTarget, callerProfile: string): IdeaSketchSdkServiceAvailability {
  const methods = { ...(target.services.methods ?? {}) };
  // A namespace-level `true` only means that the service boundary is mounted;
  // it must not imply that every catalog method has shipped.  F073-02 owns
  // Camera listing and asset metadata.  The remaining Camera interaction and
  // all later UI/IO/presentation methods stay unavailable until their rollout
  // plans provide explicit method entries.
  if (target.services.cameras && !methods.cameras) {
    methods.cameras = [
      "list",
      ...(target.updateSelection && target.updateViewport ? ["select"] : []),
      ...(target.beginCreateCamera ? ["beginCreate"] : []),
    ];
  }
  if (target.services.assets && !methods.assets) methods.assets = ["listMetadata"];
  if (target.services.selection && !methods.selection) {
    methods.selection = target.updateSelection
      ? [...IDEA_SKETCH_SDK_METHOD_CATALOG.selection]
      : [];
  }
  if (target.services.view && !methods.view) {
    methods.view = target.updateViewport
      ? [...IDEA_SKETCH_SDK_METHOD_CATALOG.view]
      : [];
  }
  if (target.services.transforms && !methods.transforms) {
    methods.transforms = target.services.scene && (target.services.pages || target.commitScene)
      ? [...IDEA_SKETCH_SDK_METHOD_CATALOG.transforms]
      : [];
  }
  if (target.services.presentation && !methods.presentation) {
    methods.presentation = [...IDEA_SKETCH_SDK_METHOD_CATALOG.presentation];
  }
  if (target.services.io && !methods.io) {
    methods.io = [...IDEA_SKETCH_SDK_METHOD_CATALOG.io];
  }
  // Page transactions are the canonical document structure boundary. Other
  // deferred namespaces remain unavailable until their rollout plans opt in.
  if (target.services.pages && !methods.pages) {
    methods.pages = [...IDEA_SKETCH_SDK_METHOD_CATALOG.pages];
  }
  for (const namespace of ["selection", "view", "transforms", "presentation", "io"] as const) {
    if (target.services[namespace] && !methods[namespace]) methods[namespace] = [];
  }
  // Event subscriptions are a host-owned lifecycle surface.  An explicit
  // `events: true` service flag is an opt-in for the complete subscription
  // catalog (used by the mounted host/tests); omitted events stay unavailable
  // until a host mounts the service.
  if (target.services.events && !methods.events) {
    methods.events = [...IDEA_SKETCH_SDK_METHOD_CATALOG.events];
  }
  if (!target.confirmClear) {
    const sceneMethods = methods?.scene ?? ["read", "getElements", "requestClearConfirmation", "validatePlan", "applyPlan"];
    const operationMethods = methods?.operations ?? ["page", "element", "shape", "connector", "text", "camera", "appearance", "transform", "scene"];
    Object.assign(methods, {
      scene: sceneMethods.filter((method) => method !== "requestClearConfirmation"),
      operations: operationMethods.filter((method) => method !== "scene"),
    });
  }
  return {
    ...target.services,
    ...(Object.keys(methods).length > 0 ? { methods } : {}),
    mountedCanvas: Boolean(target.services.mountedCanvas ?? target.mountedPageId === target.activePageId),
    desktop: Boolean(target.services.desktop),
    documentUndo: Boolean(target.services.documentUndo),
    // An explicit service-level writable=false is authoritative (for
    // unmounted/draft-only hosts), even when the document status itself is
    // editable.  Capability projections must never advertise writes the host
    // boundary will reject.
    writable: isIdeaSketchDocumentWritable({
      documentStatus: target.documentStatus,
      readOnly: target.readOnly,
      servicesWritable: target.services.writable,
      callerProfile,
    }),
  };
}

function operationBuilder<K extends IdeaSketchOperationKind>(input: {
  isActive: () => boolean;
  getScopes: () => readonly IdeaSketchSdkScope[];
  getAvailableOperationKinds: () => readonly string[];
  getLimits: () => Partial<IdeaSketchOperationLimits>;
  isMethodAvailable: (namespace: string, method: string) => boolean;
  requiredScope: IdeaSketchSdkScope;
  kind: K;
}): IdeaSketchOperationBuilder<K> {
  return ((value: IdeaSketchOperationInput<K>): SdkSyncResult<IdeaSketchOperationOf<K>> => {
    try {
      if (!input.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
      if (!input.getScopes().includes(input.requiredScope)) {
        return sdkRejected("capability_denied", "The caller is not authorized for this operation.");
      }
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return sdkRejected("invalid_request", "The operation input must be an object.");
      }
      if (!input.getAvailableOperationKinds().includes(input.kind)) {
        return sdkRejected("unsupported_operation", `The ${input.kind} operation is not available yet.`);
      }
      const operationNamespace = input.kind === "clear-scene"
        ? "scene"
        : ["add-page", "import-page", "duplicate-page", "rename-page", "reorder-page", "delete-page", "create-page-from-selection"].includes(input.kind)
          ? "page"
          : ["move-element", "resize-element", "delete-element"].includes(input.kind)
            ? "element"
            : ["create-shape", "set-shape-style", "upsert-bound-text"].includes(input.kind)
              ? "shape"
              : ["create-arrow", "bind-arrow", "unbind-arrow", "set-connector-style", "set-arrowheads", "set-connector-points"].includes(input.kind)
                ? "connector"
                : ["create-text", "bind-text", "unbind-text", "set-text", "set-text-style", "set-text-layout"].includes(input.kind)
                  ? "text"
                  : ["create-camera", "update-camera-bounds", "set-camera-order", "delete-camera"].includes(input.kind)
                    ? "camera"
                    : ["set-background"].includes(input.kind)
                      ? "appearance"
                      : "transform";
      if (!input.isMethodAvailable("operations", operationNamespace)) {
        return sdkRejected("unsupported_operation", `The ${operationNamespace} operation namespace is not available.`);
      }
      return buildIdeaSketchOperation(input.kind, value, input.getLimits()) as SdkSyncResult<IdeaSketchOperationOf<K>>;
    } catch {
      // Operation builders are synchronous public helpers. A revoked Proxy
      // can throw from Array.isArray or another reflective operation before
      // the schema validator gets control; classify it as malformed input.
      return sdkRejected("invalid_request", "The operation input is malformed.");
    }
  }) as IdeaSketchOperationBuilder<K>;
}

function createOperationsNamespace(input: {
  isActive: () => boolean;
  getScopes: () => readonly IdeaSketchSdkScope[];
  getAvailableOperationKinds: () => readonly string[];
  getLimits: () => Partial<IdeaSketchOperationLimits>;
  isMethodAvailable: (namespace: string, method: string) => boolean;
}): IdeaSketchOperationsNamespace {
  const build = <K extends IdeaSketchOperationKind>(requiredScope: IdeaSketchSdkScope, kind: K) => operationBuilder({
    ...input,
    requiredScope,
    kind,
  });
  const scene = <K extends IdeaSketchOperationKind>(kind: K) => build("scene.write", kind);
  const page = <K extends IdeaSketchOperationKind>(kind: K) => build("document.structure.write", kind);
  return {
    page: {
      add: page("add-page"),
      import: page("import-page"),
      duplicate: page("duplicate-page"),
      rename: page("rename-page"),
      reorder: page("reorder-page"),
      delete: page("delete-page"),
      createFromSelection: page("create-page-from-selection"),
    },
    element: {
      move: scene("move-element"),
      resize: scene("resize-element"),
      delete: scene("delete-element"),
    },
    shape: {
      create: scene("create-shape"),
      setStyle: scene("set-shape-style"),
      upsertBoundText: scene("upsert-bound-text"),
    },
    connector: {
      create: scene("create-arrow"),
      bind: scene("bind-arrow"),
      unbind: scene("unbind-arrow"),
      setStyle: scene("set-connector-style"),
      setArrowheads: scene("set-arrowheads"),
      setPoints: scene("set-connector-points"),
    },
    text: {
      create: scene("create-text"),
      bind: scene("bind-text"),
      unbind: scene("unbind-text"),
      setContent: scene("set-text"),
      setStyle: scene("set-text-style"),
      setLayout: scene("set-text-layout"),
    },
    camera: {
      create: scene("create-camera"),
      updateBounds: scene("update-camera-bounds"),
      reorder: scene("set-camera-order"),
      delete: scene("delete-camera"),
    },
    appearance: { setBackground: scene("set-background") },
    transform: { applyStylePreset: scene("apply-style-preset") },
    scene: { clear: build("scene.destructive-clear", "clear-scene") },
  };
}

export function createIdeaSketchSdkHost(
  getTarget: () => IdeaSketchSdkHostTarget | undefined,
): IdeaSketchSdkHost {
  const mutationScheduler = createDocumentMutationScheduler();
  const eventHubsByDocument = new Map<string, ReturnType<typeof createIdeaSketchEventHub>>();
  const sessionsByCaller = new WeakMap<object, Map<string, {
    controller: ReturnType<typeof createSessionController>;
    ledger: ReturnType<typeof createRequestLedger>;
  }>>();
  const host: IdeaSketchSdkHost = {
    mutationScheduler,
    createSessionFactory(caller) {
      return {
        // Keep the convenience factory on the same never-throw public
        // boundary as host.createSession. Object spread can invoke hostile
        // getters before the host validator gets a chance to classify them.
        createSession: async (input) => {
          try {
            const envelope = publicEnvelope(input);
            if (!envelope) return sdkRejected("invalid_request", "The IdeaSketch SDK session input must be an object.");
            // The host boundary performs the runtime shape/version checks;
            // this cast only bridges the unknown envelope produced by the
            // hostile-input-safe validator.
            return await host.createSession({ ...envelope, caller } as unknown as CreateIdeaSketchSdkSessionInput);
          } catch {
            return sdkRejected("invalid_request", "The IdeaSketch SDK session input is malformed.");
          }
        },
      };
    },
    async createSession(rawInput) {
      try {
      const envelope = publicEnvelope(rawInput);
      if (!envelope) {
        return sdkRejected("invalid_request", "The IdeaSketch SDK session input must be an object.");
      }
      const allowedInputFields = ["caller", "sdkProtocolVersion", "agentToolProtocolVersion", "expectedAgentSchemaDigest", "requiredCapabilities"];
      const unknownInput = unknownEnvelopeFields(envelope, allowedInputFields);
      if (unknownInput.length > 0) return sdkRejected("invalid_request", `The session input contains unknown field(s): ${unknownInput.map(String).join(", ")}.`);
      const sdkProtocolVersion = publicEnvelope(envelope.sdkProtocolVersion);
      if (!sdkProtocolVersion || unknownEnvelopeFields(sdkProtocolVersion, ["major", "minor"]).length > 0) {
        return sdkRejected("invalid_request", "The SDK protocol version is required.");
      }
      const agentToolProtocolVersion = envelope.agentToolProtocolVersion === undefined
        ? undefined
        : publicEnvelope(envelope.agentToolProtocolVersion);
      if (envelope.agentToolProtocolVersion !== undefined && (!agentToolProtocolVersion || unknownEnvelopeFields(agentToolProtocolVersion, ["major", "minor"]).length > 0)) {
        return sdkRejected("invalid_request", "The Agent Tool protocol version is malformed.");
      }
      if (
        envelope.expectedAgentSchemaDigest !== undefined
        && (
          typeof envelope.expectedAgentSchemaDigest !== "string"
          || envelope.expectedAgentSchemaDigest.length === 0
          || /[\u0000-\u0020\u007f]/.test(envelope.expectedAgentSchemaDigest)
        )
      ) {
        return sdkRejected("invalid_request", "expectedAgentSchemaDigest must be a non-empty opaque string.");
      }
      let requiredCapabilitiesInput: readonly IdeaSketchSdkScope[] | undefined;
      try {
        if (envelope.requiredCapabilities !== undefined) {
          if (!denseArray(envelope.requiredCapabilities)) throw new TypeError("not a dense array");
          requiredCapabilitiesInput = [...envelope.requiredCapabilities] as IdeaSketchSdkScope[];
        }
      } catch {
        return sdkRejected("invalid_request", "requiredCapabilities must contain only known capability names.");
      }
      const input: CreateIdeaSketchSdkSessionInput = {
        caller: envelope.caller as IdeaSketchHostCaller,
        sdkProtocolVersion: sdkProtocolVersion as unknown as SdkProtocolVersion,
        ...(agentToolProtocolVersion ? { agentToolProtocolVersion: agentToolProtocolVersion as unknown as SdkProtocolVersion } : {}),
        ...(envelope.expectedAgentSchemaDigest !== undefined ? { expectedAgentSchemaDigest: envelope.expectedAgentSchemaDigest as string } : {}),
        ...(requiredCapabilitiesInput ? { requiredCapabilities: requiredCapabilitiesInput } : {}),
      };
      const caller = input.caller;
      if (typeof caller !== "object" || caller === null || !issuedHostCallers.has(caller) || caller[hostCallerBrand] !== true) {
        return sdkRejected("invalid_request", "The IdeaSketch SDK caller descriptor is invalid.");
      }
      if (
        typeof caller.id !== "string"
        || caller.id.length === 0
        || !KNOWN_CALLER_PROFILES.has(caller.profile as IdeaSketchSdkCallerProfile)
      ) {
        return sdkRejected("invalid_request", "The IdeaSketch SDK caller descriptor is malformed.");
      }
      if (
        input.requiredCapabilities !== undefined
        && (
          !Array.isArray(input.requiredCapabilities)
          || input.requiredCapabilities.some((scope) => (
            typeof scope !== "string" || !KNOWN_SCOPES.has(scope as IdeaSketchSdkScope)
          ))
        )
      ) {
        return sdkRejected("invalid_request", "requiredCapabilities must contain only known capability names.");
      }
      let target: IdeaSketchSdkHostTarget | undefined;
      try {
        target = getTarget();
      } catch {
        return sdkRejected("internal_error", "The active IdeaSketch editor could not be inspected safely.", true);
      }
      if (!target) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
      const boundDocumentSessionId = target.documentSessionId;
      const callerSessions = sessionsByCaller.get(input.caller as object) ?? new Map();
      sessionsByCaller.set(input.caller as object, callerSessions);
      const existingSession = callerSessions.get(boundDocumentSessionId);
      if (existingSession && !existingSession.controller.isDisposed()) {
        return existingSession.ledger.hasIndeterminate()
          ? sdkRejected(
              "commit_indeterminate",
              "The caller has an unresolved mutation in its active document session.",
              true,
            )
          : sdkRejected(
              "editor_busy",
              "The caller already has an active SDK session for this document.",
              true,
            );
      }
      const documentRef = `document:${target.documentId}` as DocumentRef;
      let eventHub = eventHubsByDocument.get(boundDocumentSessionId);
      if (!eventHub) {
        eventHub = createIdeaSketchEventHub({ documentRef });
        eventHubsByDocument.set(boundDocumentSessionId, eventHub);
      }
      const eventDispatcher = eventHub.createDispatcher();
      const getSessionTarget = () => {
        try {
          const candidate = getTarget();
          return candidate?.documentSessionId === boundDocumentSessionId ? candidate : undefined;
        } catch {
          return undefined;
        }
      };
      const negotiated = negotiateSdkProtocols({
        sdk: input.sdkProtocolVersion,
        ...(input.agentToolProtocolVersion ? { agentTool: input.agentToolProtocolVersion } : {}),
        ...(input.expectedAgentSchemaDigest
          ? { expectedAgentSchemaDigest: input.expectedAgentSchemaDigest }
          : {}),
      });
      if (negotiated.status === "rejected") return negotiated;
      const requiredAgentMajor = input.caller.profile === "agent-v1" || input.caller.profile === "legacy"
        ? 1
        : input.caller.profile === "agent-v2"
          ? 2
          : undefined;
      if (requiredAgentMajor !== undefined && !input.expectedAgentSchemaDigest) {
        return sdkRejected(
          "protocol_mismatch",
          `The ${input.caller.profile} caller must pin its Agent Tool schema digest.`,
        );
      }
      if (requiredAgentMajor !== undefined && negotiated.value.agentTool?.major !== requiredAgentMajor) {
        return sdkRejected(
          "protocol_mismatch",
          `The ${input.caller.profile} caller requires Agent Tool protocol v${requiredAgentMajor}.`,
        );
      }

      const getCapabilities = () => {
        const capabilityTarget = getSessionTarget() ?? {
          ...target,
          mountedPageId: undefined,
          services: {},
        };
        return createCapabilityProjection(
          input.caller.profile,
          targetAvailability(capabilityTarget, input.caller.profile),
          negotiated.value.agentTool,
          input.caller.grantedScopes,
          {
            ...(negotiated.value.agentSchemaDigest
              ? { toolSchemaDigest: negotiated.value.agentSchemaDigest }
              : {}),
            documentFormatVersion: capabilityTarget.document.formatVersion,
          },
        );
      };
      const initialCapabilities = getCapabilities();
      const requiredCapabilities = [...new Set(input.requiredCapabilities ?? [])];
      const missingRequired = requiredCapabilities.filter(
        (scope) => !initialCapabilities.scopes.includes(scope),
      );
      if (missingRequired.length > 0) {
        return sdkRejected(
          "capability_denied",
          `The caller is missing required capabilities: ${missingRequired.join(", ")}.`,
        );
      }

      const id = sessionId();
      const snapshots = createSnapshotStore({ sessionId: id });
      const ledger = createRequestLedger({
        sessionId: id,
        capacity: initialCapabilities.limits.mutationRequestsPerSession,
      });
      let presentationCleanup: () => void = () => undefined;
      let ioCleanup: () => void = () => undefined;
      let controller!: ReturnType<typeof createSessionController>;
      controller = createSessionController({
        sessionId: id,
        callerProfile: input.caller.profile,
        sdkProtocolVersion: negotiated.value.sdk,
        ...(negotiated.value.agentTool
          ? { agentToolProtocolVersion: negotiated.value.agentTool }
          : {}),
        ...(negotiated.value.agentSchemaDigest
          ? { toolSchemaDigest: negotiated.value.agentSchemaDigest }
          : {}),
        documentFormatVersion: target.document.formatVersion,
        ledger,
        cleanupSession: async () => {
          presentationCleanup();
          ioCleanup();
          await target.cleanupSession?.(id);
        },
        invalidateCallerResources: () => {
          snapshots.dispose();
          eventDispatcher.dispose();
        },
        onDisposed: () => {
          if (callerSessions.get(boundDocumentSessionId)?.controller === controller) {
            callerSessions.delete(boundDocumentSessionId);
          }
        },
      });
      callerSessions.set(boundDocumentSessionId, { controller, ledger });

      const sceneService = createIdeaSketchSceneService({
        sessionId: id,
        sdkProtocolVersion: negotiated.value.sdk,
        callerProfile: input.caller.profile,
        getTarget: getSessionTarget,
        getScopes: () => getCapabilities().scopes,
        getAvailableOperationKinds: () => getCapabilities().availableOperationKinds,
        isMethodAvailable: (namespace, method) => Boolean(getCapabilities().availableMethods[namespace]?.includes(method)),
        getLimits: () => operationLimitsFromCapabilities(getCapabilities().limits),
        snapshots,
        ledger,
        scheduler: mutationScheduler,
        isActive: controller.isActive,
        ...(target.confirmClear ? { confirmClear: (value) => getSessionTarget()?.confirmClear?.(value) ?? Promise.resolve(false) } : {}),
      });
      const cameraService = createIdeaSketchCameraService({
        getTarget: getSessionTarget,
        getScopes: () => getCapabilities().scopes,
        isActive: controller.isActive,
        isMethodAvailable: (method) => Boolean(getCapabilities().availableMethods.cameras?.includes(method)),
        listCameras: sceneService.listCameras,
        ...(target.beginCreateCamera ? { beginCreate: async (value) => getSessionTarget()?.beginCreateCamera?.(value) ?? sdkRejected("editor_unavailable", "The active Camera interaction is unavailable.", true) } : {}),
      });
      const pagesService = createIdeaSketchPagesService({
        sessionId: id,
        sdkProtocolVersion: negotiated.value.sdk,
        callerProfile: input.caller.profile,
        getTarget: getSessionTarget,
        getScopes: () => getCapabilities().scopes,
        getAvailableOperationKinds: () => getCapabilities().availableOperationKinds,
        isMethodAvailable: (namespace, method) => Boolean(getCapabilities().availableMethods[namespace]?.includes(method)),
        getLimits: () => getCapabilities().limits,
        snapshots,
        ledger,
        scheduler: mutationScheduler,
        isActive: controller.isActive,
      });

      const requests: IdeaSketchRequestsNamespace = {
        async getMutationResult(requestId) {
          if (!controller.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
          if (typeof requestId !== "string" || requestId.trim().length === 0) return sdkRejected("invalid_request", "requestId must be a non-empty string.");
          if (!getCapabilities().scopes.includes("requests.read")) {
            return sdkRejected("capability_denied", "The caller cannot inspect mutation requests.");
          }
          return ledger.getMutationResult(requestId);
        },
        async reconcile(reconciliationToken: ReconciliationToken) {
          if (!controller.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
          if (typeof reconciliationToken !== "string" || !/^reconciliation-token:[^\u0000-\u0020\u007f]+$/.test(reconciliationToken)) return sdkRejected("invalid_request", "The reconciliation token is malformed.");
          if (!getCapabilities().scopes.includes("requests.read")) {
            return sdkRejected("capability_denied", "The caller cannot reconcile mutation requests.");
          }
          return ledger.reconcile({ reconciliationToken });
        },
      };

      const rawPages: IdeaSketchPagesNamespace = {
        list: (value) => pagesService.list(value as never),
        select: (value) => pagesService.select(value as never),
        parseExcalidraw: (value) => pagesService.parseExcalidraw(value),
        validatePlan: (value) => pagesService.validatePlan(value),
        applyPlan: (value) => pagesService.applyPlan(value as never),
      };
      const rawScene: IdeaSketchSceneNamespace = {
        read: (value) => sceneService.read(value as never),
        getElements: (value) => sceneService.getElements(value as never),
        requestClearConfirmation: (value) => sceneService.requestClearConfirmation(value as never),
        validatePlan: (value) => sceneService.validatePlan(value as never),
        applyPlan: (value) => sceneService.applyPlan(value as never),
      };
      const scene: IdeaSketchSceneNamespace = {
        read: rawScene.read,
        getElements: rawScene.getElements,
        requestClearConfirmation: rawScene.requestClearConfirmation,
        validatePlan: rawScene.validatePlan,
        applyPlan: async (value) => {
          const result = await rawScene.applyPlan(value);
          if (result.status === "succeeded" && result.value.outcome === "applied") {
            const live = getSessionTarget();
            const affected = [...new Set([
              ...result.value.updatedRefs.map((entity) => entity.ref),
              ...result.value.deletedRefs.map((entity) => entity.ref),
              ...result.value.cascadedRefs.map((entity) => entity.ref),
              ...Object.values(result.value.createdRefs).map((entity) => typeof entity === "string" ? entity : entity.ref),
            ])];
            const boundedAffected = affected.slice(0, 200);
            const event: Omit<IdeaSketchSceneCommittedEvent, "sequence" | "documentRef"> = {
              type: "scene-committed",
              pageRef: `page:${live?.activePageId ?? target.activePageId}` as import("./types.ts").PageRef,
              sceneEditVersion: result.value.afterEditVersion,
              origin: "sdk",
              operationKinds: Object.freeze([...new Set(result.value.operations.map((operation) => operation.kind))]),
              affectedRefs: Object.freeze(boundedAffected) as import("./types.ts").IdeaSketchSceneCommittedEvent["affectedRefs"],
              truncated: affected.length > boundedAffected.length,
            };
            eventHub.publish(event);
          }
          return result;
        },
      };
      const pages: IdeaSketchPagesNamespace = {
        list: rawPages.list,
        parseExcalidraw: rawPages.parseExcalidraw,
        validatePlan: rawPages.validatePlan,
        select: async (value) => {
          const beforePage = getSessionTarget()?.activePageId;
          if (beforePage && typeof value === "object" && value !== null) {
            const requested = (value as { pageRef?: unknown }).pageRef;
            if (typeof requested === "string" && requested !== `page:${beforePage}`) presentationService.stopForContextChange();
          }
          const result = await rawPages.select(value);
          const afterPage = getSessionTarget()?.activePageId;
          if (result.status === "succeeded" && beforePage !== afterPage && afterPage) {
            eventHub.publish({
              type: "context-change",
              activePageRef: `page:${afterPage}` as import("./types.ts").PageRef,
            });
          }
          return result;
        },
        applyPlan: async (value) => {
          const beforePage = getSessionTarget()?.activePageId;
          const result = await rawPages.applyPlan(value);
          if (result.status === "succeeded" && result.value.outcome === "applied") {
            const live = getSessionTarget();
            const documentEvent: Omit<IdeaSketchDocumentCommittedEvent, "sequence" | "documentRef"> = {
              type: "document-committed",
              documentVersion: live?.revision ?? target.revision,
              operationKinds: result.value.operations.map((operation) => operation.kind),
              createdPageRefs: (result.value.createdPageRefs ?? []).slice(),
              updatedPageRefs: (result.value.updatedPageRefs ?? []).slice(),
              deletedPageRefs: (result.value.deletedPageRefs ?? []).slice(),
            };
            const events: Array<Omit<IdeaSketchDocumentCommittedEvent, "sequence" | "documentRef"> | Omit<import("./types.ts").IdeaSketchContextChangeEvent, "sequence" | "documentRef">> = [documentEvent];
            const afterPage = live?.activePageId;
            if (beforePage !== afterPage && afterPage) {
              events.push({ type: "context-change", activePageRef: `page:${afterPage}` as import("./types.ts").PageRef });
            }
            eventHub.publishBatch(events);
          }
          return result;
        },
      };
      const selectionViewService = createIdeaSketchSelectionViewService({
        getTarget: getSessionTarget,
        getScopes: () => getCapabilities().scopes,
        isActive: controller.isActive,
        isMethodAvailable: (namespace, method) => Boolean(getCapabilities().availableMethods[namespace]?.includes(method)),
        readScene: (value) => scene.read(value),
        getSceneElements: (value) => scene.getElements(value),
        ...(target.updateSelection ? { updateSelection: (refs) => getSessionTarget()?.updateSelection?.(refs) } : {}),
        ...(target.updateViewport ? { updateViewport: (viewport) => getSessionTarget()?.updateViewport?.(viewport) } : {}),
        onSelectionChange: (selection) => {
          eventHub.publish({
            type: "selection-change",
            pageRef: selection.pageRef,
            selectionVersion: selection.selectionVersion,
            refs: selection.refs,
          });
        },
      });
      const transformsService = createIdeaSketchTransformsService({
        isActive: controller.isActive,
        getScopes: () => getCapabilities().scopes,
        isMethodAvailable: (namespace, method) => Boolean(getCapabilities().availableMethods[namespace]?.includes(method)),
        scene,
        pages,
      });
      const presentationService = createIdeaSketchPresentationService({
        getTarget: getSessionTarget,
        getScopes: () => getCapabilities().scopes,
        isActive: controller.isActive,
        isMethodAvailable: (method) => Boolean(getCapabilities().availableMethods.presentation?.includes(method)),
        onStateChange: (state) => {
          const live = getSessionTarget();
          eventHub.publish({
            type: "presentation-state-change",
            state: state.running ? "running" : "stopped",
            ...(state.mode ? { mode: state.mode } : {}),
            ...(state.pageRef ? { pageRef: state.pageRef } : {}),
            ...(state.presentationSessionId ? { presentationSessionId: state.presentationSessionId } : {}),
            ...(state.activeCameraRef ? { activeCameraRef: state.activeCameraRef } : {}),
            ...(state.cameraIndex !== undefined ? { cameraIndex: state.cameraIndex } : {}),
            ...(state.cameraCount !== undefined ? { cameraCount: state.cameraCount } : {}),
            ...(live ? {} : {}),
          });
        },
      });
      presentationCleanup = presentationService.stopForContextChange;
      const ioService = createIdeaSketchIoService({
        getTarget: getSessionTarget,
        getScopes: () => getCapabilities().scopes,
        isActive: controller.isActive,
        isMethodAvailable: (method) => Boolean(getCapabilities().availableMethods.io?.includes(method)),
        ledger,
        ...(target.openImageExportDialog ? { openImageExportDialog: () => getSessionTarget()?.openImageExportDialog?.() } : {}),
        ...(target.chooseExcalidrawImport ? { chooseImport: () => getSessionTarget()?.chooseExcalidrawImport?.() ?? Promise.reject(new Error("The Excalidraw picker is unavailable.")) } : {}),
        parseExcalidraw: (value) => pagesService.parseExcalidraw(value),
        applyImport: async ({ requestId, draftRef, title, reservedRequestHandle }) => {
          const live = getSessionTarget();
          if (!live) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
          const listed = await pagesService.list();
          if (listed.status !== "succeeded") return listed;
          const pageRef = `temp:imported-page:${requestId}`;
          return pagesService.applyPlan({
            requestId,
            documentSnapshotId: listed.value.documentSnapshotId,
            operations: [{ kind: "import-page", version: 1, ref: pageRef as import("./types.ts").TempRef, ...(title ? { title } : {}), parsedPageDraftRef: draftRef as import("./types.ts").ParsedPageDraftRef }],
            ...(reservedRequestHandle ? { reservedRequestHandle } : {}),
          } as never);
        },
      });
      ioCleanup = ioService.dispose;
      const cameras: IdeaSketchCamerasNamespace = {
        list: (value) => cameraService.list(value as never),
        select: (value) => selectionViewService.cameras.select(value as never),
        beginCreate: (value) => cameraService.beginCreate(value as never),
      };
      const selection: IdeaSketchSelectionNamespace = {
        get: (value) => selectionViewService.selection.get(value as never),
        set: (value) => selectionViewService.selection.set(value as never),
        clear: (value) => selectionViewService.selection.clear(value as never),
      };
      const view: IdeaSketchViewNamespace = {
        getViewport: (value) => selectionViewService.view.getViewport(value as never),
        focusElements: (value) => selectionViewService.view.focusElements(value as never),
      };
      const transforms: IdeaSketchTransformsNamespace = {
        convertSelectionStyle: (value) => transformsService.convertSelectionStyle(value as never),
      };
      const presentation: IdeaSketchPresentationNamespace = {
        getState: (value) => presentationService.getState(value),
        start: (value) => presentationService.start(value),
        stop: (value) => presentationService.stop(value),
        next: (value) => presentationService.next(value),
        previous: (value) => presentationService.previous(value),
        goToCamera: (value) => presentationService.goToCamera(value),
      };
      const assets: IdeaSketchAssetsNamespace = {
        listMetadata: (value: IdeaSketchAssetMetadataListOptions) =>
          sceneService.listAssetMetadata(value) as Promise<SdkResult<IdeaSketchAssetMetadataListResult>>,
      };
      const io: IdeaSketchIoNamespace = {
        serializeActivePageAsExcalidraw: () => ioService.serializeActivePageAsExcalidraw(),
        serializeActivePageAsIdeaSketch: () => ioService.serializeActivePageAsIdeaSketch(),
        serializeActivePageAsDrawio: () => ioService.serializeActivePageAsDrawio(),
        exportActivePageAsExcalidraw: () => ioService.exportActivePageAsExcalidraw(),
        exportActivePageAsIdeaSketch: () => ioService.exportActivePageAsIdeaSketch(),
        exportActivePageAsDrawio: () => ioService.exportActivePageAsDrawio(),
        openImageExportDialog: () => ioService.openImageExportDialog(),
        pickExcalidrawAndAddPage: (value) => ioService.pickExcalidrawAndAddPage(value),
      };

      const subscribe = <Event extends IdeaSketchSdkEvent>(
        method: string,
        type: Event["type"],
        handler: IdeaSketchSdkEventHandler<Event>,
      ) => {
        try {
          if (!controller.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
          const capabilities = getCapabilities();
          if (!capabilities.supportedMethods.events?.includes(method)) {
            return sdkRejected("capability_denied", "The caller cannot subscribe to this event.");
          }
          if (!capabilities.availableMethods.events?.includes(method)) {
            return sdkRejected("unsupported_operation", "The event service is unavailable.");
          }
          return eventDispatcher.subscribe(
            type,
            handler as IdeaSketchSdkEventHandler<IdeaSketchSdkEvent>,
          );
        } catch {
          return sdkRejected("internal_error", "The IdeaSketch event service could not be accessed safely.", true);
        }
      };
      const events: IdeaSketchEventsNamespace = {
        onContextChange: (handler) => subscribe("onContextChange", "context-change", handler),
        onDocumentCommitted: (handler) => subscribe("onDocumentCommitted", "document-committed", handler),
        onSceneCommitted: (handler) => subscribe("onSceneCommitted", "scene-committed", handler),
        onSelectionChange: (handler) => subscribe("onSelectionChange", "selection-change", handler),
        onAvailabilityChange: (handler) => subscribe("onAvailabilityChange", "availability-change", handler),
        onPresentationStateChange: (handler) => subscribe("onPresentationStateChange", "presentation-state-change", handler),
      };

      const sdk: IdeaSketchSdk = {
        session: controller.namespace,
        context: createContextNamespace({
          isActive: controller.isActive,
          getSource: () => {
            const liveTarget = getSessionTarget();
            if (!liveTarget) return undefined;
            return {
              documentId: liveTarget.documentId,
              activePageId: liveTarget.activePageId,
              documentStatus: liveTarget.documentStatus,
              readOnly: liveTarget.readOnly,
              mountedPageId: liveTarget.mountedPageId,
              revision: liveTarget.revision,
              pageEditVersion: liveTarget.pageEditVersion,
              nativeInteraction: liveTarget.nativeInteraction,
            };
          },
          getCapabilities,
          sdkProtocolVersion: negotiated.value.sdk,
          ...(negotiated.value.agentTool
            ? { agentToolProtocolVersion: negotiated.value.agentTool }
            : {}),
          ...(negotiated.value.agentSchemaDigest
            ? { toolSchemaDigest: negotiated.value.agentSchemaDigest }
            : {}),
          documentFormatVersion: target.document.formatVersion,
          callerProfile: input.caller.profile,
        }),
        requests,
        pages,
        scene,
        operations: createOperationsNamespace({
          isActive: controller.isActive,
          getScopes: () => getCapabilities().scopes,
          getAvailableOperationKinds: () => getCapabilities().availableOperationKinds,
          getLimits: () => operationLimitsFromCapabilities(getCapabilities().limits),
          isMethodAvailable: (namespace, method) => Boolean(getCapabilities().availableMethods[namespace]?.includes(method)),
        }),
        cameras,
        selection,
        view,
        transforms,
        presentation,
        assets,
        io,
        events,
      };
      return sdkSucceeded(sdk);
      } catch {
        // Host target/service state is internal, but a malformed adapter must
        // still never escape as a rejected Promise from this public boundary.
        return sdkRejected("internal_error", "The IdeaSketch SDK session could not be created safely.", true);
      }
    },
  };
  return host;
}

let activeTargetRegistration:
  | { token: symbol; getTarget: () => IdeaSketchSdkHostTarget | undefined }
  | undefined;

const activeIdeaSketchSdkHost = createIdeaSketchSdkHost(
  () => activeTargetRegistration?.getTarget(),
);

export function registerActiveIdeaSketchSdkHostTarget(
  getTarget: () => IdeaSketchSdkHostTarget | undefined,
) {
  const token = Symbol("IdeaSketchSdkHostTargetRegistration");
  activeTargetRegistration = { token, getTarget };
  return () => {
    if (activeTargetRegistration?.token === token) activeTargetRegistration = undefined;
  };
}

export function createIdeaSketchSdkHostRegistrationLifecycle(
  register: typeof registerActiveIdeaSketchSdkHostTarget = registerActiveIdeaSketchSdkHostTarget,
) {
  let active: { token: symbol; unregister: () => void } | undefined;
  return {
    mount(getTarget: () => IdeaSketchSdkHostTarget | undefined) {
      const previous = active;
      active = undefined;
      previous?.unregister();
      const token = Symbol("IdeaSketchSdkHostRegistrationLifecycle");
      const unregister = register(getTarget);
      active = { token, unregister };
      return () => {
        if (active?.token !== token) return;
        active = undefined;
        unregister();
      };
    },
  };
}

export function getActiveIdeaSketchSdkHost(): IdeaSketchSdkHost {
  return activeIdeaSketchSdkHost;
}
