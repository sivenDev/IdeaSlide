import { useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useSettings } from "../../hooks/useSettings";
import { SettingsField } from "./SettingsField";

export function AiProviderSettings() {
  const {
    settings,
    saving,
    credentialConfigured,
    updateSettings,
    storeCredential,
    removeCredential,
  } = useSettings();
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState<string>();

  const saveCredential = async () => {
    setMessage(undefined);
    await storeCredential(apiKey);
    setApiKey("");
    setMessage("Credential saved in the system vault.");
  };

  return (
    <section aria-labelledby="settings-provider-title">
      <h2 id="settings-provider-title" className="ideanote-settings-title">AI Provider</h2>
      <p className="ideanote-settings-lead">Configure an OpenAI-compatible endpoint. Secrets never enter settings or Workspace files.</p>

      <div className="ideanote-settings-card">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 text-emerald-600" aria-hidden size={18} />
          <div>
            <div className="text-sm font-semibold text-gray-900">System credential vault</div>
            <div className="mt-1 text-xs leading-5 text-gray-500">
              {credentialConfigured ? "A provider credential is configured." : "No credential is configured yet."}
            </div>
          </div>
        </div>
      </div>

      <SettingsField title="Base URL" description="The API root for an OpenAI-compatible provider.">
        <input
          aria-label="AI provider base URL"
          className="ideanote-settings-control w-72"
          value={settings.ai.baseUrl}
          onChange={(event) => void updateSettings((current) => ({
            ...current,
            ai: { ...current.ai, baseUrl: event.target.value },
          }))}
        />
      </SettingsField>
      <SettingsField title="Model" description="The model identifier sent to the configured provider.">
        <input
          aria-label="AI model"
          className="ideanote-settings-control w-52"
          value={settings.ai.model}
          onChange={(event) => void updateSettings((current) => ({
            ...current,
            ai: { ...current.ai, model: event.target.value },
          }))}
        />
      </SettingsField>
      <div className="ideanote-settings-field items-start">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900">API Key</div>
          <div className="mt-1 text-xs leading-5 text-gray-500">Entering a new key replaces the existing credential.</div>
        </div>
        <div className="flex w-72 flex-col gap-2">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <KeyRound className="absolute left-2.5 top-2.5 text-gray-400" aria-hidden size={14} />
              <input
                type="password"
                autoComplete="new-password"
                aria-label="AI provider API key"
                placeholder={credentialConfigured ? "Replace credential" : "Enter API key"}
                className="ideanote-settings-control w-full pl-8"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </div>
            <button
              type="button"
              className="ideanote-settings-button is-primary"
              disabled={saving || !apiKey.trim()}
              onClick={() => void saveCredential()}
            >
              Save
            </button>
          </div>
          {credentialConfigured && (
            <button type="button" className="self-start text-xs font-medium text-red-600 hover:text-red-700" onClick={() => void removeCredential()}>
              Remove credential
            </button>
          )}
          {message && <div className="text-xs text-emerald-700">{message}</div>}
        </div>
      </div>
    </section>
  );
}
