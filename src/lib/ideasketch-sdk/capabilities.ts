import {
  sdkRejected,
  sdkSucceeded,
  type IdeaSketchSdkCallerProfile,
  type IdeaSketchSdkCapabilities,
  type IdeaSketchSdkScope,
  type IdeaSketchSceneModel,
  type SdkProtocolVersion,
  type SdkSyncResult,
} from "./types.ts";
import { IDEA_SKETCH_OPERATION_SCHEMAS } from "./operationSchemas.ts";

export const IDEA_SKETCH_SDK_PROTOCOL_VERSION = Object.freeze({ major: 1, minor: 0 });

export const IDEA_SKETCH_SDK_METHOD_CATALOG = Object.freeze({
  session: Object.freeze(["getInfo", "dispose"]),
  context: Object.freeze(["get", "getCapabilities"]),
  requests: Object.freeze(["getMutationResult", "reconcile"]),
  pages: Object.freeze(["list", "select", "parseExcalidraw", "validatePlan", "applyPlan"]),
  scene: Object.freeze(["read", "getElements", "requestClearConfirmation", "validatePlan", "applyPlan"]),
  operations: Object.freeze(["page", "element", "shape", "connector", "text", "camera", "appearance", "transform", "scene"]),
  cameras: Object.freeze(["list", "select", "beginCreate"]),
  selection: Object.freeze(["get", "set", "clear"]),
  view: Object.freeze(["getViewport", "focusElements"]),
  transforms: Object.freeze(["convertSelectionStyle"]),
  presentation: Object.freeze(["getState", "start", "stop", "next", "previous", "goToCamera"]),
  assets: Object.freeze(["listMetadata"]),
  io: Object.freeze([
    "serializeActivePageAsExcalidraw",
    "serializeActivePageAsIdeaSketch",
    "serializeActivePageAsDrawio",
    "exportActivePageAsExcalidraw",
    "exportActivePageAsIdeaSketch",
    "exportActivePageAsDrawio",
    "openImageExportDialog",
    "pickExcalidrawAndAddPage",
  ]),
  events: Object.freeze([
    "onContextChange",
    "onDocumentCommitted",
    "onSceneCommitted",
    "onSelectionChange",
    "onAvailabilityChange",
    "onPresentationStateChange",
  ]),
});

export const IDEA_SKETCH_PAGE_OPERATION_KINDS = Object.freeze([
  "add-page",
  "import-page",
  "duplicate-page",
  "rename-page",
  "reorder-page",
  "delete-page",
  "create-page-from-selection",
]);

export const IDEA_SKETCH_SCENE_OPERATION_KINDS = Object.freeze([
  "create-shape",
  "create-arrow",
  "create-text",
  "create-camera",
  "bind-arrow",
  "unbind-arrow",
  "bind-text",
  "unbind-text",
  "upsert-bound-text",
  "set-text",
  "set-text-style",
  "set-text-layout",
  "set-shape-style",
  "set-connector-style",
  "set-arrowheads",
  "move-element",
  "resize-element",
  "set-connector-points",
  "update-camera-bounds",
  "set-camera-order",
  "delete-element",
  "delete-camera",
  "set-background",
  "apply-style-preset",
  "clear-scene",
]);

const AGENT_V1_PAGE_OPERATION_KINDS = Object.freeze([
  "add-page",
  "delete-page",
  "reorder-page",
]);

const AGENT_V1_SCENE_OPERATION_KINDS = Object.freeze([
  "create-shape",
  "create-arrow",
  "bind-arrow",
  "move-element",
  "resize-element",
]);

const AGENT_V2_PAGE_OPERATION_KINDS = Object.freeze([
  "add-page",
  "delete-page",
  "reorder-page",
]);

const AGENT_V2_SCENE_OPERATION_KINDS = Object.freeze([
  "create-shape",
  "create-arrow",
  "bind-arrow",
  "create-text",
  "bind-text",
  "unbind-text",
  "upsert-bound-text",
  "set-text",
  "set-text-style",
  "set-text-layout",
  "move-element",
  "resize-element",
]);

const AGENT_METHOD_ALLOWLIST = Object.freeze({
  session: Object.freeze(["getInfo", "dispose"]),
  context: Object.freeze(["get", "getCapabilities"]),
  requests: Object.freeze(["getMutationResult", "reconcile"]),
  pages: Object.freeze(["list", "validatePlan", "applyPlan"]),
  scene: Object.freeze(["read", "getElements", "validatePlan", "applyPlan"]),
  operations: Object.freeze(["page", "element", "shape", "connector", "text"]),
} satisfies Partial<Record<keyof typeof IDEA_SKETCH_SDK_METHOD_CATALOG, readonly string[]>>);

export type IdeaSketchSdkServiceAvailability = Partial<Record<keyof typeof IDEA_SKETCH_SDK_METHOD_CATALOG, boolean>> & {
  /** Optional per-method availability for partially rolled-out namespaces. */
  methods?: Partial<Record<keyof typeof IDEA_SKETCH_SDK_METHOD_CATALOG, readonly string[]>>;
  mountedCanvas?: boolean;
  desktop?: boolean;
  documentUndo?: boolean;
  writable?: boolean;
};

const PROFILE_SCOPES = Object.freeze({
  "trusted-ui": Object.freeze([
    "context.read", "requests.read", "document.read", "document.structure.write", "document.import.parse",
    "scene.read", "scene.write", "scene.destructive-clear", "selection.control", "view.read", "view.control",
    "presentation.control", "io.serialize", "user-mediated-io", "asset.read", "events.read", "host.interaction",
  ]),
  "agent-v1": Object.freeze([
    "context.read", "requests.read", "document.read", "document.structure.write", "scene.read", "scene.write", "legacy.raw-scene",
  ]),
  "agent-v2": Object.freeze([
    "context.read", "requests.read", "document.read", "document.structure.write", "scene.read", "scene.write", "asset.read",
  ]),
  "future-external": Object.freeze([
    "context.read", "requests.read", "document.read", "scene.read", "scene.write", "view.read", "asset.read",
  ]),
  "host-internal": Object.freeze([
    "context.read", "requests.read", "document.read", "document.structure.write", "document.import.parse",
    "scene.read", "scene.write", "scene.destructive-clear", "selection.control", "view.read", "view.control",
    "presentation.control", "io.serialize", "user-mediated-io", "asset.read", "events.read", "host.interaction", "legacy.raw-scene",
  ]),
  legacy: Object.freeze([
    "context.read", "requests.read", "document.read", "document.structure.write", "scene.read", "scene.write", "legacy.raw-scene",
  ]),
} satisfies Record<IdeaSketchSdkCallerProfile, readonly IdeaSketchSdkScope[]>);

const AGENT_TOOL_SCHEMA_DIGESTS = Object.freeze({
  1: "agent-tool-v1:eight-tools",
  2: "agent-tool-v2:semantic",
});

const SDK_LIMITS = Object.freeze({
  mutationRequestsPerSession: 512,
  sceneOperationsPerPlan: 40,
  pageOperationsPerPlan: 20,
  sceneReadPageSize: 100,
  cameraReadPageSize: 100,
  assetReadPageSize: 100,
  maxPlanBytes: 256 * 1024,
  maxCoordinate: 1_000_000,
  maxTextLength: 10_000,
  minFontSize: 6,
  maxFontSize: 256,
  maxDimension: 100_000,
  minLineHeight: 0.5,
  maxLineHeight: 4,
  maxCameraCount: 200,
  minCameraWidth: 16,
  minCameraHeight: 16,
});

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

const SCENE_MODEL: IdeaSketchSceneModel = deepFreeze({
  elementTypes: {
    rectangle: { read: true, create: true, operations: ["create-shape", "move-element", "resize-element", "set-shape-style", "bind-text", "upsert-bound-text", "delete-element", "arrow-target"] },
    ellipse: { read: true, create: true, operations: ["create-shape", "move-element", "resize-element", "set-shape-style", "bind-text", "upsert-bound-text", "delete-element", "arrow-target"] },
    diamond: { read: true, create: true, operations: ["create-shape", "move-element", "resize-element", "set-shape-style", "bind-text", "upsert-bound-text", "delete-element", "arrow-target"] },
    text: { read: true, create: true, operations: ["create-text", "set-text", "set-text-style", "set-text-layout", "bind-text", "unbind-text", "move-element", "delete-element"] },
    "shape-bound-text": { read: true, create: true, operations: ["upsert-bound-text", "set-text", "set-text-style", "unbind-text", "delete-element"] },
    arrow: { read: true, create: true, operations: ["create-arrow", "bind-arrow", "unbind-arrow", "set-connector-style", "set-arrowheads", "set-connector-points", "delete-element"] },
    camera: { read: true, create: true, operations: ["create-camera", "update-camera-bounds", "set-camera-order", "delete-camera"], preserveOnly: false },
    "imported-arrow-label": { read: true, create: false, operations: ["read", "preserve", "reflow-on-connector", "delete-with-arrow"], preserveOnly: true },
    line: { read: true, create: false, operations: ["read", "preserve"], preserveOnly: true },
    freedraw: { read: true, create: false, operations: ["read", "preserve"], preserveOnly: true },
    image: { read: true, create: false, operations: ["read", "preserve"], preserveOnly: true },
    frame: { read: true, create: false, operations: ["read", "preserve"], preserveOnly: true },
    embeddable: { read: true, create: false, operations: ["read", "preserve"], preserveOnly: true },
  },
  containers: {
    boundText: ["rectangle", "ellipse", "diamond"],
    arrowTargets: ["rectangle", "ellipse", "diamond"],
    maxLiveBoundTextPerContainer: 1,
    boundTextLayout: "container-owned",
  },
  stateMatrix: {
    locked: { read: true, ordinaryMutation: false, destructiveClear: "trusted-ui-with-confirmation" },
    grouped: { read: true, ordinaryMutation: false, stylePreset: true, selectionClosure: true },
    framed: { read: true, ordinaryMutation: false, stylePreset: true, selectionClosure: true },
    importedArrowLabel: { read: true, contentStyleLayoutMutation: false, connectorReflow: true, deleteWithArrow: true },
    camera: { dedicatedOperationsOnly: true, genericElementOperations: false, bindable: false },
  },
  styleFields: {
    shape: ["backgroundColor", "strokeColor", "strokeWidth", "strokeStyle", "fillStyle", "roundness", "opacity", "roughness"],
    connector: ["strokeColor", "strokeWidth", "strokeStyle", "opacity", "roughness"],
    text: ["fontFamily", "fontSize", "color", "textAlign", "verticalAlign", "opacity", "lineHeight"],
  },
  enums: {
    shapes: ["rectangle", "ellipse", "diamond"],
    fonts: ["hand-drawn", "normal", "code"],
    textAlign: ["left", "center", "right"],
    verticalAlign: ["top", "middle", "bottom"],
    strokeStyle: ["solid", "dashed", "dotted"],
    fillStyle: ["solid", "hachure", "cross-hatch"],
    arrowheads: ["arrow", "bar", "dot", "triangle", "circle", "none"],
  },
  defaults: {
    text: { fontFamily: "hand-drawn", fontSize: 20, textAlign: "left", verticalAlign: "top", lineHeight: 1.25, overflowPolicy: "grow-container" },
    shape: { strokeWidth: 1, strokeStyle: "solid", fillStyle: "solid", roughness: 1, opacity: 100 },
    connector: { strokeWidth: 1, strokeStyle: "solid", roughness: 1, opacity: 100, startArrowhead: "none", endArrowhead: "arrow" },
    camera: { angle: 0, strokeColor: "#1e90ff", strokeWidth: 2, strokeStyle: "dashed", opacity: 60, roughness: 0 },
  },
});

function fnv1a(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function freezeMethodMap(map: Record<string, readonly string[]>) {
  for (const methods of Object.values(map)) Object.freeze(methods);
  return Object.freeze(map);
}

function methodIsSupported(
  namespace: string,
  method: string,
  has: (scope: IdeaSketchSdkScope) => boolean,
) {
  if (namespace === "session") return true;
  if (namespace === "context") return method === "getCapabilities" || has("context.read");
  if (namespace === "requests") return has("requests.read");
  if (namespace === "pages") {
    if (method === "list" || method === "select") return has("document.read");
    if (method === "parseExcalidraw") return has("document.import.parse");
    return has("document.structure.write");
  }
  if (namespace === "scene") {
    if (method === "read" || method === "getElements") return has("scene.read");
    if (method === "requestClearConfirmation") return has("scene.destructive-clear");
    return has("scene.write");
  }
  if (namespace === "operations") {
    if (method === "page") return has("document.structure.write");
    if (method === "scene") return has("scene.destructive-clear");
    return has("scene.write");
  }
  if (namespace === "cameras") {
    if (method === "list") return has("scene.read");
    if (method === "select") return has("selection.control");
    return has("scene.write") && has("host.interaction");
  }
  if (namespace === "selection") return has("selection.control");
  if (namespace === "view") return method === "getViewport" ? has("view.read") : has("view.control");
  if (namespace === "transforms") return has("scene.write");
  if (namespace === "presentation") return has("presentation.control");
  if (namespace === "assets") return has("asset.read");
  if (namespace === "io") {
    if (method.startsWith("serialize")) return has("io.serialize");
    return has("user-mediated-io");
  }
  if (namespace === "events") return has("events.read");
  return false;
}

function methodMapForScopes(scopes: readonly IdeaSketchSdkScope[]) {
  const has = (scope: IdeaSketchSdkScope) => scopes.includes(scope);
  const result: Record<string, readonly string[]> = {};
  for (const [namespace, methods] of Object.entries(IDEA_SKETCH_SDK_METHOD_CATALOG)) {
    result[namespace] = methods.filter((method) => methodIsSupported(namespace, method, has));
  }
  return result;
}

const OPERATION_NAMESPACE_KINDS = Object.freeze({
  page: IDEA_SKETCH_PAGE_OPERATION_KINDS,
  element: Object.freeze(["move-element", "resize-element", "delete-element"]),
  shape: Object.freeze(["create-shape", "set-shape-style", "upsert-bound-text"]),
  connector: Object.freeze([
    "create-arrow",
    "bind-arrow",
    "unbind-arrow",
    "set-connector-style",
    "set-arrowheads",
    "set-connector-points",
  ]),
  text: Object.freeze([
    "create-text",
    "bind-text",
    "unbind-text",
    "set-text",
    "set-text-style",
    "set-text-layout",
  ]),
  camera: Object.freeze([
    "create-camera",
    "update-camera-bounds",
    "set-camera-order",
    "delete-camera",
  ]),
  appearance: Object.freeze(["set-background"]),
  transform: Object.freeze(["apply-style-preset"]),
  scene: Object.freeze(["clear-scene"]),
} satisfies Record<string, readonly string[]>);

function operationNamespaceForKind(kind: string) {
  for (const [namespace, kinds] of Object.entries(OPERATION_NAMESPACE_KINDS)) {
    if (kinds.includes(kind)) return namespace;
  }
  return undefined;
}

function restrictOperationMethods(
  methods: Record<string, readonly string[]>,
  operationKinds: readonly string[],
) {
  const supported = new Set(operationKinds);
  methods.operations = (methods.operations ?? []).filter((namespace) => (
    OPERATION_NAMESPACE_KINDS[namespace as keyof typeof OPERATION_NAMESPACE_KINDS]
      ?.some((kind) => supported.has(kind))
  ));
}

function restrictMethodsToAllowlist(
  methods: Record<string, readonly string[]>,
  allowlist: Readonly<Partial<Record<keyof typeof IDEA_SKETCH_SDK_METHOD_CATALOG, readonly string[]>>>,
) {
  for (const namespace of Object.keys(methods)) {
    const allowed = allowlist[namespace as keyof typeof IDEA_SKETCH_SDK_METHOD_CATALOG] ?? [];
    methods[namespace] = methods[namespace]?.filter((method) => allowed.includes(method)) ?? [];
  }
}

export function createCapabilityProjection(
  callerProfile: IdeaSketchSdkCallerProfile,
  availability: IdeaSketchSdkServiceAvailability,
  agentToolProtocolVersion?: SdkProtocolVersion,
  grantedScopes?: readonly IdeaSketchSdkScope[],
  options: {
    toolSchemaDigest?: string;
    documentFormatVersion?: string;
  } = {},
): IdeaSketchSdkCapabilities {
  const profileScopes = PROFILE_SCOPES[callerProfile];
  const effectiveGrants = callerProfile === "future-external"
    ? grantedScopes ?? []
    : grantedScopes;
  const scopes = profileScopes
    .filter((scope) => !effectiveGrants || effectiveGrants.includes(scope))
    .sort();
  const profilePageOperationKinds = callerProfile === "agent-v1" || callerProfile === "legacy"
    ? AGENT_V1_PAGE_OPERATION_KINDS
    : callerProfile === "agent-v2"
      ? AGENT_V2_PAGE_OPERATION_KINDS
      : IDEA_SKETCH_PAGE_OPERATION_KINDS;
  const profileSceneOperationKinds = callerProfile === "agent-v1" || callerProfile === "legacy"
    ? AGENT_V1_SCENE_OPERATION_KINDS
    : callerProfile === "agent-v2"
      ? AGENT_V2_SCENE_OPERATION_KINDS
      : IDEA_SKETCH_SCENE_OPERATION_KINDS;
  const supportedOperationKinds = [
    ...(scopes.includes("document.structure.write") ? profilePageOperationKinds : []),
    ...(scopes.includes("scene.write")
      ? profileSceneOperationKinds.filter((kind) => (
          kind !== "clear-scene" || scopes.includes("scene.destructive-clear")
        ))
      : []),
  ];
  const supportedMethods = methodMapForScopes(scopes);
  if (callerProfile === "agent-v1" || callerProfile === "agent-v2" || callerProfile === "legacy") {
    restrictMethodsToAllowlist(supportedMethods, AGENT_METHOD_ALLOWLIST);
  }
  restrictOperationMethods(supportedMethods, supportedOperationKinds);
  const operationNamespaces = availability.methods?.operations;
  const operationServiceAvailable = availability.operations === true || operationNamespaces !== undefined;
  const pageMethods = availability.methods?.pages;
  const pageApplyAvailable = Boolean(availability.pages && (!pageMethods || pageMethods.includes("applyPlan")));
  const sceneServiceAvailable = Boolean(availability.scene);
  const clearOperationAvailable = !operationNamespaces || operationNamespaces.includes("scene");
  const availableOperationKinds = availability.writable ? [
    ...(availability.pages && pageApplyAvailable
      ? supportedOperationKinds.filter((kind) => IDEA_SKETCH_PAGE_OPERATION_KINDS.includes(kind))
      : []),
    ...(sceneServiceAvailable && operationServiceAvailable
      ? supportedOperationKinds.filter((kind) => {
          if (!IDEA_SKETCH_SCENE_OPERATION_KINDS.includes(kind)) return false;
          const namespace = operationNamespaceForKind(kind);
          if (operationNamespaces && (!namespace || !operationNamespaces.includes(namespace))) return false;
          return kind !== "clear-scene" || clearOperationAvailable;
        })
      : []),
  ] : [];
  const availableMethods: Record<string, readonly string[]> = {};
  const availableOperationMethods = new Set(availableOperationKinds);
  for (const [namespace, methods] of Object.entries(supportedMethods)) {
    const explicitlyAvailable = availability.methods?.[namespace as keyof typeof IDEA_SKETCH_SDK_METHOD_CATALOG];
    const namespaceAvailable = availability[namespace as keyof typeof IDEA_SKETCH_SDK_METHOD_CATALOG]
      || namespace === "session" || namespace === "context" || namespace === "requests";
    let available = namespaceAvailable ? [...methods] : [];
    if (explicitlyAvailable) {
      available = available.filter((method) => explicitlyAvailable.includes(method));
    }
    if (namespace === "operations") {
      available = available.filter((method) => (
        OPERATION_NAMESPACE_KINDS[method as keyof typeof OPERATION_NAMESPACE_KINDS]
          ?.some((kind) => availableOperationMethods.has(kind)) ?? false
      ));
    }
    if (availability.writable === false) {
      const readOnlyMethods: Record<string, readonly string[]> = {
        scene: ["read", "getElements"],
        pages: ["list", "select", "parseExcalidraw"],
        cameras: ["list", "select"],
        transforms: [],
      };
      if (Object.prototype.hasOwnProperty.call(readOnlyMethods, namespace)) {
        available = available.filter((method) => readOnlyMethods[namespace].includes(method));
      }
    }
    availableMethods[namespace] = available;
  }
  const documentFormatVersion = options.documentFormatVersion ?? "1.0";
  const toolSchemaDigest = options.toolSchemaDigest
    ?? (agentToolProtocolVersion
      ? AGENT_TOOL_SCHEMA_DIGESTS[agentToolProtocolVersion.major as 1 | 2]
      : undefined);
  const capabilities: IdeaSketchSdkCapabilities = {
    sdkProtocolVersion: IDEA_SKETCH_SDK_PROTOCOL_VERSION,
    ...(agentToolProtocolVersion ? { agentToolProtocolVersion: Object.freeze({ ...agentToolProtocolVersion }) } : {}),
    ...(toolSchemaDigest ? { toolSchemaDigest } : {}),
    documentFormatVersion,
    callerProfile,
    scopes: Object.freeze(scopes),
    supportedMethods: freezeMethodMap(supportedMethods),
    availableMethods: freezeMethodMap(availableMethods),
    supportedOperationKinds: Object.freeze(supportedOperationKinds),
    availableOperationKinds: Object.freeze(availableOperationKinds),
    limits: SDK_LIMITS,
    sceneModel: SCENE_MODEL,
    schemaDigest: `sdk-v1:${fnv1a(JSON.stringify({
      callerProfile,
      scopes,
      supportedMethods,
      availableMethods,
      supportedOperationKinds,
      availableOperationKinds,
      agentToolProtocolVersion,
      toolSchemaDigest,
      documentFormatVersion,
      operationSchemas: IDEA_SKETCH_OPERATION_SCHEMAS,
      limits: SDK_LIMITS,
      sceneModel: SCENE_MODEL,
    }))}`,
    available: Object.freeze({
      documentUndo: Boolean(availability.documentUndo),
      mountedCanvas: Boolean(availability.mountedCanvas),
      desktop: Boolean(availability.desktop),
      writable: Boolean(availability.writable),
    }),
  };
  return Object.freeze(capabilities);
}

export function negotiateSdkProtocols(input: {
  sdk: SdkProtocolVersion;
  agentTool?: SdkProtocolVersion;
  expectedAgentSchemaDigest?: string;
}): SdkSyncResult<{
  sdk: Readonly<SdkProtocolVersion>;
  agentTool?: Readonly<SdkProtocolVersion>;
  agentSchemaDigest?: string;
}> {
  const isVersion = (version: SdkProtocolVersion) => (
    Number.isInteger(version.major)
    && version.major >= 0
    && Number.isInteger(version.minor)
    && version.minor >= 0
  );
  if (
    !isVersion(input.sdk)
    || input.sdk.major !== IDEA_SKETCH_SDK_PROTOCOL_VERSION.major
    || input.sdk.minor > IDEA_SKETCH_SDK_PROTOCOL_VERSION.minor
  ) {
    return sdkRejected("protocol_mismatch", "The requested IdeaSketch SDK protocol is not supported.");
  }
  if (!input.agentTool) {
    if (input.expectedAgentSchemaDigest) {
      return sdkRejected("invalid_request", "An Agent schema digest requires an Agent Tool protocol version.");
    }
    return sdkSucceeded({ sdk: IDEA_SKETCH_SDK_PROTOCOL_VERSION });
  }
  if (
    !isVersion(input.agentTool)
    || (input.agentTool.major !== 1 && input.agentTool.major !== 2)
    || input.agentTool.minor !== 0
  ) {
    return sdkRejected("protocol_mismatch", "The requested Agent Tool protocol is not supported.");
  }
  const agentSchemaDigest = AGENT_TOOL_SCHEMA_DIGESTS[input.agentTool.major as 1 | 2];
  if (input.expectedAgentSchemaDigest && input.expectedAgentSchemaDigest !== agentSchemaDigest) {
    return sdkRejected("protocol_mismatch", "The Agent Tool schema digest does not match the negotiated protocol.");
  }
  return sdkSucceeded({
    sdk: IDEA_SKETCH_SDK_PROTOCOL_VERSION,
    agentTool: Object.freeze({ ...input.agentTool }),
    agentSchemaDigest,
  });
}
