import type { DocumentStatus } from "../../types.ts";
import type { IdeaSketchOperationKind } from "./operationSchemas.ts";
import type { IdeaSketchSceneRead as SemanticSceneRead, IdeaSketchSemanticElement } from "./sceneProjection.ts";

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

export type IdeaSketchShapeType = "rectangle" | "ellipse" | "diamond";
export type IdeaSketchArrowhead = "arrow" | "bar" | "dot" | "triangle" | "circle" | "none";
export type IdeaSketchTextFontFamily = "hand-drawn" | "normal" | "code";
export type IdeaSketchTextAlign = "left" | "center" | "right";
export type IdeaSketchVerticalAlign = "top" | "middle" | "bottom";
export type IdeaSketchStrokeStyle = "solid" | "dashed" | "dotted";
export type IdeaSketchFillStyle = "solid" | "hachure" | "cross-hatch";

export interface IdeaSketchBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IdeaSketchShapeStyle {
  backgroundColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: IdeaSketchStrokeStyle;
  fillStyle?: IdeaSketchFillStyle;
  roundness?: "sharp" | "rounded";
  opacity?: number;
  roughness?: 0 | 1 | 2;
}

export type IdeaSketchConnectorStyle = Pick<IdeaSketchShapeStyle, "strokeColor" | "strokeWidth" | "strokeStyle" | "opacity" | "roughness">;

export interface IdeaSketchTextStyle {
  fontFamily?: IdeaSketchTextFontFamily;
  fontSize?: number;
  color?: string;
  textAlign?: IdeaSketchTextAlign;
  verticalAlign?: IdeaSketchVerticalAlign;
  opacity?: number;
  lineHeight?: number;
}

export interface IdeaSketchTextLayout {
  autoResize?: boolean;
  width?: number;
  overflowPolicy?: "grow-container";
}

/**
 * Layout fields that are valid for shape-owned text.  Container geometry owns
 * wrapping and width, so callers may only select the overflow policy here.
 */
export interface IdeaSketchBoundTextLayout {
  overflowPolicy?: "grow-container";
}

/**
 * Text content accepted by the semantic operation contract. `text` is kept as
 * a compatibility alias for callers of the early draft API, but a payload
 * must carry exactly one canonical content field at the type level.
 */
export type IdeaSketchTextContent =
  | { text: string; originalText?: never }
  | { text?: never; originalText: string };

export type IdeaSketchOptionalTextContent =
  | { text?: never; originalText?: never }
  | IdeaSketchTextContent;

export type IdeaSketchArrowEndpointPatch<Endpoint extends "start" | "end"> = {
  endpoint: Endpoint;
  targetRef: ElementRef | TempRef;
};

export interface IdeaSketchCreateShapeOperation {
  kind: "create-shape";
  version: 1;
  ref: TempRef;
  shape: IdeaSketchShapeType;
  bounds: IdeaSketchBounds;
  style?: IdeaSketchShapeStyle;
  boundText?: {
    ref: TempRef;
    style?: IdeaSketchTextStyle;
    layout?: IdeaSketchBoundTextLayout;
  } & IdeaSketchOptionalTextContent;
}

export interface IdeaSketchCreateArrowOperation {
  kind: "create-arrow";
  version: 1;
  ref: TempRef;
  points: readonly [number, number][];
  style?: IdeaSketchConnectorStyle;
  arrowheads?: { start?: IdeaSketchArrowhead; end?: IdeaSketchArrowhead };
}

export type IdeaSketchCreateTextOperation = {
  kind: "create-text";
  version: 1;
  ref: TempRef;
  x: number;
  y: number;
  style?: IdeaSketchTextStyle;
  layout?: IdeaSketchTextLayout;
} & IdeaSketchTextContent;

export interface IdeaSketchCreateCameraOperation {
  kind: "create-camera";
  version: 1;
  ref: TempRef;
  bounds: IdeaSketchBounds;
  atIndex?: number;
}

export interface IdeaSketchBindArrowOperation {
  kind: "bind-arrow";
  version: 1;
  arrowRef: ElementRef | TempRef;
  start?: IdeaSketchArrowEndpointPatch<"start">;
  end?: IdeaSketchArrowEndpointPatch<"end">;
}

export interface IdeaSketchUnbindArrowOperation {
  kind: "unbind-arrow";
  version: 1;
  arrowRef: ElementRef | TempRef;
  endpoint: "start" | "end" | "both";
}

export interface IdeaSketchBindTextOperation {
  kind: "bind-text";
  version: 1;
  textRef: ElementRef | TempRef;
  containerRef: ElementRef | TempRef;
}

export interface IdeaSketchUnbindTextOperation {
  kind: "unbind-text";
  version: 1;
  textRef?: ElementRef | TempRef;
  containerRef?: ElementRef | TempRef;
}

export type IdeaSketchUpsertBoundTextOperation = {
  kind: "upsert-bound-text";
  version: 1;
  shapeRef: ElementRef | TempRef;
  createRef?: TempRef;
  style?: IdeaSketchTextStyle;
  layout?: IdeaSketchBoundTextLayout;
} & IdeaSketchTextContent;

export type IdeaSketchSetTextOperation = {
  kind: "set-text";
  version: 1;
  textRef: ElementRef | TempRef;
} & IdeaSketchTextContent;

type IdeaSketchTextStyleFields = {
  fontFamily?: IdeaSketchTextFontFamily;
  fontSize?: number;
  color?: string;
  textAlign?: IdeaSketchTextAlign;
  verticalAlign?: IdeaSketchVerticalAlign;
  opacity?: number;
  lineHeight?: number;
};

type IdeaSketchAtLeastOne<T extends Record<string, unknown>> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<Omit<T, K>>
}[keyof T];

export type IdeaSketchSetTextStyleOperation = {
  kind: "set-text-style";
  version: 1;
  textRef: ElementRef | TempRef;
} & (
  | { style: IdeaSketchTextStyle; } & { [K in keyof IdeaSketchTextStyleFields]?: never }
  | { style?: never; } & IdeaSketchAtLeastOne<IdeaSketchTextStyleFields>
);

export type IdeaSketchSetTextLayoutOperation = {
  kind: "set-text-layout";
  version: 1;
  textRef: ElementRef | TempRef;
} & (
  | { layout: IdeaSketchTextLayout; autoResize?: never; width?: never }
  | { layout?: never; } & IdeaSketchAtLeastOne<{ autoResize?: boolean; width?: number }>
);

export interface IdeaSketchSetShapeStyleOperation {
  kind: "set-shape-style";
  version: 1;
  shapeRef: ElementRef | TempRef;
  style: IdeaSketchShapeStyle;
}

export interface IdeaSketchSetConnectorStyleOperation {
  kind: "set-connector-style";
  version: 1;
  arrowRef: ElementRef | TempRef;
  style: IdeaSketchConnectorStyle;
}

export interface IdeaSketchSetArrowheadsOperation {
  kind: "set-arrowheads";
  version: 1;
  arrowRef: ElementRef | TempRef;
  start?: IdeaSketchArrowhead;
  end?: IdeaSketchArrowhead;
}

export interface IdeaSketchMoveElementOperation {
  kind: "move-element";
  version: 1;
  elementRef: ElementRef | TempRef;
  dx: number;
  dy: number;
}

export interface IdeaSketchResizeElementOperation {
  kind: "resize-element";
  version: 1;
  elementRef: ElementRef | TempRef;
  width: number;
  height: number;
  anchor?: "top-left";
  keepAspect?: boolean;
}

export interface IdeaSketchSetConnectorPointsOperation {
  kind: "set-connector-points";
  version: 1;
  arrowRef: ElementRef | TempRef;
  points: readonly [number, number][];
}

export interface IdeaSketchUpdateCameraBoundsOperation {
  kind: "update-camera-bounds";
  version: 1;
  cameraRef: CameraRef | TempRef;
  bounds: IdeaSketchBounds;
}

export interface IdeaSketchSetCameraOrderOperation {
  kind: "set-camera-order";
  version: 1;
  cameraRefs: readonly (CameraRef | TempRef)[];
}

export interface IdeaSketchDeleteElementOperation {
  kind: "delete-element";
  version: 1;
  elementRef: ElementRef | TempRef;
}

export interface IdeaSketchDeleteCameraOperation {
  kind: "delete-camera";
  version: 1;
  cameraRef: CameraRef | TempRef;
}

export interface IdeaSketchSetBackgroundOperation {
  kind: "set-background";
  version: 1;
  color: string;
}

export interface IdeaSketchApplyStylePresetOperation {
  kind: "apply-style-preset";
  version: 1;
  selectedRefs: readonly (ElementRef | TempRef)[];
  preset: "formal";
}

export interface IdeaSketchClearSceneOperation {
  kind: "clear-scene";
  version: 1;
  scope: "content-only" | "all-elements";
  confirmationReceipt: ConfirmationReceipt;
}

export type IdeaSketchPageOperation =
  | { kind: "add-page"; version: 1; ref: TempRef; title?: string; initialScene?: { operations: readonly IdeaSketchOperation[] } }
  | { kind: "import-page"; version: 1; ref: TempRef; title?: string; parsedPageDraftRef: ParsedPageDraftRef }
  | { kind: "duplicate-page"; version: 1; ref: TempRef; sourcePageRef: PageRef; title?: string }
  | { kind: "rename-page"; version: 1; pageRef: PageRef | TempRef; title: string }
  | { kind: "reorder-page"; version: 1; pageRef: PageRef | TempRef; toIndex: number }
  | { kind: "delete-page"; version: 1; pageRef: PageRef | TempRef }
  | { kind: "create-page-from-selection"; version: 1; ref: TempRef; sourcePageRef: PageRef; selectedRefs: readonly ElementRef[]; preset: "formal" };

export type IdeaSketchOperation =
  | IdeaSketchPageOperation
  | IdeaSketchCreateShapeOperation
  | IdeaSketchCreateArrowOperation
  | IdeaSketchCreateTextOperation
  | IdeaSketchCreateCameraOperation
  | IdeaSketchBindArrowOperation
  | IdeaSketchUnbindArrowOperation
  | IdeaSketchBindTextOperation
  | IdeaSketchUnbindTextOperation
  | IdeaSketchUpsertBoundTextOperation
  | IdeaSketchSetTextOperation
  | IdeaSketchSetTextStyleOperation
  | IdeaSketchSetTextLayoutOperation
  | IdeaSketchSetShapeStyleOperation
  | IdeaSketchSetConnectorStyleOperation
  | IdeaSketchSetArrowheadsOperation
  | IdeaSketchMoveElementOperation
  | IdeaSketchResizeElementOperation
  | IdeaSketchSetConnectorPointsOperation
  | IdeaSketchUpdateCameraBoundsOperation
  | IdeaSketchSetCameraOrderOperation
  | IdeaSketchDeleteElementOperation
  | IdeaSketchDeleteCameraOperation
  | IdeaSketchSetBackgroundOperation
  | IdeaSketchApplyStylePresetOperation
  | IdeaSketchClearSceneOperation;

/**
 * Type-level view of the payload accepted by one operation builder.  The
 * runtime still validates untrusted JavaScript values, while TypeScript
 * callers get the exact fields for the selected operation kind.
 */
export type IdeaSketchOperationInput<Kind extends IdeaSketchOperationKind> =
  Omit<Extract<IdeaSketchOperation, { kind: Kind }>, "kind" | "version">;

export type IdeaSketchOperationOf<Kind extends IdeaSketchOperationKind> =
  Extract<IdeaSketchOperation, { kind: Kind }>;

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

export type IdeaSketchOperationOutcome = "created" | "updated" | "deleted" | "noop";

/**
 * Machine-readable consequences for one semantic operation. The aggregate
 * mutation result still carries the complete page-qualified sets; these
 * optional fields let clients understand relation/layout cascades without
 * diffing raw Excalidraw elements.
 */
export interface IdeaSketchOperationResultBase {
  index: number;
  kind: Exclude<IdeaSketchOperationKind, "upsert-bound-text">;
  outcome: IdeaSketchOperationOutcome;
  affectedRefs?: readonly (ElementRef | CameraRef)[];
  updatedRefs?: readonly (ElementRef | CameraRef)[];
  deletedRefs?: readonly (ElementRef | CameraRef)[];
  cascadedRefs?: readonly (ElementRef | CameraRef)[];
  bounds?: IdeaSketchBounds;
}

export interface IdeaSketchUpsertBoundTextOperationResult {
  index: number;
  kind: "upsert-bound-text";
  outcome: "created" | "updated" | "noop";
  /** Final stable text ref, including when the operation updates an existing text. */
  textRef: ElementRef;
  affectedRefs?: readonly (ElementRef | CameraRef)[];
  updatedRefs?: readonly (ElementRef | CameraRef)[];
  deletedRefs?: readonly (ElementRef | CameraRef)[];
  cascadedRefs?: readonly (ElementRef | CameraRef)[];
  bounds?: IdeaSketchBounds;
}

export type IdeaSketchOperationResult =
  | IdeaSketchOperationResultBase
  | IdeaSketchUpsertBoundTextOperationResult;

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
  operations: readonly IdeaSketchOperationResult[];
  diagnostics: readonly string[];
  history: IdeaSketchSdkHistoryResult;
  /** Page refs affected by a document-structure transaction. */
  createdPageRefs?: readonly PageRef[];
  updatedPageRefs?: readonly PageRef[];
  deletedPageRefs?: readonly PageRef[];
}

/** Public, typed scene-service payloads.  Native Excalidraw element objects
 * remain intentionally private to the host adapter. */
export interface IdeaSketchSceneReadOptions {
  pageRef?: PageRef;
  snapshotId?: SceneSnapshotId;
  cursor?: SnapshotCursor;
  limit?: number;
  includeDeleted?: boolean;
}

export type IdeaSketchSceneReadResult = SemanticSceneRead;

export interface IdeaSketchSceneElementReadOptions {
  snapshotId: SceneSnapshotId;
  refs: readonly (ElementRef | CameraRef)[];
  includeDeleted?: boolean;
}

export interface IdeaSketchScenePlanValidationResult {
  valid: true;
  snapshotId: SceneSnapshotId;
  operationResults: readonly IdeaSketchOperationResult[];
  createdRefs: Readonly<Record<TempRef, ElementRef | CameraRef>>;
  updatedRefs: readonly (ElementRef | CameraRef)[];
  deletedRefs: readonly (ElementRef | CameraRef)[];
  cascadedRefs: readonly (ElementRef | CameraRef)[];
  diagnostics: readonly string[];
}

export interface IdeaSketchSceneApplyPlanInput {
  requestId: string;
  snapshotId: SceneSnapshotId;
  operations: readonly IdeaSketchOperation[];
  requiredCapabilities?: readonly IdeaSketchSdkScope[];
  signal?: AbortSignal;
}

/** Page/document transaction envelope. Page structure work is implemented by
 * F073-03 and intentionally has a distinct document snapshot receipt. */
export interface IdeaSketchPageApplyPlanInput {
  requestId: string;
  documentSnapshotId: DocumentSnapshotId;
  operations: readonly IdeaSketchPageOperation[];
  sceneSnapshotId?: SceneSnapshotId;
  signal?: AbortSignal;
}

export interface IdeaSketchPageSummary {
  pageRef: PageRef;
  index: number;
  title: string;
  elementCount: number;
  cameraCount: number;
}

export interface IdeaSketchPageListOptions {
  cursor?: SnapshotCursor;
  limit?: number;
}

export interface IdeaSketchPageListResult {
  documentSnapshotId: DocumentSnapshotId;
  pages: readonly IdeaSketchPageSummary[];
  complete: boolean;
  nextCursor?: SnapshotCursor;
  coverage: {
    identityRefs: readonly PageRef[];
  };
}

export interface IdeaSketchPagePlanValidationResult {
  valid: true;
  documentSnapshotId: DocumentSnapshotId;
  sceneSnapshotId?: SceneSnapshotId;
  operationKinds: readonly IdeaSketchPageOperation["kind"][];
  diagnostics: readonly string[];
}

export interface IdeaSketchClearConfirmationInput {
  snapshotId: SceneSnapshotId;
  scope: "content-only" | "all-elements";
}

export interface IdeaSketchCameraListOptions {
  snapshotId: SceneSnapshotId;
  cursor?: SnapshotCursor;
  limit?: number;
}

export interface IdeaSketchCameraListResult {
  snapshotId: SceneSnapshotId;
  pageRef: PageRef;
  cameras: readonly IdeaSketchSemanticElement[];
  complete: boolean;
  nextCursor?: SnapshotCursor;
  coverage: IdeaSketchSceneCoverage;
}

export interface IdeaSketchAssetMetadata {
  ref: AssetRef;
  mimeType?: string;
  byteLength?: number;
  width?: number;
  height?: number;
  name?: string;
  referencedBy: readonly { pageRef: PageRef; elementRef: ElementRef }[];
}

export interface IdeaSketchAssetMetadataListOptions {
  snapshotId: SceneSnapshotId;
  cursor?: SnapshotCursor;
  limit?: number;
}

export interface IdeaSketchAssetMetadataListResult {
  snapshotId: SceneSnapshotId;
  pageRef: PageRef;
  assets: readonly IdeaSketchAssetMetadata[];
  complete: boolean;
  nextCursor?: SnapshotCursor;
  coverage: IdeaSketchAssetCoverage;
}

export interface IdeaSketchSceneCoverage {
  identityRefs: readonly (ElementRef | CameraRef)[];
  mutationReadyRefs: readonly (ElementRef | CameraRef)[];
}

export interface IdeaSketchAssetCoverage {
  identityRefs: readonly AssetRef[];
  mutationReadyRefs: readonly AssetRef[];
}

/**
 * Self-describing v1 scene matrix.  It intentionally describes semantic
 * support and fail-closed boundaries without exposing native Excalidraw
 * element payloads or implementation-only fields.
 */
export interface IdeaSketchSceneModel {
  elementTypes: Readonly<Record<string, Readonly<{
    read: boolean;
    create: boolean;
    operations: readonly string[];
    preserveOnly?: boolean;
  }>>>;
  containers: Readonly<{
    boundText: readonly string[];
    arrowTargets: readonly string[];
    maxLiveBoundTextPerContainer: number;
    boundTextLayout: "container-owned";
  }>;
  stateMatrix: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  styleFields: Readonly<Record<string, readonly string[]>>;
  enums: Readonly<Record<string, readonly string[]>>;
  defaults: Readonly<Record<string, unknown>>;
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
    sceneReadPageSize: number;
    cameraReadPageSize: number;
    assetReadPageSize: number;
    maxPlanBytes: number;
    maxCoordinate: number;
    maxTextLength: number;
    minFontSize: number;
    maxFontSize: number;
    maxDimension: number;
    minLineHeight: number;
    maxLineHeight: number;
    maxCameraCount: number;
    minCameraWidth: number;
    minCameraHeight: number;
    maxImportElements: number;
    maxImportBytes: number;
    maxImportFileBytes: number;
    maxImportTotalFileBytes: number;
  }>;
  sceneModel: IdeaSketchSceneModel;
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
  ref: PageRef | ElementRef | CameraRef | AssetRef;
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
  operations: readonly IdeaSketchOperation[];
  /** Additional caller-declared prerequisites; never escalates authority. */
  requiredCapabilities?: readonly IdeaSketchSdkScope[];
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
  list(input?: IdeaSketchPageListOptions): Promise<SdkResult<IdeaSketchPageListResult>>;
  select(input: unknown): Promise<SdkResult<{ pageRef: PageRef; active: true | false }>>;
  parseExcalidraw(input: unknown): Promise<SdkResult<ParsedPageDraftRef>>;
  validatePlan(input: unknown): Promise<SdkResult<IdeaSketchPagePlanValidationResult>>;
  applyPlan(input: IdeaSketchPageApplyPlanInput): Promise<SdkResult<IdeaSketchSdkMutationResult>>;
}

export interface IdeaSketchSceneNamespace {
  read(input?: IdeaSketchSceneReadOptions): Promise<SdkResult<IdeaSketchSceneReadResult>>;
  getElements(input: IdeaSketchSceneElementReadOptions): Promise<SdkResult<IdeaSketchSceneReadResult>>;
  requestClearConfirmation(input: IdeaSketchClearConfirmationInput): Promise<SdkResult<ConfirmationReceipt>>;
  validatePlan(input: { snapshotId: SceneSnapshotId; operations: readonly IdeaSketchOperation[] }): Promise<SdkResult<IdeaSketchScenePlanValidationResult>>;
  applyPlan(input: IdeaSketchSceneApplyPlanInput): Promise<SdkResult<IdeaSketchSdkMutationResult>>;
}

export type IdeaSketchOperationBuilder<Kind extends IdeaSketchOperationKind> = (
  input: IdeaSketchOperationInput<Kind>,
) => SdkSyncResult<IdeaSketchOperationOf<Kind>>;

export interface IdeaSketchOperationsNamespace {
  page: {
    add: IdeaSketchOperationBuilder<"add-page">;
    import: IdeaSketchOperationBuilder<"import-page">;
    duplicate: IdeaSketchOperationBuilder<"duplicate-page">;
    rename: IdeaSketchOperationBuilder<"rename-page">;
    reorder: IdeaSketchOperationBuilder<"reorder-page">;
    delete: IdeaSketchOperationBuilder<"delete-page">;
    createFromSelection: IdeaSketchOperationBuilder<"create-page-from-selection">;
  };
  element: {
    move: IdeaSketchOperationBuilder<"move-element">;
    resize: IdeaSketchOperationBuilder<"resize-element">;
    delete: IdeaSketchOperationBuilder<"delete-element">;
  };
  shape: {
    create: IdeaSketchOperationBuilder<"create-shape">;
    setStyle: IdeaSketchOperationBuilder<"set-shape-style">;
    upsertBoundText: IdeaSketchOperationBuilder<"upsert-bound-text">;
  };
  connector: {
    create: IdeaSketchOperationBuilder<"create-arrow">;
    bind: IdeaSketchOperationBuilder<"bind-arrow">;
    unbind: IdeaSketchOperationBuilder<"unbind-arrow">;
    setStyle: IdeaSketchOperationBuilder<"set-connector-style">;
    setArrowheads: IdeaSketchOperationBuilder<"set-arrowheads">;
    setPoints: IdeaSketchOperationBuilder<"set-connector-points">;
  };
  text: {
    create: IdeaSketchOperationBuilder<"create-text">;
    bind: IdeaSketchOperationBuilder<"bind-text">;
    unbind: IdeaSketchOperationBuilder<"unbind-text">;
    setContent: IdeaSketchOperationBuilder<"set-text">;
    setStyle: IdeaSketchOperationBuilder<"set-text-style">;
    setLayout: IdeaSketchOperationBuilder<"set-text-layout">;
  };
  camera: {
    create: IdeaSketchOperationBuilder<"create-camera">;
    updateBounds: IdeaSketchOperationBuilder<"update-camera-bounds">;
    reorder: IdeaSketchOperationBuilder<"set-camera-order">;
    delete: IdeaSketchOperationBuilder<"delete-camera">;
  };
  appearance: { setBackground: IdeaSketchOperationBuilder<"set-background"> };
  transform: { applyStylePreset: IdeaSketchOperationBuilder<"apply-style-preset"> };
  scene: { clear: IdeaSketchOperationBuilder<"clear-scene"> };
}

export interface IdeaSketchCamerasNamespace {
  list(input: IdeaSketchCameraListOptions): Promise<SdkResult<IdeaSketchCameraListResult>>;
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
  listMetadata(input: IdeaSketchAssetMetadataListOptions): Promise<SdkResult<IdeaSketchAssetMetadataListResult>>;
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
