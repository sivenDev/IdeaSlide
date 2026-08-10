import type { MarkdownDocument, MarkdownLineEnding } from "../types.ts";

export interface MarkdownFileData {
  text: string;
  bom: boolean;
  lineEnding: MarkdownLineEnding;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function detectMarkdownLineEnding(text: string): MarkdownLineEnding {
  let lf = 0;
  let crlf = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "\n") continue;
    if (index > 0 && text[index - 1] === "\r") crlf += 1;
    else lf += 1;
  }
  if (lf === 0 && crlf === 0) return "none";
  if (lf > 0 && crlf > 0) return "mixed";
  return crlf > 0 ? "crlf" : "lf";
}

export function normalizeMarkdownText(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

export function createEmptyMarkdownDocument(): MarkdownDocument {
  return {
    type: "markdown",
    text: "",
    bom: false,
    lineEnding: "none",
    originalText: "",
  };
}

export function parseMarkdownFile(value: unknown): MarkdownDocument {
  const data = requireRecord(value, "Markdown data");
  if (typeof data.text !== "string") throw new Error("Markdown text must be a string");
  if (typeof data.bom !== "boolean") throw new Error("Markdown BOM metadata is invalid");
  const detected = detectMarkdownLineEnding(data.text);
  const declared = data.lineEnding;
  if (declared !== undefined && declared !== detected) {
    throw new Error("Markdown line-ending metadata does not match the source");
  }
  return {
    type: "markdown",
    text: normalizeMarkdownText(data.text),
    bom: data.bom,
    lineEnding: detected,
    originalText: data.text,
  };
}

export function serializeMarkdownDocument(model: MarkdownDocument): MarkdownFileData {
  const normalizedOriginal = normalizeMarkdownText(model.originalText);
  const unchanged = model.text === normalizedOriginal;
  let text: string;
  if (model.lineEnding === "mixed" && !model.normalization) {
    if (!unchanged) {
      throw new Error("This file uses mixed line endings. Choose LF or CRLF before saving edited content.");
    }
    text = model.originalText;
  } else {
    const lineEnding = model.normalization
      ?? (model.lineEnding === "crlf" ? "crlf" : "lf");
    text = lineEnding === "crlf" ? model.text.replace(/\n/g, "\r\n") : model.text;
  }
  return {
    text,
    bom: model.bom,
    lineEnding: detectMarkdownLineEnding(text),
  };
}

export function updateMarkdownText(model: MarkdownDocument, text: string): MarkdownDocument {
  return model.text === text ? model : { ...model, text };
}

export function normalizeMarkdownLineEndings(
  model: MarkdownDocument,
  normalization: "lf" | "crlf",
): MarkdownDocument {
  return { ...model, normalization, lineEnding: normalization };
}
