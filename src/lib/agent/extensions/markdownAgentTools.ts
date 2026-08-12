import type { MarkdownDocument } from "../../../types";
import type {
  AgentChangeSet,
  AgentToolCall,
  AgentToolDescriptor,
  AgentToolExecutionContext,
  AgentToolResult,
} from "../types.ts";

export interface MarkdownPosition {
  line: number;
  column: number;
}

export interface MarkdownAgentOperation {
  kind: "replace-range";
  from: MarkdownPosition;
  to: MarkdownPosition;
  replacement: string;
  rangeHash: string;
}

const MAX_DOCUMENT_CHARACTERS = 32_000;
const MAX_RANGE_CHARACTERS = 40_000;
const MAX_RANGE_LINES = 400;
const MAX_REPLACEMENT_CHARACTERS = 40_000;

export const MARKDOWN_AGENT_TOOLS: AgentToolDescriptor[] = [
  {
    name: "read_markdown_outline",
    description: "Read a bounded heading outline for the active Markdown document.",
    effect: "read",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "read_markdown_document",
    description: "Read a short Markdown document with line numbers. Large documents require read_markdown_range.",
    effect: "read",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "read_markdown_range",
    description: "Read an inclusive bounded line range and return the exact range hash required by replace_markdown_range.",
    effect: "read",
    inputSchema: {
      type: "object",
      properties: {
        startLine: { type: "integer", minimum: 1 },
        startColumn: { type: "integer", minimum: 0 },
        endLine: { type: "integer", minimum: 1 },
        endColumn: { type: "integer", minimum: 0 },
      },
      required: ["startLine", "endLine"],
      additionalProperties: false,
    },
  },
  {
    name: "replace_markdown_range",
    description: "After read_markdown_range succeeds, replace one exact Markdown range through a single native CodeMirror transaction.",
    effect: "write",
    requires: ["read_markdown_range"],
    inputSchema: {
      type: "object",
      properties: {
        startLine: { type: "integer", minimum: 1 },
        startColumn: { type: "integer", minimum: 0 },
        endLine: { type: "integer", minimum: 1 },
        endColumn: { type: "integer", minimum: 0 },
        replacement: { type: "string", maxLength: MAX_REPLACEMENT_CHARACTERS },
        rangeHash: { type: "string", minLength: 8, maxLength: 32 },
      },
      required: ["startLine", "startColumn", "endLine", "endColumn", "replacement", "rangeHash"],
      additionalProperties: false,
    },
  },
];

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function getMarkdownSourceFingerprint(model: MarkdownDocument): string {
  return stableHash(`${model.text.length}:${model.text}`);
}

export function getMarkdownRangeHash(value: string): string {
  return stableHash(`${value.length}:${value}`);
}

export interface MarkdownAgentEditTarget {
  documentId: string;
  revision: number;
  documentStatus: AgentToolExecutionContext["documentStatus"];
  sourceModified?: string;
  readOnly: boolean;
  model: MarkdownDocument;
}

export interface ResolvedMarkdownAgentEdit {
  from: number;
  to: number;
  replacement: string;
}

export function markdownOffsetForPosition(text: string, position: MarkdownPosition): number {
  if (!Number.isInteger(position.line) || !Number.isInteger(position.column) || position.line < 1 || position.column < 0) {
    throw new Error("Markdown positions use one-based lines and zero-based UTF-16 columns.");
  }
  const lines = text.split("\n");
  const line = lines[position.line - 1];
  if (line === undefined || position.column > line.length) throw new Error("Markdown range is outside the captured document.");
  const offset = lines.slice(0, position.line - 1).reduce((total, value) => total + value.length + 1, 0) + position.column;
  const previous = text.charCodeAt(offset - 1);
  const current = text.charCodeAt(offset);
  if (previous >= 0xd800 && previous <= 0xdbff && current >= 0xdc00 && current <= 0xdfff) {
    throw new Error("Markdown range cannot split a Unicode surrogate pair.");
  }
  return offset;
}

function lineNumbered(lines: string[], startLine: number): string {
  return lines.map((line, index) => `${startLine + index}: ${line}`).join("\n");
}

export function resolveMarkdownAgentEdit(
  changeSet: AgentChangeSet<MarkdownAgentOperation>,
  target: MarkdownAgentEditTarget,
): ResolvedMarkdownAgentEdit | undefined {
  if (
    target.readOnly
    || target.documentStatus !== "editable"
    || changeSet.status !== "proposed"
    || changeSet.extensionId !== "markdown-agent"
    || changeSet.documentId !== target.documentId
    || changeSet.baseRevision !== target.revision
    || changeSet.baseDocumentStatus !== target.documentStatus
    || changeSet.baseSourceModified !== target.sourceModified
    || changeSet.sourceFingerprint !== getMarkdownSourceFingerprint(target.model)
    || changeSet.operations.length !== 1
  ) return undefined;

  const operation = changeSet.operations[0];
  if (operation.kind !== "replace-range" || operation.replacement.length > MAX_REPLACEMENT_CHARACTERS) {
    return undefined;
  }
  try {
    const from = markdownOffsetForPosition(target.model.text, operation.from);
    const to = markdownOffsetForPosition(target.model.text, operation.to);
    if (to < from || getMarkdownRangeHash(target.model.text.slice(from, to)) !== operation.rangeHash) {
      return undefined;
    }
    return { from, to, replacement: operation.replacement };
  } catch {
    return undefined;
  }
}

function outline(text: string) {
  const entries: Array<{ line: number; level: number; text: string }> = [];
  text.split("\n").some((line, index) => {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) entries.push({ line: index + 1, level: match[1].length, text: match[2].trim() });
    return entries.length > 200;
  });
  return entries;
}

function mutationResult(
  call: AgentToolCall,
  context: AgentToolExecutionContext<MarkdownDocument>,
  operation: MarkdownAgentOperation,
): AgentToolResult<MarkdownAgentOperation> {
  const changeSet: AgentChangeSet<MarkdownAgentOperation> = {
    id: `agent-change-${call.callId}`,
    extensionId: "markdown-agent",
    documentId: context.documentId,
    baseRevision: context.revision,
    baseDocumentStatus: context.documentStatus,
    baseSourceModified: context.sourceModified,
    sourceFingerprint: getMarkdownSourceFingerprint(context.model),
    summary: `Replace Markdown ${operation.from.line}:${operation.from.column}–${operation.to.line}:${operation.to.column}`,
    operations: [operation],
    status: "proposed",
  };
  return {
    kind: "mutation",
    callId: call.callId,
    name: call.name,
    success: true,
    summary: changeSet.summary,
    changeSet,
    truncated: false,
    persistable: true,
  };
}

export function executeMarkdownAgentTool(
  call: AgentToolCall,
  context: AgentToolExecutionContext<MarkdownDocument>,
): AgentToolResult<MarkdownAgentOperation> {
  const text = context.model.text;
  const lines = text.split("\n");
  const args = call.arguments as Record<string, unknown>;
  switch (call.name) {
    case "read_markdown_outline": {
      const projectedHeadings = outline(text);
      const headings = projectedHeadings.slice(0, 200);
      return {
        kind: "read", callId: call.callId, name: call.name, success: true,
        summary: `Read ${headings.length} Markdown headings`,
        content: { lineCount: lines.length, headings, truncated: projectedHeadings.length > headings.length },
        truncated: projectedHeadings.length > headings.length, persistable: true,
      };
    }
    case "read_markdown_document": {
      if (text.length > MAX_DOCUMENT_CHARACTERS) {
        throw new Error(`Markdown document has ${text.length} characters; use read_markdown_range.`);
      }
      return {
        kind: "read", callId: call.callId, name: call.name, success: true,
        summary: `Read ${lines.length} Markdown lines`,
        content: { startLine: 1, endLine: lines.length, source: lineNumbered(lines, 1), sourceFingerprint: getMarkdownSourceFingerprint(context.model) },
        truncated: false, persistable: false,
      };
    }
    case "read_markdown_range": {
      const startLine = Number(args.startLine);
      const endLine = Number(args.endLine);
      if (!Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine < 1 || endLine < startLine || endLine > lines.length || endLine - startLine + 1 > MAX_RANGE_LINES) {
        throw new Error(`Markdown range must contain 1–${MAX_RANGE_LINES} valid inclusive lines.`);
      }
      const hasStartColumn = args.startColumn !== undefined;
      const hasEndColumn = args.endColumn !== undefined;
      if (hasStartColumn !== hasEndColumn) throw new Error("Markdown range columns must be supplied together.");
      const fromPosition = {
        line: startLine,
        column: hasStartColumn ? Number(args.startColumn) : 0,
      };
      const toPosition = {
        line: endLine,
        column: hasEndColumn ? Number(args.endColumn) : lines[endLine - 1].length,
      };
      const from = markdownOffsetForPosition(text, fromPosition);
      const to = markdownOffsetForPosition(text, toPosition);
      if (to < from) throw new Error("Markdown range end must not precede its start.");
      const rangeText = text.slice(from, to);
      if (rangeText.length > MAX_RANGE_CHARACTERS) throw new Error("Markdown range exceeds the bounded read limit.");
      return {
        kind: "read", callId: call.callId, name: call.name, success: true,
        summary: `Read Markdown lines ${startLine}–${endLine}`,
        content: {
          from: fromPosition,
          to: toPosition,
          source: lineNumbered(rangeText.split("\n"), startLine),
          rangeHash: getMarkdownRangeHash(rangeText),
          sourceFingerprint: getMarkdownSourceFingerprint(context.model),
        },
        truncated: false, persistable: false,
      };
    }
    case "replace_markdown_range": {
      const operation: MarkdownAgentOperation = {
        kind: "replace-range",
        from: { line: Number(args.startLine), column: Number(args.startColumn) },
        to: { line: Number(args.endLine), column: Number(args.endColumn) },
        replacement: String(args.replacement ?? ""),
        rangeHash: String(args.rangeHash ?? ""),
      };
      if (operation.replacement.length > MAX_REPLACEMENT_CHARACTERS) throw new Error("Markdown replacement exceeds the bounded mutation limit.");
      const from = markdownOffsetForPosition(text, operation.from);
      const to = markdownOffsetForPosition(text, operation.to);
      if (to < from || getMarkdownRangeHash(text.slice(from, to)) !== operation.rangeHash) {
        throw new Error("Markdown range hash does not match the captured source.");
      }
      return mutationResult(call, context, operation);
    }
    default:
      throw new Error(`Unsupported Markdown Tool: ${call.name}`);
  }
}
