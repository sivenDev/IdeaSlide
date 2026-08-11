import { Bot, Monitor, Moon, Sun, X } from "lucide-react";
import { useState } from "react";

export function SettingsCenter({ theme, onTheme, onClose }) {
  const [section, setSection] = useState("general");
  return (
    <div className="dialog-backdrop">
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-header"><div><strong id="settings-title">Settings</strong><small>Application preferences · mock review</small></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close Settings"><X size={16} /></button></header>
        <div className="settings-layout">
          <nav className="settings-nav" aria-label="Settings categories">
            <button className={section === "general" ? "is-selected" : ""} type="button" onClick={() => setSection("general")}>General</button>
            <button className={section === "agent" ? "is-selected" : ""} type="button" onClick={() => setSection("agent")}>Agent</button>
          </nav>
          <div className="settings-content">
            {section === "general" ? <section className="settings-section"><span className="settings-kicker">General</span><h2>Appearance</h2><p>Choose how application-owned surfaces appear.</p><div className="theme-options">{[
              ["light", Sun, "Light", "Bright native surfaces"],
              ["dark", Moon, "Dark", "Low-light workspace"],
              ["system", Monitor, "System", "Follow this computer"],
            ].map(([value, Icon, label, copy]) => <button key={value} className={theme === value ? "is-selected" : ""} type="button" aria-pressed={theme === value} onClick={() => onTheme(value)}><Icon size={16} /><span><strong>{label}</strong><small>{copy}</small></span></button>)}</div><div className="settings-fact"><span>Storage</span><strong>Browser-only mock state</strong></div></section>
              : <section className="settings-section"><span className="settings-kicker">Agent</span><h2>Reserved runtime surface</h2><p>F044-03 replaces this placeholder with Provider, Runtime, policy and Skill settings.</p><div className="settings-callout"><Bot size={18} /><span><strong>No real model is connected</strong><small>The review never sends prompts or credentials to a network service.</small></span></div></section>}
          </div>
        </div>
      </section>
    </div>
  );
}
