import { Command, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export function CommandPalette({ commands, onRun, onClose }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? commands.filter((item) => `${item.label} ${item.detail ?? ""}`.toLowerCase().includes(needle)) : commands;
  }, [commands, query]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setActiveIndex(0); }, [query]);

  const run = (command) => {
    if (!command || command.disabled) return;
    onRun(command.id);
  };

  return (
    <div className="command-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-labelledby="command-title">
        <header><Command size={15} /><strong id="command-title">Commands</strong><button type="button" aria-label="Close Commands" onClick={onClose}><X size={14} /></button></header>
        <label className="command-search"><Search size={14} /><input ref={inputRef} value={query} placeholder="Type a command…" aria-label="Search commands" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((value) => Math.min(visible.length - 1, value + 1)); }
          if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((value) => Math.max(0, value - 1)); }
          if (event.key === "Enter") { event.preventDefault(); run(visible[activeIndex]); }
          if (event.key === "Escape") { event.preventDefault(); onClose(); }
        }} /></label>
        <div className="command-list" role="listbox" aria-label="Available commands">
          {visible.map((command, index) => <button key={command.id} type="button" role="option" aria-selected={index === activeIndex} className={index === activeIndex ? "is-active" : ""} disabled={command.disabled} onMouseEnter={() => setActiveIndex(index)} onClick={() => run(command)}><span><strong>{command.label}</strong>{command.detail && <small>{command.detail}</small>}</span>{command.shortcut && <kbd>{command.shortcut}</kbd>}</button>)}
          {!visible.length && <p>No matching commands.</p>}
        </div>
        <footer><span>↑↓ Navigate</span><span>↵ Run</span><span>Esc Close</span></footer>
      </section>
    </div>
  );
}
