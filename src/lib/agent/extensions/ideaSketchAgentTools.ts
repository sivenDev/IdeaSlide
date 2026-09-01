import type { IdeaSketchDocument } from "../../../types";
import { extractCameras } from "../../cameraUtils.ts";
import type {
  AgentChangeSet,
  AgentToolCall,
  AgentToolDescriptor,
  AgentToolExecutionContext,
  AgentToolResult,
} from "../types.ts";
import type { IdeaSketchAgentOperation, IdeaSketchDrawingOperation, IdeaSketchDrawingStyle } from "./ideaSketchAgentExtension.ts";

const MAX_SCENE_ELEMENT_SUMMARIES = 80;
const MAX_DRAWING_PLAN_OPERATIONS = 40;
const MAX_DRAWING_PLAN_BYTES = 32 * 1024;
const MAX_SCENE_COORDINATE = 1_000_000;
const MAX_ELEMENT_DIMENSION = 10_000;
const TEMP_REF_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const BINDABLE_SHAPE_TYPES = new Set(["rectangle", "ellipse", "diamond"]);

const DRAWING_STYLE_SCHEMA = {
  type: "object",
  properties: {
    strokeColor: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
    backgroundColor: { type: "string", pattern: "^(?:#[0-9a-fA-F]{6}|transparent)$" },
    strokeWidth: { type: "integer", enum: [1, 2, 4] },
    strokeStyle: { type: "string", enum: ["solid", "dashed", "dotted"] },
    fillStyle: { type: "string", enum: ["solid", "hachure", "cross-hatch"] },
    roughness: { type: "integer", enum: [0, 1, 2] },
    opacity: { type: "integer", minimum: 0, maximum: 100 },
    roundness: { type: "string", enum: ["sharp", "rounded"] },
  },
  additionalProperties: false,
};

const DRAWING_POINT_SCHEMA = {
  type: "object",
  properties: {
    x: { type: "number", minimum: -MAX_SCENE_COORDINATE, maximum: MAX_SCENE_COORDINATE },
    y: { type: "number", minimum: -MAX_SCENE_COORDINATE, maximum: MAX_SCENE_COORDINATE },
  },
  required: ["x", "y"],
  additionalProperties: false,
};

const DRAWING_OPERATION_SCHEMA = {
  oneOf: [
    {
      type: "object",
      properties: {
        kind: { const: "create-shape" },
        ref: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" },
        shape: { type: "string", enum: ["rectangle", "ellipse", "diamond"] },
        x: { type: "number", minimum: -MAX_SCENE_COORDINATE, maximum: MAX_SCENE_COORDINATE },
        y: { type: "number", minimum: -MAX_SCENE_COORDINATE, maximum: MAX_SCENE_COORDINATE },
        width: { type: "number", minimum: 4, maximum: MAX_ELEMENT_DIMENSION },
        height: { type: "number", minimum: 4, maximum: MAX_ELEMENT_DIMENSION },
        style: DRAWING_STYLE_SCHEMA,
      },
      required: ["kind", "ref", "shape", "x", "y", "width", "height"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        kind: { const: "create-arrow" },
        ref: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" },
        start: DRAWING_POINT_SCHEMA,
        end: DRAWING_POINT_SCHEMA,
        style: DRAWING_STYLE_SCHEMA,
      },
      required: ["kind", "ref", "start", "end"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        kind: { const: "bind-arrow" },
        arrowRef: { type: "string", minLength: 1, maxLength: 128 },
        startElementRef: { type: "string", minLength: 1, maxLength: 256 },
        endElementRef: { type: "string", minLength: 1, maxLength: 256 },
      },
      required: ["kind", "arrowRef"],
      anyOf: [
        { required: ["startElementRef"] },
        { required: ["endElementRef"] },
      ],
      additionalProperties: false,
    },
  ],
};

export const IDEA_SKETCH_AGENT_TOOLS: AgentToolDescriptor[] = [
  {
    name: "read_document_outline",
    description: "Read the ordered IdeaSketch Page outline and active Page summary.",
    effect: "read",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "read_active_page",
    description: "Read the bounded active Page scene and Page-scoped Cameras from the captured editor state.",
    effect: "read",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "add_page",
    description: "Add a new editable IdeaSketch Page through the active editor. The editor applies this atomically and handles persistence.",
    effect: "write",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1, maxLength: 120 },
        elements: { type: "array", maxItems: 500, items: { type: "object" } },
      },
      required: ["title", "elements"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_page",
    description: "Delete one existing Page through the active editor. The document must retain at least one Page.",
    effect: "write",
    inputSchema: {
      type: "object",
      properties: { pageId: { type: "string", minLength: 1 } },
      required: ["pageId"],
      additionalProperties: false,
    },
  },
  {
    name: "reorder_page",
    description: "Move an existing Page to a zero-based position through the active editor.",
    effect: "write",
    inputSchema: {
      type: "object",
      properties: { pageId: { type: "string", minLength: 1 }, toIndex: { type: "integer", minimum: 0 } },
      required: ["pageId", "toIndex"],
      additionalProperties: false,
    },
  },
  {
    name: "replace_page_elements",
    description: "After read_active_page succeeds, replace the editable elements of that active Page through its mounted canvas editor while preserving Page identity and metadata.",
    effect: "write",
    requires: ["read_active_page"],
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", minLength: 1 },
        elements: { type: "array", maxItems: 500, items: { type: "object" } },
      },
      required: ["pageId", "elements"],
      additionalProperties: false,
    },
  },
  {
    name: "apply_drawing_plan",
    description: "After read_active_page succeeds, apply one bounded ordered semantic shape, arrow, and binding plan to that active Page without replacing unrelated elements.",
    effect: "write",
    requires: ["read_active_page"],
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", minLength: 1 },
        operations: {
          type: "array",
          minItems: 1,
          maxItems: MAX_DRAWING_PLAN_OPERATIONS,
          items: DRAWING_OPERATION_SCHEMA,
        },
      },
      required: ["pageId", "operations"],
      additionalProperties: false,
    },
  },
];

function asFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function boundedText(value: unknown) {
  if (typeof value !== "string" || value.length === 0) return undefined;
  return value.length <= 240 ? value : `${value.slice(0, 239)}…`;
}

const DEFAULT_DRAWING_STYLE: IdeaSketchDrawingStyle = {
  strokeColor: "#1e1e1e",
  backgroundColor: "transparent",
  strokeWidth: 2,
  strokeStyle: "solid",
  fillStyle: "solid",
  roughness: 0,
  opacity: 100,
  roundness: "sharp",
};

function normalizeDrawingStyle(value: unknown, kind: "shape" | "arrow"): IdeaSketchDrawingStyle {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const style = {
    ...DEFAULT_DRAWING_STYLE,
    ...input,
    backgroundColor: kind === "arrow" ? "transparent" : input.backgroundColor ?? DEFAULT_DRAWING_STYLE.backgroundColor,
  } as IdeaSketchDrawingStyle;
  if (!COLOR_PATTERN.test(style.strokeColor) || !COLOR_PATTERN.test(style.backgroundColor) && style.backgroundColor !== "transparent") {
    throw new Error("Drawing style colors must be six-digit hexadecimal values.");
  }
  if (![1, 2, 4].includes(style.strokeWidth) || ![0, 1, 2].includes(style.roughness)) {
    throw new Error("Drawing style contains an unsupported stroke width or roughness.");
  }
  if (!["solid", "dashed", "dotted"].includes(style.strokeStyle)
    || !["solid", "hachure", "cross-hatch"].includes(style.fillStyle)
    || !["sharp", "rounded"].includes(style.roundness)
    || !Number.isInteger(style.opacity) || style.opacity < 0 || style.opacity > 100) {
    throw new Error("Drawing style contains an unsupported visual property.");
  }
  return style;
}

function normalizePoint(value: unknown, label: string) {
  if (!value || typeof value !== "object") throw new Error(`${label} must be a point.`);
  const point = value as Record<string, unknown>;
  const x = point.x;
  const y = point.y;
  if (typeof x !== "number" || !Number.isFinite(x) || Math.abs(x) > MAX_SCENE_COORDINATE
    || typeof y !== "number" || !Number.isFinite(y) || Math.abs(y) > MAX_SCENE_COORDINATE) {
    throw new Error(`${label} must contain finite bounded coordinates.`);
  }
  return { x, y };
}

function normalizeRef(value: unknown, label: string) {
  if (typeof value !== "string" || !TEMP_REF_PATTERN.test(value)) {
    throw new Error(`${label} must be a short stable reference.`);
  }
  return value;
}

function normalizeTargetRef(value: unknown, label: string) {
  if (typeof value !== "string" || (!TEMP_REF_PATTERN.test(value) && !/^element:[A-Za-z0-9_-]{1,128}$/.test(value))) {
    throw new Error(`${label} must identify an existing element or plan reference.`);
  }
  return value;
}

function stableDrawingElementId(pageId: string, callId: string, index: number) {
  let hash = 2_166_136_261;
  for (const character of `${pageId}:${callId}:${index}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return `agent-${(hash >>> 0).toString(36)}-${index}`;
}

function normalizeDrawingPlan(
  args: Record<string, unknown>,
  activePage: IdeaSketchDocument["pages"][number] | undefined,
  callId: string,
): IdeaSketchDrawingOperation[] {
  if (typeof args.pageId !== "string" || args.pageId !== activePage?.id) {
    throw new Error("Drawing plans must target the captured active Page.");
  }
  const rawOperations = args.operations;
  if (!Array.isArray(rawOperations) || rawOperations.length === 0 || rawOperations.length > MAX_DRAWING_PLAN_OPERATIONS) {
    throw new Error(`Drawing plans must contain between 1 and ${MAX_DRAWING_PLAN_OPERATIONS} operations.`);
  }
  if (JSON.stringify(args).length > MAX_DRAWING_PLAN_BYTES) {
    throw new Error("Drawing plan payload exceeds the bounded size limit.");
  }
  const refs = new Set<string>();
  const arrowRefs = new Set<string>();
  const shapeRefs = new Set<string>();
  const existingElementRefs = new Map(
    (activePage?.elements ?? [])
      .filter((element) => element && !element.isDeleted && typeof element.id === "string")
      .map((element) => [`element:${element.id}`, element]),
  );
  const operations: IdeaSketchDrawingOperation[] = [];
  rawOperations.forEach((rawOperation, index) => {
    if (!rawOperation || typeof rawOperation !== "object") throw new Error("Every drawing operation must be an object.");
    const input = rawOperation as Record<string, unknown>;
    const pageId = args.pageId as string;
    if (input.kind === "create-shape") {
      const ref = normalizeRef(input.ref, "Shape ref");
      if (refs.has(ref)) throw new Error(`Drawing reference is duplicated: ${ref}`);
      const width = input.width;
      const height = input.height;
      if (typeof width !== "number" || !Number.isFinite(width) || width < 4 || width > MAX_ELEMENT_DIMENSION
        || typeof height !== "number" || !Number.isFinite(height) || height < 4 || height > MAX_ELEMENT_DIMENSION) {
        throw new Error("Shape dimensions are outside the bounded drawing limits.");
      }
      const x = input.x;
      const y = input.y;
      if (typeof x !== "number" || !Number.isFinite(x) || Math.abs(x) > MAX_SCENE_COORDINATE
        || typeof y !== "number" || !Number.isFinite(y) || Math.abs(y) > MAX_SCENE_COORDINATE) {
        throw new Error("Shape coordinates are outside the bounded drawing limits.");
      }
      if (!["rectangle", "ellipse", "diamond"].includes(String(input.shape))) {
        throw new Error("Only rectangle, ellipse, and diamond shapes are supported.");
      }
      refs.add(ref);
      shapeRefs.add(ref);
      operations.push({
        kind: "create-shape",
        pageId,
        ref,
        elementId: stableDrawingElementId(pageId, callId, index),
        shape: input.shape as "rectangle" | "ellipse" | "diamond",
        x,
        y,
        width,
        height,
        style: normalizeDrawingStyle(input.style, "shape"),
      });
      return;
    }
    if (input.kind === "create-arrow") {
      const ref = normalizeRef(input.ref, "Arrow ref");
      if (refs.has(ref)) throw new Error(`Drawing reference is duplicated: ${ref}`);
      refs.add(ref);
      arrowRefs.add(ref);
      operations.push({
        kind: "create-arrow",
        pageId,
        ref,
        elementId: stableDrawingElementId(pageId, callId, index),
        start: normalizePoint(input.start, "Arrow start"),
        end: normalizePoint(input.end, "Arrow end"),
        style: normalizeDrawingStyle(input.style, "arrow"),
      });
      return;
    }
    if (input.kind === "bind-arrow") {
      const arrowRef = normalizeRef(input.arrowRef, "Arrow binding ref");
      const startElementRef = input.startElementRef === undefined
        ? undefined
        : normalizeTargetRef(input.startElementRef, "Arrow start target");
      const endElementRef = input.endElementRef === undefined
        ? undefined
        : normalizeTargetRef(input.endElementRef, "Arrow end target");
      if (!startElementRef && !endElementRef) throw new Error("Arrow binding needs an endpoint target.");
      if (!arrowRefs.has(arrowRef)) throw new Error(`Arrow binding must follow an earlier created arrow: ${arrowRef}`);
      for (const targetRef of [startElementRef, endElementRef]) {
        if (!targetRef) continue;
        if (targetRef.startsWith("element:")) {
          const target = existingElementRefs.get(targetRef);
          if (!target || !BINDABLE_SHAPE_TYPES.has(String(target.type))) {
            throw new Error(`Arrow binding target is unavailable or unsupported: ${targetRef}`);
          }
        } else if (!shapeRefs.has(targetRef)) {
          throw new Error(`Arrow binding target must identify an earlier shape: ${targetRef}`);
        }
      }
      operations.push({ kind: "bind-arrow", pageId, arrowRef, startElementRef, endElementRef });
      return;
    }
    throw new Error(`Unsupported drawing operation: ${String(input.kind)}`);
  });
  return operations;
}

function drawingSummary(operations: readonly IdeaSketchDrawingOperation[]) {
  const shapes = operations.filter((operation) => operation.kind === "create-shape").length;
  const arrows = operations.filter((operation) => operation.kind === "create-arrow").length;
  const bindings = operations.filter((operation) => operation.kind === "bind-arrow")
    .reduce((count, operation) => count + Number(Boolean(operation.startElementRef)) + Number(Boolean(operation.endElementRef)), 0);
  return `Apply ${shapes} shape${shapes === 1 ? "" : "s"}, ${arrows} arrow${arrows === 1 ? "" : "s"}, and ${bindings} binding${bindings === 1 ? "" : "s"}`;
}

export function summarizeIdeaSketchElements(
  elements: readonly any[],
  limit = MAX_SCENE_ELEMENT_SUMMARIES,
) {
  const liveElements = elements
    .map((element, index) => ({ element, index }))
    .filter(({ element }) => element && !element.isDeleted)
    .slice(0, limit);
  return liveElements.map(({ element, index: zIndex }) => {
    const text = boundedText(element.text ?? element.originalText);
    const groupIds = Array.isArray(element.groupIds)
      ? element.groupIds.filter((groupId: unknown) => typeof groupId === "string").slice(0, 8)
      : [];
    const summary: Record<string, unknown> = {
      ref: `element:${element.id}`,
      id: String(element.id),
      type: String(element.type),
      bounds: {
        x: asFiniteNumber(element.x),
        y: asFiniteNumber(element.y),
        width: asFiniteNumber(element.width),
        height: asFiniteNumber(element.height),
      },
      ...(text ? { text } : {}),
      ...(groupIds.length > 0 ? { groupIds } : {}),
      ...(typeof element.frameId === "string" ? { frameRef: `element:${element.frameId}` } : {}),
      ...(typeof element.containerId === "string" ? { containerRef: `element:${element.containerId}` } : {}),
      ...(typeof element.startBinding?.elementId === "string"
        ? { startBindingRef: `element:${element.startBinding.elementId}` }
        : {}),
      ...(typeof element.endBinding?.elementId === "string"
        ? { endBindingRef: `element:${element.endBinding.elementId}` }
        : {}),
      ...(Array.isArray(element.boundElements) && element.boundElements.length > 0
        ? {
            boundElementRefs: element.boundElements
              .filter((binding: any) => typeof binding?.id === "string")
              .slice(0, 8)
              .map((binding: any) => `element:${binding.id}`),
          }
        : {}),
      ...(typeof element.customData?.type === "string" ? { customType: element.customData.type } : {}),
      zIndex,
    };
    return summary;
  });
}

export function getIdeaSketchSourceFingerprint(model: IdeaSketchDocument): string {
  return JSON.stringify(model.pages.map((page) => ({
    id: page.id,
    title: page.title,
    elements: page.elements,
    appState: page.appState,
    files: page.files,
  })));
}

function mutationResult(
  call: AgentToolCall,
  context: AgentToolExecutionContext<IdeaSketchDocument>,
  operation: IdeaSketchAgentOperation | IdeaSketchAgentOperation[],
  summary: string,
): AgentToolResult<IdeaSketchAgentOperation> {
  const changeSet: AgentChangeSet<IdeaSketchAgentOperation> = {
    id: `agent-change-${call.callId}`,
    extensionId: "ideasketch-agent",
    documentId: context.documentId,
    baseRevision: context.revision,
    baseDocumentStatus: context.documentStatus,
    baseSourceModified: context.sourceModified,
    sourceFingerprint: getIdeaSketchSourceFingerprint(context.model),
    summary,
    operations: Array.isArray(operation) ? operation : [operation],
    status: "proposed",
  };
  return {
    kind: "mutation",
    callId: call.callId,
    name: call.name,
    success: true,
    summary,
    changeSet,
    truncated: false,
    persistable: true,
  };
}

export function executeIdeaSketchAgentTool(
  call: AgentToolCall,
  context: AgentToolExecutionContext<IdeaSketchDocument>,
): AgentToolResult<IdeaSketchAgentOperation> {
  const { model, activeContextId } = context;
  const args = call.arguments as Record<string, unknown>;
  const activePage = model.pages.find((page) => page.id === activeContextId) ?? model.pages[0];
  switch (call.name) {
    case "read_document_outline":
      return {
        kind: "read",
        callId: call.callId,
        name: call.name,
        success: true,
        summary: `Read ${model.pages.length} Page outline entries`,
        content: {
          pageCount: model.pages.length,
          pages: model.pages.slice(0, 100).map((page, index) => ({
            id: page.id,
            index,
            title: page.title,
            elementCount: page.elements.length,
            cameraCount: extractCameras(page.elements).length,
          })),
          truncated: model.pages.length > 100,
        },
        truncated: model.pages.length > 100,
        persistable: true,
      };
    case "read_active_page":
      {
      const liveElementCount = activePage?.elements.filter((element) => !element.isDeleted).length ?? 0;
      return {
        kind: "read",
        callId: call.callId,
        name: call.name,
        success: true,
        summary: activePage ? `Read active Page ${activePage.title}` : "No active Page",
        content: activePage ? {
          id: activePage.id,
          title: activePage.title,
          elementCount: activePage.elements.length,
          elements: summarizeIdeaSketchElements(activePage.elements),
          elementLimit: MAX_SCENE_ELEMENT_SUMMARIES,
          returnedElementCount: Math.min(liveElementCount, MAX_SCENE_ELEMENT_SUMMARIES),
          cameraCount: extractCameras(activePage.elements).length,
          truncated: liveElementCount > MAX_SCENE_ELEMENT_SUMMARIES,
        } : null,
        truncated: Boolean(activePage && liveElementCount > MAX_SCENE_ELEMENT_SUMMARIES),
        persistable: false,
      };
      }
    case "add_page": {
      const title = String(args.title).trim();
      const elements = args.elements as unknown[];
      return mutationResult(call, context, { kind: "add-page", title, elements }, `Add a new Page named “${title}”`);
    }
    case "delete_page": {
      const pageId = String(args.pageId);
      if (model.pages.length <= 1 || !model.pages.some((page) => page.id === pageId)) {
        throw new Error("The requested Page cannot be deleted from the captured document.");
      }
      return mutationResult(call, context, { kind: "delete-page", pageId }, `Delete Page ${pageId}`);
    }
    case "reorder_page": {
      const pageId = String(args.pageId);
      const toIndex = Number(args.toIndex);
      if (!model.pages.some((page) => page.id === pageId) || toIndex >= model.pages.length) {
        throw new Error("The requested Page order is outside the captured document.");
      }
      return mutationResult(call, context, { kind: "reorder-page", pageId, toIndex }, `Move Page ${pageId} to position ${toIndex + 1}`);
    }
    case "replace_page_elements": {
      const pageId = String(args.pageId);
      const elements = args.elements as unknown[];
      if (!model.pages.some((page) => page.id === pageId)) {
        throw new Error("The requested Page is not present in the captured document.");
      }
      return mutationResult(
        call,
        context,
        { kind: "replace-page-elements", pageId, elements },
        `Replace the editable elements on Page ${pageId}`,
      );
    }
    case "apply_drawing_plan": {
      const operations = normalizeDrawingPlan(args, activePage, call.callId);
      return mutationResult(call, context, operations, drawingSummary(operations));
    }
    default:
      throw new Error(`Unsupported IdeaSketch Tool: ${call.name}`);
  }
}
