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
} from "./types.ts";
import type { IdeaSketchOperationKind } from "./operationSchemas.ts";
import type { IdeaSketchDocument } from "../../types.ts";
import type { IdeaSketchInternalSceneCommitRecord } from "./editorHostAdapter.ts";

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
  commitDocument?: (document: IdeaSketchDocument) => void | IdeaSketchMutationCommitReceipt;
  cleanupSession?: (sessionId: CallerSessionId) => Promise<void>;
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

function targetAvailability(target: IdeaSketchSdkHostTarget): IdeaSketchSdkServiceAvailability {
  const methods = { ...(target.services.methods ?? {}) };
  // A namespace-level `true` only means that the service boundary is mounted;
  // it must not imply that every catalog method has shipped.  F073-02 owns
  // Camera listing and asset metadata.  The remaining Camera interaction and
  // all later UI/IO/presentation methods stay unavailable until their rollout
  // plans provide explicit method entries.
  if (target.services.cameras && !methods.cameras) methods.cameras = ["list"];
  if (target.services.assets && !methods.assets) methods.assets = ["listMetadata"];
  // These namespaces are declared in the v1 catalog but are intentionally
  // deferred to later rollout plans.  Keep a namespace-level service flag
  // from advertising methods that the current facade still implements as
  // explicit unsupported stubs; a later plan can opt in by supplying its
  // method list.
  for (const namespace of ["pages", "selection", "view", "transforms", "presentation", "io"] as const) {
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
    writable: target.services.writable !== false
      && !target.readOnly
      && target.documentStatus === "editable",
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
  const sessionsByCaller = new WeakMap<object, Map<string, {
    controller: ReturnType<typeof createSessionController>;
    ledger: ReturnType<typeof createRequestLedger>;
  }>>();
  const host: IdeaSketchSdkHost = {
    mutationScheduler,
    createSessionFactory(caller) {
      return {
        createSession: (input) => host.createSession({ ...input, caller }),
      };
    },
    async createSession(input) {
      if (typeof input !== "object" || input === null || Array.isArray(input)) {
        return sdkRejected("invalid_request", "The IdeaSketch SDK session input must be an object.");
      }
      const allowedInputFields = ["caller", "sdkProtocolVersion", "agentToolProtocolVersion", "expectedAgentSchemaDigest", "requiredCapabilities"];
      const unknownInput = Reflect.ownKeys(input).filter((key) => typeof key !== "string" || !allowedInputFields.includes(key) || Object.getOwnPropertyDescriptor(input, key)?.enumerable !== true);
      if (unknownInput.length > 0) return sdkRejected("invalid_request", `The session input contains unknown field(s): ${unknownInput.map(String).join(", ")}.`);
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
        typeof input.sdkProtocolVersion !== "object"
        || input.sdkProtocolVersion === null
        || Array.isArray(input.sdkProtocolVersion)
      ) {
        return sdkRejected("invalid_request", "The SDK protocol version is required.");
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
      const target = getTarget();
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
      const getSessionTarget = () => {
        const candidate = getTarget();
        return candidate?.documentSessionId === boundDocumentSessionId ? candidate : undefined;
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
          targetAvailability(capabilityTarget),
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
        ...(target.cleanupSession
          ? { cleanupSession: () => target.cleanupSession!(id) }
          : {}),
        invalidateCallerResources: () => snapshots.dispose(),
        onDisposed: () => {
          if (callerSessions.get(boundDocumentSessionId)?.controller === controller) {
            callerSessions.delete(boundDocumentSessionId);
          }
        },
      });
      callerSessions.set(boundDocumentSessionId, { controller, ledger });

      const sceneService = createIdeaSketchSceneService({
        sessionId: id,
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
      });

      const methodAvailabilityError = <Value>(namespace: string, method: string): SdkResult<Value> | undefined => {
        if (!controller.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
        const capabilities = getCapabilities();
        if (!capabilities.supportedMethods[namespace]?.includes(method)) {
          return sdkRejected("capability_denied", "The caller is not authorized for this method.");
        }
        if (!getSessionTarget()) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
        if (!capabilities.availableMethods[namespace]?.includes(method)) {
          return sdkRejected("unsupported_operation", `The ${namespace}.${method} method is not currently available.`);
        }
        return undefined;
      };

      const unsupported = async <Value>(namespace: string, method: string): Promise<SdkResult<Value>> => {
        const unavailable = methodAvailabilityError<Value>(namespace, method);
        if (unavailable) return unavailable;
        return sdkRejected("unsupported_operation", `The ${namespace}.${method} method is not available yet.`);
      };

      const requests: IdeaSketchRequestsNamespace = {
        async getMutationResult(requestId) {
          if (typeof requestId !== "string" || requestId.trim().length === 0) return sdkRejected("invalid_request", "requestId must be a non-empty string.");
          if (!controller.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
          if (!getCapabilities().scopes.includes("requests.read")) {
            return sdkRejected("capability_denied", "The caller cannot inspect mutation requests.");
          }
          return ledger.getMutationResult(requestId);
        },
        async reconcile(reconciliationToken: ReconciliationToken) {
          if (typeof reconciliationToken !== "string" || !/^reconciliation-token:[^\u0000-\u0020\u007f]+$/.test(reconciliationToken)) return sdkRejected("invalid_request", "The reconciliation token is malformed.");
          if (!controller.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
          if (!getCapabilities().scopes.includes("requests.read")) {
            return sdkRejected("capability_denied", "The caller cannot reconcile mutation requests.");
          }
          return ledger.reconcile({ reconciliationToken });
        },
      };

      const pages: IdeaSketchPagesNamespace = {
        list: () => unsupported("pages", "list"),
        select: () => unsupported("pages", "select"),
        parseExcalidraw: () => unsupported("pages", "parseExcalidraw"),
        validatePlan: () => unsupported("pages", "validatePlan"),
        applyPlan: () => unsupported("pages", "applyPlan"),
      };
      const scene: IdeaSketchSceneNamespace = {
        read: (value) => sceneService.read(value as never),
        getElements: (value) => sceneService.getElements(value as never),
        requestClearConfirmation: (value) => sceneService.requestClearConfirmation(value as never),
        validatePlan: (value) => sceneService.validatePlan(value as never),
        applyPlan: (value) => sceneService.applyPlan(value as never),
      };
      const cameras: IdeaSketchCamerasNamespace = {
        list: (value) => cameraService.list(value as never),
        select: (value) => cameraService.select(value as never),
        beginCreate: (value) => cameraService.beginCreate(value as never),
      };
      const selection: IdeaSketchSelectionNamespace = {
        get: () => unsupported("selection", "get"),
        set: () => unsupported("selection", "set"),
        clear: () => unsupported("selection", "clear"),
      };
      const view: IdeaSketchViewNamespace = {
        getViewport: () => unsupported("view", "getViewport"),
        focusElements: () => unsupported("view", "focusElements"),
      };
      const transforms: IdeaSketchTransformsNamespace = {
        convertSelectionStyle: () => unsupported("transforms", "convertSelectionStyle"),
      };
      const presentation: IdeaSketchPresentationNamespace = {
        getState: () => unsupported("presentation", "getState"),
        start: () => unsupported("presentation", "start"),
        stop: () => unsupported("presentation", "stop"),
        next: () => unsupported("presentation", "next"),
        previous: () => unsupported("presentation", "previous"),
        goToCamera: () => unsupported("presentation", "goToCamera"),
      };
      const assets: IdeaSketchAssetsNamespace = {
        listMetadata: (value: IdeaSketchAssetMetadataListOptions) =>
          sceneService.listAssetMetadata(value) as Promise<SdkResult<IdeaSketchAssetMetadataListResult>>,
      };
      const io: IdeaSketchIoNamespace = {
        serializeActivePageAsExcalidraw: () => unsupported("io", "serializeActivePageAsExcalidraw"),
        serializeActivePageAsIdeaSketch: () => unsupported("io", "serializeActivePageAsIdeaSketch"),
        serializeActivePageAsDrawio: () => unsupported("io", "serializeActivePageAsDrawio"),
        exportActivePageAsExcalidraw: () => unsupported("io", "exportActivePageAsExcalidraw"),
        exportActivePageAsIdeaSketch: () => unsupported("io", "exportActivePageAsIdeaSketch"),
        exportActivePageAsDrawio: () => unsupported("io", "exportActivePageAsDrawio"),
        openImageExportDialog: () => unsupported("io", "openImageExportDialog"),
        pickExcalidrawAndAddPage: () => unsupported("io", "pickExcalidrawAndAddPage"),
      };

      const subscribe = <Event extends IdeaSketchSdkEvent>(
        method: string,
        type: Event["type"],
        handler: IdeaSketchSdkEventHandler<Event>,
      ) => {
        if (!controller.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
        const capabilities = getCapabilities();
        if (!capabilities.supportedMethods.events?.includes(method)) {
          return sdkRejected("capability_denied", "The caller cannot subscribe to this event.");
        }
        if (!capabilities.availableMethods.events?.includes(method)) {
          return sdkRejected("unsupported_operation", "The event service is unavailable.");
        }
        return controller.subscribe(
          type,
          handler as IdeaSketchSdkEventHandler<IdeaSketchSdkEvent>,
        );
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
