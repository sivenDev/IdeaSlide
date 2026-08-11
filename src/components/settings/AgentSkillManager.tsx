import { ask, open } from "@tauri-apps/plugin-dialog";
import { FolderPlus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  discoverAgentSkills,
  importAgentSkill,
  removeAgentSkill,
  updateAgentSkill,
} from "../../lib/agent/agentClient";
import type { AgentSkillMetadata } from "../../lib/agent/types";
import type { AgentActivationState } from "../../lib/settings";
import { SettingsCheckbox } from "./SettingsCheckbox";
import { SettingsSwitch } from "./SettingsSwitch";

function desktopRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export function AgentSkillManager({ activationState }: { activationState: AgentActivationState }) {
  const [skills, setSkills] = useState<AgentSkillMetadata[]>([]);
  const [busyId, setBusyId] = useState<string>();
  const [message, setMessage] = useState<string>();
  const bundled = useMemo(() => skills.filter((skill) => skill.origin === "bundled"), [skills]);
  const custom = useMemo(() => skills.filter((skill) => skill.origin === "custom"), [skills]);

  const refresh = useCallback(async () => {
    if (!desktopRuntime()) return;
    try {
      setSkills(await discoverAgentSkills());
      setMessage(undefined);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const chooseAndImport = async (replaceId?: string) => {
    const sourcePath = await open({ directory: true, multiple: false, title: replaceId ? "Refresh managed Skill" : "Import Agent Skill" });
    if (typeof sourcePath !== "string") return;
    setBusyId(replaceId ?? "import");
    try {
      await importAgentSkill(sourcePath, replaceId);
      await refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(undefined);
    }
  };

  const update = async (
    skill: AgentSkillMetadata,
    change: Partial<Pick<AgentSkillMetadata, "enabled" | "implicitInvocation" | "editorScopes">>,
  ) => {
    setBusyId(skill.id);
    try {
      const updated = await updateAgentSkill(skill.id, {
        enabled: change.enabled ?? skill.enabled,
        implicitInvocation: change.implicitInvocation ?? skill.implicitInvocation,
        editorScopes: change.editorScopes ?? skill.editorScopes,
      });
      setSkills((current) => current.map((candidate) => candidate.id === updated.id ? updated : candidate));
      setMessage(undefined);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(undefined);
    }
  };

  const remove = async (skill: AgentSkillMetadata) => {
    if (!await ask(`Remove the managed copy of “${skill.name}”? The original import folder is not changed.`, {
      title: "Remove custom Skill",
      kind: "warning",
      okLabel: "Remove",
      cancelLabel: "Cancel",
    })) return;
    setBusyId(skill.id);
    try {
      await removeAgentSkill(skill.id);
      await refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(undefined);
    }
  };

  if (!desktopRuntime()) {
    return <p className="ideanote-agent-skill-manager__empty">Custom Skills are managed by the IdeaNote desktop app.</p>;
  }

  return (
    <div className="ideanote-agent-skill-manager">
      <div className="ideanote-agent-skill-manager__header">
        <div>
          <strong>Managed Skills</strong>
          <span>Instruction-only Skills use existing editor Tools and permissions.</span>
        </div>
        <button type="button" className="ideanote-settings-button" onClick={() => void chooseAndImport()} disabled={Boolean(busyId)}>
          <FolderPlus aria-hidden size={13} /> Import folder
        </button>
      </div>
      {activationState === "disabled" && (
        <p className="ideanote-agent-skill-manager__notice">AI is disabled. You can manage stored Skills here, but Turn discovery, activation, references, and model injection remain off.</p>
      )}
      {message && <p className="ideanote-agent-skill-manager__error" role="alert">{message}</p>}

      <section aria-label="Bundled editor Skills">
        <h3>Bundled editor Skills</h3>
        {bundled.map((skill) => (
          <article key={skill.id} className="ideanote-agent-skill-card is-bundled">
            <div><strong>{skill.name}</strong><span>{skill.description}</span></div>
            <small>Mandatory for {skill.editorScopes.join(", ")} · {skill.resources.length} reference{skill.resources.length === 1 ? "" : "s"}</small>
          </article>
        ))}
      </section>

      <section aria-label="Custom Agent Skills">
        <h3>Custom Skills</h3>
        {custom.length === 0 ? (
          <p className="ideanote-agent-skill-manager__empty">No custom Skills imported.</p>
        ) : custom.map((skill) => {
          const busy = busyId === skill.id;
          return (
            <article key={skill.id} className={`ideanote-agent-skill-card ${skill.valid ? "is-valid" : "is-invalid"}`}>
              <div className="ideanote-agent-skill-card__title">
                <div><strong>{skill.name}</strong><span>{skill.description}</span></div>
                <SettingsSwitch label={`Enable ${skill.name}`} checked={skill.enabled} disabled={busy || !skill.valid} onCheckedChange={(enabled) => void update(skill, { enabled })} />
              </div>
              <dl>
                <div><dt>Source</dt><dd>{skill.sourceLabel}</dd></div>
                <div><dt>Version</dt><dd title={skill.digest}>{skill.digest ? skill.digest.slice(0, 12) : "Invalid"}</dd></div>
                <div><dt>References</dt><dd>{skill.resources.length}</dd></div>
                <div><dt>Status</dt><dd>{skill.valid ? "Valid" : skill.validationMessage ?? "Invalid"}</dd></div>
              </dl>
              <label className="ideanote-agent-skill-card__implicit">
                <SettingsCheckbox
                  label={`Allow ${skill.name} to activate autonomously`}
                  checked={skill.implicitInvocation}
                  disabled={busy || !skill.enabled || !skill.valid}
                  onCheckedChange={(implicitInvocation) => void update(skill, { implicitInvocation })}
                />
                Allow the Agent to activate this Skill autonomously
              </label>
              <fieldset disabled={busy || !skill.valid}>
                <legend>Compatible editor Skills</legend>
                <label>
                  <SettingsCheckbox
                    label={`Use ${skill.name} with all supported editors`}
                    checked={skill.editorScopes.length === 0}
                    disabled={bundled.length === 0}
                    onCheckedChange={(checked) => void update(skill, {
                      editorScopes: checked ? [] : bundled.slice(0, 1).map((item) => item.id),
                    })}
                  />
                  All supported editors
                </label>
                {bundled.map((editor) => (
                  <label key={editor.id}>
                    <SettingsCheckbox
                      label={`Use ${skill.name} with ${editor.name}`}
                      checked={skill.editorScopes.includes(editor.id)}
                      disabled={skill.editorScopes.length === 0 || busy || (
                        skill.editorScopes.length === 1 && skill.editorScopes[0] === editor.id
                      )}
                      title={skill.editorScopes.length === 1 && skill.editorScopes[0] === editor.id
                        ? "Select another editor or All supported editors before removing this scope."
                        : undefined}
                      onCheckedChange={(checked) => void update(skill, {
                        editorScopes: checked
                          ? [...skill.editorScopes, editor.id]
                          : skill.editorScopes.filter((scope) => scope !== editor.id),
                      })}
                    />
                    {editor.name}
                  </label>
                ))}
              </fieldset>
              <div className="ideanote-agent-skill-card__actions">
                <button type="button" onClick={() => void chooseAndImport(skill.id)} disabled={Boolean(busyId)}><RefreshCw aria-hidden size={12} /> Refresh</button>
                <button type="button" className="is-danger" onClick={() => void remove(skill)} disabled={Boolean(busyId)}><Trash2 aria-hidden size={12} /> Remove</button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
