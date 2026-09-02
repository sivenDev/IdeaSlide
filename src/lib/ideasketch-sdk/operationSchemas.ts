import {
  sdkRejected,
  sdkSucceeded,
  type IdeaSketchArrowhead,
  type IdeaSketchBounds,
  type IdeaSketchOperation,
  type IdeaSketchOperationInput,
  type IdeaSketchOperationOf,
  type IdeaSketchSdkErrorCode,
  type SdkSyncResult,
  type TempRef,
} from "./types.ts";

export interface IdeaSketchOperationLimits {
  maxOperations: number;
  maxPlanBytes: number;
  maxCoordinate: number;
  maxTextLength: number;
  minFontSize: number;
  maxFontSize: number;
  maxDimension: number;
  maxLineHeight: number;
  minLineHeight: number;
}

export const DEFAULT_OPERATION_LIMITS: Readonly<IdeaSketchOperationLimits> = Object.freeze({
  maxOperations: 40,
  maxPlanBytes: 256 * 1024,
  maxCoordinate: 1_000_000,
  maxTextLength: 10_000,
  minFontSize: 6,
  maxFontSize: 256,
  maxDimension: 100_000,
  maxLineHeight: 4,
  minLineHeight: 0.5,
});

function validateOperationLimits(limits: Partial<IdeaSketchOperationLimits>): SdkSyncResult<void> {
  if (!isPlainRecord(limits)) return fail("Operation limits must be an object.");
  const known = new Set<keyof IdeaSketchOperationLimits>([
    "maxOperations", "maxPlanBytes", "maxCoordinate", "maxTextLength", "minFontSize", "maxFontSize",
    "maxDimension", "maxLineHeight", "minLineHeight",
  ]);
  for (const key of Reflect.ownKeys(limits)) {
    if (typeof key !== "string" || !known.has(key as keyof IdeaSketchOperationLimits)) return fail(`Unknown operation limit: ${String(key)}.`);
    const value = limits[key as keyof IdeaSketchOperationLimits];
    if (typeof value !== "number" || !Number.isFinite(value)) return fail(`Operation limit ${key} must be finite.`);
    if (["maxOperations", "maxPlanBytes", "maxTextLength"].includes(key) && (!Number.isInteger(value) || value < 1)) return fail(`Operation limit ${key} must be a positive integer.`);
    if (!["maxOperations", "maxPlanBytes", "maxTextLength"].includes(key) && value <= 0) return fail(`Operation limit ${key} must be positive.`);
  }
  const merged = { ...DEFAULT_OPERATION_LIMITS, ...limits };
  if (merged.minFontSize > merged.maxFontSize) return fail("minFontSize cannot exceed maxFontSize.");
  if (merged.minLineHeight > merged.maxLineHeight) return fail("minLineHeight cannot exceed maxLineHeight.");
  return sdkSucceeded(undefined);
}

const SHAPES = new Set(["rectangle", "ellipse", "diamond"]);
const STROKE_STYLES = new Set(["solid", "dashed", "dotted"]);
const FILL_STYLES = new Set(["solid", "hachure", "cross-hatch"]);
const FONTS = new Set(["hand-drawn", "normal", "code"]);
const TEXT_ALIGNS = new Set(["left", "center", "right"]);
const VERTICAL_ALIGNS = new Set(["top", "middle", "bottom"]);
const ARROWHEADS = new Set(["arrow", "bar", "dot", "triangle", "circle", "none"]);

const SCHEMA_FIELDS = Object.freeze({
  "add-page": ["ref", "title", "initialScene"],
  "import-page": ["ref", "title", "parsedPageDraftRef"],
  "duplicate-page": ["ref", "sourcePageRef", "title"],
  "rename-page": ["pageRef", "title"],
  "reorder-page": ["pageRef", "toIndex"],
  "delete-page": ["pageRef"],
  "create-page-from-selection": ["ref", "sourcePageRef", "selectedRefs", "preset"],
  "create-shape": ["ref", "shape", "bounds", "style", "boundText"],
  "create-arrow": ["ref", "points", "style", "arrowheads"],
  "create-text": ["ref", "x", "y", "text", "originalText", "style", "layout"],
  "create-camera": ["ref", "bounds", "atIndex"],
  "bind-arrow": ["arrowRef", "start", "end"],
  "unbind-arrow": ["arrowRef", "endpoint"],
  "bind-text": ["textRef", "containerRef"],
  "unbind-text": ["textRef", "containerRef"],
  "upsert-bound-text": ["shapeRef", "createRef", "text", "originalText", "style", "layout"],
  "set-text": ["textRef", "text", "originalText"],
  "set-text-style": ["textRef", "style", "fontFamily", "fontSize", "color", "textAlign", "verticalAlign", "opacity", "lineHeight"],
  "set-text-layout": ["textRef", "layout", "autoResize", "width"],
  "set-shape-style": ["shapeRef", "style"],
  "set-connector-style": ["arrowRef", "style"],
  "set-arrowheads": ["arrowRef", "start", "end"],
  "move-element": ["elementRef", "dx", "dy"],
  "resize-element": ["elementRef", "width", "height", "anchor", "keepAspect"],
  "set-connector-points": ["arrowRef", "points"],
  "update-camera-bounds": ["cameraRef", "bounds"],
  "set-camera-order": ["cameraRefs"],
  "delete-element": ["elementRef"],
  "delete-camera": ["cameraRef"],
  "set-background": ["color"],
  "apply-style-preset": ["selectedRefs", "preset"],
  "clear-scene": ["scope", "confirmationReceipt"],
} as const);

// Keep the exported schema immutable at every level. The validator and the
// public capability digest both depend on this being a canonical map.
for (const fields of Object.values(SCHEMA_FIELDS)) Object.freeze(fields);

export type IdeaSketchOperationKind = keyof typeof SCHEMA_FIELDS;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function error(code: IdeaSketchSdkErrorCode, message: string): SdkSyncResult<never> {
  return sdkRejected(code, message);
}

function fail(message: string): SdkSyncResult<never> {
  return error("invalid_request", message);
}

function rejectUnknownFields(value: Record<string, unknown>, allowed: readonly string[], label: string) {
  const unknown = Reflect.ownKeys(value).filter((key) => (
    typeof key !== "string"
    || !allowed.includes(key)
    || Object.getOwnPropertyDescriptor(value, key)?.enumerable !== true
  ));
  return unknown.length > 0 ? fail(`${label} contains unknown field(s): ${unknown.map((key) => typeof key === "string" ? key : String(key)).join(", ")}.`) : undefined;
}

function validateStrictJsonValue(value: unknown, label: string, seen = new WeakSet<object>()): SdkSyncResult<never> | undefined {
  if (value === undefined) return fail(`${label} must not be undefined.`);
  if (value === null || typeof value === "string" || typeof value === "boolean") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? undefined : fail(`${label} must be a finite number.`);
  if (typeof value !== "object") return fail(`${label} must be strict JSON data.`);
  if (seen.has(value)) return fail(`${label} must not contain cyclic data.`);
  seen.add(value);
  if (Array.isArray(value)) {
    const keys = Reflect.ownKeys(value);
    for (const key of keys) {
      if (key === "length") continue;
      if (
        typeof key !== "string"
        || !/^\d+$/.test(key)
        || String(Number(key)) !== key
        || Number(key) >= value.length
        || !Object.getOwnPropertyDescriptor(value, key)?.enumerable
      ) {
        return fail(`${label} must be a dense JSON array.`);
      }
    }
    for (let index = 0; index < value.length; index += 1) {
      const invalid = validateStrictJsonValue(value[index], `${label}[${index}]`, seen);
      if (invalid) return invalid;
    }
    seen.delete(value);
    return undefined;
  }
  if (!isPlainRecord(value)) return fail(`${label} must be a plain JSON object.`);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !Object.getOwnPropertyDescriptor(value, key)?.enumerable) return fail(`${label} contains a non-enumerable or symbol field.`);
    const invalid = validateStrictJsonValue(value[key], `${label}.${key}`, seen);
    if (invalid) return invalid;
  }
  seen.delete(value);
  return undefined;
}

function finiteNumber(value: unknown, label: string, limits: IdeaSketchOperationLimits) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fail(`${label} must be a finite number.`);
  if (Math.abs(value) > limits.maxCoordinate) return fail(`${label} exceeds the scene coordinate limit.`);
  return undefined;
}

function positiveDimension(value: unknown, label: string, limits: IdeaSketchOperationLimits) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return fail(`${label} must be greater than zero.`);
  if (value > limits.maxDimension) return fail(`${label} exceeds the scene dimension limit.`);
  return undefined;
}

function textValue(value: unknown, label: string, limits: IdeaSketchOperationLimits) {
  if (typeof value !== "string") return fail(`${label} must be a string.`);
  if (value.length > limits.maxTextLength) return fail(`${label} exceeds the text length limit.`);
  return undefined;
}

function validateTextAliases(value: Record<string, unknown>, label: string, limits: IdeaSketchOperationLimits) {
  if (value.text !== undefined && value.originalText !== undefined) return fail(`${label} must provide exactly one of text or originalText.`);
  const content = value.originalText ?? value.text;
  if (content === undefined) return fail(`${label} requires text content.`);
  return textValue(content, `${label}.originalText`, limits);
}

function stableRef(value: unknown, label: string, prefixes: readonly string[] = ["element:", "temp:"]) {
  if (typeof value !== "string" || !prefixes.some((prefix) => value.startsWith(prefix)) || value.length <= value.indexOf(":") + 1) {
    return fail(`${label} must be an opaque SDK reference.`);
  }
  if (/[\u0000-\u0020\u007f]/.test(value)) return fail(`${label} is malformed.`);
  return undefined;
}

function tempRef(value: unknown, label: string) {
  return stableRef(value, label, ["temp:"]);
}

function validateBounds(value: unknown, label: string, limits: IdeaSketchOperationLimits): SdkSyncResult<never> | undefined {
  if (!isPlainRecord(value)) return fail(`${label} must be an object.`);
  const unknown = rejectUnknownFields(value, ["x", "y", "width", "height"], label);
  if (unknown) return unknown;
  for (const key of ["x", "y"] as const) {
    const invalid = finiteNumber(value[key], `${label}.${key}`, limits);
    if (invalid) return invalid;
  }
  for (const key of ["width", "height"] as const) {
    const invalid = positiveDimension(value[key], `${label}.${key}`, limits);
    if (invalid) return invalid;
  }
  return undefined;
}

function validateTopLevelBounds(value: Record<string, unknown>, label: string, limits: IdeaSketchOperationLimits) {
  if (value.bounds !== undefined) return validateBounds(value.bounds, `${label}.bounds`, limits);
  for (const key of ["x", "y"] as const) {
    const invalid = finiteNumber(value[key], `${label}.${key}`, limits);
    if (invalid) return invalid;
  }
  for (const key of ["width", "height"] as const) {
    const invalid = positiveDimension(value[key], `${label}.${key}`, limits);
    if (invalid) return invalid;
  }
  return undefined;
}

function validateStyle(value: unknown, label: string, limits: IdeaSketchOperationLimits, textStyle = false) {
  if (!isPlainRecord(value)) return fail(`${label} must be an object.`);
  const fields = textStyle
    ? ["fontFamily", "fontSize", "color", "textAlign", "verticalAlign", "opacity", "lineHeight"]
    : ["backgroundColor", "strokeColor", "strokeWidth", "strokeStyle", "fillStyle", "roundness", "opacity", "roughness"];
  const unknown = rejectUnknownFields(value, fields, label);
  if (unknown) return unknown;
  for (const key of ["backgroundColor", "strokeColor", "color"] as const) {
    if (value[key] !== undefined && (typeof value[key] !== "string" || value[key].length > 128)) return fail(`${label}.${key} must be a bounded string.`);
  }
  if (value.strokeWidth !== undefined) {
    const invalid = positiveDimension(value.strokeWidth, `${label}.strokeWidth`, { ...limits, maxDimension: 64 });
    if (invalid) return invalid;
  }
  if (value.fontSize !== undefined && (typeof value.fontSize !== "number" || !Number.isFinite(value.fontSize) || value.fontSize < limits.minFontSize || value.fontSize > limits.maxFontSize)) {
    return fail(`${label}.fontSize is outside the supported range.`);
  }
  if (value.lineHeight !== undefined && (typeof value.lineHeight !== "number" || !Number.isFinite(value.lineHeight) || value.lineHeight < limits.minLineHeight || value.lineHeight > limits.maxLineHeight)) {
    return fail(`${label}.lineHeight is outside the supported range.`);
  }
  if (value.opacity !== undefined && (typeof value.opacity !== "number" || !Number.isInteger(value.opacity) || value.opacity < 0 || value.opacity > 100)) return fail(`${label}.opacity must be an integer from 0 to 100.`);
  if (value.roughness !== undefined && (typeof value.roughness !== "number" || ![0, 1, 2].includes(value.roughness))) return fail(`${label}.roughness is unsupported.`);
  if (value.strokeStyle !== undefined && (typeof value.strokeStyle !== "string" || !STROKE_STYLES.has(value.strokeStyle))) return fail(`${label}.strokeStyle is unsupported.`);
  if (value.fillStyle !== undefined && (typeof value.fillStyle !== "string" || !FILL_STYLES.has(value.fillStyle))) return fail(`${label}.fillStyle is unsupported.`);
  if (value.roundness !== undefined && value.roundness !== "sharp" && value.roundness !== "rounded") return fail(`${label}.roundness is unsupported.`);
  if (value.fontFamily !== undefined && (typeof value.fontFamily !== "string" || !FONTS.has(value.fontFamily))) return fail(`${label}.fontFamily is unsupported.`);
  if (value.textAlign !== undefined && (typeof value.textAlign !== "string" || !TEXT_ALIGNS.has(value.textAlign))) return fail(`${label}.textAlign is unsupported.`);
  if (value.verticalAlign !== undefined && (typeof value.verticalAlign !== "string" || !VERTICAL_ALIGNS.has(value.verticalAlign))) return fail(`${label}.verticalAlign is unsupported.`);
  return undefined;
}

function validateConnectorStyle(value: unknown, label: string, limits: IdeaSketchOperationLimits) {
  if (!isPlainRecord(value)) return fail(`${label} must be an object.`);
  const unknown = rejectUnknownFields(value, ["strokeColor", "strokeWidth", "strokeStyle", "opacity", "roughness"], label);
  if (unknown) return unknown;
  return validateStyle(value, label, limits);
}

function validateLayout(value: unknown, label: string, limits: IdeaSketchOperationLimits) {
  if (!isPlainRecord(value)) return fail(`${label} must be an object.`);
  const unknown = rejectUnknownFields(value, ["autoResize", "width", "overflowPolicy"], label);
  if (unknown) return unknown;
  if (value.autoResize !== undefined && typeof value.autoResize !== "boolean") return fail(`${label}.autoResize must be boolean.`);
  if (value.width !== undefined) {
    const invalid = positiveDimension(value.width, `${label}.width`, limits);
    if (invalid) return invalid;
  }
  if (value.autoResize === true && value.width !== undefined) return fail(`${label} cannot specify width when autoResize is true.`);
  if (value.overflowPolicy !== undefined && value.overflowPolicy !== "grow-container") return fail(`${label}.overflowPolicy is unsupported.`);
  if (value.autoResize === false && value.width === undefined) return fail(`${label}.width is required when autoResize is false.`);
  return undefined;
}

function validateBoundTextLayout(value: unknown, label: string, limits: IdeaSketchOperationLimits) {
  const invalid = validateLayout(value, label, limits);
  if (invalid) return invalid;
  const layout = value as Record<string, unknown>;
  if (layout.autoResize !== undefined || layout.width !== undefined) {
    return fail(`${label} width and autoResize are owned by the text container.`);
  }
  return undefined;
}

function arrowhead(value: unknown, label: string) {
  return ARROWHEADS.has(value as IdeaSketchArrowhead) ? undefined : fail(`${label} is unsupported.`);
}

function endpointTarget(value: unknown, label: string) {
  if (!isPlainRecord(value)) return fail(`${label} must be a target reference or endpoint patch.`);
  const unknown = rejectUnknownFields(value, ["endpoint", "targetRef"], label);
  if (unknown) return unknown;
  if (value.endpoint === undefined) return fail(`${label}.endpoint is required.`);
  if (value.endpoint !== label.split(".").pop()) return fail(`${label}.endpoint does not match the endpoint field.`);
  return stableRef(value.targetRef, `${label}.targetRef`);
}

function validatePoints(value: unknown, label: string, limits: IdeaSketchOperationLimits) {
  if (!Array.isArray(value) || value.length < 2) return fail(`${label} must contain at least two points.`);
  for (const [index, point] of value.entries()) {
    if (!Array.isArray(point) || point.length !== 2) return fail(`${label}[${index}] must be a two-number point.`);
    const x = finiteNumber(point[0], `${label}[${index}][0]`, limits);
    if (x) return x;
    const y = finiteNumber(point[1], `${label}[${index}][1]`, limits);
    if (y) return y;
  }
  return undefined;
}

function requireField(value: Record<string, unknown>, key: string, label: string) {
  return value[key] === undefined ? fail(`${label}.${key} is required.`) : undefined;
}

function containsStableReference(value: unknown): boolean {
  if (typeof value === "string") {
    return /^(element|camera|page|asset|scene-snapshot|document-snapshot|snapshot-cursor|confirmation-receipt):/.test(value);
  }
  if (!isPlainRecord(value)) return false;
  return containsStableReference(value.targetRef);
}

function seedContainsStableReference(operation: IdeaSketchOperation) {
  switch (operation.kind) {
    case "bind-arrow":
      return [operation.arrowRef, operation.start, operation.end].some(containsStableReference);
    case "bind-text":
      return containsStableReference(operation.textRef) || containsStableReference(operation.containerRef);
    default:
      // All other seed operation reference-bearing fields are TempRefs and
      // have already been validated by their operation-specific schemas.
      return false;
  }
}

function validateByKind(kind: IdeaSketchOperationKind, value: Record<string, unknown>, limits: IdeaSketchOperationLimits) {
  const refError = (key: string, prefixes?: readonly string[]) => stableRef(value[key], `${kind}.${key}`, prefixes);
  switch (kind) {
    case "add-page": {
      const pageRef = tempRef(value.ref, `${kind}.ref`);
      if (pageRef) return pageRef;
      if (value.title !== undefined && (typeof value.title !== "string" || value.title.trim().length === 0 || value.title.trim().length > 120)) return fail(`${kind}.title must be 1–120 characters after trimming.`);
      if (value.initialScene !== undefined) {
        if (!isPlainRecord(value.initialScene)) return fail(`${kind}.initialScene must be an object.`);
        const unknown = rejectUnknownFields(value.initialScene, ["operations"], `${kind}.initialScene`);
        if (unknown) return unknown;
        const seed = validateOperationPlan(value.initialScene.operations, limits);
        if (seed.status === "rejected") return seed;
        if (seed.value.some((operation) => !["create-shape", "create-arrow", "create-text", "create-camera", "bind-arrow", "bind-text", "set-background"].includes(operation.kind))) return fail(`${kind}.initialScene contains an unsupported seed operation.`);
        if (seed.value.some((operation) => operation.kind === "create-camera" && operation.atIndex !== undefined)) return fail(`${kind}.initialScene create-camera must append and cannot specify atIndex.`);
        if (seed.value.some(seedContainsStableReference)) return fail(`${kind}.initialScene may reference only TempRefs created in the same seed.`);
      }
      return undefined;
    }
    case "import-page": {
      const pageRef = tempRef(value.ref, `${kind}.ref`);
      if (pageRef) return pageRef;
      const parsedDraft = stableRef(value.parsedPageDraftRef, `${kind}.parsedPageDraftRef`, ["import:"]);
      if (parsedDraft) return fail(`${kind}.parsedPageDraftRef must be a parsed page draft reference.`);
      if (value.title !== undefined && (typeof value.title !== "string" || value.title.trim().length === 0 || value.title.trim().length > 120)) return fail(`${kind}.title must be 1–120 characters after trimming.`);
      return undefined;
    }
    case "duplicate-page": {
      const ref = tempRef(value.ref, `${kind}.ref`);
      if (ref) return ref;
      const source = stableRef(value.sourcePageRef, `${kind}.sourcePageRef`, ["page:"]);
      if (source) return source;
      if (value.title !== undefined && (typeof value.title !== "string" || value.title.trim().length === 0 || value.title.trim().length > 120)) return fail(`${kind}.title must be 1–120 characters after trimming.`);
      return undefined;
    }
    case "rename-page": {
      const page = stableRef(value.pageRef, `${kind}.pageRef`, ["page:", "temp:"]);
      if (page) return page;
      if (typeof value.title !== "string" || value.title.trim().length === 0 || value.title.trim().length > 120) return fail(`${kind}.title must be 1–120 characters after trimming.`);
      return undefined;
    }
    case "reorder-page": {
      const page = stableRef(value.pageRef, `${kind}.pageRef`, ["page:", "temp:"]);
      if (page) return page;
      if (typeof value.toIndex !== "number" || !Number.isInteger(value.toIndex) || value.toIndex < 0) return fail(`${kind}.toIndex must be a non-negative integer.`);
      return undefined;
    }
    case "delete-page": {
      return stableRef(value.pageRef, `${kind}.pageRef`, ["page:", "temp:"]);
    }
    case "create-page-from-selection": {
      const ref = tempRef(value.ref, `${kind}.ref`);
      if (ref) return ref;
      const source = stableRef(value.sourcePageRef, `${kind}.sourcePageRef`, ["page:"]);
      if (source) return source;
      if (!Array.isArray(value.selectedRefs) || value.selectedRefs.length === 0) return fail(`${kind}.selectedRefs must not be empty.`);
      if (new Set(value.selectedRefs).size !== value.selectedRefs.length) return fail(`${kind}.selectedRefs must not contain duplicates.`);
      for (const [index, ref] of value.selectedRefs.entries()) {
        const invalid = stableRef(ref, `${kind}.selectedRefs[${index}]`, ["element:"]);
        if (invalid) return invalid;
      }
      if (value.preset !== "formal") return fail(`${kind}.preset must be formal.`);
      return undefined;
    }
    case "create-shape": {
      const required = requireField(value, "ref", kind) ?? requireField(value, "shape", kind);
      if (required) return required;
      const ref = tempRef(value.ref, `${kind}.ref`);
      if (ref) return ref;
      if (typeof value.shape !== "string" || !SHAPES.has(value.shape)) return fail(`${kind}.shape is unsupported.`);
      if (value.bounds === undefined) return fail(`${kind}.bounds is required.`);
      const bounds = validateTopLevelBounds(value, kind, limits);
      if (bounds) return bounds;
      if (value.style !== undefined) {
        const style = validateStyle(value.style, `${kind}.style`, limits);
        if (style) return style;
      }
      if (value.boundText !== undefined) {
        if (!isPlainRecord(value.boundText)) return fail(`${kind}.boundText must be an object.`);
        const unknown = rejectUnknownFields(value.boundText, ["ref", "text", "originalText", "style", "layout"], `${kind}.boundText`);
        if (unknown) return unknown;
        const textRef = tempRef(value.boundText.ref, `${kind}.boundText.ref`);
        if (textRef) return textRef;
        if (value.boundText.text !== undefined || value.boundText.originalText !== undefined) {
          const text = validateTextAliases(value.boundText, `${kind}.boundText`, limits);
          if (text) return text;
        }
        if (value.boundText.style !== undefined) {
          const style = validateStyle(value.boundText.style, `${kind}.boundText.style`, limits, true);
          if (style) return style;
        }
        if (value.boundText.layout !== undefined) {
          const layout = validateBoundTextLayout(value.boundText.layout, `${kind}.boundText.layout`, limits);
          if (layout) return layout;
        }
      }
      return undefined;
    }
    case "create-arrow": {
      const ref = tempRef(value.ref, `${kind}.ref`);
      if (ref) return ref;
      const points = validatePoints(value.points, `${kind}.points`, limits);
      if (points) return points;
      if (value.style !== undefined) {
        const style = validateConnectorStyle(value.style, `${kind}.style`, limits);
        if (style) return style;
      }
      if (value.arrowheads !== undefined) {
        if (!isPlainRecord(value.arrowheads)) return fail(`${kind}.arrowheads must be an object.`);
        const unknown = rejectUnknownFields(value.arrowheads, ["start", "end"], `${kind}.arrowheads`);
        if (unknown) return unknown;
        for (const key of ["start", "end"] as const) {
          if (value.arrowheads[key] !== undefined) {
            const invalid = arrowhead(value.arrowheads[key], `${kind}.arrowheads.${key}`);
            if (invalid) return invalid;
          }
        }
      }
      return undefined;
    }
    case "create-text": {
      const ref = tempRef(value.ref, `${kind}.ref`);
      if (ref) return ref;
      const x = finiteNumber(value.x, `${kind}.x`, limits);
      if (x) return x;
      const y = finiteNumber(value.y, `${kind}.y`, limits);
      if (y) return y;
      const text = validateTextAliases(value, kind, limits);
      if (text) return text;
      if (value.style !== undefined) {
        const style = validateStyle(value.style, `${kind}.style`, limits, true);
        if (style) return style;
      }
      if (value.layout !== undefined) {
        const layout = validateLayout(value.layout, `${kind}.layout`, limits);
        if (layout) return layout;
      }
      return undefined;
    }
    case "create-camera": {
      const ref = tempRef(value.ref, `${kind}.ref`);
      if (ref) return ref;
      if (value.bounds === undefined) return fail(`${kind}.bounds is required.`);
      const bounds = validateTopLevelBounds(value, kind, limits);
      if (bounds) return bounds;
      if (value.atIndex !== undefined && (typeof value.atIndex !== "number" || !Number.isInteger(value.atIndex) || value.atIndex < 0)) return fail(`${kind}.atIndex must be a non-negative integer.`);
      return undefined;
    }
    case "bind-arrow": {
      const arrow = refError("arrowRef");
      if (arrow) return arrow;
      const start = value.start;
      const end = value.end;
      if (start === undefined && end === undefined) return fail(`${kind} requires at least one endpoint patch.`);
      for (const [key, target] of [["start", start], ["end", end]] as const) {
        if (target !== undefined) {
          const invalid = endpointTarget(target, `${kind}.${key}`);
          if (invalid) return invalid;
        }
      }
      return undefined;
    }
    case "unbind-arrow": {
      const arrow = refError("arrowRef");
      if (arrow) return arrow;
      if (value.endpoint === undefined || !["start", "end", "both"].includes(value.endpoint as string)) return fail(`${kind}.endpoint must be start, end, or both.`);
      return undefined;
    }
    case "bind-text": {
      const text = refError("textRef");
      if (text) return text;
      const container = refError("containerRef");
      if (container) return container;
      return undefined;
    }
    case "unbind-text": {
      if (value.textRef === undefined && value.containerRef === undefined) return fail(`${kind} requires textRef or containerRef.`);
      for (const key of ["textRef", "containerRef"] as const) {
        if (value[key] !== undefined) {
          const invalid = refError(key);
          if (invalid) return invalid;
        }
      }
      return undefined;
    }
    case "upsert-bound-text": {
      const shape = refError("shapeRef");
      if (shape) return shape;
      if (value.createRef !== undefined) {
        const create = tempRef(value.createRef, `${kind}.createRef`);
        if (create) return create;
      }
      if (value.text === undefined && value.originalText === undefined) return fail(`${kind} requires text or originalText.`);
      const text = validateTextAliases(value, kind, limits);
      if (text) return text;
      if (value.style !== undefined) {
        const style = validateStyle(value.style, `${kind}.style`, limits, true);
        if (style) return style;
      }
      if (value.layout !== undefined) {
        const layout = validateBoundTextLayout(value.layout, `${kind}.layout`, limits);
        if (layout) return layout;
      }
      return undefined;
    }
    case "set-text": {
      const target = refError("textRef");
      if (target) return target;
      if (value.text === undefined && value.originalText === undefined) return fail(`${kind} requires text or originalText.`);
      return validateTextAliases(value, kind, limits);
    }
    case "set-text-style": {
      const target = refError("textRef");
      if (target) return target;
      if (value.style !== undefined && ["fontFamily", "fontSize", "color", "textAlign", "verticalAlign", "opacity", "lineHeight"].some((key) => value[key] !== undefined)) return fail(`${kind} cannot mix style with top-level style fields.`);
      if (value.style === undefined && !["fontFamily", "fontSize", "color", "textAlign", "verticalAlign", "opacity", "lineHeight"].some((key) => value[key] !== undefined)) return fail(`${kind} requires a style patch.`);
      if (value.style !== undefined) {
        const style = validateStyle(value.style, `${kind}.style`, limits, true);
        if (style) return style;
      }
      const topLevelStyle = { ...value };
      delete topLevelStyle.textRef;
      delete topLevelStyle.style;
      const style = validateStyle(topLevelStyle, kind, limits, true);
      if (style) return style;
      return undefined;
    }
    case "set-text-layout": {
      const target = refError("textRef");
      if (target) return target;
      if (value.layout !== undefined && (value.autoResize !== undefined || value.width !== undefined)) return fail(`${kind} cannot mix layout with top-level layout fields.`);
      if (value.layout === undefined && value.autoResize === undefined && value.width === undefined) return fail(`${kind} requires a layout patch.`);
      if (value.layout !== undefined) {
        const layout = validateLayout(value.layout, `${kind}.layout`, limits);
        if (layout) return layout;
      }
      if (value.autoResize !== undefined && typeof value.autoResize !== "boolean") return fail(`${kind}.autoResize must be boolean.`);
      if (value.width !== undefined) {
        const width = positiveDimension(value.width, `${kind}.width`, limits);
        if (width) return width;
      }
      const autoResize = value.autoResize ?? (isPlainRecord(value.layout) ? value.layout.autoResize : undefined);
      const width = value.width ?? (isPlainRecord(value.layout) ? value.layout.width : undefined);
      if (autoResize === true && width !== undefined) return fail(`${kind} cannot enable autoResize while setting a bounded width.`);
      if (autoResize === false && width === undefined) return fail(`${kind}.width is required when autoResize is false.`);
      return undefined;
    }
    case "set-shape-style":
    case "set-connector-style": {
      const target = refError(kind === "set-shape-style" ? "shapeRef" : "arrowRef");
      if (target) return target;
      if (!isPlainRecord(value.style)) return fail(`${kind}.style is required.`);
      return kind === "set-connector-style"
        ? validateConnectorStyle(value.style, `${kind}.style`, limits)
        : validateStyle(value.style, `${kind}.style`, limits);
    }
    case "set-arrowheads": {
      const target = refError("arrowRef");
      if (target) return target;
      const start = value.start;
      const end = value.end;
      if (start === undefined && end === undefined) return fail(`${kind} requires a start or end arrowhead.`);
      for (const [key, head] of [["start", start], ["end", end]] as const) {
        if (head !== undefined) {
          const invalid = arrowhead(head, `${kind}.${key}`);
          if (invalid) return invalid;
        }
      }
      return undefined;
    }
    case "move-element": {
      const target = refError("elementRef");
      if (target) return target;
      const dx = finiteNumber(value.dx, `${kind}.dx`, limits);
      if (dx) return dx;
      return finiteNumber(value.dy, `${kind}.dy`, limits);
    }
    case "resize-element": {
      const target = refError("elementRef");
      if (target) return target;
      const width = positiveDimension(value.width, `${kind}.width`, limits);
      if (width) return width;
      const height = positiveDimension(value.height, `${kind}.height`, limits);
      if (height) return height;
      if (value.anchor !== undefined && value.anchor !== "top-left") return fail(`${kind}.anchor is unsupported.`);
      if (value.keepAspect !== undefined && typeof value.keepAspect !== "boolean") return fail(`${kind}.keepAspect must be boolean.`);
      return undefined;
    }
    case "set-connector-points": {
      const target = refError("arrowRef");
      if (target) return target;
      return validatePoints(value.points, `${kind}.points`, limits);
    }
    case "update-camera-bounds": {
      const target = stableRef(value.cameraRef, `${kind}.cameraRef`, ["camera:", "temp:"]);
      if (target) return target;
      if (value.bounds === undefined) return fail(`${kind}.bounds is required.`);
      return validateTopLevelBounds(value, kind, limits);
    }
    case "set-camera-order": {
      const refs = value.cameraRefs;
      if (!Array.isArray(refs)) return fail(`${kind}.cameraRefs is required.`);
      const seen = new Set<string>();
      for (const [index, ref] of refs.entries()) {
        const invalid = stableRef(ref, `${kind}.cameraRefs[${index}]`, ["camera:", "temp:"]);
        if (invalid) return invalid;
        if (seen.has(ref as string)) return fail(`${kind} contains duplicate Camera refs.`);
        seen.add(ref as string);
      }
      return undefined;
    }
    case "delete-element": {
      return refError("elementRef");
    }
    case "delete-camera": {
      return stableRef(value.cameraRef, `${kind}.cameraRef`, ["camera:", "temp:"]);
    }
    case "set-background": {
      const color = value.color;
      if (typeof color !== "string" || color.length === 0 || color.length > 128) return fail(`${kind} requires a bounded color string.`);
      return undefined;
    }
    case "apply-style-preset": {
      if (!Array.isArray(value.selectedRefs) || value.selectedRefs.length === 0) return fail(`${kind}.selectedRefs must not be empty.`);
      if (new Set(value.selectedRefs).size !== value.selectedRefs.length) return fail(`${kind}.selectedRefs must not contain duplicates.`);
      if (value.preset !== "formal") return fail(`${kind}.preset is unsupported.`);
      for (const [index, ref] of value.selectedRefs.entries()) {
        const invalid = stableRef(ref, `${kind}.selectedRefs[${index}]`);
        if (invalid) return invalid;
      }
      return undefined;
    }
    case "clear-scene": {
      if (value.scope !== "content-only" && value.scope !== "all-elements") return fail(`${kind}.scope is unsupported.`);
      const receipt = stableRef(value.confirmationReceipt, `${kind}.confirmationReceipt`, ["confirmation-receipt:"]);
      if (receipt) return receipt;
      return undefined;
    }
    default:
      return error("unsupported_operation", `The ${kind} operation is not supported.`);
  }
}

function canonicalizeOperation(value: Record<string, unknown>, limits: IdeaSketchOperationLimits): Record<string, unknown> {
  const output = structuredClone(value) as Record<string, unknown>;
  const canonicalizeLayout = (value: unknown) => {
    if (!isPlainRecord(value)) return value;
    const layout = { ...value };
    if (layout.width !== undefined && layout.autoResize === undefined) layout.autoResize = false;
    return layout;
  };
  const kind = output.kind;
  if (["add-page", "import-page", "duplicate-page", "rename-page"].includes(String(kind)) && typeof output.title === "string") {
    output.title = output.title.trim();
  }
  const canonicalizeTextContent = (record: Record<string, unknown>) => {
    if (record.text !== undefined) {
      record.originalText = record.text;
      delete record.text;
    }
  };
  if (kind === "create-text" || kind === "set-text" || kind === "upsert-bound-text") {
    canonicalizeTextContent(output);
  }
  if (kind === "create-shape" && isPlainRecord(output.boundText)) {
    canonicalizeTextContent(output.boundText);
    if (output.boundText.layout !== undefined) output.boundText.layout = canonicalizeLayout(output.boundText.layout);
  }
  if (kind === "create-text" || kind === "upsert-bound-text") {
    if (output.layout !== undefined) output.layout = canonicalizeLayout(output.layout);
  }
  if (kind === "set-text-style") {
    const style = isPlainRecord(output.style) ? { ...output.style } : {};
    for (const key of ["fontFamily", "fontSize", "color", "textAlign", "verticalAlign", "opacity", "lineHeight"]) {
      if (output[key] !== undefined) style[key] = output[key];
      delete output[key];
    }
    output.style = style;
  }
  if (kind === "set-text-layout") {
    const layout = isPlainRecord(output.layout) ? { ...output.layout } : {};
    if (output.autoResize !== undefined) layout.autoResize = output.autoResize;
    if (output.width !== undefined) layout.width = output.width;
    if (layout.width !== undefined && layout.autoResize === undefined) layout.autoResize = false;
    delete output.autoResize;
    delete output.width;
    output.layout = layout;
  }
  if (kind === "add-page" && isPlainRecord(output.initialScene) && Array.isArray(output.initialScene.operations)) {
    const seed = validateOperationPlan(output.initialScene.operations, limits);
    if (seed.status === "rejected") throw new Error(seed.error.message);
    output.initialScene.operations = seed.value;
  }
  return output;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

export function getOperationSchema(kind: string) {
  if (typeof kind !== "string") return undefined;
  try {
    const fields = Object.prototype.hasOwnProperty.call(SCHEMA_FIELDS, kind)
      ? SCHEMA_FIELDS[kind as IdeaSketchOperationKind]
      : undefined;
    return fields ? Object.freeze({ kind, version: 1 as const, fields: Object.freeze([...fields]) }) : undefined;
  } catch {
    return undefined;
  }
}

export function buildIdeaSketchOperation<K extends IdeaSketchOperationKind>(
  kind: K,
  input: IdeaSketchOperationInput<K>,
  limits?: Partial<IdeaSketchOperationLimits>,
): SdkSyncResult<IdeaSketchOperationOf<K>>;
export function buildIdeaSketchOperation(
  kind: string,
  input: unknown,
  limits?: Partial<IdeaSketchOperationLimits>,
): SdkSyncResult<IdeaSketchOperation>;
export function buildIdeaSketchOperation(
  kind: string,
  input: unknown,
  limits: Partial<IdeaSketchOperationLimits> = {},
): SdkSyncResult<IdeaSketchOperation> {
  try {
    const validLimits = validateOperationLimits(limits);
    if (validLimits.status === "rejected") return validLimits;
    if (!Object.prototype.hasOwnProperty.call(SCHEMA_FIELDS, kind)) return error("unsupported_operation", `The ${kind} operation is not supported.`);
    if (!isPlainRecord(input)) return fail("The operation input must be a plain object.");
    if (Object.prototype.hasOwnProperty.call(input, "kind") || Object.prototype.hasOwnProperty.call(input, "version")) return fail("Operation kind and version are host-owned.");
    const fields = SCHEMA_FIELDS[kind as IdeaSketchOperationKind];
    const unknown = rejectUnknownFields(input, fields, kind);
    if (unknown) return unknown;
    const strict = validateStrictJsonValue(input, kind);
    if (strict) return strict;
    // Validate a detached own-property clone so inherited properties cannot
    // influence the semantic payload and the canonical output cannot lose
    // fields during structuredClone.
    const canonicalInput = structuredClone(input) as Record<string, unknown>;
    const validation = validateByKind(kind as IdeaSketchOperationKind, canonicalInput, { ...DEFAULT_OPERATION_LIMITS, ...limits });
    if (validation) return validation;
    const mergedLimits = { ...DEFAULT_OPERATION_LIMITS, ...limits };
    const canonical = canonicalizeOperation({ kind, version: 1 as const, ...canonicalInput }, mergedLimits);
    const output = deepFreeze(canonical) as IdeaSketchOperation;
    const bytes = new TextEncoder().encode(JSON.stringify(output)).byteLength;
    const maxPlanBytes = limits.maxPlanBytes ?? DEFAULT_OPERATION_LIMITS.maxPlanBytes;
    if (bytes > maxPlanBytes) return fail("The operation exceeds the plan byte limit.");
    return sdkSucceeded(output);
  } catch {
    return fail("The operation is not strict JSON data.");
  }
}

export function validateIdeaSketchOperation(
  operation: unknown,
  limits: Partial<IdeaSketchOperationLimits> = {},
): SdkSyncResult<IdeaSketchOperation> {
  try {
    const validLimits = validateOperationLimits(limits);
    if (validLimits.status === "rejected") return validLimits;
    if (!isPlainRecord(operation) || typeof operation.kind !== "string" || operation.version !== 1) return fail("The operation must include version 1 and a known kind.");
    const fields = Object.prototype.hasOwnProperty.call(SCHEMA_FIELDS, operation.kind)
      ? SCHEMA_FIELDS[operation.kind as IdeaSketchOperationKind]
      : undefined;
    if (!fields) return error("unsupported_operation", `The ${operation.kind} operation is not supported.`);
    const unknown = rejectUnknownFields(operation, ["kind", "version", ...fields], operation.kind);
    if (unknown) return unknown;
    const input = { ...operation };
    delete input.kind;
    delete input.version;
    return buildIdeaSketchOperation(operation.kind, input, limits);
  } catch {
    return fail("The operation is not strict JSON data.");
  }
}

function referencedTempRefs(operation: IdeaSketchOperation): string[] {
  const refs: string[] = [];
  const add = (value: unknown) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      add((value as Record<string, unknown>).targetRef);
      return;
    }
    if (typeof value === "string" && value.startsWith("temp:")) refs.push(value);
  };
  switch (operation.kind) {
    case "rename-page":
    case "reorder-page":
    case "delete-page": add(operation.pageRef); break;
    case "create-shape": break;
    case "create-arrow": break;
    case "create-text": break;
    case "create-camera": break;
    case "bind-arrow": add(operation.arrowRef); add(operation.start); add(operation.end); break;
    case "unbind-arrow": add(operation.arrowRef); break;
    case "bind-text": add(operation.textRef); add(operation.containerRef); break;
    case "unbind-text": add(operation.textRef); add(operation.containerRef); break;
    case "upsert-bound-text": add(operation.shapeRef); break;
    case "set-text": add(operation.textRef); break;
    case "set-text-style": add(operation.textRef); break;
    case "set-text-layout": add(operation.textRef); break;
    case "set-shape-style": add(operation.shapeRef); break;
    case "set-connector-style": add(operation.arrowRef); break;
    case "set-arrowheads": add(operation.arrowRef); break;
    case "move-element": add(operation.elementRef); break;
    case "resize-element": add(operation.elementRef); break;
    case "set-connector-points": add(operation.arrowRef); break;
    case "update-camera-bounds": add(operation.cameraRef); break;
    case "set-camera-order": for (const ref of operation.cameraRefs ?? []) add(ref); break;
    case "delete-element": add(operation.elementRef); break;
    case "delete-camera": add(operation.cameraRef); break;
    case "apply-style-preset": for (const ref of operation.selectedRefs) add(ref); break;
    default: break;
  }
  return refs;
}

function createdTempRefs(operation: IdeaSketchOperation): string[] {
  switch (operation.kind) {
    case "add-page": {
      // Seed TempRefs are scoped to the detached new Page and must not leak
      // into the outer document plan's reference namespace.
      return typeof operation.ref === "string" && operation.ref.startsWith("temp:") ? [operation.ref] : [];
    }
    case "import-page":
    case "duplicate-page":
    case "create-page-from-selection":
      return typeof operation.ref === "string" && operation.ref.startsWith("temp:") ? [operation.ref] : [];
    case "create-shape": return [operation.ref, ...(operation.boundText ? [operation.boundText.ref] : [])];
    case "create-arrow":
    case "create-text":
    case "create-camera": return [operation.ref];
    case "upsert-bound-text": return operation.createRef ? [operation.createRef] : [];
    default: return [];
  }
}

// Includes detached Page seed allocations for the plan-wide uniqueness rule.
// Seed refs are deliberately excluded from createdTempRefs(), so they cannot
// be referenced by later operations in the outer plan.
function allCreatedTempRefs(operation: IdeaSketchOperation): string[] {
  if (operation.kind !== "add-page") return createdTempRefs(operation);
  const refs = typeof operation.ref === "string" && operation.ref.startsWith("temp:") ? [operation.ref] : [];
  const seed = isPlainRecord(operation.initialScene) && Array.isArray(operation.initialScene.operations)
    ? operation.initialScene.operations.flatMap((item) => allCreatedTempRefs(item as IdeaSketchOperation))
    : [];
  return [...refs, ...seed];
}

export function validateOperationPlan(
  operations: unknown,
  limits: Partial<IdeaSketchOperationLimits> = {},
): SdkSyncResult<readonly IdeaSketchOperation[]> {
  try {
    const validLimits = validateOperationLimits(limits);
    if (validLimits.status === "rejected") return validLimits;
    if (!Array.isArray(operations) || operations.length === 0) return fail("An operation plan must contain at least one operation.");
    const merged = { ...DEFAULT_OPERATION_LIMITS, ...limits };
    if (operations.length > merged.maxOperations) return fail("The operation plan exceeds the operation count limit.");
    const validated: IdeaSketchOperation[] = [];
    const created = new Set<string>();
    const allocated = new Set<string>();
    let bytes = 0;
    for (const [index, raw] of operations.entries()) {
      const result = validateIdeaSketchOperation(raw, merged);
      if (result.status === "rejected") {
        return {
          ...result,
          error: {
            ...result.error,
            message: `Operation ${index}: ${result.error.message}`,
            operationIndex: result.error.operationIndex ?? index,
          },
        };
      }
      const operation = result.value;
      const operationCreatedRefs = createdTempRefs(operation);
      const operationAllCreatedRefs = allCreatedTempRefs(operation);
      if (new Set(operationAllCreatedRefs).size !== operationAllCreatedRefs.length) {
        return sdkRejected("invalid_request", `Operation ${index}: TempRef is duplicated within the operation.`);
      }
      for (const ref of operationAllCreatedRefs) {
        if (allocated.has(ref)) return sdkRejected("invalid_request", `Operation ${index}: TempRef ${ref} is duplicated.`);
      }
      for (const ref of referencedTempRefs(operation)) {
        if (!created.has(ref)) return sdkRejected("invalid_request", `Operation ${index}: TempRef ${ref} must refer to an earlier operation.`);
      }
      for (const ref of operationAllCreatedRefs) allocated.add(ref);
      for (const ref of operationCreatedRefs) created.add(ref);
      validated.push(operation);
      // Bound the canonical serialized operation array, including JSON array
      // delimiters and separators, rather than summing element sizes.
      bytes = new TextEncoder().encode(JSON.stringify(validated)).byteLength;
      if (bytes > merged.maxPlanBytes) return fail("The operation plan exceeds the byte limit.");
    }
    return sdkSucceeded(Object.freeze(validated));
  } catch {
    return fail("The operation plan is not strict JSON data.");
  }
}

export const IDEA_SKETCH_OPERATION_SCHEMAS = SCHEMA_FIELDS;

export function isTempRef(value: unknown): value is TempRef {
  return typeof value === "string" && value.startsWith("temp:") && value.length > 5;
}

export function normalizeBounds(value: unknown, limits: Partial<IdeaSketchOperationLimits> = {}): SdkSyncResult<IdeaSketchBounds> {
  try {
    const merged = { ...DEFAULT_OPERATION_LIMITS, ...limits };
    if (isPlainRecord(value) && value.bounds !== undefined) value = value.bounds;
    if (!isPlainRecord(value)) return fail("Bounds must be an object.");
    const result = validateBounds(value, "bounds", merged);
    if (result) return result;
    return sdkSucceeded({ x: value.x as number, y: value.y as number, width: value.width as number, height: value.height as number });
  } catch {
    return fail("Bounds must be strict JSON data.");
  }
}

export function isArrowhead(value: unknown): value is IdeaSketchArrowhead {
  return ARROWHEADS.has(value as IdeaSketchArrowhead);
}
