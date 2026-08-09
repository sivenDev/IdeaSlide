import { useEffect, useMemo, useState } from "react";
import { useSettings } from "../../hooks/useSettings";
import { listAgentRuntimes } from "../../lib/agent/agentClient";
import { selectAgentRuntime } from "../../lib/agent/runtimeSelection";
import type { AgentRuntimeDescriptor } from "../../lib/agent/types";
import { SettingsField, SettingsToggle } from "./SettingsField";

export function AgentSettings() {
  const { settings, activationState, updateSettings } = useSettings();
  const [runtimes, setRuntimes] = useState<AgentRuntimeDescriptor[]>([]);
  const [runtimeDiagnostic, setRuntimeDiagnostic] = useState<string>();
  const runtimeSelection = useMemo(
    () => selectAgentRuntime(runtimes, { requiresEditorTools: true }),
    [runtimes],
  );
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window) || activationState === "disabled") return;
    let active = true;
    listAgentRuntimes()
      .then((descriptors) => {
        if (!active) return;
        setRuntimes(descriptors);
        setRuntimeDiagnostic(undefined);
      })
      .catch((cause) => {
        if (active) setRuntimeDiagnostic(cause instanceof Error ? cause.message : String(cause));
      });
    return () => { active = false; };
  }, [activationState]);
  const status = activationState === "ready"
    ? "Ready"
    : activationState === "configuration-required"
      ? "Provider configuration required"
      : activationState === "disabled"
        ? "Disabled"
        : "Loading settings";

  return (
    <section aria-labelledby="settings-agent-title">
      <h2 id="settings-agent-title" className="ideanote-settings-title">Agent</h2>
      <p className="ideanote-settings-lead">The Agent is application-wide. Editors contribute their own Skills and Tools.</p>
      <div className={`ideanote-settings-status is-${activationState}`}>
        <span className="ideanote-settings-status__dot" />
        <span>{status}</span>
      </div>
      <SettingsField
        title="Enable AI"
        description="Enabled by default. When off, IdeaNote does not mount the Agent, initialize its runtime, load Skills or Tools, or call a model."
      >
        <SettingsToggle
          label="Enable AI"
          checked={settings.ai.enabled}
          onChange={(enabled) => void updateSettings((current) => ({
            ...current,
            ai: { ...current.ai, enabled },
          }))}
        />
      </SettingsField>
      <SettingsField
        title="Runtime selection"
        description="IdeaNote automatically uses the pinned Codex app-server when it passes compatibility and editor Tool safety checks, then falls back to the configured OpenAI-compatible provider."
      >
        <div className="ideanote-settings-readout" role="status">
          <strong>{runtimeSelection.descriptor?.label ?? "Automatic selection"}</strong>
          <span>{runtimeDiagnostic ?? (runtimes.length > 0
            ? runtimeSelection.reason
            : "Runtime availability is checked by the desktop app.")}</span>
        </div>
      </SettingsField>
      <SettingsField title="Maximum steps" description="Bound each Agent run to prevent unbounded Tool activity.">
        <input
          type="number"
          min={1}
          max={20}
          aria-label="Maximum Agent steps"
          className="ideanote-settings-control w-20"
          value={settings.agent.maxSteps}
          onChange={(event) => void updateSettings((current) => ({
            ...current,
            agent: { ...current.agent, maxSteps: Number(event.target.value) },
          }))}
        />
      </SettingsField>
      <SettingsField title="Show Tool Activity" description="Display editor Tool calls and results in the Agent panel.">
        <SettingsToggle
          label="Show Tool Activity"
          checked={settings.agent.showToolActivity}
          onChange={(showToolActivity) => void updateSettings((current) => ({
            ...current,
            agent: { ...current.agent, showToolActivity },
          }))}
        />
      </SettingsField>
    </section>
  );
}
