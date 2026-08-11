import { Bot, Check, Eye, EyeOff, KeyRound, Monitor, Moon, Plus, RefreshCw, ShieldCheck, Sparkles, Sun, Trash2, X } from "lucide-react";
import { useState } from "react";
import { mockSettingsApi } from "../../mock/mockSettingsApi.js";
import { runtimeCatalog } from "../../mock/mockAgentRuntime.js";
import { ReviewScenariosSettings } from "./ReviewScenariosSettings.jsx";

const sections = [
  ["general", "General"],
  ["provider", "AI Provider"],
  ["agent", "Agent"],
  ["skills", "Skills"],
  ["ideasketch", "IdeaSketch"],
  ["review", "Review Scenarios"],
];

function Toggle({ checked, onChange, label }) {
  return <button className={`settings-toggle ${checked ? "is-on" : ""}`} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><span /></button>;
}

function Field({ label, description, children }) {
  return <div className="settings-field"><div><strong>{label}</strong>{description && <small>{description}</small>}</div><div className="settings-field__control">{children}</div></div>;
}

function GeneralSettings({ draft, setDraft, onTheme }) {
  return <section className="settings-section"><span className="settings-kicker">General</span><h2>Application</h2><p>Control application-owned surfaces and global availability.</p><div className="theme-options">{[
    ["light", Sun, "Light", "Bright native surfaces"], ["dark", Moon, "Dark", "Low-light workspace"], ["system", Monitor, "System", "Follow this computer"],
  ].map(([value, Icon, label, copy]) => <button key={value} className={draft.theme === value ? "is-selected" : ""} type="button" aria-pressed={draft.theme === value} onClick={() => { setDraft({ ...draft, theme: value }); onTheme(value); }}><Icon size={16} /><span><strong>{label}</strong><small>{copy}</small></span></button>)}</div><Field label="AI features" description="Hide Agent UI and stop all mock Agent activity."><Toggle label="Enable AI features" checked={draft.aiEnabled} onChange={(value) => setDraft({ ...draft, aiEnabled: value })} /></Field><Field label="Storage boundary" description="Review preferences use namespaced browser storage."><span className="settings-value">Mock only</span></Field></section>;
}

function ProviderSettings({ draft, setDraft }) {
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const provider = draft.provider;
  const update = (patch) => setDraft({ ...draft, provider: { ...provider, ...patch } });
  return <section className="settings-section"><span className="settings-kicker">AI Provider</span><h2>OpenAI-compatible provider</h2><p>The review validates settings behavior without sending network requests or retaining a credential value.</p><Field label="Base URL"><input value={provider.baseUrl} onChange={(event) => update({ baseUrl: event.target.value })} /></Field><Field label="Model"><input value={provider.model} onChange={(event) => update({ model: event.target.value })} /></Field><Field label="Automatic retry"><Toggle label="Automatic retry" checked={provider.retryEnabled} onChange={(value) => update({ retryEnabled: value })} /></Field><Field label="Maximum attempts"><input type="number" min="1" max="6" value={provider.maxAttempts} onChange={(event) => update({ maxAttempts: Math.max(1, Math.min(6, Number(event.target.value))) })} /></Field><div className="credential-card"><div className="credential-status"><span className={provider.credentialConfigured ? "is-ready" : ""}><KeyRound size={15} /></span><div><strong>{provider.credentialConfigured ? "Credential configured" : "Credential required"}</strong><small>A saved value is never returned to this UI.</small></div></div><div className="credential-entry"><input type={showSecret ? "text" : "password"} placeholder={provider.credentialConfigured ? "Enter replacement mock key" : "Enter a mock key"} value={secret} onChange={(event) => setSecret(event.target.value)} /><button type="button" onClick={() => setShowSecret((value) => !value)} aria-label={showSecret ? "Hide credential" : "Show credential"}>{showSecret ? <EyeOff size={14} /> : <Eye size={14} />}</button><button type="button" disabled={busy || !secret.trim()} onClick={async () => { setBusy(true); await mockSettingsApi.setCredential(secret); update({ credentialConfigured: true }); setSecret(""); setBusy(false); }}>Save</button></div>{provider.credentialConfigured && <button className="text-danger" type="button" onClick={async () => { await mockSettingsApi.deleteCredential(); update({ credentialConfigured: false }); }}>Remove configured credential</button>}</div></section>;
}

function AgentSettings({ draft, setDraft }) {
  const agent = draft.agent;
  const update = (patch) => setDraft({ ...draft, agent: { ...agent, ...patch } });
  const selectedId = agent.runtime === "compatibility" ? "compatibility" : "codex";
  return <section className="settings-section"><span className="settings-kicker">Agent</span><h2>Runtime and policy</h2><p>Automatic selection prefers the healthy mock Codex runtime. Compatibility mode exposes its smaller Tool surface honestly.</p><div className="runtime-list">{runtimeCatalog.map((runtime) => <button type="button" aria-pressed={selectedId === runtime.id} className={`runtime-row ${selectedId === runtime.id ? "is-selected" : ""}`} key={runtime.id} onClick={() => update({ runtime: runtime.id === "codex" ? "automatic" : "compatibility" })}><span className={`runtime-dot runtime-dot--${runtime.status}`} /><div><strong>{runtime.label}</strong><small>{runtime.capabilities.join(" · ")}</small></div><span>{selectedId === runtime.id ? "Selected" : runtime.status}</span></button>)}</div><Field label="Maximum Tool steps"><input type="number" min="2" max="40" value={agent.maxSteps} onChange={(event) => update({ maxSteps: Math.max(2, Math.min(40, Number(event.target.value))) })} /></Field><Field label="New Thread warning" description="Recommend a fresh Thread after this context percentage."><input type="number" min="45" max="95" value={agent.exactContextWarning} onChange={(event) => update({ exactContextWarning: Math.max(45, Math.min(95, Number(event.target.value))) })} /></Field><Field label="Answer delivery"><select value={agent.deliveryMode} onChange={(event) => update({ deliveryMode: event.target.value })}><option value="incremental">Incremental</option><option value="burst">Burst</option><option value="atomic">Atomic</option></select></Field><Field label="Tool Activity"><Toggle label="Show Tool Activity" checked={agent.showToolActivity} onChange={(value) => update({ showToolActivity: value })} /></Field><button className="settings-secondary" type="button" onClick={() => update({ runtime: "automatic", maxSteps: 12, exactContextWarning: 78, showToolActivity: true, deliveryMode: "incremental", diagnostics: 20, replayEvents: 200 })}><RefreshCw size={13} />Reset Agent policy</button></section>;
}

function SkillSettings({ draft, setDraft }) {
  const [busy, setBusy] = useState(false);
  const updateSkill = (id, patch) => setDraft({ ...draft, skills: draft.skills.map((skill) => skill.id === id ? { ...skill, ...patch } : skill) });
  return <section className="settings-section settings-section--wide"><span className="settings-kicker">Skills</span><h2>Managed Agent Skills</h2><p>Skills provide instructions and selection metadata. They cannot widen editor Tool capabilities.</p><div className="skills-list">{draft.skills.map((skill) => <div className={`skill-row ${skill.valid === false ? "is-invalid" : ""}`} key={skill.id}><span className={`skill-source skill-source--${skill.source}`}>{skill.valid === false ? "invalid" : skill.source}</span><div><strong>{skill.name}</strong><small className={skill.valid === false ? "text-danger" : ""}>{skill.error ?? skill.path ?? `Built into ${skill.scope === "all" ? "the application" : skill.scope}`}</small></div><select aria-label={`Scope for ${skill.name}`} value={skill.scope} onChange={(event) => updateSkill(skill.id, { scope: event.target.value })} disabled={skill.valid === false}><option value="all">All editors</option><option value="ideasketch">IdeaSketch</option><option value="markdown">Markdown</option></select><Toggle label={`Enable ${skill.name}`} checked={skill.enabled} onChange={(value) => updateSkill(skill.id, { enabled: value })} />{skill.source === "custom" && <button type="button" aria-label={`Remove ${skill.name}`} onClick={() => setDraft({ ...draft, skills: draft.skills.filter((item) => item.id !== skill.id) })}><Trash2 size={14} /></button>}</div>)}</div><button className="settings-secondary" type="button" disabled={busy} onClick={async () => { setBusy(true); const skill = await mockSettingsApi.importSkill(); setDraft({ ...draft, skills: [...draft.skills, skill] }); setBusy(false); }}><Plus size={13} />Import mock Skill folder</button><div className="settings-callout"><ShieldCheck size={18} /><span><strong>Validation is simulated</strong><small>Invalid imports stay disabled and show the exact validation issue.</small></span></div></section>;
}

function IdeaSketchSettings({ draft, setDraft }) {
  return <section className="settings-section"><span className="settings-kicker">IdeaSketch</span><h2>Presentation</h2><p>Editor-contributed settings stay registered inside the shared Settings Center.</p><Field label="Laser pointer" description="Show a bounded fading pointer trail during Preview."><Toggle label="Enable presentation laser" checked={draft.ideaSketch.laserEnabled} onChange={(value) => setDraft({ ...draft, ideaSketch: { ...draft.ideaSketch, laserEnabled: value } })} /></Field><div className="settings-callout"><Sparkles size={18} /><span><strong>Editor-owned behavior</strong><small>This preference changes presentation only and never modifies the document.</small></span></div></section>;
}

export function SettingsCenter({ settings, onSettings, onTheme, onClose, activeScenario = "normal", onScenario }) {
  const [section, setSection] = useState("general");
  const [draft, setDraft] = useState(() => structuredClone(settings));
  const [status, setStatus] = useState("idle");
  const save = async () => {
    setStatus("saving");
    try { const saved = await mockSettingsApi.save(draft); onSettings(saved); setStatus("saved"); window.setTimeout(() => setStatus("idle"), 1100); }
    catch { setStatus("error"); }
  };
  return <div className="dialog-backdrop"><section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title"><header className="settings-header"><div><strong id="settings-title">Settings</strong><small>Application preferences · deterministic mock</small></div><div className="settings-header-actions">{status === "saved" && <span><Check size={12} />Saved</span>}{status === "error" && <span className="text-danger">Save failed</span>}<button className="settings-save" type="button" onClick={save} disabled={status === "saving"}>{status === "saving" ? "Saving…" : "Save changes"}</button><button className="icon-button" type="button" onClick={onClose} aria-label="Close Settings"><X size={16} /></button></div></header><div className="settings-layout"><nav className="settings-nav" aria-label="Settings categories">{sections.map(([id, label]) => <button className={section === id ? "is-selected" : ""} type="button" key={id} onClick={() => setSection(id)}>{label}</button>)}</nav><div className="settings-content">{section === "general" && <GeneralSettings draft={draft} setDraft={setDraft} onTheme={onTheme} />}{section === "provider" && <ProviderSettings draft={draft} setDraft={setDraft} />}{section === "agent" && <AgentSettings draft={draft} setDraft={setDraft} />}{section === "skills" && <SkillSettings draft={draft} setDraft={setDraft} />}{section === "ideasketch" && <IdeaSketchSettings draft={draft} setDraft={setDraft} />}{section === "review" && <ReviewScenariosSettings activeScenario={activeScenario} onScenario={async (id) => { const next = await onScenario(id); if (next) setDraft(structuredClone(next)); }} />}</div></div></section></div>;
}
