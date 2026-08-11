import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_SETTINGS,
  deleteAiCredential,
  getAgentActivationState,
  getAiCredentialStatus,
  loadSettings,
  normalizeSettings,
  saveSettings,
  setAiCredential,
  type AgentActivationState,
  type AppSettings,
} from "../lib/settings";

interface SettingsContextValue {
  settings: AppSettings;
  hydrated: boolean;
  saving: boolean;
  error?: string;
  credentialConfigured: boolean;
  activationState: AgentActivationState;
  updateSettings: (updater: (current: AppSettings) => AppSettings) => Promise<void>;
  storeCredential: (apiKey: string) => Promise<void>;
  removeCredential: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => structuredClone(DEFAULT_SETTINGS));
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [credentialConfigured, setCredentialConfigured] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([loadSettings(), getAiCredentialStatus()])
      .then(([loaded, credential]) => {
        if (!active) return;
        setSettings(loaded);
        setCredentialConfigured(credential.configured);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolved = settings.general.theme === "system"
        ? (media.matches ? "dark" : "light")
        : settings.general.theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
    };
    applyTheme();
    if (settings.general.theme !== "system") return;
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [settings.general.theme]);

  const updateSettings = useCallback(async (updater: (current: AppSettings) => AppSettings) => {
    setSaving(true);
    setError(undefined);
    try {
      const next = normalizeSettings(updater(settings));
      setSettings(await saveSettings(next));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      throw cause;
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const storeCredential = useCallback(async (apiKey: string) => {
    setSaving(true);
    setError(undefined);
    try {
      const status = await setAiCredential(apiKey);
      setCredentialConfigured(status.configured);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      throw cause;
    } finally {
      setSaving(false);
    }
  }, []);

  const removeCredential = useCallback(async () => {
    setSaving(true);
    setError(undefined);
    try {
      const status = await deleteAiCredential();
      setCredentialConfigured(status.configured);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      throw cause;
    } finally {
      setSaving(false);
    }
  }, []);

  const value = useMemo<SettingsContextValue>(() => ({
    settings,
    hydrated,
    saving,
    error,
    credentialConfigured,
    activationState: getAgentActivationState(hydrated, settings, credentialConfigured),
    updateSettings,
    storeCredential,
    removeCredential,
  }), [credentialConfigured, error, hydrated, removeCredential, saving, settings, storeCredential, updateSettings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used within SettingsProvider");
  return value;
}
