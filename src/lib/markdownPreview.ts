import { defaultSchema } from "rehype-sanitize";
import type { Schema } from "hast-util-sanitize";

const MAX_SPECIAL_BLOCK_LENGTH = 50_000;
const MAX_SPECIAL_BLOCKS = 24;

const LANGUAGE_ALIASES: Record<string, string> = {
  cjs: "javascript",
  htm: "html",
  html5: "html",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  shell: "bash",
  ts: "typescript",
  tsx: "typescript",
  yml: "yaml",
};

export type MarkdownCodeBlockKind = "code" | "mermaid" | "html" | "limited";

export interface MarkdownCodeBlockDescriptor {
  kind: MarkdownCodeBlockKind;
  language: string;
  source: string;
  message?: string;
}

interface MarkdownLine {
  content: string;
  nextOffset: number;
  hasLineEnding: boolean;
}

function readMarkdownLine(text: string, offset: number): MarkdownLine {
  const newlineOffset = text.indexOf("\n", offset);
  if (newlineOffset < 0) {
    return {
      content: text.slice(offset).replace(/\r$/, ""),
      nextOffset: text.length,
      hasLineEnding: false,
    };
  }
  const contentEnd = newlineOffset > offset && text[newlineOffset - 1] === "\r"
    ? newlineOffset - 1
    : newlineOffset;
  return {
    content: text.slice(offset, contentEnd),
    nextOffset: newlineOffset + 1,
    hasLineEnding: true,
  };
}

/**
 * Removes only a complete YAML frontmatter block at the beginning of a Markdown
 * document. The source text is never changed; this is a Preview-only projection.
 */
export function stripMarkdownFrontmatter(text: string): string {
  const openingOffset = text.startsWith("\uFEFF") ? 1 : 0;
  const opening = readMarkdownLine(text, openingOffset);
  if (!opening.hasLineEnding || !/^---[ \t]*$/.test(opening.content)) return text;

  let offset = opening.nextOffset;
  while (offset < text.length) {
    const line = readMarkdownLine(text, offset);
    if (/^(?:---|\.\.\.)[ \t]*$/.test(line.content)) {
      return text.slice(line.nextOffset);
    }
    if (line.nextOffset === offset) break;
    offset = line.nextOffset;
  }
  return text;
}

export function normalizeCodeLanguage(language = ""): string {
  const normalized = language.trim().toLowerCase().replace(/^language-/, "");
  return (LANGUAGE_ALIASES[normalized] ?? normalized) || "text";
}

export function classifyCodeBlock(
  source: string,
  language = "",
  specialBlockIndex = 0,
): MarkdownCodeBlockDescriptor {
  const normalizedLanguage = normalizeCodeLanguage(language);
  const special = normalizedLanguage === "mermaid" || normalizedLanguage === "html";
  if (special && source.length > MAX_SPECIAL_BLOCK_LENGTH) {
    return {
      kind: "limited",
      language: normalizedLanguage,
      source,
      message: `Preview unavailable: this ${normalizedLanguage} block exceeds 50 KB.`,
    };
  }
  if (special && specialBlockIndex >= MAX_SPECIAL_BLOCKS) {
    return {
      kind: "limited",
      language: normalizedLanguage,
      source,
      message: "Preview unavailable: this document contains more than 24 rich preview blocks.",
    };
  }
  return {
    kind: normalizedLanguage === "mermaid" ? "mermaid" : normalizedLanguage === "html" ? "html" : "code",
    language: normalizedLanguage,
    source,
  };
}

export function indexSpecialCodeBlocks(text: string): ReadonlyMap<number, number> {
  const indexes = new Map<number, number>();
  const lines = text.split("\n");
  let activeFence: { marker: "`" | "~"; length: number } | undefined;
  let specialBlockIndex = 0;

  lines.forEach((line, index) => {
    if (activeFence) {
      const closingPattern = new RegExp(`^ {0,3}\\${activeFence.marker}{${activeFence.length},}\\s*$`);
      if (closingPattern.test(line)) activeFence = undefined;
      return;
    }

    const opening = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*([^ \t`~]+)?/);
    if (!opening) return;
    const fence = opening[1];
    activeFence = { marker: fence[0] as "`" | "~", length: fence.length };
    const language = normalizeCodeLanguage(opening[2] ?? "");
    if (language === "mermaid" || language === "html") {
      indexes.set(index + 1, specialBlockIndex);
      specialBlockIndex += 1;
    }
  });

  return indexes;
}

const allowedMarkdownTags = [
  "a", "b", "blockquote", "br", "code", "dd", "del", "details", "div", "dl", "dt",
  "em", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "input", "kbd",
  "li", "main", "ol", "p", "pre", "q", "s", "samp", "section", "span", "strong",
  "sub", "summary", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul", "var",
];

export const markdownHtmlSchema: Schema = {
  ...defaultSchema,
  tagNames: allowedMarkdownTags,
  attributes: {
    a: ["ariaLabel", "href", "title"],
    code: [["className", /^language-[a-z0-9_+-]+$/]],
    details: ["open"],
    img: ["alt", "src", "title"],
    input: [["disabled", true], ["type", "checkbox"], ["checked", true]],
    ol: ["start"],
    td: ["colSpan", "rowSpan"],
    th: ["colSpan", "rowSpan", "scope"],
    "*": ["ariaLabel", "id", "title"],
  },
  protocols: {
    href: ["http", "https"],
    src: ["data"],
  },
  strip: ["script", "style"],
};

export function sanitizePreviewCss(source: string): string {
  return source
    .replace(/@import\s+[^;]+;?/gi, "")
    .replace(/url\s*\([^)]*\)/gi, "none")
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/(?:behavior|-moz-binding)\s*:[^;]+;?/gi, "");
}

const htmlPreviewCsp = [
  "default-src 'none'",
  "base-uri 'none'",
  "connect-src 'none'",
  "font-src 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "img-src data: blob:",
  "media-src 'none'",
  "object-src 'none'",
  "script-src 'none'",
  "style-src 'unsafe-inline'",
].join("; ");

export function buildHtmlPreviewDocument(sanitizedFragment: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${htmlPreviewCsp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root { color-scheme: light dark; font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
* { box-sizing: border-box; }
body { min-width: 0; margin: 0; overflow-wrap: anywhere; color: CanvasText; background: Canvas; padding: 16px; }
img, svg, video { max-width: 100%; height: auto; }
pre { max-width: 100%; overflow: auto; }
table { max-width: 100%; border-collapse: collapse; }
td, th { border: 1px solid color-mix(in srgb, CanvasText 24%, transparent); padding: 6px 8px; }
</style>
</head>
<body>${sanitizedFragment}</body>
</html>`;
}

export function estimateHtmlPreviewHeight(source: string): number {
  const lineEstimate = source.split("\n").length * 22;
  const contentEstimate = Math.ceil(source.length / 72) * 18;
  return Math.max(160, Math.min(520, 76 + Math.max(lineEstimate, contentEstimate)));
}
