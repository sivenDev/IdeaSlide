export const fileTypeRegistry = {
  ideasketch: { id: "ideasketch", label: "IdeaSketch", extension: ".is", badge: "IS", tone: "blue", creatable: true },
  markdown: { id: "markdown", label: "Markdown", extension: ".md", badge: "MD", tone: "slate", creatable: true },
  unsupported: { id: "unsupported", label: "Unsupported", extension: "", badge: "?", tone: "muted", creatable: false },
};

export function typeForName(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".is")) return "ideasketch";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  return "unsupported";
}

export function isVisibleEntry(entry) {
  if (entry.hidden || entry.name === ".ideanote") return false;
  return entry.kind === "directory" || entry.type === "ideasketch" || entry.type === "markdown";
}
