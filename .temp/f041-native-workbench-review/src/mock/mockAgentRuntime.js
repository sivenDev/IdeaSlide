const wait = (ms, signal) => new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Cancelled", "AbortError")); }, { once: true });
});

export const runtimeCatalog = [
  { id: "codex", label: "Codex app-server", status: "healthy", selected: true, capabilities: ["streaming", "threads", "skills", "editor-tools"] },
  { id: "compatibility", label: "OpenAI-compatible", status: "standby", selected: false, capabilities: ["streaming", "threads"] },
];

function responseFor(prompt, document) {
  const lower = prompt.toLowerCase();
  if (lower.includes("fail")) return { fail: true, text: "The deterministic runtime stopped before producing a response." };
  if (lower.includes("edit") || lower.includes("rewrite") || lower.includes("add")) {
    return { tool: document.type === "markdown" ? "edit_markdown_selection" : "add_ideasketch_note", text: document.type === "markdown" ? "I added a concise review note through one CodeMirror transaction. You can undo it with the editor's native history." : "I added a review note through one Excalidraw scene transaction. The normal document save lifecycle now owns the change." };
  }
  if (lower.includes("outline") || lower.includes("structure")) return { tool: "read_document_structure", text: `The active ${document.type === "markdown" ? "Markdown document" : "IdeaSketch"} has a clear primary structure. The next useful step is to make the review decision explicit near the current selection.` };
  return { tool: "read_active_document", text: `I reviewed ${document.name} in the current editor context. The outer workspace frame stays quiet, the editor remains authoritative, and the Agent can explain or apply a bounded change without owning persistence.` };
}

export class MockAgentRuntime {
  constructor() { this.sequence = 1; }

  createThread(document) {
    return { id: `thread-${this.sequence++}`, title: `Review ${document.name}`, documentId: document.sessionId, createdAt: Date.now(), updatedAt: Date.now(), archived: false, items: [] };
  }

  async run({ prompt, document, deliveryMode = "incremental", signal, onEvent, toolExecutor }) {
    const script = responseFor(prompt, document);
    const turnId = `turn-${this.sequence++}`;
    await onEvent({ type: "turn-started", turnId, runtime: "codex", model: "gpt-5.2" });
    await wait(140, signal);
    await onEvent({ type: "activity", title: "Attached active editor", detail: `${document.name} · revision ${document.revision}`, status: "complete" });
    await wait(160, signal);
    if (script.tool) {
      await onEvent({ type: "tool-started", id: `tool-${this.sequence++}`, name: script.tool, detail: "Validating active document binding" });
      await wait(240, signal);
      const result = await toolExecutor(script.tool);
      await onEvent({ type: "tool-completed", name: script.tool, detail: result.detail, ok: result.ok });
      if (!result.ok) throw new Error(result.detail);
    }
    if (script.fail) throw new Error(script.text);
    const chunks = deliveryMode === "atomic" ? [script.text] : deliveryMode === "burst" ? script.text.match(/.{1,48}(?:\s|$)/g) ?? [script.text] : script.text.split(/(?<=\s)/);
    for (const chunk of chunks) {
      await wait(deliveryMode === "incremental" ? 32 : deliveryMode === "burst" ? 95 : 20, signal);
      await onEvent({ type: "message-delta", text: chunk });
    }
    await onEvent({ type: "turn-completed", turnId, contextPercent: Math.min(96, 38 + prompt.length) });
    return { turnId, text: script.text };
  }
}

export const mockAgentRuntime = new MockAgentRuntime();
