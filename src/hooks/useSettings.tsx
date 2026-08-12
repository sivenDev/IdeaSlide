import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  replaceSettings: (next: AppSettings) => Promise<AppSettings>;
  previewTheme: (theme?: AppSettings["general"]["theme"]) => void;
  storeCredential: (apiKey: string) => Promise<void>;
  removeCredential: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

type DraftStatus = "idle" | "saving" | "saved" | "error";

interface SettingsDraftContextValue {
  settings: AppSettings;
  credentialConfigured: boolean;
  credentialInput: string;
  setCredentialInput: (value: string) => void;
  activationState: AgentActivationState;
  dirty: boolean;
  status: DraftStatus;
  error?: string;
  updateSettings: (updater: (current: AppSettings) => AppSettings) => void;
  saveDraft: () => Promise<void>;
  discardDraft: () => void;
}

const SettingsDraftContext = createContext<SettingsDraftContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => structuredClone(DEFAULT_SETTINGS));
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [credentialConfigured, setCredentialConfigured] = useState(false);
  const [themePreview, setThemePreview] = useState<AppSettings["general"]["theme"]>();

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
    const theme = themePreview ?? settings.general.theme;
    const applyTheme = () => {
      const resolved = theme === "system"
        ? (media.matches ? "dark" : "light")
        : theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
    };
    applyTheme();
    if (theme !== "system") return;
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [settings.general.theme, themePreview]);

  const replaceSettings = useCallback(async (next: AppSettings) => {
    setSaving(true);
    setError(undefined);
    try {
      const saved = await saveSettings(normalizeSettings(next));
      setSettings(saved);
      setThemePreview(undefined);
      return saved;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      throw cause;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateSettings = useCallback(async (updater: (current: AppSettings) => AppSettings) => {
    setSaving(true);
    setError(undefined);
    try {
      await replaceSettings(updater(settings));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      throw cause;
    } finally {
      setSaving(false);
    }
  }, [replaceSettings, settings]);

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
    replaceSettings,
    previewTheme: setThemePreview,
    storeCredential,
    removeCredential,
  }), [credentialConfigured, error, hydrated, removeCredential, replaceSettings, saving, settings, storeCredential, updateSettings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function SettingsDraftProvider({ open, children }: { open: boolean; children: ReactNode }) {
  const persisted = useSettings();
  const [draft, setDraft] = useState<AppSettings>(() => structuredClone(persisted.settings));
  const draftRef = useRef(draft);
  const [credentialInput, setCredentialInput] = useState("");
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    const nextDraft = structuredClone(persisted.settings);
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setCredentialInput("");
    setStatus("idle");
    setError(undefined);
    persisted.previewTheme(undefined);
  }, [open, persisted.hydrated]);

  useEffect(() => {
    if (status !== "saved") return;
    const timeout = window.setTimeout(() => setStatus("idle"), 1100);
    return () => window.clearTimeout(timeout);
  }, [status]);

  const updateSettings = useCallback((updater: (current: AppSettings) => AppSettings) => {
    const current = draftRef.current;
    const next = updater(current);
    draftRef.current = next;
    setDraft(next);
    if (next.general.theme !== current.general.theme) persisted.previewTheme(next.general.theme);
    setStatus("idle");
    setError(undefined);
  }, [persisted.previewTheme]);

  const discardDraft = useCallback(() => {
    const nextDraft = structuredClone(persisted.settings);
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setCredentialInput("");
    setStatus("idle");
    setError(undefined);
    persisted.previewTheme(undefined);
  }, [persisted.previewTheme, persisted.settings]);

  const saveDraft = useCallback(async () => {
    setStatus("saving");
    setError(undefined);
    try {
      const saved = await persisted.replaceSettings(draftRef.current);
      if (credentialInput.trim()) await persisted.storeCredential(credentialInput.trim());
      draftRef.current = saved;
      setDraft(saved);
      setCredentialInput("");
      setStatus("saved");
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : String(cause));
      throw cause;
    }
  }, [credentialInput, persisted.replaceSettings, persisted.storeCredential]);

  const value = useMemo<SettingsDraftContextValue>(() => ({
    settings: draft,
    credentialConfigured: persisted.credentialConfigured,
    credentialInput,
    setCredentialInput,
    activationState: getAgentActivationState(persisted.hydrated, draft, persisted.credentialConfigured || Boolean(credentialInput.trim())),
    dirty: JSON.stringify(draft) !== JSON.stringify(persisted.settings) || Boolean(credentialInput.trim()),
    status,
    error,
    updateSettings,
    saveDraft,
    discardDraft,
  }), [credentialInput, draft, error, persisted.credentialConfigured, persisted.hydrated, persisted.settings, saveDraft, status, discardDraft, updateSettings]);

  return <SettingsDraftContext.Provider value={value}>{children}</SettingsDraftContext.Provider>;
}

export function useSettingsDraft(): SettingsDraftContextValue {
  const value = useContext(SettingsDraftContext);
  if (!value) throw new Error("useSettingsDraft must be used within SettingsDraftProvider");
  return value;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used within SettingsProvider");
  return value;
}
