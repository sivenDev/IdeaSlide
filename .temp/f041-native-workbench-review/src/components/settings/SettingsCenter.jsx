import { Check, LoaderCircle, Monitor, Moon, Plus, RefreshCw, Sun, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { mockSettingsApi } from "../../mock/mockSettingsApi.js";
import { runtimeCatalog } from "../../mock/mockAgentRuntime.js";
import { ReviewScenariosSettings } from "./ReviewScenariosSettings.jsx";
import { SettingsSwitch } from "./SettingsSwitch.jsx";

const sectionGroups = [
  { label: "APPLICATION", items: [["general", "General"]] },
  { label: "AI", items: [["provider", "AI Provider"], ["agent", "Agent"], ["skills", "Skills"]] },
  { label: "EDITORS", items: [["ideasketch", "IdeaSketch"], ["markdown", "Markdown"]] },
  { label: "REVIEW", items: [["review", "Review Scenarios"]] },
];

function Field({ label, description, children }) {
  return <div className="settings-field"><div><strong>{label}</strong>{description && <small>{description}</small>}</div><div className="settings-field__control">{children}</div></div>;
}

function GeneralSettings({ draft, setDraft, onTheme }) {
  return (
    <section className="settings-section">
      <h2>Appearance</h2>
      <div className="theme-options">
        {[["light", Sun, "Light"], ["dark", Moon, "Dark"], ["system", Monitor, "System"]].map(([value, Icon, label]) => (
          <button key={value} className={draft.theme === value ? "is-selected" : ""} type="button" aria-pressed={draft.theme === value} onClick={() => { setDraft({ ...draft, theme: value }); onTheme(value); }}>
            <Icon size={16} /><strong>{label}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}

function ProviderSettings({ draft, setDraft }) {
  const [secret, setSecret] = useState("");
  const [testState, setTestState] = useState({ status: "idle", models: [], message: "" });
  const testSequence = useRef(0);
  const provider = draft.provider;
  const update = (patch) => setDraft({ ...draft, provider: { ...provider, ...patch } });
  const invalidate = (patch = {}) => {
    testSequence.current += 1;
    setTestState({ status: "idle", models: [], message: "" });
    update({ ...patch, model: "" });
  };
  const testProvider = async () => {
    const requestId = ++testSequence.current;
    setTestState({ status: "testing", models: [], message: "Testing…" });
    try {
      const result = await mockSettingsApi.testProvider({
        baseUrl: provider.baseUrl,
        token: secret,
        hasConfiguredCredential: provider.credentialConfigured,
      });
      if (requestId !== testSequence.current) return;
      const model = result.models.includes(provider.model) ? provider.model : result.models[0];
      update({ model, credentialConfigured: result.configured });
      setSecret("");
      setTestState({ status: "success", models: result.models, message: "Connection verified" });
    } catch (error) {
      if (requestId !== testSequence.current) return;
      setTestState({ status: "error", models: [], message: error.message });
      update({ model: "" });
    }
  };

  return (
    <section className="settings-section">
      <h2>Provider</h2>
      <Field label="Base URL"><input aria-label="Provider Base URL" value={provider.baseUrl} onChange={(event) => invalidate({ baseUrl: event.target.value })} /></Field>
      <Field label="Token"><input aria-label="Provider token" type="password" autoComplete="new-password" placeholder={provider.credentialConfigured ? "Configured token" : "Enter token"} value={secret} onChange={(event) => { setSecret(event.target.value); invalidate(); }} /></Field>
      <div className="provider-test-row">
        <button className="settings-test" type="button" disabled={testState.status === "testing" || !provider.baseUrl.trim() || (!secret.trim() && !provider.credentialConfigured)} onClick={testProvider}>
          {testState.status === "testing" && <LoaderCircle className="spin-icon" size={13} />}Test connection
        </button>
        {testState.status !== "idle" && <span className={`provider-test-status is-${testState.status}`} role="status">{testState.status === "success" && <Check size={12} />}{testState.message}</span>}
      </div>
      {testState.status === "success" && (
        <Field label="Model">
          <select aria-label="Provider model" value={provider.model} onChange={(event) => update({ model: event.target.value })}>
            {testState.models.map((model) => <option key={model} value={model}>{model}</option>)}
          </select>
        </Field>
      )}
      <Field label="Automatic retry"><SettingsSwitch label="Automatic retry" checked={provider.retryEnabled} onChange={(value) => update({ retryEnabled: value })} /></Field>
      <Field label="Maximum attempts"><input type="number" min="1" max="6" value={provider.maxAttempts} onChange={(event) => update({ maxAttempts: Math.max(1, Math.min(6, Number(event.target.value))) })} /></Field>
    </section>
  );
}

function AgentSettings({ draft, setDraft }) {
  const agent = draft.agent;
  const update = (patch) => setDraft({ ...draft, agent: { ...agent, ...patch } });
  const selectedId = agent.runtime === "compatibility" ? "compatibility" : "codex";
  return (
    <section className="settings-section">
      <h2>Agent</h2>
      <Field label="AI features"><SettingsSwitch label="Enable AI features" checked={draft.aiEnabled} onChange={(value) => setDraft({ ...draft, aiEnabled: value })} /></Field>
      <div className="runtime-list">
        {runtimeCatalog.map((runtime) => (
          <button type="button" aria-pressed={selectedId === runtime.id} className={`runtime-row ${selectedId === runtime.id ? "is-selected" : ""}`} key={runtime.id} onClick={() => update({ runtime: runtime.id === "codex" ? "automatic" : "compatibility" })}>
            <span className={`runtime-dot runtime-dot--${runtime.status}`} />
            <div><strong>{runtime.label}</strong><small>{runtime.capabilities.join(" · ")}</small></div>
            <span>{selectedId === runtime.id ? "Selected" : runtime.status}</span>
          </button>
        ))}
      </div>
      <Field label="Maximum Tool steps"><input type="number" min="2" max="40" value={agent.maxSteps} onChange={(event) => update({ maxSteps: Math.max(2, Math.min(40, Number(event.target.value))) })} /></Field>
      <Field label="New Thread warning"><input type="number" min="45" max="95" value={agent.exactContextWarning} onChange={(event) => update({ exactContextWarning: Math.max(45, Math.min(95, Number(event.target.value))) })} /></Field>
      <Field label="Answer delivery"><select value={agent.deliveryMode} onChange={(event) => update({ deliveryMode: event.target.value })}><option value="incremental">Incremental</option><option value="burst">Burst</option><option value="atomic">Atomic</option></select></Field>
      <Field label="Tool Activity"><SettingsSwitch label="Show Tool Activity" checked={agent.showToolActivity} onChange={(value) => update({ showToolActivity: value })} /></Field>
      <button className="settings-secondary" type="button" onClick={() => update({ runtime: "automatic", maxSteps: 12, exactContextWarning: 78, showToolActivity: true, deliveryMode: "incremental", diagnostics: 20, replayEvents: 200 })}><RefreshCw size={13} />Reset Agent policy</button>
    </section>
  );
}

function SkillSettings({ draft, setDraft }) {
  const [busy, setBusy] = useState(false);
  const updateSkill = (id, patch) => setDraft({ ...draft, skills: draft.skills.map((skill) => skill.id === id ? { ...skill, ...patch } : skill) });
  return (
    <section className="settings-section settings-section--wide">
      <h2>Skills</h2>
      <div className="skills-list">
        {draft.skills.map((skill) => (
          <div className={`skill-row ${skill.valid === false ? "is-invalid" : ""}`} key={skill.id}>
            <span className={`skill-source skill-source--${skill.source}`}>{skill.valid === false ? "invalid" : skill.source}</span>
            <div><strong>{skill.name}</strong><small className={skill.valid === false ? "text-danger" : ""}>{skill.error ?? skill.path ?? skill.scope}</small></div>
            <select aria-label={`Scope for ${skill.name}`} value={skill.scope} onChange={(event) => updateSkill(skill.id, { scope: event.target.value })} disabled={skill.valid === false}><option value="all">All editors</option><option value="ideasketch">IdeaSketch</option><option value="markdown">Markdown</option></select>
            {skill.source === "custom"
              ? <SettingsSwitch label={`Enable ${skill.name}`} checked={skill.enabled} disabled={skill.valid === false} onChange={(value) => updateSkill(skill.id, { enabled: value })} />
              : <span className="skill-always-on"><Check size={11} />Always on</span>}
            {skill.source === "custom" && <button className="skill-remove" type="button" aria-label={`Remove ${skill.name}`} onClick={() => setDraft({ ...draft, skills: draft.skills.filter((item) => item.id !== skill.id) })}><Trash2 size={14} /></button>}
          </div>
        ))}
      </div>
      <button className="settings-secondary" type="button" disabled={busy} onClick={async () => { setBusy(true); const skill = await mockSettingsApi.importSkill(); setDraft({ ...draft, skills: [...draft.skills, skill] }); setBusy(false); }}><Plus size={13} />Import mock Skill folder</button>
    </section>
  );
}

function IdeaSketchSettings({ draft, setDraft }) {
  return <section className="settings-section"><h2>Presentation</h2><Field label="Laser pointer"><SettingsSwitch label="Enable presentation laser" checked={draft.ideaSketch.laserEnabled} onChange={(value) => setDraft({ ...draft, ideaSketch: { ...draft.ideaSketch, laserEnabled: value } })} /></Field></section>;
}

function MarkdownSettings({ draft, setDraft }) {
  return <section className="settings-section"><h2>Markdown</h2><Field label="Line numbers"><SettingsSwitch label="Show Markdown line numbers" checked={draft.markdown.showLineNumbers} onChange={(value) => setDraft({ ...draft, markdown: { ...draft.markdown, showLineNumbers: value } })} /></Field></section>;
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
  return (
    <div className="dialog-backdrop">
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-header">
          <strong id="settings-title">Settings</strong>
          <div className="settings-header-actions">
            {status === "saved" && <span><Check size={12} />Saved</span>}
            {status === "error" && <span className="text-danger">Save failed</span>}
            <button className="settings-save" type="button" onClick={save} disabled={status === "saving"}>{status === "saving" ? "Saving…" : "Save changes"}</button>
            <button className="icon-button" type="button" onClick={onClose} aria-label="Close Settings"><X size={16} /></button>
          </div>
        </header>
        <div className="settings-layout">
          <nav className="settings-nav" aria-label="Settings categories">
            {sectionGroups.map((group) => (
              <div className="settings-nav-group" key={group.label}>
                <span>{group.label}</span>
                {group.items.map(([id, label]) => <button className={section === id ? "is-selected" : ""} type="button" key={id} onClick={() => setSection(id)}>{label}</button>)}
              </div>
            ))}
          </nav>
          <div className="settings-content">
            {section === "general" && <GeneralSettings draft={draft} setDraft={setDraft} onTheme={onTheme} />}
            {section === "provider" && <ProviderSettings draft={draft} setDraft={setDraft} />}
            {section === "agent" && <AgentSettings draft={draft} setDraft={setDraft} />}
            {section === "skills" && <SkillSettings draft={draft} setDraft={setDraft} />}
            {section === "ideasketch" && <IdeaSketchSettings draft={draft} setDraft={setDraft} />}
            {section === "markdown" && <MarkdownSettings draft={draft} setDraft={setDraft} />}
            {section === "review" && <ReviewScenariosSettings activeScenario={activeScenario} onScenario={async (id) => { const next = await onScenario(id); if (next) setDraft(structuredClone(next)); }} />}
          </div>
        </div>
      </section>
    </div>
  );
}
