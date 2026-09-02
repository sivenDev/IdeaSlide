import type { DocumentStatus } from "../../types.ts";

declare const sdkRefBrand: unique symbol;

export type SdkRef<Kind extends string> = string & {
  readonly [sdkRefBrand]: Kind;
};

export type DocumentRef = SdkRef<"document">;
export type PageRef = SdkRef<"page">;
export type ElementRef = SdkRef<"element">;
export type CameraRef = SdkRef<"camera">;
export type AssetRef = SdkRef<"asset">;
export type TempRef = SdkRef<"temp">;
export type SceneSnapshotId = SdkRef<"scene-snapshot">;
export type DocumentSnapshotId = SdkRef<"document-snapshot">;
export type SnapshotCursor = SdkRef<"snapshot-cursor">;
export type ConfirmationReceipt = SdkRef<"confirmation-receipt">;
export type ParsedPageDraftRef = SdkRef<"parsed-page-draft">;
export type ReconciliationToken = SdkRef<"reconciliation-token">;
export type PresentationSessionId = SdkRef<"presentation-session">;
export type CallerSessionId = SdkRef<"caller-session">;

export type IdeaSketchSdkCallerProfile =
  | "trusted-ui"
  | "agent-v1"
  | "agent-v2"
  | "future-external"
  | "host-internal"
  | "legacy";

export type IdeaSketchSdkScope =
  | "context.read"
  | "requests.read"
  | "document.read"
  | "document.structure.write"
  | "document.import.parse"
  | "scene.read"
  | "scene.write"
  | "scene.destructive-clear"
  | "selection.control"
  | "view.read"
  | "view.control"
  | "presentation.control"
  | "io.serialize"
  | "user-mediated-io"
  | "asset.read"
  | "events.read"
  | "host.interaction"
  | "legacy.raw-scene";

export type IdeaSketchSdkErrorCode =
  | "invalid_request"
  | "internal_error"
  | "protocol_mismatch"
  | "unsupported_operation"
  | "capability_denied"
  | "confirmation_required"
  | "editor_unavailable"
  | "desktop_unavailable"
  | "editor_busy"
  | "session_closed"
  | "presentation_session_not_found"
  | "read_only"
  | "snapshot_required"
  | "snapshot_stale"
  | "incomplete_read"
  | "target_not_found"
  | "cross_page_target"
  | "relation_conflict"
  | "locked_target"
  | "limit_exceeded"
  | "import_token_expired"
  | "request_not_found"
  | "idempotency_conflict"
  | "request_ledger_full"
  | "cancelled_before_commit"
  | "external_change"
  | "commit_indeterminate";

export interface IdeaSketchSdkError {
  code: IdeaSketchSdkErrorCode;
  message: string;
  retryable: boolean;
  operationIndex?: number;
  ref?: string;
}

export type SdkSucceeded<T> = { status: "succeeded"; value: T };
export type SdkRejected = { status: "rejected"; error: IdeaSketchSdkError };
export type SdkCancelled = {
  status: "cancelled";
  error: IdeaSketchSdkError & { code: "cancelled_before_commit" };
};
export type SdkIndeterminate = {
  status: "indeterminate";
  error: IdeaSketchSdkError & { code: "commit_indeterminate" };
  reconciliationToken: ReconciliationToken;
};

export type SdkResult<T> = SdkSucceeded<T> | SdkRejected | SdkCancelled | SdkIndeterminate;
export type SdkSyncResult<T> = SdkSucceeded<T> | SdkRejected;

export interface SdkProtocolVersion {
  major: number;
  minor: number;
}

export interface IdeaSketchSdkHistoryResult {
  nativeCanvas: "created" | "none" | "unavailable";
  document: "created" | "none" | "unavailable";
  agentCustom: "not-supported";
}

export interface IdeaSketchSdkMutationResult {
  changeSetId: string;
  requestId: string;
  outcome: "applied" | "noop";
  beforeDigest: string;
  afterDigest: string;
  beforeEditVersion: number;
  afterEditVersion: number;
  createdRefs: Readonly<Record<TempRef, PageRef | IdeaSketchEntityRef>>;
  updatedRefs: readonly IdeaSketchEntityRef[];
  deletedRefs: readonly IdeaSketchEntityRef[];
  cascadedRefs: readonly IdeaSketchEntityRef[];
  operations: readonly unknown[];
  diagnostics: readonly string[];
  history: IdeaSketchSdkHistoryResult;
}

export interface IdeaSketchSdkCapabilities {
  sdkProtocolVersion: Readonly<SdkProtocolVersion>;
  agentToolProtocolVersion?: Readonly<SdkProtocolVersion>;
  toolSchemaDigest?: string;
  documentFormatVersion: string;
  callerProfile: IdeaSketchSdkCallerProfile;
  scopes: readonly IdeaSketchSdkScope[];
  supportedMethods: Readonly<Record<string, readonly string[]>>;
  availableMethods: Readonly<Record<string, readonly string[]>>;
  supportedOperationKinds: readonly string[];
  availableOperationKinds: readonly string[];
  limits: Readonly<{
    mutationRequestsPerSession: number;
    sceneOperationsPerPlan: number;
    pageOperationsPerPlan: number;
  }>;
  schemaDigest: string;
  available: Readonly<{
    documentUndo: boolean;
    mountedCanvas: boolean;
    desktop: boolean;
    writable: boolean;
  }>;
}

export interface IdeaSketchEntityRef {
  pageRef: PageRef;
  ref: ElementRef | CameraRef | AssetRef;
}

export interface IdeaSketchSdkContext {
  documentRef: DocumentRef;
  activePageRef: PageRef;
  documentStatus: DocumentStatus;
  writable: boolean;
  mounted: boolean;
  busy: boolean;
  revision: number;
  pageEditVersion: number;
  sdkProtocolVersion: Readonly<SdkProtocolVersion>;
  agentToolProtocolVersion?: Readonly<SdkProtocolVersion>;
  toolSchemaDigest?: string;
  documentFormatVersion: string;
}

export interface IdeaSketchSdkSessionInfo {
  sessionId: CallerSessionId;
  callerProfile: IdeaSketchSdkCallerProfile;
  sdkProtocolVersion: Readonly<SdkProtocolVersion>;
  agentToolProtocolVersion?: Readonly<SdkProtocolVersion>;
  toolSchemaDigest?: string;
  documentFormatVersion: string;
  lifecycle: "active" | "disposed";
}

export interface IdeaSketchSdkPlanEnvelope {
  requestId: string;
  snapshotId: SceneSnapshotId | DocumentSnapshotId;
  operations: readonly never[];
}

export interface IdeaSketchSdkEventBase {
  sequence: number;
  documentRef: DocumentRef;
}

export interface IdeaSketchContextChangeEvent extends IdeaSketchSdkEventBase {
  type: "context-change";
  activePageRef: PageRef;
}

export interface IdeaSketchDocumentCommittedEvent extends IdeaSketchSdkEventBase {
  type: "document-committed";
  documentVersion: number;
  operationKinds: readonly string[];
  createdPageRefs: readonly PageRef[];
  updatedPageRefs: readonly PageRef[];
  deletedPageRefs: readonly PageRef[];
}

export interface IdeaSketchSceneCommittedEvent extends IdeaSketchSdkEventBase {
  type: "scene-committed";
  pageRef: PageRef;
  sceneEditVersion: number;
  origin: "sdk" | "native";
  operationKinds: readonly string[];
  affectedRefs: readonly (ElementRef | CameraRef)[];
  truncated: boolean;
}

export interface IdeaSketchSelectionChangeEvent extends IdeaSketchSdkEventBase {
  type: "selection-change";
  pageRef: PageRef;
  selectionVersion: number;
  refs: readonly (ElementRef | CameraRef)[];
}

export interface IdeaSketchAvailabilityChangeEvent extends IdeaSketchSdkEventBase {
  type: "availability-change";
  mounted: boolean;
  writable: boolean;
  busy: boolean;
  desktop: boolean;
}

export interface IdeaSketchPresentationStateChangeEvent extends IdeaSketchSdkEventBase {
  type: "presentation-state-change";
  state: "running" | "stopped";
  mode?: "preview" | "fullscreen";
  pageRef?: PageRef;
  presentationSessionId?: PresentationSessionId;
  activeCameraRef?: CameraRef;
  cameraIndex?: number;
  cameraCount?: number;
}

export type IdeaSketchSdkEvent =
  | IdeaSketchContextChangeEvent
  | IdeaSketchDocumentCommittedEvent
  | IdeaSketchSceneCommittedEvent
  | IdeaSketchSelectionChangeEvent
  | IdeaSketchAvailabilityChangeEvent
  | IdeaSketchPresentationStateChangeEvent;

export type IdeaSketchSdkUnsubscribe = () => void;
export type IdeaSketchSdkEventHandler<Event extends IdeaSketchSdkEvent> = (event: Event) => void;

export interface IdeaSketchSessionNamespace {
  getInfo(): Promise<SdkResult<IdeaSketchSdkSessionInfo>>;
  dispose(): Promise<SdkResult<{ outcome: "disposed" | "noop" }>>;
}

export interface IdeaSketchContextNamespace {
  get(): Promise<SdkResult<IdeaSketchSdkContext>>;
  getCapabilities(): Promise<SdkResult<IdeaSketchSdkCapabilities>>;
}

export interface IdeaSketchRequestsNamespace {
  getMutationResult(requestId: string): Promise<SdkResult<IdeaSketchSdkMutationResult>>;
  reconcile(reconciliationToken: ReconciliationToken): Promise<SdkResult<IdeaSketchSdkMutationResult>>;
}

export interface IdeaSketchPagesNamespace {
  list(input?: unknown): Promise<SdkResult<unknown>>;
  select(input: unknown): Promise<SdkResult<unknown>>;
  parseExcalidraw(input: unknown): Promise<SdkResult<ParsedPageDraftRef>>;
  validatePlan(input: unknown): Promise<SdkResult<unknown>>;
  applyPlan(input: unknown): Promise<SdkResult<IdeaSketchSdkMutationResult>>;
}

export interface IdeaSketchSceneNamespace {
  read(input?: unknown): Promise<SdkResult<unknown>>;
  getElements(input: unknown): Promise<SdkResult<unknown>>;
  requestClearConfirmation(input: unknown): Promise<SdkResult<ConfirmationReceipt>>;
  validatePlan(input: unknown): Promise<SdkResult<unknown>>;
  applyPlan(input: unknown): Promise<SdkResult<IdeaSketchSdkMutationResult>>;
}

export type IdeaSketchOperationBuilder = (input: unknown) => SdkSyncResult<never>;

export interface IdeaSketchOperationsNamespace {
  page: {
    add: IdeaSketchOperationBuilder;
    import: IdeaSketchOperationBuilder;
    duplicate: IdeaSketchOperationBuilder;
    rename: IdeaSketchOperationBuilder;
    reorder: IdeaSketchOperationBuilder;
    delete: IdeaSketchOperationBuilder;
    createFromSelection: IdeaSketchOperationBuilder;
  };
  element: { move: IdeaSketchOperationBuilder; resize: IdeaSketchOperationBuilder; delete: IdeaSketchOperationBuilder };
  shape: { create: IdeaSketchOperationBuilder; setStyle: IdeaSketchOperationBuilder; upsertBoundText: IdeaSketchOperationBuilder };
  connector: {
    create: IdeaSketchOperationBuilder;
    bind: IdeaSketchOperationBuilder;
    unbind: IdeaSketchOperationBuilder;
    setStyle: IdeaSketchOperationBuilder;
    setArrowheads: IdeaSketchOperationBuilder;
    setPoints: IdeaSketchOperationBuilder;
  };
  text: {
    create: IdeaSketchOperationBuilder;
    bind: IdeaSketchOperationBuilder;
    unbind: IdeaSketchOperationBuilder;
    setContent: IdeaSketchOperationBuilder;
    setStyle: IdeaSketchOperationBuilder;
    setLayout: IdeaSketchOperationBuilder;
  };
  camera: {
    create: IdeaSketchOperationBuilder;
    updateBounds: IdeaSketchOperationBuilder;
    reorder: IdeaSketchOperationBuilder;
    delete: IdeaSketchOperationBuilder;
  };
  appearance: { setBackground: IdeaSketchOperationBuilder };
  transform: { applyStylePreset: IdeaSketchOperationBuilder };
  scene: { clear: IdeaSketchOperationBuilder };
}

export interface IdeaSketchCamerasNamespace {
  list(input: unknown): Promise<SdkResult<unknown>>;
  select(input: unknown): Promise<SdkResult<unknown>>;
  beginCreate(input: unknown): Promise<SdkResult<IdeaSketchSdkMutationResult>>;
}

export interface IdeaSketchSelectionNamespace {
  get(input: unknown): Promise<SdkResult<unknown>>;
  set(input: unknown): Promise<SdkResult<unknown>>;
  clear(input: unknown): Promise<SdkResult<unknown>>;
}

export interface IdeaSketchViewNamespace {
  getViewport(input: unknown): Promise<SdkResult<unknown>>;
  focusElements(input: unknown): Promise<SdkResult<unknown>>;
}

export interface IdeaSketchTransformsNamespace {
  convertSelectionStyle(input: unknown): Promise<SdkResult<IdeaSketchSdkMutationResult>>;
}

export interface IdeaSketchPresentationNamespace {
  getState(input?: unknown): Promise<SdkResult<unknown>>;
  start(input: unknown): Promise<SdkResult<unknown>>;
  stop(input: unknown): Promise<SdkResult<unknown>>;
  next(input: unknown): Promise<SdkResult<unknown>>;
  previous(input: unknown): Promise<SdkResult<unknown>>;
  goToCamera(input: unknown): Promise<SdkResult<unknown>>;
}

export interface IdeaSketchAssetsNamespace {
  listMetadata(input: unknown): Promise<SdkResult<unknown>>;
}

export interface IdeaSketchIoNamespace {
  serializeActivePageAsExcalidraw(): Promise<SdkResult<unknown>>;
  serializeActivePageAsIdeaSketch(): Promise<SdkResult<unknown>>;
  serializeActivePageAsDrawio(): Promise<SdkResult<unknown>>;
  exportActivePageAsExcalidraw(): Promise<SdkResult<unknown>>;
  exportActivePageAsIdeaSketch(): Promise<SdkResult<unknown>>;
  exportActivePageAsDrawio(): Promise<SdkResult<unknown>>;
  openImageExportDialog(): Promise<SdkResult<unknown>>;
  pickExcalidrawAndAddPage(input: unknown): Promise<SdkResult<IdeaSketchSdkMutationResult>>;
}

export interface IdeaSketchEventsNamespace {
  onContextChange(handler: IdeaSketchSdkEventHandler<IdeaSketchContextChangeEvent>): SdkSyncResult<IdeaSketchSdkUnsubscribe>;
  onDocumentCommitted(handler: IdeaSketchSdkEventHandler<IdeaSketchDocumentCommittedEvent>): SdkSyncResult<IdeaSketchSdkUnsubscribe>;
  onSceneCommitted(handler: IdeaSketchSdkEventHandler<IdeaSketchSceneCommittedEvent>): SdkSyncResult<IdeaSketchSdkUnsubscribe>;
  onSelectionChange(handler: IdeaSketchSdkEventHandler<IdeaSketchSelectionChangeEvent>): SdkSyncResult<IdeaSketchSdkUnsubscribe>;
  onAvailabilityChange(handler: IdeaSketchSdkEventHandler<IdeaSketchAvailabilityChangeEvent>): SdkSyncResult<IdeaSketchSdkUnsubscribe>;
  onPresentationStateChange(handler: IdeaSketchSdkEventHandler<IdeaSketchPresentationStateChangeEvent>): SdkSyncResult<IdeaSketchSdkUnsubscribe>;
}

export interface IdeaSketchSdk {
  session: IdeaSketchSessionNamespace;
  context: IdeaSketchContextNamespace;
  requests: IdeaSketchRequestsNamespace;
  pages: IdeaSketchPagesNamespace;
  scene: IdeaSketchSceneNamespace;
  operations: IdeaSketchOperationsNamespace;
  cameras: IdeaSketchCamerasNamespace;
  selection: IdeaSketchSelectionNamespace;
  view: IdeaSketchViewNamespace;
  transforms: IdeaSketchTransformsNamespace;
  presentation: IdeaSketchPresentationNamespace;
  assets: IdeaSketchAssetsNamespace;
  io: IdeaSketchIoNamespace;
  events: IdeaSketchEventsNamespace;
}

export interface IdeaSketchSdkSessionFactory {
  createSession(input: {
    sdkProtocolVersion: SdkProtocolVersion;
    agentToolProtocolVersion?: SdkProtocolVersion;
    expectedAgentSchemaDigest?: string;
    requiredCapabilities?: readonly IdeaSketchSdkScope[];
  }): Promise<SdkResult<IdeaSketchSdk>>;
}

export function sdkSucceeded<T>(value: T): SdkSucceeded<T> {
  return { status: "succeeded", value };
}

export function sdkRejected(
  code: IdeaSketchSdkErrorCode,
  message: string,
  retryable = false,
): SdkRejected {
  return { status: "rejected", error: { code, message, retryable } };
}

export function sdkCancelled(message = "The request was cancelled before commit."): SdkCancelled {
  return {
    status: "cancelled",
    error: { code: "cancelled_before_commit", message, retryable: true },
  };
}
