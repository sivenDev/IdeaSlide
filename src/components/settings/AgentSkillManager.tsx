import { ask, open } from "@tauri-apps/plugin-dialog";
import { Check, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  discoverAgentSkills,
  importAgentSkill,
  removeAgentSkill,
  updateAgentSkill,
} from "../../lib/agent/agentClient";
import type { AgentSkillMetadata } from "../../lib/agent/types";
import { getOpenableFileTypeDefinitions } from "../../lib/fileTypeRegistry";
import type { AgentActivationState } from "../../lib/settings";
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
  const scopeOptions = useMemo(() => getOpenableFileTypeDefinitions().map((definition) => ({
    value: definition.type,
    label: definition.displayName,
  })), []);

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
      {activationState === "disabled" && (
        <p className="sr-only">AI is disabled. Stored Skills remain available to manage.</p>
      )}
      {message && <p className="ideanote-agent-skill-manager__error" role="alert">{message}</p>}

      <div className="ideanote-skills-list" aria-label="Agent Skills">
        {bundled.map((skill) => (
          <div key={skill.id} className="ideanote-skill-row">
            <span className="ideanote-skill-source">bundled</span>
            <div className="ideanote-skill-copy">
              <strong>{skill.name}</strong>
              <small>{skill.editorScopes[0] ?? "all"}</small>
            </div>
            <select aria-label={`Scope for ${skill.name}`} value={skill.editorScopes[0] ?? ""} disabled>
              <option value="">All editors</option>
              {scopeOptions.map((scope) => <option key={scope.value} value={scope.value}>{scope.label}</option>)}
            </select>
            <span className="skill-always-on"><Check aria-hidden size={11} />Always on</span>
            <span aria-hidden />
          </div>
        ))}
        {custom.map((skill) => {
          const busy = busyId === skill.id;
          return (
            <div key={skill.id} className={`ideanote-skill-row ${skill.valid ? "" : "is-invalid"}`}>
              <button
                type="button"
                className="ideanote-skill-source is-custom"
                aria-label={`Refresh ${skill.name}`}
                title={`Refresh ${skill.name}`}
                onClick={() => void chooseAndImport(skill.id)}
                disabled={Boolean(busyId)}
              >
                {skill.valid ? "custom" : "invalid"}
              </button>
              <div className="ideanote-skill-copy">
                <strong>{skill.name}</strong>
                <small className={skill.valid ? "" : "is-danger"} title={skill.valid ? skill.sourceLabel : skill.validationMessage}>
                  {skill.valid ? skill.sourceLabel : skill.validationMessage ?? "Invalid Skill"}
                </small>
              </div>
              <select
                aria-label={`Scope for ${skill.name}`}
                value={skill.editorScopes.length === 1 ? skill.editorScopes[0] : ""}
                disabled={busy || !skill.valid}
                onChange={(event) => void update(skill, { editorScopes: event.target.value ? [event.target.value] : [] })}
              >
                <option value="">All editors</option>
                {scopeOptions.map((scope) => <option key={scope.value} value={scope.value}>{scope.label}</option>)}
              </select>
              <SettingsSwitch
                label={`Enable ${skill.name}`}
                checked={skill.enabled}
                disabled={busy || !skill.valid}
                onCheckedChange={(enabled) => void update(skill, { enabled })}
              />
              <button
                type="button"
                className="ideanote-skill-remove"
                aria-label={`Remove ${skill.name}`}
                title={`Remove ${skill.name}`}
                onClick={() => void remove(skill)}
                disabled={Boolean(busyId)}
              >
                <Trash2 aria-hidden size={14} />
              </button>
            </div>
          );
        })}
      </div>
      <button type="button" className="ideanote-settings-button ideanote-skill-import" onClick={() => void chooseAndImport()} disabled={Boolean(busyId)}>
        <Plus aria-hidden size={13} /> Import Skill folder
      </button>
    </div>
  );
}
