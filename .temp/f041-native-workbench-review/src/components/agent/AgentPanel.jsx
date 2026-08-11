import { Bot, History, MoreHorizontal, Send, Sparkles, SquarePen } from "lucide-react";

export function AgentPanel({ document }) {
  return (
    <aside className="agent-region" aria-label="Agent">
      <header className="agent-crown" data-tauri-drag-region>
        <div className="agent-heading"><span className="agent-mark"><Sparkles size={15} /></span><span><strong>Agent</strong><small>Mock workspace runtime</small></span></div>
        <div className="inline-actions"><button className="icon-button" type="button" aria-label="New thread"><SquarePen size={15} /></button><button className="icon-button" type="button" aria-label="Thread history"><History size={15} /></button><button className="icon-button" type="button" aria-label="Agent options"><MoreHorizontal size={15} /></button></div>
      </header>
      <div className="agent-scope"><span>Attached document</span><strong>{document.name}</strong></div>
      <div className="agent-empty">
        <Bot size={24} />
        <strong>Agent runtime arrives in F044-03</strong>
        <p>The panel is already bound to the active editor and session. Thread, Skill, runtime and Tool flows will mount here.</p>
      </div>
      <div className="agent-composer"><div className="composer-box is-disabled"><textarea disabled rows={3} placeholder="Agent runtime is not mounted yet" /><div className="composer-foot"><span>Active editor context reserved</span><button type="button" disabled aria-label="Send message"><Send size={15} /></button></div></div></div>
    </aside>
  );
}
