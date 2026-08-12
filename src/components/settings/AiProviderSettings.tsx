import { useEffect, useState } from "react";
import { useSettingsDraft } from "../../hooks/useSettings";
import { probeAiProvider } from "../../lib/tauriCommands";
import { SettingsField } from "./SettingsField";
import { SettingsSwitch } from "./SettingsSwitch";

interface TestedProvider {
  baseUrl: string;
  apiKey: string;
}

const CONFIGURED_TOKEN_MASK = "••••••••••••";

export function AiProviderSettings() {
  const {
    settings,
    credentialConfigured,
    credentialInput: apiKey,
    setCredentialInput: setApiKey,
    updateSettings,
    flush,
    storeCredential,
  } = useSettingsDraft();
  const [testing, setTesting] = useState(false);
  const [replacingCredential, setReplacingCredential] = useState(false);
  const [tested, setTested] = useState<TestedProvider>();
  const [testMessage, setTestMessage] = useState<string>();
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const normalizedBaseUrl = settings.ai.baseUrl.trim().replace(/\/$/, "");
  const credentialFingerprint = apiKey || (credentialConfigured ? "__configured__" : "");
  const testCurrent = tested?.baseUrl === normalizedBaseUrl && tested.apiKey === credentialFingerprint;

  useEffect(() => {
    if (!testCurrent && tested) setTestMessage(undefined);
  }, [testCurrent, tested]);

  const testProvider = async () => {
    setTesting(true);
    setTestMessage(undefined);
    try {
      const result = await probeAiProvider(normalizedBaseUrl, apiKey || undefined);
      if (apiKey.trim()) await storeCredential(apiKey.trim());
      await updateSettings((current) => ({
        ...current,
        ai: {
          ...current.ai,
          availableModels: result.models,
          model: result.models.includes(current.ai.model) ? current.ai.model : (result.models[0] ?? current.ai.model),
        },
      }));
      const testedCredentialFingerprint = apiKey.trim() ? "__configured__" : credentialFingerprint;
      setApiKey("");
      setReplacingCredential(false);
      setTested({ baseUrl: normalizedBaseUrl, apiKey: testedCredentialFingerprint });
      setMessageTone("success");
      setTestMessage(`${result.models.length} model${result.models.length === 1 ? "" : "s"} available`);
    } catch (cause) {
      setTested(undefined);
      setMessageTone("error");
      setTestMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="ideanote-settings-section ideanote-settings-section--wide" aria-label="AI Provider settings">
      <div className="ideanote-provider-form">
        <SettingsField title="Base URL">
          <input
            aria-label="AI provider base URL"
            className="ideanote-settings-control ideanote-provider-control"
            value={settings.ai.baseUrl}
            onChange={(event) => { void updateSettings((current) => ({
              ...current,
              ai: { ...current.ai, baseUrl: event.target.value },
            }), { persistence: "debounced" }).catch(() => undefined); }}
            onBlur={() => { void flush().catch(() => undefined); }}
          />
        </SettingsField>
        <SettingsField title="Token">
          <input
            type="password"
            autoComplete="new-password"
            aria-label="AI provider token"
            placeholder={credentialConfigured ? "Enter replacement token" : "Enter token"}
            className="ideanote-settings-control ideanote-provider-control"
            value={credentialConfigured && !replacingCredential && !apiKey ? CONFIGURED_TOKEN_MASK : apiKey}
            onFocus={() => { if (credentialConfigured && !apiKey) setReplacingCredential(true); }}
            onBlur={() => { if (credentialConfigured && !apiKey) setReplacingCredential(false); }}
            onChange={(event) => setApiKey(event.target.value)}
          />
        </SettingsField>
        <SettingsField title="Connection">
          <div className="ideanote-provider-test-row">
            <button
              type="button"
              className="ideanote-settings-button is-primary"
              disabled={testing || !normalizedBaseUrl || (!apiKey.trim() && !credentialConfigured)}
              onClick={() => void testProvider()}
            >
              {testing ? "Testing…" : "Test"}
            </button>
            {testMessage && (
              <span className={messageTone === "success" ? "is-success" : "is-error"} role="status">{testMessage}</span>
            )}
          </div>
        </SettingsField>
        <SettingsField title="Automatic retry">
          <SettingsSwitch
            label="Automatic retry"
            checked={settings.ai.retry.enabled}
            onCheckedChange={(enabled) => { void updateSettings((current) => ({
              ...current,
              ai: { ...current.ai, retry: { ...current.ai.retry, enabled } },
            })).catch(() => undefined); }}
          />
        </SettingsField>
        <SettingsField title="Maximum attempts">
          <input
            type="number"
            min={1}
            max={5}
            disabled={!settings.ai.retry.enabled}
            aria-label="Maximum AI provider attempts"
            className="ideanote-settings-control w-20"
            value={settings.ai.retry.maxAttempts}
            onChange={(event) => { void updateSettings((current) => ({
              ...current,
              ai: {
                ...current.ai,
                retry: { ...current.ai.retry, maxAttempts: Number(event.target.value) },
              },
            }), { persistence: "debounced" }).catch(() => undefined); }}
            onBlur={() => { void flush().catch(() => undefined); }}
          />
        </SettingsField>
      </div>
    </section>
  );
}
