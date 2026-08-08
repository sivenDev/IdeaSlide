import type { IdeaSketchDocument } from "../../../types";
import { extractCameras } from "../../cameraUtils.ts";
import type {
  AgentChangeSet,
  AgentToolCall,
  AgentToolDescriptor,
  AgentToolExecutionContext,
  AgentToolResult,
} from "../types.ts";
import type { IdeaSketchAgentOperation } from "./ideaSketchAgentExtension.ts";

export const IDEA_SKETCH_AGENT_TOOLS: AgentToolDescriptor[] = [
  {
    name: "read_document_outline",
    description: "Read the ordered IdeaSketch Page outline and active Page summary.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "read_active_page",
    description: "Read the bounded active Page scene and Page-scoped Cameras from supplied context.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "propose_add_page",
    description: "Propose a new editable IdeaSketch Page for user review. This never writes or mutates the document.",
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
    name: "propose_delete_page",
    description: "Propose deleting one existing Page. The document must retain at least one Page.",
    inputSchema: {
      type: "object",
      properties: { pageId: { type: "string", minLength: 1 } },
      required: ["pageId"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_reorder_page",
    description: "Propose moving an existing Page to a zero-based position in the document.",
    inputSchema: {
      type: "object",
      properties: { pageId: { type: "string", minLength: 1 }, toIndex: { type: "integer", minimum: 0 } },
      required: ["pageId", "toIndex"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_replace_page_elements",
    description: "Propose replacing the editable elements of one Page while preserving its identity and metadata.",
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
];

export function getIdeaSketchSourceFingerprint(model: IdeaSketchDocument): string {
  return JSON.stringify(model.pages.map((page) => ({
    id: page.id,
    title: page.title,
    elements: page.elements,
    appState: page.appState,
    files: page.files,
  })));
}

function proposalResult(
  call: AgentToolCall,
  context: AgentToolExecutionContext<IdeaSketchDocument>,
  operation: IdeaSketchAgentOperation,
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
    operations: [operation],
    status: "proposed",
  };
  return {
    kind: "proposal",
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
          elements: activePage.elements.slice(0, 80),
          cameraCount: extractCameras(activePage.elements).length,
          truncated: activePage.elements.length > 80,
        } : null,
        truncated: Boolean(activePage && activePage.elements.length > 80),
        persistable: false,
      };
    case "propose_add_page": {
      const title = String(args.title).trim();
      const elements = args.elements as unknown[];
      return proposalResult(call, context, { kind: "add-page", title, elements }, `Add a new Page named “${title}”`);
    }
    case "propose_delete_page": {
      const pageId = String(args.pageId);
      if (model.pages.length <= 1 || !model.pages.some((page) => page.id === pageId)) {
        throw new Error("The requested Page cannot be deleted from the captured document.");
      }
      return proposalResult(call, context, { kind: "delete-page", pageId }, `Delete Page ${pageId}`);
    }
    case "propose_reorder_page": {
      const pageId = String(args.pageId);
      const toIndex = Number(args.toIndex);
      if (!model.pages.some((page) => page.id === pageId) || toIndex >= model.pages.length) {
        throw new Error("The requested Page order is outside the captured document.");
      }
      return proposalResult(call, context, { kind: "reorder-page", pageId, toIndex }, `Move Page ${pageId} to position ${toIndex + 1}`);
    }
    case "propose_replace_page_elements": {
      const pageId = String(args.pageId);
      const elements = args.elements as unknown[];
      if (!model.pages.some((page) => page.id === pageId)) {
        throw new Error("The requested Page is not present in the captured document.");
      }
      return proposalResult(
        call,
        context,
        { kind: "replace-page-elements", pageId, elements },
        `Replace the editable elements on Page ${pageId}`,
      );
    }
    default:
      throw new Error(`Unsupported IdeaSketch Tool: ${call.name}`);
  }
}
