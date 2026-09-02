import {
  createCapabilityProjection,
  negotiateSdkProtocols,
  type IdeaSketchSdkServiceAvailability,
} from "./capabilities.ts";
import { createContextNamespace } from "./context.ts";
import { createRequestLedger } from "./requestLedger.ts";
import { createSessionController } from "./session.ts";
import { createSnapshotStore } from "./snapshots.ts";
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
  type IdeaSketchPagesNamespace,
  type IdeaSketchPresentationNamespace,
  type IdeaSketchRequestsNamespace,
  type IdeaSketchSceneNamespace,
  type IdeaSketchSdk,
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
import type { IdeaSketchDocument } from "../../types.ts";

const hostCallerBrand = Symbol("IdeaSketchSdkHostCaller");
const issuedHostCallers = new WeakSet<object>();

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
  commitDocument?: (document: IdeaSketchDocument) => void | IdeaSketchMutationCommitReceipt;
  cleanupSession?: (sessionId: CallerSessionId) => Promise<void>;
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
  return {
    ...target.services,
    mountedCanvas: Boolean(target.services.mountedCanvas ?? target.mountedPageId === target.activePageId),
    desktop: Boolean(target.services.desktop),
    documentUndo: Boolean(target.services.documentUndo),
    writable: !target.readOnly && target.documentStatus === "editable",
  };
}

function operationBuilder(input: {
  isActive: () => boolean;
  getScopes: () => readonly IdeaSketchSdkScope[];
  getAvailableOperationKinds: () => readonly string[];
  requiredScope: IdeaSketchSdkScope;
  kind: string;
}) {
  return (value: unknown): SdkSyncResult<never> => {
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
    return sdkRejected("unsupported_operation", `The ${input.kind} operation is not implemented.`);
  };
}

function createOperationsNamespace(input: {
  isActive: () => boolean;
  getScopes: () => readonly IdeaSketchSdkScope[];
  getAvailableOperationKinds: () => readonly string[];
}): IdeaSketchOperationsNamespace {
  const build = (requiredScope: IdeaSketchSdkScope, kind: string) => operationBuilder({
    ...input,
    requiredScope,
    kind,
  });
  const scene = (kind: string) => build("scene.write", kind);
  const page = (kind: string) => build("document.structure.write", kind);
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
      if (!issuedHostCallers.has(input.caller as object) || input.caller[hostCallerBrand] !== true) {
        return sdkRejected("invalid_request", "The IdeaSketch SDK caller descriptor is invalid.");
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
      const missingRequired = (input.requiredCapabilities ?? []).filter(
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

      const unsupported = async <Value>(namespace: string, method: string): Promise<SdkResult<Value>> => {
        if (!controller.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
        const capabilities = getCapabilities();
        if (!capabilities.supportedMethods[namespace]?.includes(method)) {
          return sdkRejected("capability_denied", "The caller is not authorized for this method.");
        }
        if (!getSessionTarget()) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
        return sdkRejected("unsupported_operation", `The ${namespace}.${method} method is not available yet.`);
      };

      const requests: IdeaSketchRequestsNamespace = {
        async getMutationResult(requestId) {
          if (!controller.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
          if (!getCapabilities().scopes.includes("requests.read")) {
            return sdkRejected("capability_denied", "The caller cannot inspect mutation requests.");
          }
          return ledger.getMutationResult(requestId);
        },
        async reconcile(reconciliationToken: ReconciliationToken) {
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
        read: () => unsupported("scene", "read"),
        getElements: () => unsupported("scene", "getElements"),
        requestClearConfirmation: () => unsupported("scene", "requestClearConfirmation"),
        validatePlan: () => unsupported("scene", "validatePlan"),
        applyPlan: () => unsupported("scene", "applyPlan"),
      };
      const cameras: IdeaSketchCamerasNamespace = {
        list: () => unsupported("cameras", "list"),
        select: () => unsupported("cameras", "select"),
        beginCreate: () => unsupported("cameras", "beginCreate"),
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
        listMetadata: () => unsupported("assets", "listMetadata"),
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
