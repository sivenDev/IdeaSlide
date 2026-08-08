import type { IdeaSketchDocument } from "../../../types";
import { extractCameras } from "../../cameraUtils.ts";
import { registerAgentExtension } from "../agentExtensionRegistry.ts";
import type { AgentExtension } from "../types.ts";
import {
  executeIdeaSketchAgentTool,
  getIdeaSketchSourceFingerprint,
  IDEA_SKETCH_AGENT_TOOLS,
} from "./ideaSketchAgentTools.ts";

export type IdeaSketchAgentOperation =
  | { kind: "add-page"; title: string; elements: unknown[] }
  | { kind: "delete-page"; pageId: string }
  | { kind: "reorder-page"; pageId: string; toIndex: number }
  | { kind: "replace-page-elements"; pageId: string; elements: unknown[] };

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
        elements: activePage.elements.slice(0, 80),
        truncated: activePage.elements.length > 80,
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
      }
    });
  },
};

registerAgentExtension(ideaSketchAgentExtension as AgentExtension);

export { getIdeaSketchSourceFingerprint };
