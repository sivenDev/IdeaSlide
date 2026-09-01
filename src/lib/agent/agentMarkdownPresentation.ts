interface FenceState {
  marker: "`" | "~";
  length: number;
}

function openingFence(line: string): FenceState | undefined {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})(?:[^`~].*)?$/);
  return match ? { marker: match[1][0] as FenceState["marker"], length: match[1].length } : undefined;
}

function closesFence(line: string, fence: FenceState): boolean {
  const pattern = new RegExp(`^ {0,3}\\${fence.marker}{${fence.length},}\\s*$`);
  return pattern.test(line);
}

function stripUnmatchedInlineDelimiters(text: string): string {
  let next = text;
  for (const delimiter of ["**", "__", "`"] as const) {
    const matcher = delimiter === "`"
      ? /(?<!\\)`/g
      : delimiter === "**"
        ? /(?<!\\)\*\*/g
        : /(?<!\\)__/g;
    const count = (next.match(matcher) ?? []).length;
    if (count % 2 !== 0) next = next.replace(matcher, "");
  }
  next = stripUnmatchedSingleDelimiter(next, "*");
  next = stripUnmatchedSingleDelimiter(next, "_");
  return next;
}

function ensureStreamingBlockBoundaries(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  lines.forEach((line, index) => {
    const previous = lines[index - 1] ?? "";
    const blockStart = /^ {0,3}(?:#{1,6}\s|>\s?|(?:[-+*]|\d+[.)])\s)/.test(line);
    const previousIsBlock = /^ {0,3}(?:#{1,6}\s|>\s?|(?:[-+*]|\d+[.)])\s)/.test(previous);
    if (index > 0 && line.trim() && previous.trim() && blockStart && !previousIsBlock) result.push("");
    result.push(line);
  });
  return result.join("\n");
}

function stripUnmatchedSingleDelimiter(text: string, delimiter: "*" | "_"): string {
  const candidates: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== delimiter || text[index - 1] === "\\" || text[index - 1] === delimiter || text[index + 1] === delimiter) continue;
    const lineStart = text.lastIndexOf("\n", index - 1) + 1;
    const before = text.slice(lineStart, index);
    const after = text[index + 1] ?? "";
    if (delimiter === "*" && /^\s*$/.test(before) && /\s/.test(after)) continue;
    if (delimiter === "_" && /\w/.test(text[index - 1] ?? "") && /\w/.test(after)) continue;
    candidates.push(index);
  }
  if (candidates.length % 2 === 0) return text;
  const remove = new Set(candidates);
  return Array.from(text, (character, index) => remove.has(index) ? "" : character).join("");
}

/**
 * Projects an in-flight Agent Markdown prefix into a parseable, readable form.
 * This is presentation-only: settled responses must render the original bytes.
 */
export function normalizeStreamingAgentMarkdown(text: string): string {
  if (!text) return "";
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const output: string[] = [];
  let outsideFence: string[] = [];
  let fence: FenceState | undefined;

  const flushOutside = () => {
    if (outsideFence.length === 0) return;
    output.push(stripUnmatchedInlineDelimiters(ensureStreamingBlockBoundaries(outsideFence.join("\n"))));
    outsideFence = [];
  };

  lines.forEach((line) => {
    if (!fence) {
      const opening = openingFence(line);
      if (opening) {
        flushOutside();
        output.push(line);
        fence = opening;
        return;
      }
      outsideFence.push(line);
      return;
    }

    output.push(line);
    if (closesFence(line, fence)) fence = undefined;
  });
  flushOutside();

  if (fence) {
    output.push(`${fence.marker.repeat(fence.length)}`);
  }
  return output.join("\n");
}
