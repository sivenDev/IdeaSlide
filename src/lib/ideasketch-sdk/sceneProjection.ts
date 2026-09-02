import {
  sdkRejected,
  sdkSucceeded,
  type CameraRef,
  type ElementRef,
  type IdeaSketchBounds,
  type IdeaSketchArrowhead,
  type PageRef,
  type SceneSnapshotId,
  type SnapshotCursor,
  type SdkSyncResult,
  type IdeaSketchTextLayout,
} from "./types.ts";
import { createAssetMetadataProjection, projectAssetMetadata } from "./assets.ts";

const TEXT_FONTS = new Set(["hand-drawn", "normal", "code", 1, 2, 3, 5]);
const TEXT_ALIGNS = new Set(["left", "center", "right"]);
const VERTICAL_ALIGNS = new Set(["top", "middle", "bottom"]);
const STROKE_STYLES = new Set(["solid", "dashed", "dotted"]);
const FILL_STYLES = new Set(["solid", "hachure", "cross-hatch"]);
const MUTATION_READY_TYPES = new Set(["rectangle", "ellipse", "diamond", "arrow", "text", "shape-bound-text"]);

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function boundedString(value: unknown, max = 128) {
  return typeof value === "string" && value.length <= max;
}

function textFieldsMalformed(element: Record<string, unknown>) {
  if (element.type !== "text") return false;
  const hasOriginal = Object.prototype.hasOwnProperty.call(element, "originalText");
  const hasDisplay = Object.prototype.hasOwnProperty.call(element, "text");
  if ((!hasOriginal && !hasDisplay) || hasOriginal && typeof element.originalText !== "string" || hasDisplay && typeof element.text !== "string") return true;
  if (element.fontSize !== undefined && (!finite(element.fontSize) || (element.fontSize as number) < 6 || (element.fontSize as number) > 256)) return true;
  if (element.lineHeight !== undefined && (!finite(element.lineHeight) || (element.lineHeight as number) < 0.5 || (element.lineHeight as number) > 4)) return true;
  if (element.opacity !== undefined && (!Number.isInteger(element.opacity) || (element.opacity as number) < 0 || (element.opacity as number) > 100)) return true;
  if (element.strokeColor !== undefined && !boundedString(element.strokeColor)) return true;
  if (element.fontFamily !== undefined && !TEXT_FONTS.has(element.fontFamily as never)) return true;
  if (element.textAlign !== undefined && !TEXT_ALIGNS.has(element.textAlign as never)) return true;
  if (element.verticalAlign !== undefined && !VERTICAL_ALIGNS.has(element.verticalAlign as never)) return true;
  // Excalidraw only supports vertical alignment for shape-bound text in this
  // semantic contract. A standalone text carrying middle/bottom is damaged
  // source data and must remain identity-only rather than being advertised as
  // mutation-ready with an impossible layout.
  if ((element.containerId === undefined || element.containerId === null)
    && element.verticalAlign !== undefined
    && element.verticalAlign !== "top") return true;
  if (element.autoResize !== undefined && typeof element.autoResize !== "boolean") return true;
  if (element.width !== undefined && (!finite(element.width) || (element.width as number) <= 0)) return true;
  return false;
}

function styleMalformed(element: Record<string, unknown>) {
  const shapeOrArrow = ["rectangle", "ellipse", "diamond", "arrow"].includes(String(element.type));
  if (!shapeOrArrow) return false;
  if (element.strokeWidth !== undefined && (!finite(element.strokeWidth) || (element.strokeWidth as number) <= 0 || (element.strokeWidth as number) > 64)) return true;
  if (element.opacity !== undefined && (!Number.isInteger(element.opacity) || (element.opacity as number) < 0 || (element.opacity as number) > 100)) return true;
  if (element.roughness !== undefined && (!finite(element.roughness) || ![0, 1, 2].includes(element.roughness as number))) return true;
  if (element.strokeStyle !== undefined && !STROKE_STYLES.has(element.strokeStyle as never)) return true;
  if (element.type !== "arrow" && element.fillStyle !== undefined && !FILL_STYLES.has(element.fillStyle as never)) return true;
  for (const key of ["strokeColor", "backgroundColor"]) if (element[key] !== undefined && !boundedString(element[key])) return true;
  return false;
}

function metadataMalformed(element: Record<string, unknown>) {
  if (element.angle !== undefined && !finite(element.angle)) return true;
  if (element.version !== undefined && (!Number.isInteger(element.version) || (element.version as number) < 1)) return true;
  if (element.versionNonce !== undefined && (!Number.isInteger(element.versionNonce) || (element.versionNonce as number) < 0)) return true;
  if (element.updated !== undefined && !finite(element.updated)) return true;
  return false;
}

export interface IdeaSketchSemanticRelations {
  containerRef?: ElementRef;
  boundTextRefs: readonly ElementRef[];
  arrowRefs: readonly ElementRef[];
  startBinding?: ElementRef;
  endBinding?: ElementRef;
  frameRef?: ElementRef;
  groupRefs: readonly ElementRef[];
}

export interface IdeaSketchSemanticText {
  originalText: string;
  text: string;
  fontFamily?: "hand-drawn" | "normal" | "code";
  fontSize?: number;
  color?: string;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  opacity?: number;
  lineHeight?: number;
  layout?: IdeaSketchTextLayout;
}

export interface IdeaSketchSemanticElement {
  pageRef: PageRef;
  ref: ElementRef | CameraRef;
  type: string;
  bounds?: IdeaSketchBounds;
  angle: number;
  locked: boolean;
  deleted: boolean;
  isCamera: boolean;
  cameraOrder?: number;
  text?: IdeaSketchSemanticText;
  /** Bounded public style projection for supported shapes/connectors. */
  style?: Readonly<Record<string, unknown>>;
  /** Absolute Page-space connector points, when the element is an arrow. */
  points?: readonly [number, number][];
  arrowheads?: Readonly<{ start: IdeaSketchArrowhead; end: IdeaSketchArrowhead }>;
  relations: IdeaSketchSemanticRelations;
  /** True when a native relation field has an invalid shape and the element
   * must remain identity-only until the host repairs the source scene. */
  relationsMalformed: boolean;
  relationsComplete: boolean;
}

export interface IdeaSketchSceneCoverage {
  identityRefs: readonly (ElementRef | CameraRef)[];
  mutationReadyRefs: readonly (ElementRef | CameraRef)[];
}

export interface IdeaSketchSceneRead {
  snapshotId: SceneSnapshotId;
  pageRef: PageRef;
  pageEditVersion?: number;
  complete: boolean;
  nextCursor?: SnapshotCursor;
  coverage: IdeaSketchSceneCoverage;
  elements: readonly IdeaSketchSemanticElement[];
}

export interface SemanticSceneProjectionInput {
  pageRef: PageRef | string;
  elements: readonly unknown[];
  appState?: Partial<Record<string, unknown>>;
  files?: Record<string, unknown>;
  pageEditVersion?: number;
  snapshotIdFactory?: () => string;
  cursorFactory?: () => string;
  maxLimit?: number;
}

interface InternalSnapshot {
  id: SceneSnapshotId;
  pageRef: PageRef;
  elements: readonly IdeaSketchSemanticElement[];
  byRef: Map<string, IdeaSketchSemanticElement>;
  closureByRef: Map<string, Set<string>>;
  identityRefs: Set<string>;
  mutationReadyRefs: Set<string>;
  offset: number;
  includeDeleted: boolean;
}

function opaque(prefix: string) {
  try {
    return `${prefix}:${globalThis.crypto.randomUUID()}`;
  } catch {
    return `${prefix}:${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function strictOptions(value: unknown): Record<string, unknown> | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  try {
    const prototype = Object.getPrototypeOf(record);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(record)) {
      if (typeof key !== "string") return undefined;
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
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

function safeNativeId(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && !/[\u0000-\u0020\u007f]/.test(value);
}

function refFor(element: Record<string, unknown>): ElementRef | CameraRef | undefined {
  if (!safeNativeId(element.id)) return undefined;
  return element.customData && asRecord(element.customData)?.type === "camera"
    ? `camera:${element.id}` as CameraRef
    : `element:${element.id}` as ElementRef;
}

function boundsFor(element: Record<string, unknown>): IdeaSketchBounds | undefined {
  const values = [element.x, element.y, element.width, element.height];
  if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) return undefined;
  const x = element.x as number;
  const y = element.y as number;
  const width = element.width as number;
  const height = element.height as number;
  return { x, y, width: Math.abs(width), height: Math.abs(height) };
}

function targetRef(value: unknown): ElementRef | undefined {
  if (!safeNativeId(value)) return undefined;
  return `element:${value}` as ElementRef;
}

function relationIds(element: Record<string, unknown>) {
  const boundTextRefs: ElementRef[] = [];
  const arrowRefs: ElementRef[] = [];
  const groupRefs: ElementRef[] = [];
  let containerRef: ElementRef | undefined;
  let startBinding: ElementRef | undefined;
  let endBinding: ElementRef | undefined;
  let frameRef: ElementRef | undefined;
  let malformed = false;
  const has = (key: string) => Object.prototype.hasOwnProperty.call(element, key);
  const nullableString = (key: string, assign: (value: ElementRef | undefined) => void) => {
    if (!has(key) || element[key] === null || element[key] === undefined) return;
    if (!safeNativeId(element[key])) {
      malformed = true;
      return;
    }
    const ref = targetRef(element[key]);
    if (!ref) {
      malformed = true;
      return;
    }
    assign(ref);
  };
  nullableString("containerId", (value) => { containerRef = value; });
  nullableString("frameId", (value) => { frameRef = value; });
  if (has("groupIds") && element.groupIds !== null && element.groupIds !== undefined && !Array.isArray(element.groupIds)) malformed = true;
  if (Array.isArray(element.groupIds)) {
    if (element.groupIds.some((groupId) => !safeNativeId(groupId))) malformed = true;
    // Group ids are opaque membership keys, not element ids. Actual peer
    // element refs are added by createSemanticSceneProjection below.
  }
  if (has("boundElements") && element.boundElements !== null && element.boundElements !== undefined && !Array.isArray(element.boundElements)) malformed = true;
  if (Array.isArray(element.boundElements)) {
    for (const binding of element.boundElements) {
      const record = asRecord(binding);
      if (!record || !safeNativeId(record.id) || (record.type !== "text" && record.type !== "arrow")) {
        malformed = true;
        continue;
      }
      const ref = targetRef(record.id);
      if (!ref) {
        malformed = true;
        continue;
      }
      if (record.type === "text") boundTextRefs.push(ref);
      if (record.type === "arrow") arrowRefs.push(ref);
    }
  }
  for (const [key, setter] of [["startBinding", (ref: ElementRef) => { startBinding = ref; }], ["endBinding", (ref: ElementRef) => { endBinding = ref; }]] as const) {
    if (!has(key) || element[key] === null || element[key] === undefined) continue;
    const binding = asRecord(element[key]);
    if (!binding || !safeNativeId(binding.elementId)
      || binding.focus !== undefined && (typeof binding.focus !== "number" || !Number.isFinite(binding.focus))
      || binding.gap !== undefined && (typeof binding.gap !== "number" || !Number.isFinite(binding.gap) || binding.gap < 0)
      || binding.fixedPoint !== undefined && (!Array.isArray(binding.fixedPoint) || binding.fixedPoint.length !== 2 || binding.fixedPoint.some((part) => typeof part !== "number" || !Number.isFinite(part) || part < 0 || part > 1))) {
      malformed = true;
      continue;
    }
    const ref = targetRef(binding.elementId);
    if (!ref) {
      malformed = true;
      continue;
    }
    setter(ref);
  }
  return { containerRef, boundTextRefs, arrowRefs, startBinding, endBinding, frameRef, groupRefs, malformed };
}

function textFor(element: Record<string, unknown>): IdeaSketchSemanticText | undefined {
  if (element.type !== "text") return undefined;
  const hasOriginal = Object.prototype.hasOwnProperty.call(element, "originalText");
  const hasDisplay = Object.prototype.hasOwnProperty.call(element, "text");
  // Do not manufacture an empty/content-fallback summary for damaged native
  // text. A malformed text remains identity-only and its public projection
  // must not imply that the content is safe to mutate.
  if ((!hasOriginal && !hasDisplay)
    || hasOriginal && typeof element.originalText !== "string"
    || hasDisplay && typeof element.text !== "string") return undefined;
  const originalText = typeof element.originalText === "string"
    ? element.originalText
    : typeof element.text === "string" ? element.text : "";
  return {
    originalText,
    text: typeof element.text === "string" ? element.text : originalText,
    ...(finite(element.fontSize) && (element.fontSize as number) >= 6 && (element.fontSize as number) <= 256 ? { fontSize: element.fontSize as number } : {}),
    ...(boundedString(element.strokeColor) ? { color: element.strokeColor as string } : {}),
    ...(Number.isInteger(element.opacity) && (element.opacity as number) >= 0 && (element.opacity as number) <= 100 ? { opacity: element.opacity as number } : {}),
    ...(finite(element.lineHeight) && (element.lineHeight as number) >= 0.5 && (element.lineHeight as number) <= 4 ? { lineHeight: element.lineHeight as number } : {}),
    ...((typeof element.autoResize === "boolean" || finite(element.width))
      ? { layout: Object.freeze({
          ...(typeof element.autoResize === "boolean" ? { autoResize: element.autoResize } : {}),
          ...(finite(element.width) && (element.width as number) > 0 && element.autoResize === false ? { width: element.width as number } : {}),
        }) }
      : {}),
    ...(element.textAlign === "left" || element.textAlign === "center" || element.textAlign === "right" ? { textAlign: element.textAlign } : {}),
    ...(element.verticalAlign === "top" || element.verticalAlign === "middle" || element.verticalAlign === "bottom" ? { verticalAlign: element.verticalAlign } : {}),
    ...(element.fontFamily === "hand-drawn" || element.fontFamily === "normal" || element.fontFamily === "code"
      ? { fontFamily: element.fontFamily }
    : element.fontFamily === 1 || element.fontFamily === 2 || element.fontFamily === 3 || element.fontFamily === 5
        ? { fontFamily: ({ 1: "hand-drawn", 2: "normal", 3: "code", 5: "hand-drawn" } as const)[element.fontFamily] }
        : {}),
  };
}

function coreGeometryMalformed(element: Record<string, unknown>) {
  if (typeof element.x !== "number" || !Number.isFinite(element.x) || typeof element.y !== "number" || !Number.isFinite(element.y)) return true;
  if (typeof element.width !== "number" || !Number.isFinite(element.width) || typeof element.height !== "number" || !Number.isFinite(element.height)) return true;
  if (element.type === "arrow") {
    return element.width < 0 || element.height < 0 || !Array.isArray(element.points) || element.points.length < 2
      || element.points.some((point) => !Array.isArray(point) || point.length !== 2 || point.some((value) => typeof value !== "number" || !Number.isFinite(value)));
  }
  return element.width <= 0 || element.height <= 0
    || element.type === "text" && (typeof element.originalText !== "string" && typeof element.text !== "string");
}

function cameraMalformed(element: Record<string, unknown>) {
  if (!asRecord(element.customData) || asRecord(element.customData)?.type !== "camera") return false;
  const customData = asRecord(element.customData)!;
  return element.type !== "rectangle"
    || element.angle !== undefined && element.angle !== 0
    || element.locked === true
    || Array.isArray(element.groupIds) && element.groupIds.length > 0
    || element.frameId !== undefined && element.frameId !== null
    || typeof customData.order !== "number" || !Number.isInteger(customData.order) || customData.order < 1
    || (element.width as number) < 16 || (element.height as number) < 16
    || element.strokeColor !== "#1e90ff"
    || element.backgroundColor !== "transparent"
    || element.fillStyle !== "solid"
    || element.strokeWidth !== 2
    || element.strokeStyle !== "dashed"
    || element.roughness !== 0
    || element.opacity !== 60
    || element.roundness !== null;
}

function shapeStyleFor(element: Record<string, unknown>): Readonly<Record<string, unknown>> | undefined {
  if (!["rectangle", "ellipse", "diamond"].includes(String(element.type))) return undefined;
  return Object.freeze({
    ...(typeof element.backgroundColor === "string" ? { backgroundColor: element.backgroundColor } : {}),
    ...(typeof element.strokeColor === "string" ? { strokeColor: element.strokeColor } : {}),
    ...(finite(element.strokeWidth) && (element.strokeWidth as number) > 0 && (element.strokeWidth as number) <= 64 ? { strokeWidth: element.strokeWidth as number } : {}),
    ...(STROKE_STYLES.has(element.strokeStyle as never) ? { strokeStyle: element.strokeStyle as string } : {}),
    ...(FILL_STYLES.has(element.fillStyle as never) ? { fillStyle: element.fillStyle as string } : {}),
    ...(typeof element.roundness === "object" && element.roundness !== null ? { roundness: "rounded" } : element.roundness === null ? { roundness: "sharp" } : {}),
    ...(Number.isInteger(element.opacity) && (element.opacity as number) >= 0 && (element.opacity as number) <= 100 ? { opacity: element.opacity as number } : {}),
    ...(finite(element.roughness) && [0, 1, 2].includes(element.roughness as number) ? { roughness: element.roughness as number } : {}),
  });
}

function connectorStyleFor(element: Record<string, unknown>): Readonly<Record<string, unknown>> | undefined {
  if (element.type !== "arrow") return undefined;
  return Object.freeze({
    ...(typeof element.strokeColor === "string" ? { strokeColor: element.strokeColor } : {}),
    ...(finite(element.strokeWidth) && (element.strokeWidth as number) > 0 && (element.strokeWidth as number) <= 64 ? { strokeWidth: element.strokeWidth as number } : {}),
    ...(STROKE_STYLES.has(element.strokeStyle as never) ? { strokeStyle: element.strokeStyle as string } : {}),
    ...(Number.isInteger(element.opacity) && (element.opacity as number) >= 0 && (element.opacity as number) <= 100 ? { opacity: element.opacity as number } : {}),
    ...(finite(element.roughness) && [0, 1, 2].includes(element.roughness as number) ? { roughness: element.roughness as number } : {}),
  });
}

function absolutePointsFor(element: Record<string, unknown>): readonly [number, number][] | undefined {
  if (element.type !== "arrow" || !Array.isArray(element.points)) return undefined;
  if (typeof element.x !== "number" || typeof element.y !== "number") return undefined;
  const points = element.points as unknown[];
  if (!points.every((point) => Array.isArray(point) && point.length === 2 && typeof point[0] === "number" && Number.isFinite(point[0]) && typeof point[1] === "number" && Number.isFinite(point[1]))) return undefined;
  return Object.freeze(points.map((point) => {
    const pair = point as [number, number];
    return Object.freeze([element.x as number + pair[0], element.y as number + pair[1]]) as [number, number];
  }));
}

function arrowheadsFor(element: Record<string, unknown>): Readonly<{ start: IdeaSketchArrowhead; end: IdeaSketchArrowhead }> | undefined {
  if (element.type !== "arrow") return undefined;
  const valid = (value: unknown, fallback: IdeaSketchArrowhead): IdeaSketchArrowhead => ["arrow", "bar", "dot", "triangle", "circle", "none"].includes(String(value)) ? value as IdeaSketchArrowhead : fallback;
  return Object.freeze({
    start: valid(element.startArrowhead, "none"),
    end: valid(element.endArrowhead, "arrow"),
  });
}

function cameraOrder(element: Record<string, unknown>) {
  const customData = asRecord(element.customData);
  return typeof customData?.order === "number" && Number.isFinite(customData.order) ? customData.order : undefined;
}

function isMutationReadyElement(element: IdeaSketchSemanticElement, byRef: Map<string, IdeaSketchSemanticElement>) {
  // mutationReadyRefs prove that the complete, live relation closure was read;
  // they do not grant mutation permission.  Locked/grouped/rotated and
  // preserve-only targets remain readable here so the adapter can return the
  // precise unsupported/locked error rather than an artificial incomplete_read.
  if (element.relationsMalformed || element.deleted) return false;
  // Preserved-only/imported content is readable and may participate in a
  // relation closure, but it is never a direct mutation target in v1. Keep
  // these refs out of mutationReadyRefs so callers cannot accidentally pass a
  // read-complete preserved element to a write operation.
  if (!MUTATION_READY_TYPES.has(element.type)) return false;
  if (element.type === "imported-arrow-label") return false;
  if (!element.isCamera) return true;
  const orders = [...byRef.values()]
    .filter((candidate) => candidate.isCamera && !candidate.deleted)
    .map((candidate) => candidate.cameraOrder)
    .filter((order): order is number => Number.isInteger(order));
  return element.cameraOrder !== undefined && element.cameraOrder >= 1 && new Set(orders).size === orders.length;
}

function summarize(pageRef: PageRef, element: Record<string, unknown>): IdeaSketchSemanticElement | undefined {
  const ref = refFor(element);
  if (!ref) return undefined;
  const relations = relationIds(element);
  const { malformed, ...publicRelations } = relations;
  const isCamera = typeof ref === "string" && ref.startsWith("camera:");
  const rawType = typeof element.type === "string" ? element.type : "unknown";
  const customData = asRecord(element.customData);
  const semanticType = rawType === "text" && relations.containerRef
    ? (customData?.imported === true || customData?.source === "imported" ? "imported-arrow-label" : "shape-bound-text")
    : rawType;
  return Object.freeze({
    pageRef,
    ref,
    type: semanticType,
    ...(boundsFor(element) ? { bounds: boundsFor(element) } : {}),
    angle: typeof element.angle === "number" && Number.isFinite(element.angle) ? element.angle : 0,
    locked: element.locked === true,
    deleted: element.isDeleted === true,
    isCamera,
    ...(isCamera && cameraOrder(element) !== undefined ? { cameraOrder: cameraOrder(element) } : {}),
    ...(textFor(element) ? { text: textFor(element) } : {}),
    ...((shapeStyleFor(element) ?? connectorStyleFor(element)) ? { style: shapeStyleFor(element) ?? connectorStyleFor(element) } : {}),
    ...(absolutePointsFor(element) ? { points: absolutePointsFor(element) } : {}),
    ...(arrowheadsFor(element) ? { arrowheads: arrowheadsFor(element) } : {}),
    relations: Object.freeze({
      ...publicRelations,
      boundTextRefs: Object.freeze(publicRelations.boundTextRefs),
      arrowRefs: Object.freeze(publicRelations.arrowRefs),
      groupRefs: Object.freeze(publicRelations.groupRefs),
    }),
    relationsMalformed: relations.malformed
      || coreGeometryMalformed(element)
      || textFieldsMalformed(element)
      || styleMalformed(element)
      || metadataMalformed(element)
      || cameraMalformed(element),
    relationsComplete: false,
  });
}

function addUnique(target: Set<string>, refs: readonly (string | undefined)[]) {
  for (const ref of refs) if (ref) target.add(ref);
}

function closureFor(summary: IdeaSketchSemanticElement, byRef: Map<string, IdeaSketchSemanticElement>) {
  const closure = new Set<string>([summary.ref]);
  const queue = [summary.ref];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const item = byRef.get(current);
    if (!item) continue;
    const related = [
      item.relations.containerRef,
      item.relations.frameRef,
      item.relations.startBinding,
      item.relations.endBinding,
      ...item.relations.boundTextRefs,
      ...item.relations.arrowRefs,
      ...item.relations.groupRefs,
    ];
    for (const ref of related) {
      if (!ref || closure.has(ref)) continue;
      closure.add(ref);
      if (byRef.has(ref)) queue.push(ref);
    }
    for (const candidate of byRef.values()) {
      const candidateRelations = candidate.relations;
      const pointsToCurrent = candidateRelations.containerRef === current
        || candidateRelations.boundTextRefs.includes(current as ElementRef)
        || candidateRelations.arrowRefs.includes(current as ElementRef)
        || candidateRelations.startBinding === current
        || candidateRelations.endBinding === current
        // A frame is a relation boundary, not just a parent pointer. Once the
        // frame itself is in the closure, all of its live children must be
        // included as peers so a frame-scoped mutation cannot partially apply.
        || (item?.relations.frameRef !== undefined
          && candidateRelations.frameRef === item.relations.frameRef)
        || candidateRelations.frameRef === current;
      if (pointsToCurrent && !closure.has(candidate.ref)) {
        closure.add(candidate.ref);
        queue.push(candidate.ref);
      }
    }
  }
  return closure;
}

function relationsValid(element: IdeaSketchSemanticElement, byRef: Map<string, IdeaSketchSemanticElement>) {
  if (element.relationsMalformed) return false;
  const relation = element.relations;
  if (new Set(relation.boundTextRefs).size !== relation.boundTextRefs.length || new Set(relation.arrowRefs).size !== relation.arrowRefs.length) return false;
  if (relation.containerRef) {
    const container = byRef.get(relation.containerRef);
    if (!container || !container.relations.boundTextRefs.includes(element.ref as ElementRef)) return false;
  }
  for (const textRef of relation.boundTextRefs) {
    const text = byRef.get(textRef);
    if (!text || text.relations.containerRef !== element.ref) return false;
  }
  for (const arrowRef of relation.arrowRefs) {
    const arrow = byRef.get(arrowRef);
    if (!arrow || (arrow.relations.startBinding !== element.ref && arrow.relations.endBinding !== element.ref)) return false;
  }
  for (const endpoint of [relation.startBinding, relation.endBinding]) {
    if (!endpoint) continue;
    const target = byRef.get(endpoint);
    if (!target || !target.relations.arrowRefs.includes(element.ref as ElementRef)) return false;
  }
  return true;
}

function closureRelationsValid(closure: Iterable<string>, byRef: Map<string, IdeaSketchSemanticElement>) {
  return [...closure].every((ref) => {
    const element = byRef.get(ref);
    return element !== undefined && relationsValid(element, byRef);
  });
}

function completeRelations(elements: readonly IdeaSketchSemanticElement[], byRef: Map<string, IdeaSketchSemanticElement>, visibleRefs: ReadonlySet<string>) {
  return elements.map((element) => {
    const closure = closureFor(element, byRef);
    const complete = [...closure].every((ref) => visibleRefs.has(ref)) && closureRelationsValid(closure, byRef);
    return complete === element.relationsComplete ? element : Object.freeze({ ...element, relationsComplete: complete });
  });
}

function resultCoverage(snapshot: InternalSnapshot): IdeaSketchSceneCoverage {
  return {
    identityRefs: Object.freeze([...snapshot.identityRefs].sort() as (ElementRef | CameraRef)[]),
    mutationReadyRefs: Object.freeze([...snapshot.mutationReadyRefs].sort() as (ElementRef | CameraRef)[]),
  };
}

export function createSemanticSceneProjection(input: SemanticSceneProjectionInput) {
  const pageRef = input.pageRef as PageRef;
  const maxLimit = input.maxLimit ?? 100;
  const rawSummaries = input.elements
    .map((element) => asRecord(element) ? summarize(pageRef, asRecord(element)!) : undefined)
    .filter((element): element is IdeaSketchSemanticElement => Boolean(element));
  const groupIdsByRef = new Map<string, readonly string[]>();
  for (const element of input.elements) {
    const record = asRecord(element);
    const ref = record ? refFor(record) : undefined;
    if (!ref || !Array.isArray(record?.groupIds)) continue;
    groupIdsByRef.set(ref, record.groupIds.filter((id): id is string => typeof id === "string"));
  }
  const summaries = rawSummaries.map((summary) => {
    const groups = groupIdsByRef.get(summary.ref) ?? [];
    const peers = rawSummaries
      .filter((candidate) => candidate.ref !== summary.ref)
      .filter((candidate) => {
        const candidateGroups = groupIdsByRef.get(candidate.ref) ?? [];
        return groups.some((groupId) => candidateGroups.includes(groupId));
      })
      .map((candidate) => candidate.ref as ElementRef);
    if (peers.length === 0) return summary;
    return Object.freeze({
      ...summary,
      relations: Object.freeze({
        ...summary.relations,
        groupRefs: Object.freeze(peers),
      }),
    });
  });
  const byRef = new Map(summaries.map((element) => [element.ref, element]));
  for (const summary of [...byRef.values()]) {
    if (summary.type !== "shape-bound-text" || !summary.relations.containerRef) continue;
    const container = byRef.get(summary.relations.containerRef);
    if (!container || container.type !== "arrow") continue;
    // Imported arrow labels are preserve-only, but their relation itself is
    // valid and must remain part of the connector closure so arrow geometry
    // mutations can reflow the label. Readiness is gated separately by the
    // semantic type and therefore never upgrades the label for direct writes.
    const imported = Object.freeze({ ...summary, type: "imported-arrow-label" });
    byRef.set(summary.ref, imported);
  }
  const cameraOrders = new Map<number, number>();
  for (const summary of [...byRef.values()]) {
    // Camera order is a live-scene invariant.  Deleted Camera tombstones
    // retain their historical customData for persistence/Undo, but must not
    // make a valid live order look duplicated after a delete/reorder.
    if (summary.isCamera && !summary.deleted && summary.cameraOrder !== undefined) {
      cameraOrders.set(summary.cameraOrder, (cameraOrders.get(summary.cameraOrder) ?? 0) + 1);
    }
  }
  for (const summary of [...byRef.values()]) {
    if (summary.isCamera && !summary.deleted && summary.cameraOrder !== undefined && (cameraOrders.get(summary.cameraOrder) ?? 0) > 1) {
      byRef.set(summary.ref, Object.freeze({ ...summary, relationsMalformed: true }));
    }
  }
  const normalizedSummaries = summaries.map((element) => byRef.get(element.ref) ?? element);
  const closureByRef = new Map(normalizedSummaries.map((element) => [element.ref, closureFor(element, byRef)]));
  const snapshots = new Map<string, InternalSnapshot>();
  const cursors = new Map<string, { snapshotId: string; offset: number }>();
  const cursorByPosition = new Map<string, SnapshotCursor>();

  function newSnapshot(includeDeleted: boolean) {
    const id = (input.snapshotIdFactory?.() ?? opaque("scene-snapshot")) as SceneSnapshotId;
    const snapshot: InternalSnapshot = {
      id,
      pageRef,
      elements: Object.freeze([...normalizedSummaries]),
      byRef,
      closureByRef,
      identityRefs: new Set(),
      mutationReadyRefs: new Set(),
      offset: 0,
      includeDeleted,
    };
    snapshots.set(id, snapshot);
    return snapshot;
  }

  function resolveSnapshot(snapshotId: unknown) {
    if (typeof snapshotId !== "string") return undefined;
    return snapshots.get(snapshotId);
  }

  function read(options: { snapshotId?: SceneSnapshotId; cursor?: SnapshotCursor; limit?: number; includeDeleted?: boolean } = {}): SdkSyncResult<IdeaSketchSceneRead> {
    const strict = strictOptions(options);
    if (!strict) return sdkRejected("invalid_request", "Scene read options must be an object.");
    options = strict as typeof options;
    const limit = options.limit ?? 50;
    if (!Number.isInteger(limit) || limit <= 0 || limit > maxLimit) return sdkRejected("limit_exceeded", "Scene read limit is invalid.");
    if (options.includeDeleted !== undefined && typeof options.includeDeleted !== "boolean") return sdkRejected("invalid_request", "includeDeleted must be boolean.");
    let snapshot: InternalSnapshot | undefined;
    let offset = 0;
    if (options.cursor !== undefined) {
      const cursor = cursors.get(options.cursor);
      if (!cursor) return sdkRejected("snapshot_required", "The scene cursor does not exist.");
      snapshot = snapshots.get(cursor.snapshotId);
      offset = cursor.offset;
      if (!snapshot) return sdkRejected("snapshot_stale", "The scene snapshot is stale.", true);
    } else if (options.snapshotId !== undefined) {
      snapshot = resolveSnapshot(options.snapshotId);
      if (!snapshot) return sdkRejected("snapshot_required", "The scene snapshot does not exist.");
    } else {
      snapshot = newSnapshot(options.includeDeleted === true);
    }
    if (options.includeDeleted !== undefined && options.includeDeleted !== snapshot.includeDeleted) return sdkRejected("invalid_request", "includeDeleted is fixed for the lifetime of a scene snapshot.");
    if (offset > snapshot.elements.length) return sdkRejected("snapshot_stale", "The scene cursor is stale.", true);
    const allVisible = snapshot.includeDeleted ? snapshot.elements : snapshot.elements.filter((element) => !element.deleted);
    const page = allVisible.slice(offset, offset + limit);
    // Relation-complete reads are bounded as a whole. Returning a page that
    // contains a target whose closure cannot fit the configured cap must not
    // later become mutation-ready through cumulative pagination.
    for (const element of page) {
      const closure = snapshot.closureByRef.get(element.ref) ?? new Set([element.ref]);
      if (closure.size > maxLimit) return sdkRejected("limit_exceeded", "A scene relation closure exceeds the scene read limit.");
    }
    addUnique(snapshot.identityRefs, page.map((element) => element.ref));
    for (const element of page) {
      const closure = snapshot.closureByRef.get(element.ref) ?? new Set([element.ref]);
      const closureVisible = [...closure].every((ref) => {
        const related = snapshot.byRef.get(ref);
        return related !== undefined && (snapshot.includeDeleted || !related.deleted);
      }) && closureRelationsValid(closure, snapshot.byRef);
      const closureLive = [...closure].every((ref) => snapshot.byRef.get(ref)?.deleted !== true);
      if (closureVisible && closureLive && [...closure].every((ref) => snapshot.identityRefs.has(ref))) {
        addUnique(snapshot.mutationReadyRefs, [...closure]
          .map((ref) => snapshot.byRef.get(ref))
          .filter((item): item is IdeaSketchSemanticElement => item !== undefined && isMutationReadyElement(item, snapshot.byRef))
          .map((item) => item.ref));
      }
    }
    const nextOffset = offset + page.length;
    const visible = new Set(snapshot.identityRefs);
    const completedPage = completeRelations(page, snapshot.byRef, visible);
    const complete = nextOffset >= allVisible.length;
    snapshot.offset = nextOffset;
    const positionKey = `${snapshot.id}:${nextOffset}`;
    const nextCursor = complete
      ? undefined
      : (cursorByPosition.get(positionKey) ?? (input.cursorFactory?.() ?? opaque("snapshot-cursor")) as SnapshotCursor);
    if (nextCursor) {
      cursorByPosition.set(positionKey, nextCursor);
      cursors.set(nextCursor, { snapshotId: snapshot.id, offset: nextOffset });
    }
    return sdkSucceeded({
      snapshotId: snapshot.id,
      pageRef,
      ...(input.pageEditVersion !== undefined ? { pageEditVersion: input.pageEditVersion } : {}),
      complete,
      ...(nextCursor ? { nextCursor } : {}),
      coverage: resultCoverage(snapshot),
      elements: Object.freeze(completedPage),
    });
  }

  function getElements(options: { snapshotId: SceneSnapshotId; refs: readonly (ElementRef | CameraRef)[]; includeDeleted?: boolean }): SdkSyncResult<IdeaSketchSceneRead> {
    const strict = strictOptions(options);
    if (!strict) return sdkRejected("invalid_request", "Scene getElements options must be an object.");
    options = strict as typeof options;
    if (!denseArray(options.refs) || options.refs.length === 0) return sdkRejected("invalid_request", "refs must not be empty.");
    if (options.includeDeleted !== undefined && typeof options.includeDeleted !== "boolean") return sdkRejected("invalid_request", "includeDeleted must be boolean.");
    const snapshot = resolveSnapshot(options.snapshotId);
    if (!snapshot) return sdkRejected("snapshot_required", "The scene snapshot does not exist.");
    if (options.includeDeleted !== undefined && options.includeDeleted !== snapshot.includeDeleted) return sdkRejected("invalid_request", "includeDeleted is fixed for the lifetime of a scene snapshot.");
    const selected = new Set<string>();
    const completedClosures: string[][] = [];
    for (const ref of options.refs) {
      const element = snapshot.byRef.get(ref);
      if (!element || (element.deleted && !options.includeDeleted)) return sdkRejected("target_not_found", `The scene target ${String(ref)} does not exist.`);
      const closure = [...(snapshot.closureByRef.get(ref) ?? [ref])];
      if (closure.length > maxLimit) return sdkRejected("limit_exceeded", "The requested relation closure exceeds the scene read limit.");
      for (const closureRef of closure) {
        const related = snapshot.byRef.get(closureRef);
        if (related && (snapshot.includeDeleted || !related.deleted)) selected.add(closureRef);
      }
      if (closure.every((closureRef) => {
        const related = snapshot.byRef.get(closureRef);
        return related !== undefined && (snapshot.includeDeleted || !related.deleted);
      }) && closureRelationsValid(closure, snapshot.byRef) && closure.every((closureRef) => snapshot.byRef.get(closureRef)?.deleted !== true)) completedClosures.push(closure);
    }
    if (selected.size > maxLimit) return sdkRejected("limit_exceeded", "The requested relation closure exceeds the scene read limit.");
    addUnique(snapshot.identityRefs, [...selected]);
    for (const closure of completedClosures) {
      addUnique(snapshot.mutationReadyRefs, closure
        .map((ref) => snapshot.byRef.get(ref))
        .filter((item): item is IdeaSketchSemanticElement => item !== undefined && isMutationReadyElement(item, snapshot.byRef))
        .map((item) => item.ref));
    }
    const elements = [...selected]
      .map((ref) => snapshot.byRef.get(ref))
      .filter((element): element is IdeaSketchSemanticElement => element !== undefined && (options.includeDeleted || !element.deleted));
    return sdkSucceeded({
      snapshotId: snapshot.id,
      pageRef,
      ...(input.pageEditVersion !== undefined ? { pageEditVersion: input.pageEditVersion } : {}),
      complete: false,
      coverage: resultCoverage(snapshot),
      elements: Object.freeze(completeRelations(elements, snapshot.byRef, snapshot.identityRefs)),
    });
  }

  function listCameras() {
    return Object.freeze(summaries.filter((element) => element.isCamera && !element.deleted).sort((a, b) => (a.cameraOrder ?? 0) - (b.cameraOrder ?? 0)));
  }

  function viewport(options: { snapshotId?: SceneSnapshotId } = {}) {
    if (!asRecord(options)) return sdkRejected("invalid_request", "Viewport options must be an object.");
    if (options.snapshotId && !snapshots.has(options.snapshotId)) return sdkRejected("snapshot_required", "The scene snapshot does not exist.");
    const state = input.appState ?? {};
    const scrollX = typeof state.scrollX === "number" && Number.isFinite(state.scrollX) ? state.scrollX : 0;
    const scrollY = typeof state.scrollY === "number" && Number.isFinite(state.scrollY) ? state.scrollY : 0;
    const zoomValue = asRecord(state.zoom)?.value;
    const zoom = typeof zoomValue === "number" && Number.isFinite(zoomValue) && zoomValue > 0 ? zoomValue : 1;
    const width = typeof state.width === "number" && Number.isFinite(state.width) ? state.width : undefined;
    const height = typeof state.height === "number" && Number.isFinite(state.height) ? state.height : undefined;
    return sdkSucceeded({
      pageRef,
      scrollX,
      scrollY,
      zoom,
      ...(width !== undefined && height !== undefined ? { bounds: { x: -scrollX, y: -scrollY, width: width / zoom, height: height / zoom } } : {}),
      visibleRefs: Object.freeze([] as (ElementRef | CameraRef)[]),
    });
  }

  return {
    pageRef,
    elements: Object.freeze(summaries),
    read,
    getElements,
    listCameras,
    getViewport: viewport,
    assets: createAssetMetadataProjection({ pageRef, files: input.files ?? {}, elements: input.elements }),
    listAssetMetadata: () => projectAssetMetadata({ pageRef, files: input.files ?? {}, elements: input.elements }),
    snapshots,
  };
}

export const createSceneProjection = createSemanticSceneProjection;
export const projectSemanticScene = createSemanticSceneProjection;

export function summarizeSemanticElement(pageRef: PageRef | string, element: unknown) {
  const record = asRecord(element);
  return record ? summarize(pageRef as PageRef, record) : undefined;
}
