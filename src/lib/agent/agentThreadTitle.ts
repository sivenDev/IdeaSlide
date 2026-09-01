import type { AgentThreadTitleSource } from "./protocol";

export const NEW_AGENT_THREAD_TITLE = "New conversation";
export const MAX_GENERATED_AGENT_THREAD_TITLE_GRAPHEMES = 56;

type SegmenterConstructor = new (
  locales?: string | string[],
  options?: { granularity: "grapheme" },
) => { segment(value: string): Iterable<{ segment: string }> };

function graphemes(value: string): string[] {
  const Segmenter = (Intl as typeof Intl & { Segmenter?: SegmenterConstructor }).Segmenter;
  if (!Segmenter) return Array.from(value);
  return Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(value), ({ segment }) => segment);
}

function stripMarkdownLine(line: string): string {
  const withoutFence = line.replace(/^\s*`{3,}[^`]*$/, "");
  return withoutFence.replace(
    /^\s{0,3}(?:#{1,6}\s+|>\s+|[-*+]\s+|\d+[.)]\s+)/,
    "",
  );
}

function cleanVisiblePrompt(prompt: string): string {
  return prompt
    .normalize("NFC")
    .split(/\r?\n/)
    .map(stripMarkdownLine)
    .join(" ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .replace(/\*\*|__|~~/g, "")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function trimTitleEnd(value: string): string {
  return value.replace(/[\s,.;:!?，。；：！？、]+$/u, "").trim();
}

export function generateAgentThreadTitle(prompt: string): string {
  const cleaned = cleanVisiblePrompt(prompt);
  if (!cleaned) return NEW_AGENT_THREAD_TITLE;

  const units = graphemes(cleaned);
  if (units.length <= MAX_GENERATED_AGENT_THREAD_TITLE_GRAPHEMES) {
    return trimTitleEnd(cleaned) || NEW_AGENT_THREAD_TITLE;
  }

  const available = MAX_GENERATED_AGENT_THREAD_TITLE_GRAPHEMES - 1;
  let prefix = units.slice(0, available).join("");
  const wordBoundary = prefix.lastIndexOf(" ");
  if (wordBoundary >= Math.floor(available * 0.55)) {
    prefix = prefix.slice(0, wordBoundary);
  }
  prefix = trimTitleEnd(prefix);
  return prefix ? `${prefix}…` : NEW_AGENT_THREAD_TITLE;
}

export function normalizeAgentThreadTitleSource(value: unknown): AgentThreadTitleSource {
  return value === "initial" || value === "generated" || value === "manual"
    ? value
    : "manual";
}
