const wait = (ms, signal) => new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Cancelled", "AbortError")); }, { once: true });
});

export const runtimeCatalog = [
  { id: "codex", label: "Codex app-server", status: "healthy", capabilities: ["streaming", "threads", "skills", "editor-tools"] },
  { id: "compatibility", label: "OpenAI-compatible", status: "standby", capabilities: ["streaming", "threads"] },
];

export const agentModelCatalog = [
  { id: "gpt-5.6-sol", label: "GPT 5.6 Sol", efforts: ["low", "medium", "high", "xhigh"] },
  { id: "gpt-5.6-terra", label: "GPT 5.6 Terra", efforts: ["low", "medium", "high", "xhigh"] },
  { id: "gpt-5.6-luna", label: "GPT 5.6 Luna", efforts: ["low", "medium", "high"] },
  { id: "gpt-5.5", label: "GPT 5.5", efforts: ["low", "medium", "high", "xhigh"] },
];

export function resolveAgentModel(selection = agentModelCatalog[0].id) {
  return agentModelCatalog.find((model) => model.id === selection) ?? agentModelCatalog[0];
}

export function resolveRuntime(selection = "automatic") {
  const id = selection === "compatibility" ? "compatibility" : "codex";
  return runtimeCatalog.find((runtime) => runtime.id === id);
}

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
    const sequence = this.sequence++;
    const unique = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${sequence}`;
    return { id: `thread-${unique}`, title: `Review ${document.name}`, documentId: document.sessionId, createdAt: Date.now(), updatedAt: Date.now(), items: [] };
  }

  async run({ prompt, document, model = agentModelCatalog[0].id, reasoningEffort = "medium", deliveryMode = "incremental", signal, onEvent, toolExecutor }) {
    const script = responseFor(prompt, document);
    const turnId = `turn-${this.sequence++}`;
    const startedAt = Date.now();
    const resolvedModel = resolveAgentModel(model);
    const resolvedEffort = resolvedModel.efforts.includes(reasoningEffort) ? reasoningEffort : "medium";
    await onEvent({ type: "turn-started", turnId, runtime: "codex", model: resolvedModel.id, reasoningEffort: resolvedEffort });
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
      await onEvent({ type: "message-delta", turnId, text: chunk });
    }
    const contextPercent = Math.min(96, 38 + prompt.length);
    await onEvent({
      type: "turn-completed",
      turnId,
      contextPercent,
      evidence: { model: resolvedModel.id, reasoningEffort: resolvedEffort, contextPercent, elapsedMs: Math.max(1, Date.now() - startedAt) },
    });
    return { turnId, text: script.text };
  }
}

export const mockAgentRuntime = new MockAgentRuntime();
