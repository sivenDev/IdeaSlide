import { useEffect, useMemo, useState } from "react";
import { useSettingsDraft } from "../../hooks/useSettings";
import { listAgentRuntimes } from "../../lib/agent/agentClient";
import { selectAgentRuntime } from "../../lib/agent/runtimeSelection";
import type { AgentRuntimeDescriptor } from "../../lib/agent/types";
import { DEFAULT_SETTINGS, type AppSettings } from "../../lib/settings";
import { SettingsField } from "./SettingsField";
import { SettingsSwitch } from "./SettingsSwitch";

function AgentNumberInput({
  label,
  value,
  min,
  max,
  onChange,
  onBlur,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onBlur: () => void;
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
      onBlur={onBlur}
    />
  );
}

export function AgentSettings() {
  const { settings, activationState, updateSettings, flush } = useSettingsDraft();
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
  const updateAgent = (change: Partial<AppSettings["agent"]>) => updateSettings((current) => ({
    ...current,
    agent: { ...current.agent, ...change },
  }), { persistence: "debounced" }).catch(() => undefined);

  return (
    <section className="ideanote-settings-section ideanote-settings-section--wide" aria-label="Agent settings">
      <div className={`ideanote-settings-status is-${activationState}`}>
        <span className="ideanote-settings-status__dot" />
        <span>{status}</span>
      </div>
      <SettingsField title="Enable AI">
        <SettingsSwitch
          label="Enable AI"
          checked={settings.ai.enabled}
          onCheckedChange={(enabled) => { void updateSettings((current) => ({
            ...current,
            ai: { ...current.ai, enabled },
          })).catch(() => undefined); }}
        />
      </SettingsField>
      <SettingsField title="Runtime selection">
        <div className="ideanote-settings-readout" role="status">
          <strong>{runtimeSelection.descriptor?.label ?? "Automatic selection"}</strong>
          {runtimeDiagnostic && <span>{runtimeDiagnostic}</span>}
        </div>
      </SettingsField>
      <SettingsField title="Maximum steps">
        <AgentNumberInput
          label="Maximum Agent steps"
          value={settings.agent.maxSteps}
          min={1}
          max={20}
          onChange={(maxSteps) => updateAgent({ maxSteps })}
          onBlur={() => { void flush().catch(() => undefined); }}
        />
      </SettingsField>
      <SettingsField
        title="Context warning"
        description="50–90%"
      >
        <AgentNumberInput
          label="Context warning percent"
          value={settings.agent.contextWarningPercent}
          min={50}
          max={90}
          onChange={(contextWarningPercent) => updateAgent({ contextWarningPercent })}
          onBlur={() => { void flush().catch(() => undefined); }}
        />
      </SettingsField>
      <SettingsField
        title="New thread recommendation"
        description="60–100%, above the warning threshold"
      >
        <AgentNumberInput
          label="New Thread recommendation percent"
          value={settings.agent.newThreadPercent}
          min={60}
          max={100}
          onChange={(newThreadPercent) => updateAgent({ newThreadPercent })}
          onBlur={() => { void flush().catch(() => undefined); }}
        />
      </SettingsField>
      <SettingsField
        title="Runtime diagnostics retained"
        description="5–100 per conversation"
      >
        <AgentNumberInput
          label="Runtime diagnostics retained"
          value={settings.agent.diagnosticRetention}
          min={5}
          max={100}
          onChange={(diagnosticRetention) => updateAgent({ diagnosticRetention })}
          onBlur={() => { void flush().catch(() => undefined); }}
        />
      </SettingsField>
      <SettingsField
        title="Compatibility replay messages"
        description="10–200 messages"
      >
        <AgentNumberInput
          label="Compatibility replay message limit"
          value={settings.agent.compatibilityReplayMessageLimit}
          min={10}
          max={200}
          onChange={(compatibilityReplayMessageLimit) => updateAgent({ compatibilityReplayMessageLimit })}
          onBlur={() => { void flush().catch(() => undefined); }}
        />
      </SettingsField>
      <SettingsField title="Show source delivery">
        <SettingsSwitch
          label="Show source delivery telemetry"
          checked={settings.agent.showDeliveryTelemetry}
          onCheckedChange={(showDeliveryTelemetry) => { void updateSettings((current) => ({ ...current, agent: { ...current.agent, showDeliveryTelemetry } })).catch(() => undefined); }}
        />
      </SettingsField>
      <SettingsField title="Show Tool Activity">
        <SettingsSwitch
          label="Show Tool Activity"
          checked={settings.agent.showToolActivity}
          onCheckedChange={(showToolActivity) => { void updateSettings((current) => ({ ...current, agent: { ...current.agent, showToolActivity } })).catch(() => undefined); }}
        />
      </SettingsField>
      <SettingsField title="Reset policy">
        <button
          type="button"
          className="ideanote-settings-button"
          onClick={() => { void updateSettings((current) => ({ ...current, agent: { ...current.agent,
            maxSteps: DEFAULT_SETTINGS.agent.maxSteps,
            contextWarningPercent: DEFAULT_SETTINGS.agent.contextWarningPercent,
            newThreadPercent: DEFAULT_SETTINGS.agent.newThreadPercent,
            diagnosticRetention: DEFAULT_SETTINGS.agent.diagnosticRetention,
            compatibilityReplayMessageLimit: DEFAULT_SETTINGS.agent.compatibilityReplayMessageLimit,
            showDeliveryTelemetry: DEFAULT_SETTINGS.agent.showDeliveryTelemetry,
          } })).catch(() => undefined); }}
        >
          Reset policy
        </button>
      </SettingsField>
    </section>
  );
}
