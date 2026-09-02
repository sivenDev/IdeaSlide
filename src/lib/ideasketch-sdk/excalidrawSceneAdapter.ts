import {
  sdkRejected,
  sdkSucceeded,
  type CameraRef,
  type ElementRef,
  type IdeaSketchOperation,
  type IdeaSketchOperationResult,
  type IdeaSketchSdkErrorCode,
  type SdkRejected,
  type SdkSyncResult,
  type TempRef,
} from "./types.ts";
import {
  DEFAULT_OPERATION_LIMITS,
  normalizeBounds,
  validateOperationPlan,
  type IdeaSketchOperationLimits,
} from "./operationSchemas.ts";
import { validateIdeaSketchScenePostconditions } from "./scenePostconditions.ts";

export interface IdeaSketchSceneAdapterRuntime {
  createId: () => string;
  createNonce: () => number;
  now: () => number;
  /** Optional host-provided Excalidraw text metrics. The adapter keeps a
   * complete deterministic fallback for detached/test runtimes. */
  measureText?: (text: string, font: string, lineHeight: number) => { width: number; height: number };
  wrapText?: (text: string, font: string, maxWidth: number) => string;
  /** Optional host-provided native binding geometry. */
  calculateArrowBinding?: (input: {
    arrow: Readonly<Record<string, unknown>>;
    target: Readonly<Record<string, unknown>>;
    endpoint: "start" | "end";
    points: readonly [number, number][];
  }) => { focus: number; gap: number; fixedPoint?: readonly [number, number]; point?: readonly [number, number] };
}

export interface ExcalidrawSceneAdapterInput {
  scene: {
    elements: readonly unknown[];
    appState?: Partial<Record<string, unknown>>;
    files?: Record<string, unknown>;
  };
  operations: readonly IdeaSketchOperation[] | readonly unknown[];
  pageRef?: string;
  runtime?: Partial<IdeaSketchSceneAdapterRuntime>;
  limits?: Partial<IdeaSketchOperationLimits>;
  maxCameraCount?: number;
  cameraMinWidth?: number;
  cameraMinHeight?: number;
}

export interface ExcalidrawSceneAdapterResult {
  scene: {
    elements: readonly unknown[];
    appState: Partial<Record<string, unknown>>;
    files: Record<string, unknown>;
  };
  createdRefs: Readonly<Record<TempRef, ElementRef | CameraRef>>;
  updatedRefs: readonly (ElementRef | CameraRef)[];
  deletedRefs: readonly (ElementRef | CameraRef)[];
  cascadedRefs: readonly (ElementRef | CameraRef)[];
  operations: readonly IdeaSketchOperationResult[];
  diagnostics: readonly string[];
}

const DEFAULT_RUNTIME: IdeaSketchSceneAdapterRuntime = {
  createId: () => globalThis.crypto.randomUUID(),
  createNonce: () => Math.floor(Math.random() * 2_147_483_647),
  now: () => Date.now(),
};

const SHAPES = new Set(["rectangle", "ellipse", "diamond"]);
// Excalidraw's public semantic families map to its native font ids.  Virgil
// (id 1) is a legacy font; current hand-drawn text uses Excalifont (id 5)
// with the same CJK/emoji fallbacks as the native editor.
const TEXT_FONT_IDS: Record<string, number> = { "hand-drawn": 5, normal: 2, code: 3 };
const TEXT_FONT_NAMES: Record<number, "hand-drawn" | "normal" | "code"> = { 5: "hand-drawn", 2: "normal", 3: "code", 1: "hand-drawn" };

function asRecord(value: unknown): Record<string, any> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, any> : undefined;
}

function stableRef(id: string, camera = false) {
  return `${camera ? "camera" : "element"}:${id}` as ElementRef | CameraRef;
}

function textRef(id: string) {
  return stableRef(id) as ElementRef;
}

function nativeId(ref: unknown) {
  if (typeof ref !== "string") return undefined;
  const separator = ref.indexOf(":");
  return separator >= 0 ? ref.slice(separator + 1) : undefined;
}

function isCamera(element: Record<string, any> | undefined) {
  return Boolean(element && asRecord(element.customData)?.type === "camera");
}

function normalizeGeometry(input: Record<string, any>, limits: IdeaSketchOperationLimits) {
  const bounds = input.bounds ?? {
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
  };
  const result = normalizeBounds(bounds, limits);
  if (result.status === "rejected") return result;
  return sdkSucceeded(result.value);
}

function textStyle(input: Record<string, any>) {
  const style = asRecord(input.style) ?? input;
  return {
    ...(style.fontFamily !== undefined ? { fontFamily: style.fontFamily } : {}),
    ...(style.fontSize !== undefined ? { fontSize: style.fontSize } : {}),
    ...(style.color !== undefined ? { strokeColor: style.color } : {}),
    ...(style.textAlign !== undefined ? { textAlign: style.textAlign } : {}),
    ...(style.verticalAlign !== undefined ? { verticalAlign: style.verticalAlign } : {}),
    ...(style.opacity !== undefined ? { opacity: style.opacity } : {}),
    ...(style.lineHeight !== undefined ? { lineHeight: style.lineHeight } : {}),
  };
}

function lineHeightFor(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 1.25;
}

function textFontCss(fontFamily: unknown, fontSize: number) {
  const family = typeof fontFamily === "string" ? fontFamily : TEXT_FONT_NAMES[Number(fontFamily)] ?? "normal";
  if (family === "hand-drawn") return `${fontSize}px Excalifont, Xiaolai, Segoe UI Emoji`;
  if (family === "code") return `${fontSize}px Cascadia, Segoe UI Emoji`;
  return `${fontSize}px Helvetica, Segoe UI Emoji`;
}

function fallbackGlyphWidth(glyph: string, fontSize: number) {
  if (/^\s$/u.test(glyph)) return fontSize * 0.33;
  if (/[\u{1f000}-\u{1ffff}\u{2600}-\u{27ff}]/u.test(glyph)) return fontSize;
  if (/[\u{2e80}-\u{9fff}\u{ac00}-\u{d7ff}]/u.test(glyph)) return fontSize;
  if (/^[A-Z]$/u.test(glyph)) return fontSize * 0.62;
  return fontSize * 0.55;
}

function graphemes(value: string) {
  const Segmenter = (Intl as unknown as { Segmenter?: new (locales?: string[], options?: { granularity?: string }) => { segment(value: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Segmenter) return [...new Segmenter(undefined, { granularity: "grapheme" }).segment(value)].map((part) => part.segment);
  return Array.from(value);
}

function wrapLineNativeEquivalent(line: string, widthOf: (value: string) => number, maxWidth: number) {
  if (widthOf(line) <= maxWidth) return [line];
  const tokens = line.match(/\s+|[^\s]+/gu) ?? [];
  const lines: string[] = [];
  let current = "";
  for (const token of tokens) {
    const candidate = current + token;
    if (widthOf(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    // A single unbroken token may itself exceed the bounded width. Do not
    // accept it wholesale just because the current line is empty; split it
    // by grapheme so CJK, emoji, and long identifiers wrap deterministically.
    if (!current && widthOf(token) <= maxWidth) {
      current = token;
      continue;
    }
    if (current) lines.push(current.trimEnd());
    current = "";
    for (const glyph of graphemes(token)) {
      const glyphCandidate = current + glyph;
      if (current && widthOf(glyphCandidate) > maxWidth) {
        lines.push(current);
        current = glyph;
      } else {
        current = glyphCandidate;
      }
    }
  }
  if (current || lines.length === 0) lines.push(current.trimEnd());
  return lines;
}

function measureTextEquivalent(originalText: string, fontSize: number, layout: Record<string, any> | undefined, fontFamily?: unknown, runtime?: IdeaSketchSceneAdapterRuntime) {
  const widthLimit = typeof layout?.width === "number" ? layout.width : undefined;
  const lineHeight = lineHeightFor(layout?.lineHeight);
  const font = textFontCss(fontFamily, fontSize);
  if (runtime?.measureText) {
    const native = (value: string) => runtime.measureText!(value, font, lineHeight);
    if (widthLimit !== undefined && layout?.autoResize === false) {
      const wrapped = runtime.wrapText
        ? runtime.wrapText(originalText, font, widthLimit)
        : originalText;
      const metrics = native(wrapped);
      return { text: wrapped, width: widthLimit, height: Math.max(fontSize * lineHeight, metrics.height) };
    }
    const metrics = native(originalText);
    return { text: originalText, width: metrics.width, height: Math.max(fontSize * lineHeight, metrics.height) };
  }
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : undefined;
  const context = canvas?.getContext("2d") ?? undefined;
  if (context) context.font = textFontCss(fontFamily, fontSize);
  const widthOf = (value: string) => {
    if (context) return context.measureText(value || " ").width;
    return graphemes(value || " ").reduce((sum, glyph) => sum + fallbackGlyphWidth(glyph, fontSize), 0);
  };
  const lines = widthLimit !== undefined && layout?.autoResize === false
    ? originalText.split("\n").flatMap((line) => wrapLineNativeEquivalent(line, widthOf, widthLimit))
    : originalText.split("\n");
  const contentWidth = Math.max(widthOf(""), ...lines.map((line) => widthOf(line)));
  const width = widthLimit !== undefined && layout?.autoResize === false ? widthLimit : contentWidth;
  const height = Math.max(fontSize * lineHeight, lines.length * fontSize * lineHeight);
  return { text: lines.join("\n"), width, height };
}

function touch(element: Record<string, any>, runtime: IdeaSketchSceneAdapterRuntime, updates: Record<string, unknown> = {}): Record<string, any> {
  return {
    ...element,
    ...updates,
    version: Math.max(1, Number(element.version) || 1) + 1,
    versionNonce: runtime.createNonce(),
    updated: runtime.now(),
  };
}

function addBoundElement(container: Record<string, any>, id: string, type: "text" | "arrow", runtime: IdeaSketchSceneAdapterRuntime) {
  const records = Array.isArray(container.boundElements) ? container.boundElements.filter((item: unknown) => asRecord(item)?.id !== id) : [];
  return touch(container, runtime, { boundElements: [...records, { id, type }] });
}

function removeBoundElement(container: Record<string, any>, id: string, runtime: IdeaSketchSceneAdapterRuntime) {
  const records = Array.isArray(container.boundElements) ? container.boundElements.filter((item: unknown) => asRecord(item)?.id !== id) : [];
  return touch(container, runtime, { boundElements: records.length > 0 ? records : null });
}

function absolutePoints(arrow: Record<string, any>): [number, number][] {
  if (!Array.isArray(arrow.points)) return [];
  return arrow.points.filter((point: unknown): point is [number, number] => Array.isArray(point) && point.length === 2 && point.every((value) => typeof value === "number" && Number.isFinite(value))).map((point) => [point[0] + Number(arrow.x || 0), point[1] + Number(arrow.y || 0)]);
}

function withAbsolutePoints(arrow: Record<string, any>, points: readonly [number, number][], runtime: IdeaSketchSceneAdapterRuntime) {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return touch(arrow, runtime, {
    x,
    y,
    width: Math.max(0, Math.max(...xs) - x),
    height: Math.max(0, Math.max(...ys) - y),
    points: points.map((point) => [point[0] - x, point[1] - y]),
  });
}

function pointEqual(left: readonly [number, number], right: readonly [number, number]) {
  return left[0] === right[0] && left[1] === right[1];
}

function pathMidpoint(points: readonly [number, number][]): [number, number] | undefined {
  if (points.length === 0) return undefined;
  if (points.length === 1) return points[0];
  const lengths = points.slice(1).map((point, index) => {
    const previous = points[index];
    return Math.hypot(point[0] - previous[0], point[1] - previous[1]);
  });
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total === 0) return points[0];
  let travelled = 0;
  const target = total / 2;
  for (let index = 0; index < lengths.length; index += 1) {
    const segment = lengths[index];
    if (travelled + segment < target) {
      travelled += segment;
      continue;
    }
    const ratio = segment === 0 ? 0 : (target - travelled) / segment;
    const start = points[index];
    const end = points[index + 1];
    return [
      start[0] + (end[0] - start[0]) * ratio,
      start[1] + (end[1] - start[1]) * ratio,
    ];
  }
  return points[points.length - 1];
}

function shapeAnchor(shape: Record<string, any>, toward: readonly [number, number]) {
  const x = Number(shape.x) || 0;
  const y = Number(shape.y) || 0;
  const width = Math.max(1, Number(shape.width) || 1);
  const height = Math.max(1, Number(shape.height) || 1);
  const center: [number, number] = [x + width / 2, y + height / 2];
  const dx = toward[0] - center[0];
  const dy = toward[1] - center[1];
  if (dx === 0 && dy === 0) return center;
  const radiusX = width / 2;
  const radiusY = height / 2;
  const scale = shape.type === "ellipse"
    ? 1 / Math.sqrt((dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY))
    : shape.type === "diamond"
      ? 1 / (Math.abs(dx) / radiusX + Math.abs(dy) / radiusY)
      : Math.min(
          Math.abs(dx) > 0 ? radiusX / Math.abs(dx) : Number.POSITIVE_INFINITY,
          Math.abs(dy) > 0 ? radiusY / Math.abs(dy) : Number.POSITIVE_INFINITY,
        );
  return [center[0] + dx * scale, center[1] + dy * scale] as [number, number];
}

const BOUND_TEXT_PADDING = 8;

function boundTextMaxWidth(container: Record<string, any>) {
  const width = Number(container.width) || 0;
  if (container.type === "ellipse") return Math.max(1, Math.round(width / 2 * Math.sqrt(2)) - BOUND_TEXT_PADDING * 2);
  if (container.type === "diamond") return Math.max(1, Math.round(width / 2) - BOUND_TEXT_PADDING * 2);
  return Math.max(1, width - BOUND_TEXT_PADDING * 2);
}

function boundTextMaxHeight(container: Record<string, any>) {
  const height = Number(container.height) || 0;
  if (container.type === "ellipse") return Math.max(1, Math.round(height / 2 * Math.sqrt(2)) - BOUND_TEXT_PADDING * 2);
  if (container.type === "diamond") return Math.max(1, Math.round(height / 2) - BOUND_TEXT_PADDING * 2);
  return Math.max(1, height - BOUND_TEXT_PADDING * 2);
}

function containerDimensionForText(dimension: number, type: string) {
  const measured = Math.ceil(dimension);
  if (type === "ellipse") return Math.round((measured + BOUND_TEXT_PADDING * 2) / Math.sqrt(2) * 2);
  if (type === "diamond") return 2 * (measured + BOUND_TEXT_PADDING * 2);
  return measured + BOUND_TEXT_PADDING * 2;
}

function boundTextContainerCoords(container: Record<string, any>) {
  let offsetX = BOUND_TEXT_PADDING;
  let offsetY = BOUND_TEXT_PADDING;
  if (container.type === "ellipse") {
    offsetX += Number(container.width) / 2 * (1 - Math.sqrt(2) / 2);
    offsetY += Number(container.height) / 2 * (1 - Math.sqrt(2) / 2);
  } else if (container.type === "diamond") {
    offsetX += Number(container.width) / 4;
    offsetY += Number(container.height) / 4;
  }
  return { x: Number(container.x) + offsetX, y: Number(container.y) + offsetY };
}

function endpointIndex(endpoint: "start" | "end", points: readonly [number, number][]) {
  return endpoint === "start" ? 0 : Math.max(0, points.length - 1);
}

function nativeArrowhead(value: unknown) {
  return value === "none" ? null : value;
}

function cameraElement(id: string, bounds: { x: number; y: number; width: number; height: number }, order: number, runtime: IdeaSketchSceneAdapterRuntime) {
  return {
    id,
    type: "rectangle",
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    angle: 0,
    strokeColor: "#1e90ff",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "dashed",
    roughness: 0,
    opacity: 60,
    roundness: null,
    seed: runtime.createNonce(),
    version: 1,
    versionNonce: runtime.createNonce(),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: runtime.now(),
    link: null,
    locked: false,
    customData: { type: "camera", order },
  };
}

function textElement(id: string, x: number, y: number, originalText: string, input: Record<string, any>, runtime: IdeaSketchSceneAdapterRuntime) {
  const style = textStyle(input);
  const explicitLayout = asRecord(input.layout);
  const explicitWidth = explicitLayout?.width;
  const layout = explicitLayout && explicitLayout.autoResize === undefined && explicitWidth !== undefined
    ? { ...explicitLayout, autoResize: false }
    : explicitLayout;
  const fontSize = typeof style.fontSize === "number" ? style.fontSize : 20;
  const measured = measureTextEquivalent(originalText, fontSize, { ...(layout ?? {}), ...(style.lineHeight !== undefined ? { lineHeight: style.lineHeight } : {}) }, style.fontFamily, runtime);
  const fontFamily = typeof style.fontFamily === "string" ? TEXT_FONT_IDS[style.fontFamily] ?? 5 : typeof style.fontFamily === "number" ? style.fontFamily : 5;
  return {
    id,
    type: "text",
    x,
    y,
    width: layout?.autoResize === false && typeof explicitWidth === "number" ? explicitWidth : measured.width,
    height: measured.height,
    angle: 0,
    strokeColor: typeof style.strokeColor === "string" ? style.strokeColor : "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: typeof style.opacity === "number" ? style.opacity : 100,
    roundness: null,
    seed: runtime.createNonce(),
    version: 1,
    versionNonce: runtime.createNonce(),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: runtime.now(),
    link: null,
    locked: false,
    text: measured.text,
    originalText,
    fontSize,
    fontFamily,
    textAlign: style.textAlign ?? "left",
    verticalAlign: style.verticalAlign ?? "top",
    containerId: null,
    lineHeight: lineHeightFor(style.lineHeight),
    autoResize: layout?.autoResize !== false && layout?.width === undefined,
  };
}

function isImported(element: Record<string, any>) {
  const customData = asRecord(element.customData);
  return customData?.imported === true || customData?.source === "imported";
}

function hasPatchChange(element: Record<string, any>, updates: Record<string, unknown>) {
  return Object.entries(updates).some(([key, value]) => JSON.stringify(element[key] ?? null) !== JSON.stringify(value ?? null));
}

function reject(code: IdeaSketchSdkErrorCode, message: string, operationIndex?: number): SdkSyncResult<never> {
  const result = sdkRejected(code, message);
  if (operationIndex === undefined) return result;
  return { ...result, error: { ...result.error, operationIndex } };
}

function isTargetError(value: Record<string, any> | SdkRejected): value is SdkRejected {
  return value.status === "rejected";
}

function applyIdeaSketchScenePlanUnsafe(input: ExcalidrawSceneAdapterInput): SdkSyncResult<ExcalidrawSceneAdapterResult> {
  const limits = { ...DEFAULT_OPERATION_LIMITS, ...(input.limits ?? {}) };
  const plan = validateOperationPlan(input.operations, limits);
  if (plan.status === "rejected") return plan;
  const runtime = { ...DEFAULT_RUNTIME, ...(input.runtime ?? {}) };
  let elements = input.scene.elements.map((element) => structuredClone(element)) as Record<string, any>[];
  const appState = { ...(input.scene.appState ?? {}) };
  const files = structuredClone(input.scene.files ?? {});
  const byId = () => new Map(elements.filter((element) => typeof element?.id === "string").map((element) => [element.id, element]));
  const tempMap = new Map<string, string>();
  const createdIds = new Set<string>();
  const createdRefs: Record<string, ElementRef | CameraRef> = {};
  const updatedRefs = new Set<ElementRef | CameraRef>();
  const deletedRefs = new Set<ElementRef | CameraRef>();
  const cascadedRefs = new Set<ElementRef | CameraRef>();
  const touchedIds = new Set<string>();
  const operationResults: IdeaSketchOperationResult[] = [];

  const resolve = (ref: unknown) => {
    if (typeof ref !== "string") return undefined;
    const actual = tempMap.get(ref) ?? nativeId(ref);
    if (!actual) return undefined;
    return byId().get(actual);
  };
  const markUpdated = (element: Record<string, any>) => {
    if (element?.id) touchedIds.add(element.id);
    if (element?.id && !createdIds.has(element.id) && element.isDeleted !== true) updatedRefs.add(stableRef(element.id, isCamera(element)));
  };
  const markCascaded = (element: Record<string, any>) => {
    if (element?.id) cascadedRefs.add(stableRef(element.id, isCamera(element)));
  };
  const markDeleted = (element: Record<string, any>, cascaded = false) => {
    if (!element?.id) return;
    touchedIds.add(element.id);
    const ref = stableRef(element.id, isCamera(element));
    deletedRefs.add(ref);
    if (cascaded) cascadedRefs.add(ref);
  };
  const clearSelection = (id: string) => {
    const selected = asRecord(appState.selectedElementIds);
    if (!selected || !Object.prototype.hasOwnProperty.call(selected, id)) return;
    const next = { ...selected };
    delete next[id];
    appState.selectedElementIds = next;
  };
  const replace = (next: Record<string, any>) => {
    const index = elements.findIndex((element) => element.id === next.id);
    if (index >= 0) elements[index] = next;
  };
  const placeAfter = (elementId: string, containerId: string) => {
    const elementIndex = elements.findIndex((element) => element.id === elementId);
    const containerIndex = elements.findIndex((element) => element.id === containerId);
    if (elementIndex < 0 || containerIndex < 0 || elementIndex === containerIndex + 1) return;
    const [element] = elements.splice(elementIndex, 1);
    const nextContainerIndex = elements.findIndex((candidate) => candidate.id === containerId);
    elements.splice(nextContainerIndex + 1, 0, element);
  };
  const boundTextFor = (container: Record<string, any>) => {
    const item = Array.isArray(container.boundElements)
      ? container.boundElements.map((binding: unknown) => asRecord(binding)).find((binding: Record<string, any> | undefined) => binding?.type === "text" && byId().get(binding.id)?.isDeleted !== true)
      : undefined;
    return item ? byId().get(item.id) : undefined;
  };
  const collectStyleClosure = (seedRefs: readonly unknown[]) => {
    const closure = new Set<string>();
    const queue: string[] = [];
    for (const ref of seedRefs) {
      const target = resolve(ref);
      if (target && !target.isDeleted) {
        closure.add(target.id);
        queue.push(target.id);
      }
    }
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const current = byId().get(currentId);
      if (!current) continue;
      const currentGroups = Array.isArray(current.groupIds) ? current.groupIds : [];
      const currentFrame = typeof current.frameId === "string" ? current.frameId : undefined;
      for (const candidate of elements) {
        if (!candidate || candidate.isDeleted || candidate.id === current.id) continue;
        const candidateGroups = Array.isArray(candidate.groupIds) ? candidate.groupIds : [];
        const sameGroup = currentGroups.length > 0 && candidateGroups.some((group: unknown) => currentGroups.includes(group));
        const sameFrame = currentFrame !== undefined && candidate.frameId === currentFrame;
        const framePeer = candidate.frameId === current.id || current.frameId === candidate.id;
        const reverseRelation = (current.type === "text" && candidate.containerId === current.id)
          || (candidate.type === "text" && candidate.containerId === current.id)
          || (candidate.type === "arrow" && (asRecord(candidate.startBinding)?.elementId === current.id || asRecord(candidate.endBinding)?.elementId === current.id))
          || (Array.isArray(current.boundElements) && current.boundElements.some((item: unknown) => asRecord(item)?.id === candidate.id));
        if ((sameGroup || sameFrame || framePeer || reverseRelation) && !closure.has(candidate.id)) {
          closure.add(candidate.id);
          queue.push(candidate.id);
        }
      }
      if (typeof current.containerId === "string" && byId().has(current.containerId) && !closure.has(current.containerId)) {
        closure.add(current.containerId);
        queue.push(current.containerId);
      }
    }
    return [...closure].map((id) => byId().get(id)).filter((element): element is Record<string, any> => Boolean(element));
  };
  const layoutBoundText = (text: Record<string, any>, container: Record<string, any>) => {
    let nextContainer = container;
    let width = boundTextMaxWidth(nextContainer);
    const originalText = typeof text.originalText === "string" ? text.originalText : String(text.text ?? "");
    const fontSize = Number(text.fontSize) || 20;
    const lineHeight = Number(text.lineHeight) || 1.25;
    const natural = measureTextEquivalent(originalText, fontSize, { autoResize: true, lineHeight }, text.fontFamily, runtime);
    let measured = measureTextEquivalent(originalText, fontSize, { autoResize: false, width, lineHeight }, text.fontFamily, runtime);
    let contentMeasured = measureTextEquivalent(measured.text, fontSize, { autoResize: true, lineHeight }, text.fontFamily, runtime);
    const nextWidth = natural.width > width ? containerDimensionForText(natural.width, nextContainer.type) : Number(nextContainer.width);
    const nextHeight = measured.height > boundTextMaxHeight(nextContainer)
      ? containerDimensionForText(measured.height, nextContainer.type)
      : Number(nextContainer.height);
    if (nextWidth !== Number(nextContainer.width) || nextHeight !== Number(nextContainer.height)) {
      nextContainer = touch(container, runtime, {
        ...(nextWidth !== Number(nextContainer.width) ? { width: nextWidth } : {}),
        ...(nextHeight !== Number(nextContainer.height) ? { height: nextHeight } : {}),
      });
      replace(nextContainer);
      markUpdated(nextContainer);
      updateArrowsForTarget(nextContainer);
      width = boundTextMaxWidth(nextContainer);
    }
    measured = measureTextEquivalent(originalText, fontSize, { autoResize: false, width, lineHeight }, text.fontFamily, runtime);
    contentMeasured = measureTextEquivalent(measured.text, fontSize, { autoResize: true, lineHeight }, text.fontFamily, runtime);
    const coords = boundTextContainerCoords(nextContainer);
    const maxHeight = boundTextMaxHeight(nextContainer);
    const horizontal = text.textAlign === "center"
      ? (width - contentMeasured.width) / 2
      : text.textAlign === "right"
        ? width - contentMeasured.width
        : 0;
    const vertical = text.verticalAlign === "middle"
      ? (maxHeight - contentMeasured.height) / 2
      : text.verticalAlign === "bottom"
        ? maxHeight - contentMeasured.height
        : 0;
    const updates: Record<string, unknown> = {
      x: coords.x + horizontal,
      y: coords.y + vertical,
      width: contentMeasured.width,
      height: contentMeasured.height,
      text: measured.text,
      autoResize: false,
      containerId: nextContainer.id,
    };
    if (hasPatchChange(text, updates)) {
      const nextText = touch(text, runtime, updates);
      replace(nextText);
      markUpdated(nextText);
    }
    const beforeIndex = elements.findIndex((element) => element.id === text.id);
    placeAfter(text.id, nextContainer.id);
    const afterIndex = elements.findIndex((element) => element.id === text.id);
    if (beforeIndex !== afterIndex) markUpdated(byId().get(text.id) ?? text);
  };
  const layoutArrowLabel = (arrow: Record<string, any>) => {
    const label = boundTextFor(arrow);
    const points = absolutePoints(arrow);
    if (!label || points.length < 2) return;
    const middle = pathMidpoint(points);
    if (!middle) return;
    const wrapped = measureTextEquivalent(
      typeof label.originalText === "string" ? label.originalText : String(label.text ?? ""),
      Number(label.fontSize) || 20,
      { autoResize: false, width: Number(label.width) || undefined, lineHeight: Number(label.lineHeight) || 1.25 },
      label.fontFamily,
      runtime,
    );
    const measured = measureTextEquivalent(wrapped.text, Number(label.fontSize) || 20, { autoResize: true, lineHeight: Number(label.lineHeight) || 1.25 }, label.fontFamily, runtime);
    const updates = {
      x: middle[0] - measured.width / 2,
      y: middle[1] - measured.height / 2,
      width: measured.width,
      height: measured.height,
      text: wrapped.text,
    };
    if (hasPatchChange(label, updates)) {
      const next = touch(label, runtime, updates);
      replace(next);
      markUpdated(next);
    }
  };
  const updateArrowsForMove = (target: Record<string, any>, dx: number, dy: number) => {
    for (const arrow of elements.filter((element) => element.type === "arrow" && !element.isDeleted)) {
      let next = arrow;
      let points = absolutePoints(arrow);
      if (points.length < 2) continue;
      for (const endpoint of ["start", "end"] as const) {
        if (asRecord(arrow[`${endpoint}Binding`])?.elementId !== target.id) continue;
        const index = endpointIndex(endpoint, points);
        const nextPoints = points.map((point, pointIndex) => pointIndex === index ? [point[0] + dx, point[1] + dy] as [number, number] : point);
        next = withAbsolutePoints(next, nextPoints, runtime);
        points = nextPoints;
      }
      if (next !== arrow) { replace(next); markUpdated(next); layoutArrowLabel(next); }
    }
  };
  const updateArrowsForTarget = (target: Record<string, any>) => {
    for (const arrow of elements.filter((element) => element.type === "arrow" && !element.isDeleted)) {
      let points = absolutePoints(arrow);
      if (points.length < 2) continue;
      let next = arrow;
      for (const endpoint of ["start", "end"] as const) {
        if (asRecord(arrow[`${endpoint}Binding`])?.elementId !== target.id) continue;
        const opposite = endpoint === "start" ? points[points.length - 1] : points[0];
        const anchor = shapeAnchor(target, opposite);
        const index = endpointIndex(endpoint, points);
        if (pointEqual(points[index], anchor)) continue;
        const nextPoints = points.map((point, pointIndex) => pointIndex === index ? anchor : point);
        next = withAbsolutePoints(next, nextPoints, runtime);
        points = nextPoints;
      }
      if (next !== arrow) {
        replace(next);
        markUpdated(next);
        layoutArrowLabel(next);
      }
    }
  };
  const softDelete = (element: Record<string, any>, cascaded: boolean) => {
    if (element.isDeleted) return;
    clearSelection(element.id);
    if (element.type === "arrow") {
      const label = boundTextFor(element);
      if (label) softDelete(label, true);
      for (const endpoint of ["start", "end"] as const) {
        const targetId = asRecord(element[`${endpoint}Binding`])?.elementId;
        const target = typeof targetId === "string" ? byId().get(targetId) : undefined;
        if (!target || target.isDeleted) continue;
        const nextTarget = removeBoundElement(target, element.id, runtime);
        replace(nextTarget);
        markUpdated(nextTarget);
        markCascaded(nextTarget);
      }
    }
    if (element.type === "text" && typeof element.containerId === "string") {
      const container = byId().get(element.containerId);
      if (container && !container.isDeleted) {
        const nextContainer = removeBoundElement(container, element.id, runtime);
        replace(nextContainer);
        markUpdated(nextContainer);
        markCascaded(nextContainer);
      }
    }
    if (element.type !== "arrow") {
      for (const arrow of elements.filter((candidate) => candidate.type === "arrow" && !candidate.isDeleted)) {
        let nextArrow = arrow;
        for (const endpoint of ["start", "end"] as const) {
          if (asRecord(arrow[`${endpoint}Binding`])?.elementId !== element.id) continue;
          nextArrow = touch(nextArrow, runtime, { [`${endpoint}Binding`]: null });
          const points = absolutePoints(nextArrow);
          if (points.length > 0) nextArrow = withAbsolutePoints(nextArrow, points, runtime);
        }
        if (nextArrow !== arrow) {
          replace(nextArrow);
          markUpdated(nextArrow);
          markCascaded(nextArrow);
          layoutArrowLabel(nextArrow);
        }
      }
    }
    const tombstoneUpdates: Record<string, unknown> = {
      isDeleted: true,
      boundElements: null,
      startBinding: null,
      endBinding: null,
    };
    if (element.type === "text") tombstoneUpdates.containerId = null;
    const tombstone = touch(element, runtime, tombstoneUpdates);
    replace(tombstone);
    markDeleted(tombstone, cascaded);
  };
  const deleteRelationConflict = (target: Record<string, any>) => {
    const liveById = byId();
    const hasReverse = (container: Record<string, any> | undefined, id: string, type: string) => Boolean(
      container
      && Array.isArray(container.boundElements)
      && container.boundElements.some((item: unknown) => asRecord(item)?.id === id && asRecord(item)?.type === type),
    );
    if (target.type === "text" && typeof target.containerId === "string") {
      const container = liveById.get(target.containerId);
      if (!container || container.isDeleted || !hasReverse(container, target.id, "text")) return "The text/container relationship is malformed.";
    }
    if (target.type === "arrow") {
      const label = boundTextFor(target);
      if (label && (label.containerId !== target.id || !hasReverse(target, label.id, "text"))) return "The arrow label relationship is malformed.";
      for (const endpoint of ["start", "end"] as const) {
        const binding = asRecord(target[`${endpoint}Binding`]);
        if (!binding?.elementId) continue;
        const shape = liveById.get(binding.elementId);
        if (!shape || shape.isDeleted || !hasReverse(shape, target.id, "arrow")) return "The arrow/shape relationship is malformed.";
      }
    }
    if (Array.isArray(target.boundElements)) {
      for (const item of target.boundElements) {
        const binding = asRecord(item);
        if (!binding || typeof binding.id !== "string" || (binding.type !== "text" && binding.type !== "arrow")) return "The boundElements relationship is malformed.";
        const related = liveById.get(binding.id);
        if (!related || related.isDeleted) return "The boundElements relationship is malformed.";
        if (binding.type === "text" && (related.type !== "text" || related.containerId !== target.id)) return "The text/container relationship is malformed.";
        if (binding.type === "arrow" && (related.type !== "arrow" || (asRecord(related.startBinding)?.elementId !== target.id && asRecord(related.endBinding)?.elementId !== target.id))) return "The arrow/shape relationship is malformed.";
      }
    }
    if (target.type !== "arrow") {
      for (const arrow of elements.filter((candidate) => candidate.type === "arrow" && !candidate.isDeleted)) {
        const pointsToTarget = asRecord(arrow.startBinding)?.elementId === target.id || asRecord(arrow.endBinding)?.elementId === target.id;
        if (pointsToTarget && !hasReverse(target, arrow.id, "arrow")) return "The arrow/shape relationship is malformed.";
      }
    }
    return undefined;
  };
  const relationMutationConflict = (target: Record<string, any>, operationIndex: number) => {
    // Moving/resizing/deleting a shape also mutates its bound text, attached
    // arrow endpoint geometry, and (for imported connectors) label layout.
    // Those implicit targets are part of the mutation closure and therefore
    // must obey the same locked/imported protections as explicit targets.
    if (!SHAPES.has(String(target.type)) || isCamera(target)) return undefined;
    const bound = boundTextFor(target);
    if (bound?.locked) return reject("locked_target", "The operation would modify a locked bound text.", operationIndex);
    if (bound && isImported(bound)) return reject("unsupported_operation", "The operation would modify imported bound text.", operationIndex);
    for (const arrow of elements.filter((candidate) => candidate.type === "arrow" && !candidate.isDeleted)) {
      const pointsToTarget = asRecord(arrow.startBinding)?.elementId === target.id
        || asRecord(arrow.endBinding)?.elementId === target.id;
      if (!pointsToTarget) continue;
      if (arrow.locked) return reject("locked_target", "The operation would modify a locked bound arrow.", operationIndex);
      if (isImported(arrow)) return reject("unsupported_operation", "The operation would modify an imported bound arrow.", operationIndex);
    }
    return undefined;
  };

  for (const [index, operation] of plan.value.entries()) {
    const op = operation as IdeaSketchOperation & Record<string, any>;
    const operationBaseline = {
      createdRefs: new Set(Object.keys(createdRefs)),
      updatedRefs: new Set(updatedRefs),
      deletedRefs: new Set(deletedRefs),
      cascadedRefs: new Set(cascadedRefs),
    };
    const operationTarget = (result: Record<string, any>) => {
      const directRef = result.textRef
        ?? (op.kind === "create-shape" || op.kind === "create-arrow" || op.kind === "create-text" || op.kind === "create-camera" ? createdRefs[op.ref] : undefined)
        ?? op.elementRef
        ?? op.shapeRef
        ?? op.arrowRef
        ?? op.textRef
        ?? op.cameraRef;
      const nativeTargetId = nativeId(directRef);
      return nativeTargetId ? byId().get(nativeTargetId) : undefined;
    };
    const operationRefs = (value: unknown): string[] => {
      if (typeof value === "string") return /^(element|camera|temp):/.test(value) ? [value] : [];
      if (Array.isArray(value)) return value.flatMap((item) => operationRefs(item));
      const record = asRecord(value);
      return record ? Object.values(record).flatMap((item) => operationRefs(item)) : [];
    };
    const recordOperation = (result: Record<string, any>) => {
      const created = Object.entries(createdRefs)
        .filter(([ref]) => !operationBaseline.createdRefs.has(ref))
        .map(([, ref]) => ref);
      const updated = [...updatedRefs].filter((ref) => !operationBaseline.updatedRefs.has(ref));
      const deleted = [...deletedRefs].filter((ref) => !operationBaseline.deletedRefs.has(ref));
      const cascaded = [...cascadedRefs].filter((ref) => !operationBaseline.cascadedRefs.has(ref));
      const explicit = result.outcome === "noop"
        ? []
        : operationRefs({ ...op, ...result }).flatMap((ref) => {
            const id = tempMap.get(ref) ?? nativeId(ref);
            const target = id ? byId().get(id) : undefined;
            return target ? [stableRef(target.id, isCamera(target))] : [];
          });
      const affected = [...new Set([...created, ...updated, ...deleted, ...cascaded, ...explicit])];
      const target = operationTarget(result);
      operationResults.push(Object.freeze({
        ...result,
        ...(affected.length > 0 ? { affectedRefs: Object.freeze(affected) } : {}),
        ...(updated.length > 0 ? { updatedRefs: Object.freeze(updated) } : {}),
        ...(deleted.length > 0 ? { deletedRefs: Object.freeze(deleted) } : {}),
        ...(cascaded.length > 0 ? { cascadedRefs: Object.freeze(cascaded) } : {}),
        ...(target && typeof target.x === "number" && typeof target.y === "number" && typeof target.width === "number" && typeof target.height === "number"
          ? { bounds: Object.freeze({ x: target.x, y: target.y, width: Math.abs(target.width), height: Math.abs(target.height) }) }
          : {}),
      }) as IdeaSketchOperationResult);
    };
  const getTarget = (key: string, camera = false): Record<string, any> | SdkRejected => {
      const target = resolve(op[key]);
      if (!target) return reject("target_not_found", `Operation target ${String(op[key])} does not exist.`, index);
      if (camera ? !isCamera(target) : isCamera(target)) return reject("unsupported_operation", "Camera targets require dedicated Camera operations.", index);
      if (target.isDeleted === true) return reject("target_not_found", "The target has already been deleted.", index);
      if (target.locked) return reject("locked_target", "The target is locked.", index);
      if (isImported(target)) return reject("unsupported_operation", "Imported elements are read-only in v1.", index);
      if (target.angle !== undefined && Number(target.angle) !== 0) return reject("unsupported_operation", "Rotated elements are not supported by this operation.", index);
      if (Array.isArray(target.groupIds) && target.groupIds.length > 0) return reject("unsupported_operation", "Grouped elements are not supported by this operation.", index);
      if (target.frameId !== undefined && target.frameId !== null) return reject("unsupported_operation", "Framed elements are not supported by this operation.", index);
      if (camera && (target.type !== "rectangle" || !isCamera(target))) return reject("relation_conflict", "The Camera target is malformed.", index);
      return target;
    };
    const getTextContainer = (text: Record<string, any>, operationIndex: number) => {
      if (typeof text.containerId !== "string") return undefined;
      const container = byId().get(text.containerId);
      if (!container || container.isDeleted) return reject("relation_conflict", "The text container is missing or deleted.", operationIndex);
      if (container.locked) return reject("locked_target", "The text container is locked.", operationIndex);
      if (isImported(container)) return reject("unsupported_operation", "Imported text containers are read-only in v1.", operationIndex);
      if (!SHAPES.has(container.type) || isCamera(container)) return reject("unsupported_operation", "The text container is unsupported.", operationIndex);
      return container;
    };
    if (op.kind === "create-shape") {
      const geometry = normalizeGeometry(op, limits);
      if (geometry.status === "rejected") return reject(geometry.error.code, geometry.error.message, index);
      const style = asRecord(op.style) ?? {};
      const element = {
        id: runtime.createId(), type: op.shape, ...geometry.value, angle: 0,
        strokeColor: style.strokeColor ?? "#1e1e1e", backgroundColor: style.backgroundColor ?? "transparent",
        fillStyle: style.fillStyle ?? "solid", strokeWidth: style.strokeWidth ?? 1, strokeStyle: style.strokeStyle ?? "solid",
        roughness: style.roughness ?? 1, opacity: style.opacity ?? 100, roundness: style.roundness === "rounded" ? { type: 3 } : null,
        seed: runtime.createNonce(), version: 1, versionNonce: runtime.createNonce(), isDeleted: false,
        groupIds: [], frameId: null, boundElements: null, updated: runtime.now(), link: null, locked: false,
      };
      elements.push(element);
      createdIds.add(element.id);
      tempMap.set(op.ref, element.id);
      createdRefs[op.ref] = stableRef(element.id);
      markUpdated(element);
      if (op.boundText) {
        const content = op.boundText.originalText ?? op.boundText.text ?? "";
        const text: Record<string, any> = textElement(runtime.createId(), element.x + 8, element.y + 8, content, op.boundText, runtime);
        text.containerId = element.id;
        elements.push(text);
        createdIds.add(text.id);
        tempMap.set(op.boundText.ref, text.id);
        createdRefs[op.boundText.ref] = stableRef(text.id);
        const withBinding = addBoundElement(element, text.id, "text", runtime);
        replace(withBinding);
        layoutBoundText(text, withBinding);
        markUpdated(withBinding);
      }
      recordOperation({ index, kind: op.kind, outcome: "created" });
      continue;
    }
    if (op.kind === "create-arrow") {
      const points = Array.isArray(op.points)
        ? op.points
        : op.start && op.end
          ? [[op.start.x, op.start.y], [op.end.x, op.end.y]]
          : [];
      const absolute = points.map((point: any) => [Number(point[0]), Number(point[1])] as [number, number]);
      const xs = absolute.map((point) => point[0]); const ys = absolute.map((point) => point[1]);
      const x = Math.min(...xs); const y = Math.min(...ys);
      const style = asRecord(op.style) ?? {};
      const heads = asRecord(op.arrowheads) ?? {};
      const arrow = {
        id: runtime.createId(), type: "arrow", x, y, width: Math.max(0, Math.max(...xs) - x), height: Math.max(0, Math.max(...ys) - y),
        angle: 0, points: absolute.map((point) => [point[0] - x, point[1] - y]), startBinding: null, endBinding: null,
        startArrowhead: nativeArrowhead(op.startArrowhead ?? heads.start ?? "none"), endArrowhead: nativeArrowhead(op.endArrowhead ?? heads.end ?? "arrow"),
        lastCommittedPoint: null, elbowed: false, strokeColor: style.strokeColor ?? "#1e1e1e", backgroundColor: "transparent",
        fillStyle: style.fillStyle ?? "solid", strokeWidth: style.strokeWidth ?? 1, strokeStyle: style.strokeStyle ?? "solid",
        roughness: style.roughness ?? 1, opacity: style.opacity ?? 100, roundness: null, seed: runtime.createNonce(), version: 1,
        versionNonce: runtime.createNonce(), isDeleted: false, groupIds: [], frameId: null, boundElements: null, updated: runtime.now(), link: null, locked: false,
      };
      elements.push(arrow); createdIds.add(arrow.id); tempMap.set(op.ref, arrow.id); createdRefs[op.ref] = stableRef(arrow.id); markUpdated(arrow);
      recordOperation({ index, kind: op.kind, outcome: "created" });
      continue;
    }
    if (op.kind === "create-text") {
      const requestedStyle = asRecord(op.style) ?? {};
      if (requestedStyle.verticalAlign !== undefined && requestedStyle.verticalAlign !== "top") return reject("unsupported_operation", "Standalone text only supports top vertical alignment.", index);
      const text: Record<string, any> = textElement(runtime.createId(), Number(op.x), Number(op.y), op.originalText ?? op.text ?? "", op, runtime);
      elements.push(text); createdIds.add(text.id); tempMap.set(op.ref, text.id); createdRefs[op.ref] = stableRef(text.id); markUpdated(text);
      recordOperation({ index, kind: op.kind, outcome: "created" });
      continue;
    }
    if (op.kind === "create-camera") {
      const geometry = normalizeGeometry(op, limits);
      if (geometry.status === "rejected") return reject(geometry.error.code, geometry.error.message, index);
      if (input.cameraMinWidth !== undefined && geometry.value.width < input.cameraMinWidth) return reject("limit_exceeded", "Camera width is below the supported minimum.", index);
      if (input.cameraMinHeight !== undefined && geometry.value.height < input.cameraMinHeight) return reject("limit_exceeded", "Camera height is below the supported minimum.", index);
      const cameras = elements.filter((element) => isCamera(element) && !element.isDeleted).sort((a, b) => Number(asRecord(a.customData)?.order ?? 0) - Number(asRecord(b.customData)?.order ?? 0));
      if (input.maxCameraCount !== undefined && cameras.length >= input.maxCameraCount) return reject("limit_exceeded", "The Page exceeds the Camera limit.", index);
      if (op.atIndex !== undefined && op.atIndex > cameras.length) return reject("invalid_request", "create-camera.atIndex is outside the live Camera range.", index);
      const order = op.atIndex === undefined ? Math.max(0, ...cameras.map((camera) => Number(asRecord(camera.customData)?.order ?? 0))) + 1 : op.atIndex + 1;
      const camera = cameraElement(runtime.createId(), geometry.value, order, runtime);
      elements.push(camera); createdIds.add(camera.id); tempMap.set(op.ref, camera.id); createdRefs[op.ref] = stableRef(camera.id, true); markUpdated(camera);
      if (op.atIndex !== undefined) {
        const ordered = [...cameras.slice(0, op.atIndex), camera, ...cameras.slice(op.atIndex)];
        ordered.forEach((item, itemIndex) => {
          if (Number(asRecord(item.customData)?.order) === itemIndex + 1) return;
          const next = touch(item, runtime, { customData: { ...asRecord(item.customData), order: itemIndex + 1 } });
          replace(next);
          markUpdated(next);
        });
      }
      recordOperation({ index, kind: op.kind, outcome: "created" });
      continue;
    }
    if (op.kind === "bind-arrow") {
      const arrow = getTarget("arrowRef"); if (isTargetError(arrow)) return arrow;
      if (arrow.type !== "arrow") return reject("unsupported_operation", "bind-arrow requires an arrow target.", index);
      let currentArrow = arrow;
      let changed = false;
      for (const [endpoint, key] of [["start", "start"], ["end", "end"]] as const) {
        const endpointPatch = op[key];
        const targetRef = endpointPatch && typeof endpointPatch === "object" && !Array.isArray(endpointPatch)
          ? endpointPatch.targetRef
          : endpointPatch;
        if (targetRef === undefined) continue;
        const target = resolve(targetRef);
        if (!target) return reject("target_not_found", "The arrow binding target does not exist.", index);
        if (!SHAPES.has(target.type) || isCamera(target)) return reject("unsupported_operation", "Arrow bindings require supported shapes.", index);
        if (target.isDeleted === true || target.locked || isImported(target)) return reject(target.locked ? "locked_target" : "unsupported_operation", "The arrow binding target is not writable.", index);
        if (target.angle !== undefined && Number(target.angle) !== 0) return reject("unsupported_operation", "Rotated elements cannot be arrow binding targets.", index);
        if ((Array.isArray(target.groupIds) && target.groupIds.length > 0) || (target.frameId !== undefined && target.frameId !== null)) return reject("unsupported_operation", "Grouped or framed elements cannot be arrow binding targets.", index);
        const previous = asRecord(currentArrow[`${endpoint}Binding`]);
        if (previous?.elementId === target.id) {
          const reverse = Array.isArray(target.boundElements) && target.boundElements.some((item: unknown) => asRecord(item)?.id === arrow.id && asRecord(item)?.type === "arrow");
          if (!reverse) return reject("relation_conflict", "The existing arrow binding is malformed.", index);
          continue;
        }
        if (previous?.elementId && previous.elementId !== target.id) {
          const old = byId().get(previous.elementId);
          if (!old || old.isDeleted || !Array.isArray(old.boundElements) || !old.boundElements.some((item: unknown) => asRecord(item)?.id === arrow.id && asRecord(item)?.type === "arrow")) return reject("relation_conflict", "The existing arrow binding is malformed.", index);
          const nextOld = removeBoundElement(old, arrow.id, runtime);
          replace(nextOld);
          markUpdated(nextOld);
        }
        // Native linear binding keeps the endpoint on the outline and derives
        // focus/gap from the adjacent segment. Hosts with access to
        // Excalidraw's binding helper can provide the exact calculation;
        // detached runtimes use the complete outline-equivalent fallback.
        const currentPoints = absolutePoints(currentArrow);
        const nativeBinding = runtime.calculateArrowBinding?.({
          arrow: currentArrow,
          target,
          endpoint,
          points: currentPoints,
        });
        const fallbackPoint = currentPoints.length >= 2
          ? shapeAnchor(target, endpoint === "start" ? currentPoints[currentPoints.length - 1] : currentPoints[0])
          : [Number(target.x) + Number(target.width) / 2, Number(target.y) + Number(target.height) / 2] as [number, number];
        const nativeFixedPoint = nativeBinding?.fixedPoint && nativeBinding.fixedPoint.length === 2
          && nativeBinding.fixedPoint.every((value) => Number.isFinite(value))
          ? [Math.max(0, Math.min(1, Number(nativeBinding.fixedPoint[0]))), Math.max(0, Math.min(1, Number(nativeBinding.fixedPoint[1])))] as [number, number]
          : undefined;
        const bindingPoint = nativeBinding?.point && nativeBinding.point.length === 2
          ? [Number(nativeBinding.point[0]), Number(nativeBinding.point[1])] as [number, number]
          : nativeFixedPoint
            ? [Number(target.x) + nativeFixedPoint[0] * Number(target.width), Number(target.y) + nativeFixedPoint[1] * Number(target.height)] as [number, number]
            : fallbackPoint;
        const fixedPoint: [number, number] = nativeFixedPoint ?? [
          Math.max(0, Math.min(1, (bindingPoint[0] - Number(target.x)) / Math.max(1, Number(target.width)))),
          Math.max(0, Math.min(1, (bindingPoint[1] - Number(target.y)) / Math.max(1, Number(target.height)))),
        ];
        currentArrow = touch(currentArrow, runtime, {
          [`${endpoint}Binding`]: {
            elementId: target.id,
            focus: Number.isFinite(nativeBinding?.focus) ? nativeBinding!.focus : 0,
            gap: Number.isFinite(nativeBinding?.gap) ? Math.max(1, nativeBinding!.gap) : 1,
            fixedPoint,
          },
        });
        replace(currentArrow);
        const hasReverse = Array.isArray(target.boundElements) && target.boundElements.some((item: unknown) => asRecord(item)?.id === arrow.id && asRecord(item)?.type === "arrow");
        if (!hasReverse) replace(addBoundElement(target, arrow.id, "arrow", runtime));
        const points = absolutePoints(currentArrow);
        if (points.length >= 2) {
          const nextPoints = points.map((point, pointIndex) => pointIndex === endpointIndex(endpoint, points) ? bindingPoint : point);
          currentArrow = withAbsolutePoints(currentArrow, nextPoints, runtime);
          replace(currentArrow);
        }
        markUpdated(target); markUpdated(currentArrow);
        layoutArrowLabel(currentArrow);
        changed = true;
      }
      recordOperation({ index, kind: op.kind, outcome: changed ? "updated" : "noop" });
      continue;
    }
    if (op.kind === "unbind-arrow") {
      const arrow = getTarget("arrowRef"); if (isTargetError(arrow)) return arrow;
      if (arrow.type !== "arrow") return reject("unsupported_operation", "unbind-arrow requires an arrow target.", index);
      const endpoints = op.endpoint === "both" || (!op.endpoint && (op.start === true && op.end === true)) ? ["start", "end"] : op.endpoint ? [op.endpoint] : [op.start === true ? "start" : "end"];
      let changed = false;
      let currentArrow = arrow;
      const endpointSet = new Set(endpoints as ("start" | "end")[]);
      const endpointTargets = new Map<"start" | "end", Record<string, any>>();
      for (const endpoint of endpoints as ("start" | "end")[]) {
        const binding = asRecord(currentArrow[`${endpoint}Binding`]);
        if (!binding?.elementId) continue;
        const target = byId().get(binding.elementId);
        if (!target || target.isDeleted) return reject("relation_conflict", "The arrow binding target is missing or deleted.", index);
        if (target.locked) return reject("locked_target", "The arrow binding target is locked.", index);
        if (isImported(target)) return reject("unsupported_operation", "Imported arrow binding targets are read-only.", index);
        if (!Array.isArray(target.boundElements) || !target.boundElements.some((item: unknown) => asRecord(item)?.id === arrow.id && asRecord(item)?.type === "arrow")) return reject("relation_conflict", "The arrow binding is malformed.", index);
        endpointTargets.set(endpoint, target);
      }
      for (const endpoint of endpoints as ("start" | "end")[]) {
        const binding = asRecord(currentArrow[`${endpoint}Binding`]);
        if (!binding?.elementId) continue;
        const target = endpointTargets.get(endpoint)!;
        const retained = (["start", "end"] as const).some((other) => (
          !endpointSet.has(other) && asRecord(currentArrow[`${other}Binding`])?.elementId === target.id
        ));
        if (!retained) {
          const nextTarget = removeBoundElement(byId().get(target.id) ?? target, arrow.id, runtime);
          replace(nextTarget);
          markUpdated(nextTarget);
        }
        currentArrow = touch(currentArrow, runtime, { [`${endpoint}Binding`]: null });
        replace(currentArrow);
        changed = true;
      }
      if (changed) {
        const points = absolutePoints(currentArrow);
        if (points.length >= 2) {
          const normalized = withAbsolutePoints(currentArrow, points, runtime);
          replace(normalized);
          currentArrow = normalized;
        }
        markUpdated(currentArrow); layoutArrowLabel(currentArrow);
      }
      recordOperation({ index, kind: op.kind, outcome: changed ? "updated" : "noop" });
      continue;
    }
    if (op.kind === "bind-text") {
      const text = getTarget("textRef"); if (isTargetError(text)) return text;
      const container = getTarget("containerRef"); if (isTargetError(container)) return container;
      if (text.type !== "text" || !SHAPES.has(container.type)) return reject("unsupported_operation", "Text binding requires standalone text and a supported shape.", index);
      if (text.containerId) return reject("relation_conflict", "The text is already bound.", index);
      const existing = boundTextFor(container); if (existing) return reject("relation_conflict", "The container already has bound text.", index);
      replace(touch(text, runtime, { containerId: container.id }));
      const nextContainer = addBoundElement(container, text.id, "text", runtime); replace(nextContainer); layoutBoundText(byId().get(text.id)!, nextContainer);
      placeAfter(text.id, container.id);
      markUpdated(text); markUpdated(nextContainer); recordOperation({ index, kind: op.kind, outcome: "updated" });
      continue;
    }
    if (op.kind === "unbind-text") {
      const text = op.textRef ? resolve(op.textRef) : undefined;
      const container = op.containerRef ? resolve(op.containerRef) : text && typeof text.containerId === "string" ? byId().get(text.containerId) : undefined;
      if (!text && !container) return reject("target_not_found", "The text binding target does not exist.", index);
      const actualText = text ?? boundTextFor(container!);
      if (!actualText) return reject("relation_conflict", "The container has no bound text.", index);
      if (actualText.type !== "text" || actualText.isDeleted) return reject("target_not_found", "The bound text does not exist.", index);
      if (actualText.locked || container?.locked) return reject("locked_target", "The text binding is locked.", index);
      if (isImported(actualText) || isImported(container ?? {})) return reject("unsupported_operation", "Imported text bindings are read-only in v1.", index);
      if (typeof actualText.containerId !== "string") return reject("relation_conflict", "The text is not bound.", index);
      if (!container || actualText.containerId !== container.id || !SHAPES.has(container.type) || isCamera(container)) return reject("relation_conflict", "The text/container binding does not match.", index);
      if (!Array.isArray(container.boundElements) || !container.boundElements.some((item: unknown) => asRecord(item)?.id === actualText.id && asRecord(item)?.type === "text")) return reject("relation_conflict", "The text binding is malformed.", index);
      if ((Array.isArray(actualText.groupIds) && actualText.groupIds.length > 0) || actualText.frameId || Number(actualText.angle || 0) !== 0) return reject("unsupported_operation", "Grouped, framed, or rotated text cannot be unbound.", index);
      if (container) replace(removeBoundElement(container, actualText.id, runtime));
      const detached = touch(actualText, runtime, { containerId: null, autoResize: true });
      const measured = measureTextEquivalent(String(detached.originalText ?? detached.text ?? ""), Number(detached.fontSize) || 20, { autoResize: true, lineHeight: Number(detached.lineHeight) || 1.25 }, detached.fontFamily, runtime);
      detached.text = measured.text;
      detached.width = measured.width;
      detached.height = measured.height;
      replace(detached); markUpdated(detached); if (container) markUpdated(container);
      recordOperation({ index, kind: op.kind, outcome: "updated" }); continue;
    }
    if (op.kind === "upsert-bound-text") {
      const container = getTarget("shapeRef"); if (isTargetError(container)) return container;
      if (!SHAPES.has(container.type)) return reject("unsupported_operation", "Bound text requires a supported shape.", index);
      const existing = boundTextFor(container);
      const content = op.originalText ?? op.text ?? "";
      if (!existing) {
        if (!op.createRef) return reject("invalid_request", "createRef is required when the shape has no bound text.", index);
        const text = textElement(runtime.createId(), container.x + 8, container.y + 8, content, op, runtime);
        text.containerId = container.id; elements.push(text); createdIds.add(text.id); tempMap.set(op.createRef, text.id); createdRefs[op.createRef] = stableRef(text.id);
        const nextContainer = addBoundElement(container, text.id, "text", runtime); replace(nextContainer); layoutBoundText(text, nextContainer); placeAfter(text.id, container.id); markUpdated(nextContainer); recordOperation({ index, kind: op.kind, outcome: "created", textRef: textRef(text.id) });
      } else {
        if (op.createRef !== undefined) return reject("relation_conflict", "createRef is only valid when the shape has no bound text.", index);
        if (existing.locked) return reject("locked_target", "The bound text is locked.", index);
        if (isImported(existing)) return reject("unsupported_operation", "Imported bound text is read-only in v1.", index);
        if (existing.containerId !== container.id) return reject("relation_conflict", "The existing bound text relationship is malformed.", index);
        const patch: Record<string, any> = { originalText: content, ...textStyle(op) };
        const layout = asRecord(op.layout);
        if (layout?.autoResize !== undefined) patch.autoResize = layout.autoResize;
        delete patch.overflowPolicy;
        const nextText: Record<string, any> = touch(existing, runtime, patch);
        if (typeof nextText.fontFamily === "string") nextText.fontFamily = TEXT_FONT_IDS[nextText.fontFamily] ?? 5;
        if (!hasPatchChange(existing, patch)) {
          recordOperation({ index, kind: op.kind, outcome: "noop", textRef: textRef(existing.id) });
          continue;
        }
        replace(nextText);
        layoutBoundText(nextText, container);
        markUpdated(nextText);
        recordOperation({ index, kind: op.kind, outcome: "updated", textRef: textRef(nextText.id) });
      }
      continue;
    }
    if (op.kind === "set-text" || op.kind === "set-text-style" || op.kind === "set-text-layout") {
      const text = getTarget("textRef"); if (isTargetError(text)) return text;
      if (text.type !== "text") return reject("unsupported_operation", "The target is not text.", index);
      const arrowBound = typeof text.containerId === "string" && byId().get(text.containerId)?.type === "arrow";
      if (arrowBound) return reject("unsupported_operation", "Imported arrow labels are read-only in v1.", index);
      const textContainer = getTextContainer(text, index);
      if (textContainer && isTargetError(textContainer)) return textContainer;
      if (op.kind === "set-text-layout" && text.containerId) return reject("unsupported_operation", "Bound text layout is owned by its container.", index);
      const requestedVerticalAlign = op.verticalAlign ?? asRecord(op.style)?.verticalAlign;
      if (op.kind === "set-text-style" && !text.containerId && requestedVerticalAlign !== undefined && requestedVerticalAlign !== "top") return reject("unsupported_operation", "Standalone text only supports top vertical alignment.", index);
      let updates: Record<string, any> = {};
      if (op.kind === "set-text") updates.originalText = op.originalText ?? op.text;
      if (op.kind === "set-text-style") {
        const patch = { ...(asRecord(op.style) ?? {}) };
        if (patch.color !== undefined) patch.strokeColor = patch.color;
        delete patch.color;
        updates = { ...updates, ...textStyle(op), ...patch };
      }
      if (op.kind === "set-text-layout") {
        const layoutPatch = { ...(asRecord(op.layout) ?? {}) };
        delete layoutPatch.overflowPolicy;
        updates = { ...updates, ...layoutPatch, ...(op.autoResize !== undefined ? { autoResize: op.autoResize } : {}), ...(op.width !== undefined ? { width: op.width } : {}) };
        if (Object.prototype.hasOwnProperty.call(updates, "width") && !Object.prototype.hasOwnProperty.call(updates, "autoResize")) {
          updates.autoResize = false;
        }
      }
      if (typeof updates.fontFamily === "string") updates.fontFamily = TEXT_FONT_IDS[updates.fontFamily] ?? 5;
      if (!hasPatchChange(text, updates)) { recordOperation({ index, kind: op.kind, outcome: "noop" }); continue; }
      const next: Record<string, any> = touch(text, runtime, updates);
      if (next.fontFamily && typeof next.fontFamily === "string") next.fontFamily = TEXT_FONT_IDS[next.fontFamily] ?? 5;
      if (next.containerId) {
        // Container geometry owns wrapping, size and position for bound text.
        next.text = String(next.text ?? text.text ?? "");
      } else {
        const bounded = next.autoResize === false;
        if (bounded && (typeof next.width !== "number" || next.width <= 0)) return reject("invalid_request", "Bounded standalone text requires a positive width.", index);
        const measured = measureTextEquivalent(
          String(next.originalText ?? next.text ?? ""),
          Number(next.fontSize) || 20,
          { autoResize: !bounded, ...(bounded ? { width: next.width } : {}), lineHeight: Number(next.lineHeight) || 1.25 },
          next.fontFamily,
          runtime,
        );
        next.text = measured.text;
        // Switching back to autoResize must remove the old bounded width and
        // restore the native natural width derived from the current content.
        next.width = measured.width;
        next.height = measured.height;
      }
      replace(next);
      if (next.containerId) { const container = byId().get(next.containerId); if (container) layoutBoundText(next, container); }
      markUpdated(next); recordOperation({ index, kind: op.kind, outcome: "updated" }); continue;
    }
    if (op.kind === "set-shape-style" || op.kind === "set-connector-style") {
      const target = getTarget(op.kind === "set-shape-style" ? "shapeRef" : "arrowRef"); if (isTargetError(target)) return target;
      if (op.kind === "set-shape-style" && !SHAPES.has(target.type)) return reject("unsupported_operation", "The target is not a supported shape.", index);
      if (op.kind === "set-connector-style" && target.type !== "arrow") return reject("unsupported_operation", "The target is not an arrow.", index);
      const style = asRecord(op.style) ?? {};
      const styleUpdates = Object.fromEntries(Object.entries(style).filter(([key]) => ["backgroundColor", "strokeColor", "strokeWidth", "strokeStyle", "fillStyle", "roundness", "opacity", "roughness"].includes(key)));
      if (styleUpdates.roundness === "rounded") styleUpdates.roundness = { type: 3 };
      if (styleUpdates.roundness === "sharp") styleUpdates.roundness = null;
      if (!hasPatchChange(target, styleUpdates)) { recordOperation({ index, kind: op.kind, outcome: "noop" }); continue; }
      const next = touch(target, runtime, styleUpdates);
      replace(next);
      markUpdated(next); recordOperation({ index, kind: op.kind, outcome: "updated" }); continue;
    }
    if (op.kind === "set-arrowheads") {
      const target = getTarget("arrowRef"); if (isTargetError(target)) return target;
      if (target.type !== "arrow") return reject("unsupported_operation", "The target is not an arrow.", index);
      const updates = { ...(op.start !== undefined || op.startArrowhead !== undefined ? { startArrowhead: nativeArrowhead(op.start ?? op.startArrowhead) } : {}), ...(op.end !== undefined || op.endArrowhead !== undefined ? { endArrowhead: nativeArrowhead(op.end ?? op.endArrowhead) } : {}) };
      if (!hasPatchChange(target, updates)) { recordOperation({ index, kind: op.kind, outcome: "noop" }); continue; }
      const next = touch(target, runtime, updates); replace(next); markUpdated(next); recordOperation({ index, kind: op.kind, outcome: "updated" }); continue;
    }
    if (op.kind === "move-element") {
      const target = getTarget("elementRef"); if (isTargetError(target)) return target;
      if (![...SHAPES, "text"].includes(target.type)) return reject("unsupported_operation", "Only shapes and standalone text can move.", index);
      if (target.type === "text" && typeof target.containerId === "string") return reject("unsupported_operation", "Bound text position is owned by its container.", index);
      const relationConflict = relationMutationConflict(target, index); if (relationConflict) return relationConflict;
      const dx = op.dx; const dy = op.dy;
      if (dx === 0 && dy === 0) { recordOperation({ index, kind: op.kind, outcome: "noop" }); continue; }
      replace(touch(target, runtime, { x: target.x + dx, y: target.y + dy })); markUpdated(target); updateArrowsForMove(target, dx, dy);
      const bound = target.type !== "text" ? boundTextFor(target) : undefined;
      if (bound) { replace(touch(bound, runtime, { x: bound.x + dx, y: bound.y + dy })); markUpdated(bound); }
      recordOperation({ index, kind: op.kind, outcome: "updated" }); continue;
    }
    if (op.kind === "resize-element") {
      const target = getTarget("elementRef"); if (isTargetError(target)) return target;
      if (!SHAPES.has(target.type)) return reject("unsupported_operation", "Only supported shapes can resize.", index);
      const relationConflict = relationMutationConflict(target, index); if (relationConflict) return relationConflict;
      let width = op.width;
      let height = op.height;
      if (op.keepAspect === true && Number(target.width) > 0 && Number(target.height) > 0) {
        height = Math.max(1, width * Number(target.height) / Number(target.width));
      }
      if (Number(target.width) === width && Number(target.height) === height) { recordOperation({ index, kind: op.kind, outcome: "noop" }); continue; }
      replace(touch(target, runtime, { width, height })); markUpdated(target);
      const bound = boundTextFor(target); if (bound) layoutBoundText(bound, byId().get(target.id)!);
      updateArrowsForTarget(byId().get(target.id)!);
      recordOperation({ index, kind: op.kind, outcome: "updated" }); continue;
    }
    if (op.kind === "set-connector-points") {
      const target = getTarget("arrowRef"); if (isTargetError(target)) return target;
      if (target.type !== "arrow") return reject("unsupported_operation", "The target is not an arrow.", index);
      if (target.startBinding || target.endBinding) return reject("relation_conflict", "Unbind arrow endpoints before setting connector points.", index);
      const points = op.points.map((point: any) => [point[0], point[1]] as [number, number]);
      const currentPoints = absolutePoints(target);
      if (currentPoints.length === points.length && currentPoints.every((point, pointIndex) => pointEqual(point, points[pointIndex]))) { recordOperation({ index, kind: op.kind, outcome: "noop" }); continue; }
      const next = withAbsolutePoints(target, points, runtime); replace(next); markUpdated(next); layoutArrowLabel(next); recordOperation({ index, kind: op.kind, outcome: "updated" }); continue;
    }
    if (op.kind === "update-camera-bounds") {
      const target = getTarget("cameraRef", true); if (isTargetError(target)) return target;
      const geometry = normalizeGeometry(op, limits); if (geometry.status === "rejected") return reject(geometry.error.code, geometry.error.message, index);
      if (!hasPatchChange(target, geometry.value as unknown as Record<string, unknown>)) {
        recordOperation({ index, kind: op.kind, outcome: "noop" });
        continue;
      }
      replace(touch(target, runtime, geometry.value as unknown as Record<string, unknown>)); markUpdated(target); recordOperation({ index, kind: op.kind, outcome: "updated" }); continue;
    }
    if (op.kind === "set-camera-order") {
      const refs = op.cameraRefs ?? op.refs ?? []; const cameras = elements.filter((element) => isCamera(element) && !element.isDeleted);
      if (refs.length !== cameras.length) return reject("incomplete_read", "Camera order requires all live Cameras.", index);
      const seen = new Set<string>();
      let changed = false;
      refs.forEach((ref: string, order: number) => {
        const target = resolve(ref);
        if (!target || !isCamera(target) || target.isDeleted) return;
        seen.add(target.id);
        if (Number(asRecord(target.customData)?.order) === order + 1) return;
        const next = touch(target, runtime, { customData: { ...asRecord(target.customData), order: order + 1 } });
        replace(next);
        markUpdated(next);
        changed = true;
      });
      if (seen.size !== cameras.length) return reject("target_not_found", "Camera order contains an unknown Camera.", index);
      recordOperation({ index, kind: op.kind, outcome: changed ? "updated" : "noop" }); continue;
    }
    if (op.kind === "delete-element" || op.kind === "delete-camera") {
      const target = getTarget(op.kind === "delete-camera" ? "cameraRef" : "elementRef", op.kind === "delete-camera"); if (isTargetError(target)) return target;
      if (op.kind === "delete-element" && isCamera(target)) return reject("unsupported_operation", "Use delete-camera for Camera targets.", index);
      if (op.kind === "delete-element" && ![...SHAPES, "text", "arrow"].includes(target.type)) return reject("unsupported_operation", "This element type is preserved-only and cannot be deleted individually.", index);
      if (op.kind === "delete-element") {
        const conflict = deleteRelationConflict(target);
        if (conflict) return reject("relation_conflict", conflict, index);
        const relationMutation = relationMutationConflict(target, index); if (relationMutation) return relationMutation;
      }
      const cascade = boundTextFor(target);
      if (cascade?.locked) return reject("locked_target", "The delete would cascade into a locked bound text.", index);
      if (cascade && isImported(cascade) && target.type !== "arrow") return reject("unsupported_operation", "The delete would cascade into imported bound text.", index);
      if (target.type === "text" && typeof target.containerId === "string") {
        const container = byId().get(target.containerId);
        if (container?.locked) return reject("locked_target", "The delete would modify a locked text container.", index);
        if (container && isImported(container)) return reject("unsupported_operation", "The delete would modify an imported text container.", index);
      }
      if (target.type === "arrow") {
        if (cascade?.locked) return reject("locked_target", "The delete would cascade into a locked arrow label.", index);
        for (const endpoint of ["start", "end"] as const) {
          const targetId = asRecord(target[`${endpoint}Binding`])?.elementId;
          const endpointTarget = typeof targetId === "string" ? byId().get(targetId) : undefined;
          if (endpointTarget?.locked) return reject("locked_target", "The delete would modify a locked arrow target.", index);
          if (endpointTarget && isImported(endpointTarget)) return reject("unsupported_operation", "The delete would modify an imported arrow target.", index);
        }
      }
      if (cascade) softDelete(cascade, true);
      softDelete(target, false);
      if (op.kind === "delete-camera") {
        const remaining = elements.filter((element) => isCamera(element) && !element.isDeleted).sort((a, b) => Number(asRecord(a.customData)?.order ?? 0) - Number(asRecord(b.customData)?.order ?? 0));
        remaining.forEach((camera, order) => {
          if (Number(asRecord(camera.customData)?.order) === order + 1) return;
          const next = touch(camera, runtime, { customData: { ...asRecord(camera.customData), order: order + 1 } });
          replace(next);
          markUpdated(next);
        });
      }
      recordOperation({ index, kind: op.kind, outcome: "deleted" }); continue;
    }
    if (op.kind === "set-background") {
      if (appState.viewBackgroundColor === (op.color ?? op.backgroundColor)) { recordOperation({ index, kind: op.kind, outcome: "noop" }); continue; }
      appState.viewBackgroundColor = op.color ?? op.backgroundColor;
      recordOperation({ index, kind: op.kind, outcome: "updated" }); continue;
    }
    if (op.kind === "apply-style-preset") {
      let changed = false;
      const selected = collectStyleClosure(op.selectedRefs);
      if (selected.length === 0) return reject("target_not_found", "The style preset target does not exist.", index);
      for (const target of selected) {
        if (!target || target.isDeleted) return reject("target_not_found", "The style preset target does not exist.", index);
        if (isCamera(target)) return reject("unsupported_operation", "Camera cannot be style-converted.", index);
        if (target.locked) return reject("locked_target", "Locked elements cannot be style-converted.", index);
        if (isImported(target) || target.type === "text" && typeof target.containerId === "string" && byId().get(target.containerId)?.type === "arrow") return reject("unsupported_operation", "Imported elements cannot be style-converted.", index);
        const container = target.type === "text" ? getTextContainer(target, index) : undefined;
        if (container && isTargetError(container)) return container;
        // `line`, freedraw, image, frame, and embeddable are preserved-only
        // in v1.  Formal conversion may style supported shapes/arrows/text
        // in a selected closure, but it must leave those preserved members
        // byte-for-byte untouched.
        const updates = target.type === "text" ? { roughness: 0, fontFamily: 2, opacity: 100 } : ["rectangle", "ellipse", "diamond", "arrow"].includes(target.type) ? { roughness: 0, strokeStyle: "solid", fillStyle: "solid", strokeWidth: 2, opacity: 100, roundness: null } : undefined;
        // Frames/images and other preserved-only members stay untouched while
        // convertible peers in the same closure receive the formal preset.
        if (!updates) continue;
        if (Object.keys(updates).length > 0 && hasPatchChange(target, updates)) {
          const next = touch(target, runtime, updates);
          if (target.type === "text") {
            const measured = measureTextEquivalent(String(next.originalText ?? next.text ?? ""), Number(next.fontSize) || 20, { autoResize: next.autoResize !== false, width: next.width, lineHeight: Number(next.lineHeight) || 1.25 }, next.fontFamily, runtime);
            next.text = measured.text;
            next.width = next.autoResize === false && typeof next.width === "number" ? next.width : measured.width;
            next.height = measured.height;
          }
          replace(next);
          markUpdated(next);
          if (next.containerId) {
            const nextContainer = byId().get(next.containerId);
            if (nextContainer) layoutBoundText(next, nextContainer);
          }
          changed = true;
        }
      }
      recordOperation({ index, kind: op.kind, outcome: changed ? "updated" : "noop" }); continue;
    }
    if (op.kind === "clear-scene") {
      const includeCameras = op.scope === "all-elements";
      let changed = false;
      for (const element of [...elements]) {
        if (element.isDeleted || (!includeCameras && isCamera(element))) continue;
        softDelete(element, false);
        changed = true;
      }
      recordOperation({ index, kind: op.kind, outcome: changed ? "deleted" : "noop" }); continue;
    }
    if (op.kind.startsWith("add-") || op.kind.endsWith("-page") || op.kind === "create-page-from-selection") return reject("unsupported_operation", "Page operations are handled by the document service.", index);
  }

  for (const element of [...elements]) {
    if (element.type === "text" && typeof element.containerId === "string" && touchedIds.has(element.id)) {
      const container = byId().get(element.containerId);
      if (container) {
        const beforeIndex = elements.findIndex((candidate) => candidate.id === element.id);
        placeAfter(element.id, container.id);
        if (beforeIndex !== elements.findIndex((candidate) => candidate.id === element.id)) markUpdated(element);
      }
    }
  }
  for (const element of elements) {
    if (!touchedIds.has(element.id)) continue;
    const coordinates = [element.x, element.y];
    if (coordinates.some((value) => typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > limits.maxCoordinate)) return reject("limit_exceeded", "A mutated element exceeds the scene coordinate limit.");
    if (element.isDeleted === true) continue;
    if (element.type !== "arrow" && typeof element.width === "number" && (element.width <= 0 || element.width > limits.maxDimension)) return reject("limit_exceeded", "A mutated element exceeds the scene dimension limit.");
    if (element.type !== "arrow" && typeof element.height === "number" && (element.height <= 0 || element.height > limits.maxDimension)) return reject("limit_exceeded", "A mutated element exceeds the scene dimension limit.");
    if (element.type === "arrow") {
      for (const point of absolutePoints(element)) {
        if (Math.abs(point[0]) > limits.maxCoordinate || Math.abs(point[1]) > limits.maxCoordinate) return reject("limit_exceeded", "A mutated connector exceeds the scene coordinate limit.");
      }
    }
  }
  const postconditions = validateIdeaSketchScenePostconditions({ elements, appState, files }, {
    maxCameraCount: input.maxCameraCount,
    cameraMinWidth: input.cameraMinWidth,
    cameraMinHeight: input.cameraMinHeight,
  });
  if (postconditions.status === "rejected") return sdkRejected(postconditions.error.code, postconditions.error.message);
  return sdkSucceeded({
    scene: { elements: Object.freeze(elements), appState: Object.freeze(appState), files: Object.freeze(files) },
    createdRefs: Object.freeze({ ...createdRefs }),
    updatedRefs: Object.freeze([...updatedRefs].filter((ref) => {
      const id = nativeId(ref);
      const element = id ? elements.find((candidate) => candidate.id === id) : undefined;
      return element?.isDeleted !== true;
    })),
    deletedRefs: Object.freeze([...deletedRefs]),
    cascadedRefs: Object.freeze([...cascadedRefs]),
    operations: Object.freeze(operationResults),
    diagnostics: Object.freeze([]),
  });
}

export function applyIdeaSketchScenePlan(input: ExcalidrawSceneAdapterInput): SdkSyncResult<ExcalidrawSceneAdapterResult> {
  try {
    return applyIdeaSketchScenePlanUnsafe(input);
  } catch {
    // The pure builder/validator already classifies malformed caller payloads
    // as invalid_request.  An exception that escapes cloning, measurement,
    // runtime id generation, or host scene access is an implementation
    // failure and must not be misreported as caller input error.
    return sdkRejected("internal_error", "The scene plan could not be applied safely.", true);
  }
}

export const applyScenePlan = applyIdeaSketchScenePlan;
export const createExcalidrawSceneAdapter = applyIdeaSketchScenePlan;
export { TEXT_FONT_NAMES };
