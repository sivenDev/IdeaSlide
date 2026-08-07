import type { IdeaSketchDocument } from "../../../types";
import { extractCameras } from "../../cameraUtils.ts";
import { registerAgentExtension } from "../agentExtensionRegistry.ts";
import type { AgentChangeSet, AgentExtension } from "../types.ts";

export type IdeaSketchAgentOperation =
  | { kind: "add-page"; title: string; elements: unknown[] }
  | { kind: "delete-page"; pageId: string }
  | { kind: "reorder-page"; pageId: string; toIndex: number }
  | { kind: "replace-page-elements"; pageId: string; elements: unknown[] };

function sourceFingerprint(model: IdeaSketchDocument): string {
  return JSON.stringify(model.pages.map((page) => ({
    id: page.id,
    title: page.title,
    elements: page.elements,
    appState: page.appState,
    files: page.files,
  })));
}

function extractProposal(response: string): Record<string, unknown> | undefined {
  const match = response.match(/```ideanote-change\s*([\s\S]*?)```/i);
  if (!match?.[1]) return undefined;
  try {
    const value = JSON.parse(match[1]);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

export const ideaSketchAgentExtension: AgentExtension<IdeaSketchDocument, IdeaSketchAgentOperation> = {
  id: "ideasketch-agent",
  fileType: "ideasketch",
  skillId: "ideasketch",
  tools: [
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
          title: { type: "string" },
          elements: { type: "array", items: { type: "object" } },
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
        properties: { pageId: { type: "string" } },
        required: ["pageId"],
        additionalProperties: false,
      },
    },
    {
      name: "propose_reorder_page",
      description: "Propose moving an existing Page to a zero-based position in the document.",
      inputSchema: {
        type: "object",
        properties: { pageId: { type: "string" }, toIndex: { type: "integer", minimum: 0 } },
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
          pageId: { type: "string" },
          elements: { type: "array", items: { type: "object" } },
        },
        required: ["pageId", "elements"],
        additionalProperties: false,
      },
    },
  ],
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
        elements: activePage.elements.slice(0, 80),
        truncated: activePage.elements.length > 80,
      } : null,
    };
  },
  parseChangeSet(response, documentId, revision, model) {
    const proposal = extractProposal(response);
    if (!proposal || typeof proposal.kind !== "string") return undefined;
    let operation: IdeaSketchAgentOperation | undefined;
    if (proposal.kind === "add-page") {
      const title = typeof proposal.title === "string" ? proposal.title.trim() : "";
      const elements = Array.isArray(proposal.elements) ? proposal.elements : [];
      if (title && elements.length <= 500) operation = { kind: "add-page", title, elements };
    } else if (proposal.kind === "delete-page") {
      const pageId = typeof proposal.pageId === "string" ? proposal.pageId : "";
      if (model.pages.length > 1 && model.pages.some((page) => page.id === pageId)) {
        operation = { kind: "delete-page", pageId };
      }
    } else if (proposal.kind === "reorder-page") {
      const pageId = typeof proposal.pageId === "string" ? proposal.pageId : "";
      const toIndex = proposal.toIndex;
      if (
        model.pages.some((page) => page.id === pageId)
        && Number.isInteger(toIndex)
        && Number(toIndex) >= 0
        && Number(toIndex) < model.pages.length
      ) {
        operation = { kind: "reorder-page", pageId, toIndex: Number(toIndex) };
      }
    } else if (proposal.kind === "replace-page-elements") {
      const pageId = typeof proposal.pageId === "string" ? proposal.pageId : "";
      const elements = Array.isArray(proposal.elements) ? proposal.elements : [];
      if (model.pages.some((page) => page.id === pageId) && elements.length <= 500) {
        operation = { kind: "replace-page-elements", pageId, elements };
      }
    }
    if (!operation) return undefined;
    const defaultSummary = operation.kind === "add-page"
      ? `Add a new Page named “${operation.title}”`
      : operation.kind === "delete-page"
        ? `Delete Page ${operation.pageId}`
        : operation.kind === "reorder-page"
          ? `Move Page ${operation.pageId} to position ${operation.toIndex + 1}`
          : `Replace the editable elements on Page ${operation.pageId}`;
    return {
      id: crypto.randomUUID(),
      extensionId: "ideasketch-agent",
      documentId,
      baseRevision: revision,
      sourceFingerprint: sourceFingerprint(model),
      summary: typeof proposal.summary === "string" && proposal.summary.trim()
        ? proposal.summary.trim()
        : defaultSummary,
      operations: [operation],
      status: "proposed",
    } satisfies AgentChangeSet<IdeaSketchAgentOperation>;
  },
};

registerAgentExtension(ideaSketchAgentExtension as AgentExtension);

export function getIdeaSketchSourceFingerprint(model: IdeaSketchDocument): string {
  return sourceFingerprint(model);
}
