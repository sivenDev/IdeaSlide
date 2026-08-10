import { useEffect, useMemo, useState } from "react";
import { useSettings } from "../../hooks/useSettings";
import { listAgentRuntimes } from "../../lib/agent/agentClient";
import { selectAgentRuntime } from "../../lib/agent/runtimeSelection";
import type { AgentRuntimeDescriptor } from "../../lib/agent/types";
import { DEFAULT_SETTINGS, type AppSettings } from "../../lib/settings";
import { SettingsField, SettingsToggle } from "./SettingsField";
import { AgentSkillManager } from "./AgentSkillManager";

function AgentNumberInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      aria-label={label}
      className="ideanote-settings-control w-20"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

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
  const updateAgent = (change: Partial<AppSettings["agent"]>) => void updateSettings((current) => ({
    ...current,
    agent: { ...current.agent, ...change },
  }));

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
        <AgentNumberInput
          label="Maximum Agent steps"
          value={settings.agent.maxSteps}
          min={1}
          max={20}
          onChange={(maxSteps) => updateAgent({ maxSteps })}
        />
      </SettingsField>
      <SettingsField
        title="Context warning"
        description="Show an approaching-limit state only when the runtime supplies an exact context window. Range: 50–90%."
      >
        <AgentNumberInput
          label="Context warning percent"
          value={settings.agent.contextWarningPercent}
          min={50}
          max={90}
          onChange={(contextWarningPercent) => updateAgent({ contextWarningPercent })}
        />
      </SettingsField>
      <SettingsField
        title="New Thread recommendation"
        description="Recommend a new Thread at this exact context percentage. It is always normalized above the warning threshold. Range: 60–100%."
      >
        <AgentNumberInput
          label="New Thread recommendation percent"
          value={settings.agent.newThreadPercent}
          min={60}
          max={100}
          onChange={(newThreadPercent) => updateAgent({ newThreadPercent })}
        />
      </SettingsField>
      <SettingsField
        title="Runtime diagnostics retained"
        description="Keep this many safe, classified diagnostics per Thread. Credentials and raw provider payloads are never retained. Range: 5–100."
      >
        <AgentNumberInput
          label="Runtime diagnostics retained"
          value={settings.agent.diagnosticRetention}
          min={5}
          max={100}
          onChange={(diagnosticRetention) => updateAgent({ diagnosticRetention })}
        />
      </SettingsField>
      <SettingsField
        title="Compatibility replay messages"
        description="Limit how many settled messages are sent with a Compatibility request. This is not a model context-window setting. Range: 10–200."
      >
        <AgentNumberInput
          label="Compatibility replay message limit"
          value={settings.agent.compatibilityReplayMessageLimit}
          min={10}
          max={200}
          onChange={(compatibilityReplayMessageLimit) => updateAgent({ compatibilityReplayMessageLimit })}
        />
      </SettingsField>
      <SettingsField title="Show source delivery" description="Show exact delivery timing and stream behavior in the Runtime Inspector.">
        <SettingsToggle
          label="Show source delivery telemetry"
          checked={settings.agent.showDeliveryTelemetry}
          onChange={(showDeliveryTelemetry) => updateAgent({ showDeliveryTelemetry })}
        />
      </SettingsField>
      <SettingsField title="Show Tool Activity" description="Display editor Tool calls and results in the Agent panel.">
        <SettingsToggle
          label="Show Tool Activity"
          checked={settings.agent.showToolActivity}
          onChange={(showToolActivity) => updateAgent({ showToolActivity })}
        />
      </SettingsField>
      <SettingsField title="Custom Skills" description="Import and manage standard instruction-only Skill folders. Managed Skills cannot add Tools, scripts, MCP, or system permissions.">
        <AgentSkillManager activationState={activationState} />
      </SettingsField>
      <SettingsField title="Reset Agent policy" description="Restore the maximum-step, context, diagnostics, replay, and delivery-visibility defaults.">
        <button
          type="button"
          className="ideanote-settings-button"
          onClick={() => updateAgent({
            maxSteps: DEFAULT_SETTINGS.agent.maxSteps,
            contextWarningPercent: DEFAULT_SETTINGS.agent.contextWarningPercent,
            newThreadPercent: DEFAULT_SETTINGS.agent.newThreadPercent,
            diagnosticRetention: DEFAULT_SETTINGS.agent.diagnosticRetention,
            compatibilityReplayMessageLimit: DEFAULT_SETTINGS.agent.compatibilityReplayMessageLimit,
            showDeliveryTelemetry: DEFAULT_SETTINGS.agent.showDeliveryTelemetry,
          })}
        >
          Reset policy
        </button>
      </SettingsField>
    </section>
  );
}
