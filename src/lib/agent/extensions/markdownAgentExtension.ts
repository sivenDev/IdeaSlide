import type { MarkdownDocument } from "../../../types";
import { registerAgentExtension } from "../agentExtensionRegistry.ts";
import type { AgentExtension } from "../types.ts";
import {
  executeMarkdownAgentTool,
  getMarkdownSourceFingerprint,
  MARKDOWN_AGENT_TOOLS,
  type MarkdownAgentOperation,
} from "./markdownAgentTools.ts";

function headingSummary(text: string) {
  const headings: Array<{ line: number; level: number; text: string }> = [];
  text.split("\n").some((line, index) => {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) headings.push({ line: index + 1, level: match[1].length, text: match[2].trim() });
    return headings.length > 40;
  });
  return headings;
}

export const markdownAgentExtension: AgentExtension<MarkdownDocument, MarkdownAgentOperation> = {
  id: "markdown-agent",
  fileType: "markdown",
  skillId: "markdown",
  tools: MARKDOWN_AGENT_TOOLS,
  buildContext(model, activeContextId, revision) {
    const lines = model.text.split("\n");
    const projectedHeadings = headingSummary(model.text);
    const headings = projectedHeadings.slice(0, 40);
    return {
      documentType: model.type,
      revision,
      lineCount: lines.length,
      characterCount: model.text.length,
      lineEnding: model.normalization ?? model.lineEnding,
      bom: model.bom,
      selection: activeContextId ?? null,
      headings,
      headingsTruncated: projectedHeadings.length > headings.length,
      fullSourceOmitted: true,
    };
  },
  executeTool: executeMarkdownAgentTool,
  describeChangeSet(changeSet) {
    return changeSet.operations.map((operation) =>
      `Replace Markdown range · ${operation.from.line}:${operation.from.column}–${operation.to.line}:${operation.to.column}`);
  },
};

registerAgentExtension(markdownAgentExtension as AgentExtension);

export { getMarkdownSourceFingerprint };
