import { Archive, Bot, Check, CircleStop, History, Info, MoreHorizontal, PanelRight, RefreshCw, Send, Sparkles, SquarePen, Trash2, Wrench, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { editorToolDecision } from "../../lib/agentEditorPolicy.js";
import { mockAgentRuntime, resolveRuntime } from "../../mock/mockAgentRuntime.js";

const THREAD_KEY = "ideanote-review-agent-threads-v1";
const readThreads = () => { try { return JSON.parse(localStorage.getItem(THREAD_KEY) || "[]"); } catch { return []; } };

function TranscriptItem({ item, showTools }) {
  if (item.type === "user") return <article className="thread-note"><span className="thread-avatar">Y</span><div><p>{item.text}</p><time>{item.time}</time></div></article>;
  if (item.type === "assistant") return <article className="agent-answer"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item.text || "▍"}</ReactMarkdown></article>;
  if (item.type === "activity") return <article className="activity-row"><span className="activity-icon"><PanelRight size={14} /></span><div><strong>{item.title}</strong><p>{item.detail}</p></div><span className="activity-check"><Check size={13} /></span></article>;
  if (item.type === "tool" && showTools) return <article className={`activity-row tool-row ${item.ok === false ? "is-error" : ""}`}><span className="activity-icon"><Wrench size={14} /></span><div><strong>{item.name}</strong><p>{item.detail}</p></div><span className="activity-check">{item.running ? <span className="mini-spinner" /> : item.ok === false ? <X size={13} /> : <Check size={13} />}</span></article>;
  if (item.type === "error") return <article className="agent-error"><strong>Turn stopped</strong><p>{item.text}</p></article>;
  return null;
}

function RuntimeInspector({ settings, contextPercent, document, selectedSkill }) {
  const selected = resolveRuntime(settings.agent.runtime);
  return <div className="runtime-inspector"><header><strong>Runtime Inspector</strong><span>Deterministic evidence</span></header><dl><div><dt>Runtime</dt><dd>{selected.label} · {selected.status}</dd></div><div><dt>Model</dt><dd>{settings.provider.model || "Unavailable"}</dd></div><div><dt>Context</dt><dd>{contextPercent}% · exact mock count</dd></div><div><dt>Document</dt><dd>{document.name} · revision {document.revision}</dd></div><div><dt>Policy</dt><dd>{settings.agent.maxSteps} steps · {settings.agent.deliveryMode}</dd></div><div><dt>Skill</dt><dd>{selectedSkill || "Automatic"}</dd></div><div><dt>Capabilities</dt><dd>{selected.capabilities.join(", ")}</dd></div></dl><div className="inspector-diagnostic">No real process, network request, credential value, or hidden reasoning is exposed.</div></div>;
}

function ThreadHistory({ threads, activeId, showArchived, setShowArchived, onSelect, onNew, onRename, onArchive, onDelete, onClose, running }) {
  const visible = threads.filter((thread) => showArchived || !thread.archived);
  return <div className="agent-history"><header><strong>Threads</strong><button type="button" onClick={onClose}><X size={14} /></button></header><button className="history-new" type="button" onClick={onNew}><SquarePen size={13} />New Thread</button><label className="history-filter"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />Show archived</label><div className="history-list">{visible.map((thread) => <div className={`history-row ${thread.id === activeId ? "is-active" : ""}`} key={thread.id}><button className="history-main" type="button" onClick={() => onSelect(thread.id)}><strong>{thread.title}</strong><small>{thread.archived ? "Archived" : `${thread.items.length} items`}</small></button><div><button type="button" title="Rename Thread" onClick={() => onRename(thread.id)}><RefreshCw size={12} /></button><button type="button" title={thread.archived ? "Restore Thread" : "Archive Thread"} onClick={() => onArchive(thread.id)}><Archive size={12} /></button><button type="button" title="Delete Thread" disabled={running && thread.id === activeId} onClick={() => onDelete(thread.id)}><Trash2 size={12} /></button></div></div>)}</div></div>;
}

export function AgentPanel({ document, settings, editorAdapter, onOpenSettings }) {
  const [threads, setThreads] = useState(() => { const stored = readThreads(); return stored.length ? stored : [mockAgentRuntime.createThread(document)]; });
  const [activeId, setActiveId] = useState(() => threads.find((thread) => thread.documentId === document.sessionId)?.id ?? threads[0].id);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [contextPercent, setContextPercent] = useState(38);
  const [selectedSkill, setSelectedSkill] = useState("");
  const controllerRef = useRef(null);
  const lastPromptRef = useRef("");
  const activeThread = threads.find((thread) => thread.id === activeId) ?? threads[0];
  const availableSkills = useMemo(() => settings.skills.filter((skill) => skill.enabled && (skill.scope === "all" || skill.scope === document.type)), [settings.skills, document.type]);
  const runtime = resolveRuntime(settings.agent.runtime);

  useEffect(() => { localStorage.setItem(THREAD_KEY, JSON.stringify(threads)); }, [threads]);
  useEffect(() => {
    const matching = threads.find((thread) => thread.documentId === document.sessionId && !thread.archived);
    if (matching) setActiveId(matching.id);
    else {
      const next = mockAgentRuntime.createThread(document);
      setThreads((items) => [...items, next]); setActiveId(next.id);
    }
  }, [document.sessionId]);

  const updateActive = (updater) => setThreads((items) => items.map((thread) => thread.id === activeId ? updater(thread) : thread));
  const appendItem = (item) => updateActive((thread) => ({ ...thread, updatedAt: Date.now(), items: [...thread.items, { id: crypto.randomUUID(), ...item }] }));
  const updateLastTool = (patch) => updateActive((thread) => ({ ...thread, items: thread.items.map((item, index) => index === thread.items.length - 1 && item.type === "tool" ? { ...item, ...patch } : item) }));
  const appendDelta = (text) => updateActive((thread) => {
    const items = [...thread.items]; const last = items.at(-1);
    if (last?.type === "assistant" && last.streaming) items[items.length - 1] = { ...last, text: `${last.text}${text}` };
    else items.push({ id: crypto.randomUUID(), type: "assistant", text, streaming: true });
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
    if (!settings.provider.credentialConfigured) { appendItem({ type: "error", text: "Configure a mock Provider credential in Settings before starting a Turn." }); return; }
    lastPromptRef.current = prompt;
    appendItem({ type: "user", text: prompt, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
    setInput(""); setRunning(true);
    const controller = new AbortController(); controllerRef.current = controller;
    try {
      await mockAgentRuntime.run({ prompt, document, deliveryMode: settings.agent.deliveryMode, signal: controller.signal, toolExecutor: executeTool, onEvent: async (event) => {
        if (event.type === "activity") appendItem({ type: "activity", title: event.title, detail: event.detail });
        if (event.type === "tool-started") appendItem({ type: "tool", name: event.name, detail: event.detail, running: true });
        if (event.type === "tool-completed") updateLastTool({ detail: event.detail, running: false, ok: event.ok });
        if (event.type === "message-delta") appendDelta(event.text);
        if (event.type === "turn-completed") { setContextPercent(event.contextPercent); updateActive((thread) => ({ ...thread, items: thread.items.map((item) => item.type === "assistant" ? { ...item, streaming: false } : item) })); }
      }});
    } catch (error) {
      appendItem({ type: "error", text: error.name === "AbortError" ? "Turn cancelled. No pending Tool work remains." : error.message });
    } finally { setRunning(false); controllerRef.current = null; }
  };

  const newThread = () => { const next = mockAgentRuntime.createThread(document); setThreads((items) => [...items, next]); setActiveId(next.id); setHistoryOpen(false); setContextPercent(18); return next.id; };
  const cancel = () => controllerRef.current?.abort();
  const steer = () => { if (!input.trim()) return; controllerRef.current?.abort(); window.setTimeout(() => runPrompt(`Steer: ${input}`), 30); };

  if (!settings.provider.credentialConfigured) return <aside className="agent-region" aria-label="Agent"><header className="agent-crown"><div className="agent-heading"><span className="agent-mark"><Sparkles size={15} /></span><span><strong>Agent</strong><small>Configuration required</small></span></div></header><div className="agent-empty"><Bot size={24} /><strong>Provider configuration required</strong><p>Add a mock credential status to review the complete Agent lifecycle. No value will be sent or retained.</p><button type="button" onClick={onOpenSettings}>Open AI Provider Settings</button></div></aside>;

  return <aside className="agent-region" aria-label="Agent"><header className="agent-crown" data-tauri-drag-region><div className="agent-heading"><span className="agent-mark"><Sparkles size={15} /></span><span><strong>Agent</strong><small>{running ? "Turn running" : `${runtime.label} · mock`}</small></span></div><div className="inline-actions"><button className="icon-button" type="button" aria-label="New thread" onClick={newThread}><SquarePen size={15} /></button><button className="icon-button" type="button" aria-label="Thread history" onClick={() => setHistoryOpen((value) => !value)}><History size={15} /></button><button className="icon-button" type="button" aria-label="Runtime Inspector" onClick={() => setInspectorOpen((value) => !value)}><Info size={15} /></button></div></header><div className="agent-thread-title"><strong>{activeThread.title}</strong><span>{activeThread.items.length} items</span></div><div className="agent-scope"><span>Attached document</span><strong>{document.name}</strong></div>{runtime.id === "compatibility" && <div className="runtime-limit">Compatibility mode: streaming and Threads only. Editor mutation Tools are unavailable.</div>}{contextPercent >= settings.agent.exactContextWarning && <button className="context-warning" type="button" onClick={newThread}>Context is {contextPercent}%. Start a New Thread for exact edits.</button>}<div className="agent-thread" aria-live="polite">{activeThread.items.length ? activeThread.items.map((item) => <TranscriptItem key={item.id} item={item} showTools={settings.agent.showToolActivity} />) : <div className="agent-empty agent-empty--thread"><Bot size={22} /><strong>Work with the active editor</strong><p>Ask for an outline, request a bounded edit, or type “fail” to review terminal recovery.</p><div><button type="button" onClick={() => runPrompt("Outline the active document structure")}>Outline structure</button><button type="button" onClick={() => runPrompt("Edit the current selection with a concise review note")} disabled={runtime.id === "compatibility"}>Apply a native edit</button></div></div>}</div>{inspectorOpen && <RuntimeInspector settings={settings} contextPercent={contextPercent} document={document} selectedSkill={selectedSkill} />}{historyOpen && <ThreadHistory threads={threads} activeId={activeId} showArchived={showArchived} setShowArchived={setShowArchived} onClose={() => setHistoryOpen(false)} onSelect={(id) => { setActiveId(id); setHistoryOpen(false); }} onNew={newThread} running={running} onRename={(id) => setThreads((items) => items.map((thread) => thread.id === id ? { ...thread, title: `${thread.title} · revised` } : thread))} onArchive={(id) => setThreads((items) => items.map((thread) => thread.id === id ? { ...thread, archived: !thread.archived } : thread))} onDelete={(id) => { const remaining = threads.filter((thread) => thread.id !== id); if (remaining.length) { setThreads(remaining); if (id === activeId) setActiveId(remaining[0].id); } else { const replacement = mockAgentRuntime.createThread(document); setThreads([replacement]); setActiveId(replacement.id); } }} />}<div className="agent-composer"><div className="composer-skill-row"><select aria-label="Agent Skill" value={selectedSkill} onChange={(event) => setSelectedSkill(event.target.value)} disabled={running || runtime.id === "compatibility"}><option value="">Automatic Skill</option>{availableSkills.map((skill) => <option key={skill.id} value={skill.name}>{skill.name}</option>)}</select><span>{settings.agent.deliveryMode}</span></div><div className="composer-box"><textarea aria-label="Ask Agent" rows={3} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about the active document…" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); running ? steer() : runPrompt(input); } }} /><div className="composer-foot"><span>{running ? "Enter steers this Turn" : `${runtime.label} · simulated`}</span><div>{activeThread.items.some((item) => item.type === "error") && !running && <button className="composer-retry" type="button" aria-label="Retry last Turn" onClick={() => runPrompt(lastPromptRef.current)}><RefreshCw size={13} /></button>}{running && <button className="composer-cancel" type="button" aria-label="Cancel Turn" onClick={cancel}><CircleStop size={15} /></button>}<button type="button" aria-label={running ? "Steer Turn" : "Send message"} onClick={() => running ? steer() : runPrompt(input)} disabled={!input.trim()}>{running ? <MoreHorizontal size={15} /> : <Send size={15} />}</button></div></div></div></div></aside>;
}
