import type { IdeaSketchDocument } from "../../../types";
import { extractCameras } from "../../cameraUtils.ts";
import { registerAgentExtension } from "../agentExtensionRegistry.ts";
import type { AgentExtension } from "../types.ts";
import {
  executeIdeaSketchAgentTool,
  getIdeaSketchSourceFingerprint,
  IDEA_SKETCH_AGENT_TOOLS,
  summarizeIdeaSketchElements,
} from "./ideaSketchAgentTools.ts";

export type IdeaSketchDrawingStyle = {
  strokeColor: string;
  backgroundColor: string;
  strokeWidth: 1 | 2 | 4;
  strokeStyle: "solid" | "dashed" | "dotted";
  fillStyle: "solid" | "hachure" | "cross-hatch";
  roughness: 0 | 1 | 2;
  opacity: number;
  roundness: "sharp" | "rounded";
};

export type IdeaSketchDrawingOperation =
  | {
      kind: "create-shape";
      pageId: string;
      ref: string;
      elementId: string;
      shape: "rectangle" | "ellipse" | "diamond";
      x: number;
      y: number;
      width: number;
      height: number;
      style: IdeaSketchDrawingStyle;
    }
  | {
      kind: "create-arrow";
      pageId: string;
      ref: string;
      elementId: string;
      start: { x: number; y: number };
      end: { x: number; y: number };
      style: IdeaSketchDrawingStyle;
    }
  | {
      kind: "bind-arrow";
      pageId: string;
      arrowRef: string;
      startElementRef?: string;
      endElementRef?: string;
    };

export type IdeaSketchLayoutOperation =
  | {
      kind: "move-element";
      pageId: string;
      elementRef: string;
      dx: number;
      dy: number;
    }
  | {
      kind: "resize-element";
      pageId: string;
      elementRef: string;
      width: number;
      height: number;
    };

export type IdeaSketchAgentOperation =
  | { kind: "add-page"; title: string; elements: unknown[] }
  | { kind: "delete-page"; pageId: string }
  | { kind: "reorder-page"; pageId: string; toIndex: number }
  | { kind: "replace-page-elements"; pageId: string; elements: unknown[] }
  | IdeaSketchDrawingOperation
  | IdeaSketchLayoutOperation;

interface DrawingPlanRuntime {
  createNonce: () => number;
  now: () => number;
}

const DEFAULT_DRAWING_RUNTIME: DrawingPlanRuntime = {
  createNonce: () => Math.floor(Math.random() * 2_147_483_647),
  now: () => Date.now(),
};

const DRAWING_KINDS = new Set(["create-shape", "create-arrow", "bind-arrow"]);
const LAYOUT_KINDS = new Set(["move-element", "resize-element"]);
const BINDABLE_SHAPE_TYPES = new Set(["rectangle", "ellipse", "diamond"]);
const MAX_LAYOUT_SCENE_COORDINATE = 1_000_000;

export function isIdeaSketchDrawingOperation(
  operation: IdeaSketchAgentOperation,
): operation is IdeaSketchDrawingOperation {
  return Boolean(
    operation
    && typeof operation === "object"
    && DRAWING_KINDS.has((operation as { kind?: unknown }).kind as string),
  );
}

export function isIdeaSketchLayoutOperation(
  operation: IdeaSketchAgentOperation,
): operation is IdeaSketchLayoutOperation {
  return Boolean(
    operation
    && typeof operation === "object"
    && LAYOUT_KINDS.has((operation as { kind?: unknown }).kind as string),
  );
}

function commonElementFields(
  operation: Extract<IdeaSketchDrawingOperation, { kind: "create-shape" | "create-arrow" }>,
  runtime: DrawingPlanRuntime,
) {
  return {
    id: operation.elementId,
    angle: 0,
    strokeColor: operation.style.strokeColor,
    backgroundColor: operation.kind === "create-arrow"
      ? "transparent"
      : operation.style.backgroundColor,
    fillStyle: operation.style.fillStyle,
    strokeWidth: operation.style.strokeWidth,
    strokeStyle: operation.style.strokeStyle,
    roughness: operation.style.roughness,
    opacity: operation.style.opacity,
    groupIds: [],
    frameId: null,
    roundness: operation.style.roundness === "rounded" ? { type: 3 } : null,
    seed: runtime.createNonce(),
    version: 1,
    versionNonce: runtime.createNonce(),
    isDeleted: false,
    boundElements: null,
    updated: runtime.now(),
    link: null,
    locked: false,
  };
}

function createShapeElement(
  operation: Extract<IdeaSketchDrawingOperation, { kind: "create-shape" }>,
  runtime: DrawingPlanRuntime,
) {
  return {
    ...commonElementFields(operation, runtime),
    type: operation.shape,
    x: operation.x,
    y: operation.y,
    width: operation.width,
    height: operation.height,
  };
}

function createArrowElement(
  operation: Extract<IdeaSketchDrawingOperation, { kind: "create-arrow" }>,
  runtime: DrawingPlanRuntime,
) {
  const width = operation.end.x - operation.start.x;
  const height = operation.end.y - operation.start.y;
  const x = Math.min(operation.start.x, operation.end.x);
  const y = Math.min(operation.start.y, operation.end.y);
  return {
    ...commonElementFields(operation, runtime),
    type: "arrow",
    x,
    y,
    width: Math.abs(width),
    height: Math.abs(height),
    points: [[operation.start.x - x, operation.start.y - y], [operation.end.x - x, operation.end.y - y]],
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: "arrow",
    lastCommittedPoint: null,
    elbowed: false,
  };
}

function touchBoundElement(element: any, arrowId: string, runtime: DrawingPlanRuntime) {
  const boundElements = Array.isArray(element.boundElements)
    ? element.boundElements.filter((binding: any) => binding?.id !== arrowId)
    : [];
  return {
    ...element,
    boundElements: [...boundElements, { id: arrowId, type: "arrow" }],
    version: Math.max(1, Number(element.version) || 1) + 1,
    versionNonce: runtime.createNonce(),
    updated: runtime.now(),
  };
}

export function buildIdeaSketchDrawingPlanScene(
  existingElements: readonly any[],
  operations: readonly IdeaSketchDrawingOperation[],
  runtimeOverrides: Partial<DrawingPlanRuntime> = {},
) {
  if (operations.length === 0 || operations.length > 40) {
    throw new Error("Drawing plans must contain between 1 and 40 operations.");
  }
  const runtime = { ...DEFAULT_DRAWING_RUNTIME, ...runtimeOverrides };
  const elements = existingElements.map((element) => structuredClone(element));
  const elementById = new Map<string, any>();
  const elementByRef = new Map<string, any>();
  for (const element of elements) {
    if (!element || typeof element.id !== "string" || element.isDeleted) continue;
    elementById.set(element.id, element);
    elementByRef.set(`element:${element.id}`, element);
  }
  const pageId = operations[0]?.pageId;
  const createdRefs = new Set<string>();

  for (const operation of operations) {
    if (!pageId || operation.pageId !== pageId) {
      throw new Error("Drawing plans cannot target more than one Page.");
    }
    if (operation.kind === "create-shape" || operation.kind === "create-arrow") {
      if (createdRefs.has(operation.ref) || elementByRef.has(operation.ref)) {
        throw new Error(`Drawing reference is duplicated: ${operation.ref}`);
      }
      if (elementById.has(operation.elementId)) {
        throw new Error(`Drawing element id is duplicated: ${operation.elementId}`);
      }
      const element = operation.kind === "create-shape"
        ? createShapeElement(operation, runtime)
        : createArrowElement(operation, runtime);
      createdRefs.add(operation.ref);
      elementByRef.set(operation.ref, element);
      elementById.set(element.id, element);
      elements.push(element);
      continue;
    }

    const arrow = elementByRef.get(operation.arrowRef);
    if (!arrow || arrow.type !== "arrow" || !createdRefs.has(operation.arrowRef)) {
      throw new Error(`Arrow reference must identify an earlier created arrow: ${operation.arrowRef}`);
    }
    if (!operation.startElementRef && !operation.endElementRef) {
      throw new Error("Arrow binding must provide at least one endpoint target.");
    }
    for (const [endpoint, targetRef] of [
      ["startBinding", operation.startElementRef],
      ["endBinding", operation.endElementRef],
    ] as const) {
      if (!targetRef) continue;
      const target = elementByRef.get(targetRef);
      if (!target || !BINDABLE_SHAPE_TYPES.has(target.type)) {
        throw new Error(`Arrow binding target is unavailable or unsupported: ${targetRef}`);
      }
      arrow[endpoint] = { elementId: target.id, focus: 0, gap: 6 };
      const touched = touchBoundElement(target, arrow.id, runtime);
      const targetIndex = elements.findIndex((element) => element.id === target.id);
      if (targetIndex < 0) throw new Error(`Arrow binding target is missing: ${targetRef}`);
      elements[targetIndex] = touched;
      elementById.set(touched.id, touched);
      elementByRef.set(targetRef, touched);
    }
  }

  return elements;
}

function moveBoundTextElements(elements: any[], container: any, dx: number, dy: number, runtime: DrawingPlanRuntime) {
  const boundTextIds = new Set(
    Array.isArray(container.boundElements)
      ? container.boundElements
        .filter((binding: any) => binding?.type === "text" && typeof binding.id === "string")
        .map((binding: any) => binding.id)
      : [],
  );
  return elements.map((element) => {
    if (!element || element.isDeleted || element.id === container.id
      || (element.containerId !== container.id && !boundTextIds.has(element.id))) return element;
    if (typeof element.x !== "number" || typeof element.y !== "number") return element;
    return {
      ...element,
      x: element.x + dx,
      y: element.y + dy,
      version: Math.max(1, Number(element.version) || 1) + 1,
      versionNonce: runtime.createNonce(),
      updated: runtime.now(),
    };
  });
}

export function buildIdeaSketchLayoutPlanScene(
  existingElements: readonly any[],
  operations: readonly IdeaSketchLayoutOperation[],
  runtimeOverrides: Partial<DrawingPlanRuntime> = {},
) {
  if (operations.length === 0 || operations.length > 40) {
    throw new Error("Layout plans must contain between 1 and 40 operations.");
  }
  const runtime = { ...DEFAULT_DRAWING_RUNTIME, ...runtimeOverrides };
  let elements = existingElements.map((element) => structuredClone(element));
  const elementByRef = new Map<string, any>();
  for (const element of elements) {
    if (!element || typeof element.id !== "string" || element.isDeleted) continue;
    elementByRef.set(`element:${element.id}`, element);
  }

  for (const operation of operations) {
    const target = elementByRef.get(operation.elementRef);
    if (!target) throw new Error(`Layout target is unavailable: ${operation.elementRef}`);
    const targetIndex = elements.findIndex((element) => element.id === target.id);
    if (targetIndex < 0) throw new Error(`Layout target is missing: ${operation.elementRef}`);
    if (typeof target.x !== "number" || !Number.isFinite(target.x)
      || typeof target.y !== "number" || !Number.isFinite(target.y)
      || typeof target.width !== "number" || !Number.isFinite(target.width)
      || typeof target.height !== "number" || !Number.isFinite(target.height)) {
      throw new Error(`Layout target has invalid geometry: ${operation.elementRef}`);
    }
    if (operation.kind === "move-element") {
      const nextX = target.x + operation.dx;
      const nextY = target.y + operation.dy;
      if (Math.abs(nextX) > MAX_LAYOUT_SCENE_COORDINATE || Math.abs(nextY) > MAX_LAYOUT_SCENE_COORDINATE) {
        throw new Error(`Layout target would leave the bounded scene: ${operation.elementRef}`);
      }
      const moved = {
        ...target,
        x: nextX,
        y: nextY,
        version: Math.max(1, Number(target.version) || 1) + 1,
        versionNonce: runtime.createNonce(),
        updated: runtime.now(),
      };
      elements[targetIndex] = moved;
      elements = moveBoundTextElements(elements, moved, operation.dx, operation.dy, runtime);
      for (const element of elements) {
        if (element && typeof element.id === "string" && !element.isDeleted) {
          elementByRef.set(`element:${element.id}`, element);
        }
      }
      continue;
    }
    const resized = {
      ...target,
      width: operation.width,
      height: operation.height,
      version: Math.max(1, Number(target.version) || 1) + 1,
      versionNonce: runtime.createNonce(),
      updated: runtime.now(),
    };
    elements[targetIndex] = resized;
    elementByRef.set(operation.elementRef, resized);
  }
  return elements;
}

export const ideaSketchAgentExtension: AgentExtension<IdeaSketchDocument, IdeaSketchAgentOperation> = {
  id: "ideasketch-agent",
  fileType: "ideasketch",
  skillId: "ideasketch",
  tools: IDEA_SKETCH_AGENT_TOOLS,
  buildContext(model, activePageId, revision) {
    const activePage = model.pages.find((page) => page.id === activePageId) ?? model.pages[0];
    return {
      documentType: model.type,
      formatVersion: model.formatVersion,
      revision,
      pageCount: model.pages.length,
      pages: model.pages.slice(0, 100).map((page, index) => ({
        id: page.id,
        index,
        title: page.title,
        elementCount: page.elements.length,
        cameraCount: extractCameras(page.elements).length,
      })),
      activePage: activePage ? {
        id: activePage.id,
        title: activePage.title,
        elementCount: activePage.elements.length,
        cameraCount: extractCameras(activePage.elements).length,
        semanticElementLimit: 80,
      } : null,
    };
  },
  executeTool: executeIdeaSketchAgentTool,
  describeChangeSet(changeSet) {
    return changeSet.operations.map((operation) => {
      switch (operation.kind) {
        case "add-page":
          return `New Page · ${operation.title} · ${operation.elements.length} elements`;
        case "delete-page":
          return `Delete Page · ${operation.pageId}`;
        case "reorder-page":
          return `Move Page · ${operation.pageId} · position ${operation.toIndex + 1}`;
        case "replace-page-elements":
          return `Replace Page content · ${operation.pageId} · ${operation.elements.length} elements`;
        case "create-shape":
          return `Create ${operation.shape} · ${operation.ref} · ${operation.pageId}`;
        case "create-arrow":
          return `Create arrow · ${operation.ref} · ${operation.pageId}`;
        case "bind-arrow": {
          const targets = [operation.startElementRef, operation.endElementRef].filter(Boolean).join(" → ");
          return `Bind arrow · ${operation.arrowRef} · ${targets}`;
        }
        case "move-element":
          return `Move element · ${operation.elementRef} · ${operation.dx}, ${operation.dy}`;
        case "resize-element":
          return `Resize element · ${operation.elementRef} · ${operation.width} × ${operation.height}`;
      }
    });
  },
};

registerAgentExtension(ideaSketchAgentExtension as AgentExtension);

export { getIdeaSketchSourceFingerprint, summarizeIdeaSketchElements };
