import type { SdkProtocolVersion } from "../ideasketch-sdk/types.ts";
import type { AgentToolDescriptor } from "./types.ts";
import { IDEA_SKETCH_AGENT_TOOLS } from "./extensions/ideaSketchAgentTools.ts";

export type AgentToolProtocolMajor = 1 | 2;

export const AGENT_TOOL_PROTOCOL_V1 = Object.freeze({ major: 1, minor: 0 }) satisfies SdkProtocolVersion;
export const AGENT_TOOL_PROTOCOL_V2 = Object.freeze({ major: 2, minor: 0 }) satisfies SdkProtocolVersion;

export const AGENT_TOOL_SCHEMA_DIGESTS = Object.freeze({
  1: "agent-tool-v1:eight-tools",
  2: "agent-tool-v2:semantic",
} as const);

const SCENE_COORDINATE = 1_000_000;
const ELEMENT_DIMENSION = 100_000;
const TEXT_LENGTH = 10_000;
const READ_PAGE_SIZE = 100;

const textStyleSchema = {
  type: "object",
  properties: {
    fontFamily: { type: "string", enum: ["hand-drawn", "normal", "code"] },
    fontSize: { type: "number", minimum: 6, maximum: 256 },
    color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
    textAlign: { type: "string", enum: ["left", "center", "right"] },
    verticalAlign: { type: "string", enum: ["top", "middle", "bottom"] },
    opacity: { type: "integer", minimum: 0, maximum: 100 },
    lineHeight: { type: "number", minimum: 0.5, maximum: 4 },
  },
  additionalProperties: false,
};

const textLayoutSchema = {
  type: "object",
  properties: {
    autoResize: { type: "boolean" },
    width: { type: "number", minimum: 1, maximum: ELEMENT_DIMENSION },
    overflowPolicy: { const: "grow-container" },
  },
  // Keep the Agent schema aligned with the canonical operation validator:
  // bounded text may specify a width (with or without autoResize:false), or
  // explicitly enable autoResize, but autoResize:true cannot carry width and
  // autoResize:false must carry width.
  oneOf: [
    {
      required: ["width"],
      properties: { autoResize: { const: false } },
    },
    {
      required: ["autoResize"],
      properties: { autoResize: { const: true } },
      not: { required: ["width"] },
    },
  ],
  additionalProperties: false,
};

const textStylePatchPresence = [
  "fontFamily",
  "fontSize",
  "color",
  "textAlign",
  "verticalAlign",
  "opacity",
  "lineHeight",
].map((field) => ({ required: [field] }));

const textLayoutPatchPresence = [
  "autoResize",
  "width",
].map((field) => ({ required: [field] }));

const pointSchema = {
  type: "object",
  properties: {
    x: { type: "number", minimum: -SCENE_COORDINATE, maximum: SCENE_COORDINATE },
    y: { type: "number", minimum: -SCENE_COORDINATE, maximum: SCENE_COORDINATE },
  },
  required: ["x", "y"],
  additionalProperties: false,
};

const styleSchema = {
  type: "object",
  properties: {
    strokeColor: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
    backgroundColor: { type: "string", pattern: "^(?:#[0-9a-fA-F]{6}|transparent)$" },
    strokeWidth: { type: "integer", minimum: 1, maximum: 64 },
    strokeStyle: { type: "string", enum: ["solid", "dashed", "dotted"] },
    fillStyle: { type: "string", enum: ["solid", "hachure", "cross-hatch"] },
    roughness: { type: "integer", enum: [0, 1, 2] },
    roundness: { type: "string", enum: ["sharp", "rounded"] },
    opacity: { type: "integer", minimum: 0, maximum: 100 },
  },
  additionalProperties: false,
};

// Connector operations intentionally expose only the style fields accepted by
// the canonical connector builder. Shape-only fields such as fill and
// roundness are not silently discarded by the Agent adapter.
const connectorStyleSchema = {
  type: "object",
  properties: {
    strokeColor: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
    strokeWidth: { type: "integer", minimum: 1, maximum: 64 },
    strokeStyle: { type: "string", enum: ["solid", "dashed", "dotted"] },
    roughness: { type: "integer", enum: [0, 1, 2] },
    opacity: { type: "integer", minimum: 0, maximum: 100 },
  },
  additionalProperties: false,
};

const semanticDrawingOperationSchema = {
  oneOf: [
    {
      type: "object",
      properties: {
        kind: { const: "create-shape" },
        ref: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" },
        shape: { type: "string", enum: ["rectangle", "ellipse", "diamond"] },
        x: { type: "number", minimum: -SCENE_COORDINATE, maximum: SCENE_COORDINATE },
        y: { type: "number", minimum: -SCENE_COORDINATE, maximum: SCENE_COORDINATE },
        width: { type: "number", minimum: 1, maximum: ELEMENT_DIMENSION },
        height: { type: "number", minimum: 1, maximum: ELEMENT_DIMENSION },
        style: styleSchema,
      },
      required: ["kind", "ref", "shape", "x", "y", "width", "height"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        kind: { const: "create-arrow" },
        ref: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" },
        start: pointSchema,
        end: pointSchema,
        style: connectorStyleSchema,
      },
      required: ["kind", "ref", "start", "end"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        kind: { const: "bind-arrow" },
        arrowRef: { type: "string", minLength: 1, maxLength: 256 },
        startElementRef: { type: "string", minLength: 1, maxLength: 256 },
        endElementRef: { type: "string", minLength: 1, maxLength: 256 },
      },
      required: ["kind", "arrowRef"],
      anyOf: [{ required: ["startElementRef"] }, { required: ["endElementRef"] }],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        kind: { const: "create-text" },
        ref: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" },
        x: { type: "number", minimum: -SCENE_COORDINATE, maximum: SCENE_COORDINATE },
        y: { type: "number", minimum: -SCENE_COORDINATE, maximum: SCENE_COORDINATE },
        text: { type: "string", maxLength: TEXT_LENGTH },
        originalText: { type: "string", maxLength: TEXT_LENGTH },
        style: textStyleSchema,
        layout: textLayoutSchema,
      },
      required: ["kind", "ref", "x", "y"],
      oneOf: [{ required: ["text"] }, { required: ["originalText"] }],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        kind: { const: "bind-text" },
        textRef: { type: "string", minLength: 1, maxLength: 256 },
        containerRef: { type: "string", minLength: 1, maxLength: 256 },
      },
      required: ["kind", "textRef", "containerRef"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        kind: { const: "unbind-text" },
        textRef: { type: "string", minLength: 1, maxLength: 256 },
        containerRef: { type: "string", minLength: 1, maxLength: 256 },
      },
      required: ["kind"],
      anyOf: [{ required: ["textRef"] }, { required: ["containerRef"] }],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        kind: { const: "upsert-bound-text" },
        shapeRef: { type: "string", minLength: 1, maxLength: 256 },
        createRef: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" },
        text: { type: "string", maxLength: TEXT_LENGTH },
        originalText: { type: "string", maxLength: TEXT_LENGTH },
        style: textStyleSchema,
        layout: { type: "object", properties: { overflowPolicy: { const: "grow-container" } }, additionalProperties: false },
      },
      required: ["kind", "shapeRef"],
      oneOf: [{ required: ["text"] }, { required: ["originalText"] }],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        kind: { const: "set-text" },
        textRef: { type: "string", minLength: 1, maxLength: 256 },
        text: { type: "string", maxLength: TEXT_LENGTH },
        originalText: { type: "string", maxLength: TEXT_LENGTH },
      },
      required: ["kind", "textRef"],
      oneOf: [{ required: ["text"] }, { required: ["originalText"] }],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        kind: { const: "set-text-style" },
        textRef: { type: "string", minLength: 1, maxLength: 256 },
        style: textStyleSchema,
        fontFamily: { type: "string", enum: ["hand-drawn", "normal", "code"] },
        fontSize: { type: "number", minimum: 6, maximum: 256 },
        color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
        textAlign: { type: "string", enum: ["left", "center", "right"] },
        verticalAlign: { type: "string", enum: ["top", "middle", "bottom"] },
        opacity: { type: "integer", minimum: 0, maximum: 100 },
        lineHeight: { type: "number", minimum: 0.5, maximum: 4 },
      },
      required: ["kind", "textRef"],
      oneOf: [
        {
          required: ["style"],
          properties: { style: { ...textStyleSchema, minProperties: 1 } },
          not: { anyOf: textStylePatchPresence },
        },
        {
          not: { required: ["style"] },
          anyOf: textStylePatchPresence,
        },
      ],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        kind: { const: "set-text-layout" },
        textRef: { type: "string", minLength: 1, maxLength: 256 },
        layout: textLayoutSchema,
        autoResize: { type: "boolean" },
        width: { type: "number", minimum: 1, maximum: ELEMENT_DIMENSION },
      },
      required: ["kind", "textRef"],
      oneOf: [
        {
          required: ["layout"],
          not: { anyOf: textLayoutPatchPresence },
        },
        {
          anyOf: textLayoutPatchPresence,
          not: {
            anyOf: [
              { required: ["layout"] },
              { required: ["autoResize", "width"], properties: { autoResize: { const: true } } },
              { required: ["autoResize"], properties: { autoResize: { const: false } } },
            ],
          },
        },
      ],
      additionalProperties: false,
    },
  ],
};

const semanticLayoutOperationSchema = {
  oneOf: [
    {
      type: "object",
      properties: {
        kind: { const: "move-element" },
        elementRef: { type: "string", pattern: "^element:[A-Za-z0-9_-]{1,128}$" },
        dx: { type: "number", minimum: -SCENE_COORDINATE, maximum: SCENE_COORDINATE },
        dy: { type: "number", minimum: -SCENE_COORDINATE, maximum: SCENE_COORDINATE },
      },
      required: ["kind", "elementRef", "dx", "dy"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        kind: { const: "resize-element" },
        elementRef: { type: "string", pattern: "^element:[A-Za-z0-9_-]{1,128}$" },
        width: { type: "number", minimum: 1, maximum: ELEMENT_DIMENSION },
        height: { type: "number", minimum: 1, maximum: ELEMENT_DIMENSION },
      },
      required: ["kind", "elementRef", "width", "height"],
      additionalProperties: false,
    },
  ],
};

const semanticAddPageSchema = {
  type: "object",
  properties: {
    title: { type: "string", minLength: 1, maxLength: 120 },
    initialScene: {
      type: "object",
      properties: {
        // Page seeds are detached from an existing scene. Only creation and
        // same-seed binding operations are meaningful here; update/unbind
        // operations require stable refs from a prior active-Page read.
        operations: {
          type: "array",
          minItems: 1,
          maxItems: 40,
          items: {
            oneOf: semanticDrawingOperationSchema.oneOf.filter((candidate) => [
              "create-shape",
              "create-arrow",
              "create-text",
              "bind-arrow",
              "bind-text",
            ].includes(candidate.properties?.kind?.const)),
          },
        },
      },
      required: ["operations"],
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

const semanticV2Tools: AgentToolDescriptor[] = [
  {
    name: "read_document_outline",
    description: "Read the ordered IdeaSketch Page outline and the document snapshot required for Page operations.",
    effect: "read",
    source: "editor",
    inputSchema: {
      type: "object",
      properties: {
        cursor: { type: "string", pattern: "^snapshot-cursor:[^\\u0000-\\u0020\\u007f]+$" },
        limit: { type: "integer", minimum: 1, maximum: READ_PAGE_SIZE },
      },
      additionalProperties: false,
    },
  },
  {
    name: "read_active_page",
    description: "Read the bounded active Page scene with stable element references and relation coverage.",
    effect: "read",
    source: "editor",
    inputSchema: {
      type: "object",
      properties: {
        snapshotId: { type: "string", pattern: "^scene-snapshot:[^\\u0000-\\u0020\\u007f]+$" },
        cursor: { type: "string", pattern: "^snapshot-cursor:[^\\u0000-\\u0020\\u007f]+$" },
        limit: { type: "integer", minimum: 1, maximum: READ_PAGE_SIZE },
      },
      additionalProperties: false,
    },
  },
  {
    name: "add_page",
    description: "Add a semantic IdeaSketch Page, optionally seeded with bounded shape, arrow, binding, or text operations.",
    effect: "write",
    source: "editor",
    requires: ["read_document_outline"],
    inputSchema: semanticAddPageSchema,
  },
  {
    name: "delete_page",
    description: "Delete one Page identified by the current document outline while retaining at least one Page.",
    effect: "write",
    source: "editor",
    requires: ["read_document_outline"],
    inputSchema: {
      type: "object",
      properties: { pageId: { type: "string", minLength: 1, maxLength: 256 } },
      required: ["pageId"],
      additionalProperties: false,
    },
  },
  {
    name: "reorder_page",
    description: "Move one Page identified by the current document outline to a zero-based position.",
    effect: "write",
    source: "editor",
    requires: ["read_document_outline"],
    inputSchema: {
      type: "object",
      properties: { pageId: { type: "string", minLength: 1, maxLength: 256 }, toIndex: { type: "integer", minimum: 0 } },
      required: ["pageId", "toIndex"],
      additionalProperties: false,
    },
  },
  {
    name: "apply_drawing_plan",
    description: "After read_active_page, apply one ordered semantic shape, arrow, binding, and text plan without replacing unrelated elements.",
    effect: "write",
    source: "editor",
    requires: ["read_active_page"],
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", minLength: 1, maxLength: 256 },
        operations: { type: "array", minItems: 1, maxItems: 40, items: semanticDrawingOperationSchema },
      },
      required: ["pageId", "operations"],
      additionalProperties: false,
    },
  },
  {
    name: "apply_layout_plan",
    description: "After read_active_page, move or resize already-read elements while preserving bindings and bound text.",
    effect: "write",
    source: "editor",
    requires: ["read_active_page"],
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", minLength: 1, maxLength: 256 },
        operations: { type: "array", minItems: 1, maxItems: 40, items: semanticLayoutOperationSchema },
      },
      required: ["pageId", "operations"],
      additionalProperties: false,
    },
  },
];

function freezeDeep<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
  return value;
}

const frozenV1Tools = freezeDeep(IDEA_SKETCH_AGENT_TOOLS.map((tool) => ({
  ...tool,
  source: tool.source ?? "editor",
  effect: tool.effect ?? (tool.name.startsWith("read_") ? "read" : "write"),
})));
const frozenV2Tools = freezeDeep(semanticV2Tools);

export interface AgentToolProtocolBinding {
  readonly version: Readonly<SdkProtocolVersion>;
  readonly schemaDigest: string;
  readonly tools: readonly AgentToolDescriptor[];
}

export function isAgentToolProtocolMajor(value: unknown): value is AgentToolProtocolMajor {
  return value === 1 || value === 2;
}

function normalizeAgentToolProtocolMajor(value: AgentToolMajorInput): AgentToolProtocolMajor {
  // Numeric shorthand is accepted only for local convenience. Any structured
  // version must carry the explicitly supported minor (currently 0), so a
  // caller can never accidentally receive a different catalog major.
  if (typeof value === "object" && value !== null) {
    let keys: readonly PropertyKey[];
    try {
      keys = Reflect.ownKeys(value);
    } catch {
      throw new Error("Agent Tool protocol version is malformed.");
    }
    if (keys.some((key) => typeof key !== "string" || (key !== "major" && key !== "minor"))) {
      throw new Error("Agent Tool protocol version contains unknown fields.");
    }
  }
  const major = typeof value === "number" ? value : value && typeof value === "object" ? value.major : undefined;
  const minor = typeof value === "number" ? 0 : value && typeof value === "object" ? value.minor : undefined;
  if (!isAgentToolProtocolMajor(major)) throw new Error("Unsupported IdeaSketch Agent Tool protocol major.");
  if (!Number.isInteger(minor) || minor !== 0) throw new Error("Unsupported IdeaSketch Agent Tool protocol minor.");
  return major;
}

export function getIdeaSketchAgentToolCatalog(version: AgentToolMajorInput = 2): readonly AgentToolDescriptor[] {
  return normalizeAgentToolProtocolMajor(version) === 1 ? frozenV1Tools : frozenV2Tools;
}

export type AgentToolMajorInput = AgentToolProtocolMajor | SdkProtocolVersion;

export function getIdeaSketchAgentToolProtocol(version: AgentToolMajorInput = 2): AgentToolProtocolBinding {
  const major = normalizeAgentToolProtocolMajor(version);
  const protocolVersion = major === 1 ? AGENT_TOOL_PROTOCOL_V1 : AGENT_TOOL_PROTOCOL_V2;
  return Object.freeze({
    version: protocolVersion,
    schemaDigest: AGENT_TOOL_SCHEMA_DIGESTS[major],
    tools: getIdeaSketchAgentToolCatalog(major),
  });
}

export function negotiateIdeaSketchAgentToolProtocol(input: {
  requested: unknown;
  expectedSchemaDigest?: unknown;
}): AgentToolProtocolBinding {
  const requested = input.requested;
  if (!requested || typeof requested !== "object" || Array.isArray(requested)) throw new Error("Agent Tool protocol version is required.");
  const version = requested as Record<string, unknown>;
  if (Reflect.ownKeys(version).some((key) => typeof key !== "string" || (key !== "major" && key !== "minor"))) {
    throw new Error("Agent Tool protocol version contains unknown fields.");
  }
  if (!Number.isInteger(version.major) || !Number.isInteger(version.minor) || (version.minor as number) < 0) {
    throw new Error("Agent Tool protocol version is malformed.");
  }
  if (!isAgentToolProtocolMajor(version.major)) throw new Error("Agent Tool protocol major is unsupported.");
  if ((version.minor as number) !== 0) throw new Error("Agent Tool protocol minor is unsupported.");
  const binding = getIdeaSketchAgentToolProtocol(version.major);
  if (input.expectedSchemaDigest !== binding.schemaDigest) throw new Error("Agent Tool schema digest does not match the negotiated protocol.");
  return binding;
}
