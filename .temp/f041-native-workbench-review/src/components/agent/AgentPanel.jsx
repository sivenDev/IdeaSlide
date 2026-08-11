import { Bot, Check, ChevronDown, CircleStop, Copy, Info, MoreHorizontal, PanelRight, Pencil, RefreshCw, Send, SquarePen, Trash2, Wrench, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { editorToolDecision } from "../../lib/agentEditorPolicy.js";
import { agentModelCatalog, mockAgentRuntime, resolveAgentModel, resolveRuntime } from "../../mock/mockAgentRuntime.js";
import { AppDialog } from "../primitives/AppDialog.jsx";
import { AppMenu, AppMenuItem, AppMenuRadioGroup, AppMenuRadioItem, AppMenuSeparator, AppMenuSub, AppPopover } from "../primitives/AppMenu.jsx";

const THREAD_KEY = "ideanote-review-agent-threads-v1";
const readThreads = () => {
  try {
    const value = JSON.parse(localStorage.getItem(THREAD_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.map(({ archived: _archived, ...thread }, index) => {
      const id = seen.has(thread.id) ? `${thread.id}-restored-${index + 1}` : thread.id;
      seen.add(id);
      return { ...thread, id };
    });
  } catch { return []; }
};

function ResponseActions({ item }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const model = resolveAgentModel(item.evidence.model);
  const elapsed = item.evidence.elapsedMs < 1000 ? `${item.evidence.elapsedMs}ms` : `${(item.evidence.elapsedMs / 1000).toFixed(1)}s`;
  const copy = async () => {
    await navigator.clipboard?.writeText(item.text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className="response-actions">
      <button type="button" aria-label="Copy response" onClick={copy}>{copied ? <Check size={13} /> : <Copy size={13} />}</button>
      <span>{elapsed}</span>
      <AppPopover
        open={open}
        onOpenChange={setOpen}
        side="top"
        align="end"
        sideOffset={5}
        contentClassName="response-evidence"
        trigger={<button type="button" aria-label="Response evidence"><MoreHorizontal size={14} /></button>}
      >
        <dl>
          <div><dt>Model</dt><dd>{model.label}</dd></div>
          <div><dt>Reasoning</dt><dd>{item.evidence.reasoningEffort}</dd></div>
          <div><dt>Context Window</dt><dd>{item.evidence.contextPercent}% used</dd></div>
        </dl>
      </AppPopover>
    </div>
  );
}

function TranscriptItem({ item, showTools }) {
  if (item.type === "user") return <article className="thread-note"><span className="thread-avatar">Y</span><div><p>{item.text}</p><time>{item.time}</time></div></article>;
  if (item.type === "assistant") return <article className="agent-answer"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item.text || "▍"}</ReactMarkdown>{item.evidence && !item.streaming && <ResponseActions item={item} />}</article>;
  if (item.type === "activity") return <article className="activity-row"><span className="activity-icon"><PanelRight size={14} /></span><div><strong>{item.title}</strong><p>{item.detail}</p></div><span className="activity-check"><Check size={13} /></span></article>;
  if (item.type === "tool" && showTools) return <article className={`activity-row tool-row ${item.ok === false ? "is-error" : ""}`}><span className="activity-icon"><Wrench size={14} /></span><div><strong>{item.name}</strong><p>{item.detail}</p></div><span className="activity-check">{item.running ? <span className="mini-spinner" /> : item.ok === false ? <X size={13} /> : <Check size={13} />}</span></article>;
  if (item.type === "error") return <article className="agent-error"><strong>Turn stopped</strong><p>{item.text}</p></article>;
  return null;
}

function RuntimeInspector({ settings, contextPercent, document, modelId, reasoningEffort }) {
  const selected = resolveRuntime(settings.agent.runtime);
  const model = resolveAgentModel(modelId);
  return (
    <div className="runtime-inspector">
      <dl>
        <div><dt>Runtime</dt><dd>{selected.label} · {selected.status}</dd></div>
        <div><dt>Model</dt><dd>{model.label}</dd></div>
        <div><dt>Reasoning</dt><dd>{reasoningEffort}</dd></div>
        <div><dt>Context</dt><dd>{contextPercent}%</dd></div>
        <div><dt>Document</dt><dd>{document.name} · revision {document.revision}</dd></div>
        <div><dt>Policy</dt><dd>{settings.agent.maxSteps} steps</dd></div>
        <div><dt>Capabilities</dt><dd>{selected.capabilities.join(", ")}</dd></div>
      </dl>
    </div>
  );
}

function ConversationHistory({ open, onOpenChange, threads, activeThread, activeId, onSelect, onRename, onDelete, running }) {
  return (
    <AppPopover
      open={open}
      onOpenChange={onOpenChange}
      align="start"
      contentClassName="conversation-popover"
      trigger={(
        <button className="conversation-trigger" type="button" aria-label={`Conversation history. Current conversation: ${activeThread.title}`}>
          <Bot size={15} />
          <span><strong>{activeThread.title}</strong><small>{activeThread.items.length} items</small></span>
          <ChevronDown size={13} />
        </button>
      )}
    >
      <div className="conversation-list">
        {threads.map((thread) => (
          <div className={`conversation-row ${thread.id === activeId ? "is-active" : ""}`} key={thread.id}>
            <button className="conversation-main" type="button" disabled={running && thread.id !== activeId} onClick={() => onSelect(thread.id)}>
              <strong>{thread.title}</strong><small>{thread.items.length} items</small>
            </button>
            <AppMenu
              side="right"
              align="start"
              sideOffset={4}
              contentClassName="app-menu--compact"
              trigger={<button className="conversation-actions" type="button" aria-label={`Actions for ${thread.title}`}><MoreHorizontal size={14} /></button>}
            >
              <AppMenuItem icon={Pencil} onSelect={() => onRename(thread.id)}>Rename</AppMenuItem>
              <AppMenuItem icon={Trash2} danger disabled={running && thread.id === activeId} onSelect={() => onDelete(thread.id)}>Delete</AppMenuItem>
            </AppMenu>
          </div>
        ))}
      </div>
    </AppPopover>
  );
}

function AgentCrown({ history, onNew, onInspector, onClose }) {
  return (
    <header className="agent-crown" data-tauri-drag-region>
      {history}
      <div className="inline-actions agent-header-actions">
        <button className="icon-button" type="button" aria-label="New conversation" onClick={onNew}><SquarePen size={15} /></button>
        <button className="icon-button" type="button" aria-label="Runtime Inspector" onClick={onInspector}><Info size={15} /></button>
        <button className="icon-button agent-panel-close" type="button" aria-label="Hide Agent" onClick={onClose}><PanelRight size={15} /></button>
      </div>
    </header>
  );
}

function ModelSelector({ modelId, reasoningEffort, disabled, onModelChange, onReasoningChange }) {
  const model = resolveAgentModel(modelId);
  return (
    <AppMenu
      align="start"
      side="top"
      sideOffset={6}
      contentClassName="model-menu"
      trigger={<button className="model-selector" type="button" aria-label="Model and reasoning" disabled={disabled}>{model.label} · {reasoningEffort}<ChevronDown size={12} /></button>}
    >
      <AppMenuRadioGroup value={model.id} onValueChange={onModelChange}>
        {agentModelCatalog.map((option) => <AppMenuRadioItem key={option.id} value={option.id}>{option.label}</AppMenuRadioItem>)}
      </AppMenuRadioGroup>
      <AppMenuSeparator />
      <AppMenuSub label={`Reasoning · ${reasoningEffort}`}>
        <AppMenuRadioGroup value={reasoningEffort} onValueChange={onReasoningChange}>
          {model.efforts.map((effort) => <AppMenuRadioItem key={effort} value={effort}>{effort}</AppMenuRadioItem>)}
        </AppMenuRadioGroup>
      </AppMenuSub>
    </AppMenu>
  );
}

export function AgentPanel({ document, settings, editorAdapter, onOpenSettings, onToggleAgent }) {
  const [threads, setThreads] = useState(() => {
    const stored = readThreads();
    return stored.length ? stored : [mockAgentRuntime.createThread(document)];
  });
  const [activeId, setActiveId] = useState(() => threads.find((thread) => thread.documentId === document.sessionId)?.id ?? threads[0].id);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [threadDialog, setThreadDialog] = useState(null);
  const [contextPercent, setContextPercent] = useState(38);
  const [modelId, setModelId] = useState(settings.agent.model ?? agentModelCatalog[0].id);
  const [reasoningEffort, setReasoningEffort] = useState(settings.agent.reasoningEffort ?? "medium");
  const controllerRef = useRef(null);
  const lastPromptRef = useRef("");
  const activeThread = threads.find((thread) => thread.id === activeId) ?? threads[0];
  const runtime = resolveRuntime(settings.agent.runtime);

  useEffect(() => { localStorage.setItem(THREAD_KEY, JSON.stringify(threads)); }, [threads]);
  useEffect(() => {
    const matching = threads.find((thread) => thread.documentId === document.sessionId);
    if (matching) setActiveId(matching.id);
    else {
      const next = mockAgentRuntime.createThread(document);
      setThreads((items) => [...items, next]);
      setActiveId(next.id);
    }
  }, [document.sessionId]);

  const updateActive = (updater) => setThreads((items) => items.map((thread) => thread.id === activeId ? updater(thread) : thread));
  const appendItem = (item) => updateActive((thread) => ({ ...thread, updatedAt: Date.now(), items: [...thread.items, { id: crypto.randomUUID(), ...item }] }));
  const updateLastTool = (patch) => updateActive((thread) => ({ ...thread, items: thread.items.map((item, index) => index === thread.items.length - 1 && item.type === "tool" ? { ...item, ...patch } : item) }));
  const appendDelta = (text, turnId) => updateActive((thread) => {
    const items = [...thread.items];
    const last = items.at(-1);
    if (last?.type === "assistant" && last.streaming && last.turnId === turnId) items[items.length - 1] = { ...last, text: `${last.text}${text}` };
    else items.push({ id: crypto.randomUUID(), type: "assistant", turnId, text, streaming: true });
    return { ...thread, items };
  });

  const executeTool = async (name) => {
    const decision = editorToolDecision(document, editorAdapter);
    if (!decision.ok) return decision;
    if (runtime.id === "compatibility" && !name.startsWith("read_")) return { ok: false, detail: "Compatibility runtime exposes read-only editor context in this review." };
    if (name.startsWith("read_")) {
      const context = editorAdapter.getContext();
      return { ok: true, detail: document.type === "markdown" ? `${context.outline?.length ?? 0} headings and current selection read` : `${context.pages?.length ?? 0} Pages and ${context.cameras?.length ?? 0} Cameras read` };
    }
    const content = document.type === "markdown" ? "\n\n> Agent review: Clarify the next decision before sharing.\n" : "Agent review: clarify the next decision";
    return editorAdapter.applyTransaction(content) ? { ok: true, detail: `Applied one native ${document.type === "markdown" ? "CodeMirror" : "Excalidraw"} transaction` } : { ok: false, detail: "The editor rejected the current transaction." };
  };

  const runPrompt = async (prompt) => {
    if (!prompt.trim() || running) return;
    if (!settings.provider.credentialConfigured) {
      appendItem({ type: "error", text: "Configure a Provider token in Settings before starting a Turn." });
      return;
    }
    lastPromptRef.current = prompt;
    appendItem({ type: "user", text: prompt, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
    setInput("");
    setRunning(true);
    const controller = new AbortController();
    controllerRef.current = controller;
    const turnModel = modelId;
    const turnReasoning = reasoningEffort;
    try {
      await mockAgentRuntime.run({
        prompt,
        document,
        model: turnModel,
        reasoningEffort: turnReasoning,
        deliveryMode: settings.agent.deliveryMode,
        signal: controller.signal,
        toolExecutor: executeTool,
        onEvent: async (event) => {
          if (event.type === "activity") appendItem({ type: "activity", title: event.title, detail: event.detail });
          if (event.type === "tool-started") appendItem({ type: "tool", name: event.name, detail: event.detail, running: true });
          if (event.type === "tool-completed") updateLastTool({ detail: event.detail, running: false, ok: event.ok });
          if (event.type === "message-delta") appendDelta(event.text, event.turnId);
          if (event.type === "turn-completed") {
            setContextPercent(event.contextPercent);
            updateActive((thread) => ({ ...thread, items: thread.items.map((item) => item.type === "assistant" && item.turnId === event.turnId ? { ...item, streaming: false, evidence: event.evidence } : item) }));
          }
        },
      });
    } catch (error) {
      appendItem({ type: "error", text: error.name === "AbortError" ? "Turn cancelled. No pending Tool work remains." : error.message });
    } finally {
      setRunning(false);
      controllerRef.current = null;
    }
  };

  const newThread = () => {
    const documentThreadCount = threads.filter((thread) => thread.documentId === document.sessionId).length;
    const next = { ...mockAgentRuntime.createThread(document), title: `Conversation ${documentThreadCount + 1} · ${document.name}` };
    setThreads((items) => [...items, next]);
    setActiveId(next.id);
    setHistoryOpen(false);
    setContextPercent(18);
    return next.id;
  };
  const cancel = () => controllerRef.current?.abort();
  const steer = () => {
    if (!input.trim()) return;
    controllerRef.current?.abort();
    window.setTimeout(() => runPrompt(`Steer: ${input}`), 30);
  };
  const requestRename = (id) => {
    const thread = threads.find((item) => item.id === id);
    if (!thread) return;
    setHistoryOpen(false);
    setThreadDialog({ kind: "rename", id, value: thread.title });
  };
  const requestDelete = (id) => {
    const thread = threads.find((item) => item.id === id);
    if (!thread || (running && id === activeId)) return;
    setHistoryOpen(false);
    setThreadDialog({ kind: "delete", id, title: thread.title });
  };
  const renameThread = () => {
    const title = threadDialog?.value?.trim();
    if (!title) return;
    setThreads((items) => items.map((thread) => thread.id === threadDialog.id ? { ...thread, title, updatedAt: Date.now() } : thread));
    setThreadDialog(null);
  };
  const deleteThread = () => {
    const id = threadDialog?.id;
    if (!id) return;
    const remaining = threads.filter((thread) => thread.id !== id);
    if (remaining.length) {
      setThreads(remaining);
      if (id === activeId) setActiveId(remaining[0].id);
    } else {
      const replacement = mockAgentRuntime.createThread(document);
      setThreads([replacement]);
      setActiveId(replacement.id);
    }
    setThreadDialog(null);
  };

  const history = (
    <ConversationHistory
      open={historyOpen}
      onOpenChange={setHistoryOpen}
      threads={threads}
      activeThread={activeThread}
      activeId={activeId}
      running={running}
      onSelect={(id) => { setActiveId(id); setHistoryOpen(false); }}
      onRename={requestRename}
      onDelete={requestDelete}
    />
  );

  return (
    <aside className="agent-region" aria-label="Agent">
      <AgentCrown history={history} onNew={newThread} onInspector={() => setInspectorOpen(true)} onClose={onToggleAgent} />
      {!settings.provider.credentialConfigured ? (
        <div className="agent-empty"><Bot size={24} /><strong>Provider configuration required</strong><button type="button" onClick={onOpenSettings}>Open AI Provider Settings</button></div>
      ) : (
        <>
          <div className="agent-scope"><span>Attached document</span><strong>{document.name}</strong></div>
          {runtime.id === "compatibility" && <div className="runtime-limit">Compatibility mode: streaming and Threads only. Editor mutation Tools are unavailable.</div>}
          {contextPercent >= settings.agent.exactContextWarning && <button className="context-warning" type="button" onClick={newThread}>Context is {contextPercent}%. Start a New Thread for exact edits.</button>}
          <div className="agent-thread" aria-live="polite">
            {activeThread.items.length
              ? activeThread.items.map((item) => <TranscriptItem key={item.id} item={item} showTools={settings.agent.showToolActivity} />)
              : <div className="agent-empty agent-empty--thread"><Bot size={22} /><strong>Start a conversation</strong></div>}
          </div>
          <div className="agent-composer">
            <div className="composer-box">
              <textarea aria-label="Ask Agent" rows={3} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about the active document…" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); running ? steer() : runPrompt(input); } }} />
              <div className="composer-foot">
                <ModelSelector
                  modelId={modelId}
                  reasoningEffort={reasoningEffort}
                  disabled={running}
                  onModelChange={(nextModel) => {
                    const resolved = resolveAgentModel(nextModel);
                    setModelId(resolved.id);
                    if (!resolved.efforts.includes(reasoningEffort)) setReasoningEffort("medium");
                  }}
                  onReasoningChange={setReasoningEffort}
                />
                <div>
                  {activeThread.items.some((item) => item.type === "error") && !running && <button className="composer-retry" type="button" aria-label="Retry last Turn" onClick={() => runPrompt(lastPromptRef.current)}><RefreshCw size={13} /></button>}
                  {running && <button className="composer-cancel" type="button" aria-label="Cancel Turn" onClick={cancel}><CircleStop size={15} /></button>}
                  <button type="button" aria-label={running ? "Steer Turn" : "Send message"} onClick={() => running ? steer() : runPrompt(input)} disabled={!input.trim()}>{running ? <MoreHorizontal size={15} /> : <Send size={15} />}</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <AppDialog open={inspectorOpen} onOpenChange={setInspectorOpen} title="Runtime Inspector" size="medium" closeLabel="Close Runtime Inspector">
        <RuntimeInspector settings={settings} contextPercent={contextPercent} document={document} modelId={modelId} reasoningEffort={reasoningEffort} />
      </AppDialog>
      <AppDialog
        open={threadDialog?.kind === "rename"}
        onOpenChange={(open) => { if (!open) setThreadDialog(null); }}
        title="Rename conversation"
        footer={<><button type="button" onClick={() => setThreadDialog(null)}>Cancel</button><button className="primary-button" type="button" disabled={!threadDialog?.value?.trim()} onClick={renameThread}>Rename</button></>}
      >
        <label className="field-label">Name<input autoFocus value={threadDialog?.value ?? ""} onChange={(event) => setThreadDialog((current) => current ? { ...current, value: event.target.value } : current)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); renameThread(); } }} /></label>
      </AppDialog>
      <AppDialog
        open={threadDialog?.kind === "delete"}
        onOpenChange={(open) => { if (!open) setThreadDialog(null); }}
        title="Delete conversation?"
        footer={<><button type="button" onClick={() => setThreadDialog(null)}>Cancel</button><button className="danger-button" type="button" onClick={deleteThread}>Delete</button></>}
      >
        <p className="dialog-copy"><strong>{threadDialog?.title}</strong> will be removed from conversation history.</p>
      </AppDialog>
    </aside>
  );
}
