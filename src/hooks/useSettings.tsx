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
import { createLatestSettingsWriter, type LatestSettingsWriter } from "../lib/settingsAutoPersist";

interface SettingsContextValue {
  settings: AppSettings;
  resolvedTheme: "light" | "dark";
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

export const AUTO_SAVE_DEBOUNCE_MS = 350;
type SettingsEditStatus = "idle" | "saving" | "saved" | "error";
type SettingsPersistence = "immediate" | "debounced";

interface SettingsEditContextValue {
  settings: AppSettings;
  credentialConfigured: boolean;
  credentialInput: string;
  setCredentialInput: (value: string) => void;
  activationState: AgentActivationState;
  status: SettingsEditStatus;
  error?: string;
  updateSettings: (
    updater: (current: AppSettings) => AppSettings,
    options?: { persistence?: SettingsPersistence },
  ) => Promise<void>;
  flush: () => Promise<void>;
  retry: () => Promise<void>;
  storeCredential: (apiKey: string) => Promise<void>;
}

const SettingsEditContext = createContext<SettingsEditContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => structuredClone(DEFAULT_SETTINGS));
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [credentialConfigured, setCredentialConfigured] = useState(false);
  const [themePreview, setThemePreview] = useState<AppSettings["general"]["theme"]>();
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

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
      setResolvedTheme(resolved);
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
    resolvedTheme,
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
  }), [credentialConfigured, error, hydrated, removeCredential, replaceSettings, resolvedTheme, saving, settings, storeCredential, updateSettings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function SettingsEditProvider({ open, children }: { open: boolean; children: ReactNode }) {
  const persisted = useSettings();
  const persistedRef = useRef(persisted);
  persistedRef.current = persisted;
  const [settings, setSettings] = useState<AppSettings>(() => structuredClone(persisted.settings));
  const settingsRef = useRef(settings);
  const versionRef = useRef(0);
  const persistedVersionRef = useRef(0);
  const debounceRef = useRef<number | undefined>(undefined);
  const [credentialInput, setCredentialInput] = useState("");
  const [status, setStatus] = useState<SettingsEditStatus>("idle");
  const [error, setError] = useState<string>();
  const writerRef = useRef<LatestSettingsWriter<AppSettings> | undefined>(undefined);

  if (!writerRef.current) {
    writerRef.current = createLatestSettingsWriter({
      persist: (next) => persistedRef.current.replaceSettings(next),
      onPersisted: (entry, saved) => {
        persistedVersionRef.current = Math.max(persistedVersionRef.current, entry.version);
        if (entry.version === versionRef.current) {
          settingsRef.current = saved;
          setSettings(saved);
          setStatus("saved");
          setError(undefined);
        }
      },
      onError: (_entry, cause) => {
        setStatus("error");
        setError(cause.message);
      },
    });
  }

  useEffect(() => {
    if (!open) {
      setCredentialInput("");
      return;
    }
    const nextSettings = structuredClone(persisted.settings);
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
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

  const flush = useCallback(async () => {
    if (debounceRef.current !== undefined) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = undefined;
    }
    if (versionRef.current <= persistedVersionRef.current) return;
    setStatus("saving");
    setError(undefined);
    await writerRef.current?.flush();
  }, []);

  const updateSettings = useCallback((
    updater: (current: AppSettings) => AppSettings,
    options?: { persistence?: SettingsPersistence },
  ) => {
    const current = settingsRef.current;
    const next = updater(current);
    settingsRef.current = next;
    setSettings(next);
    if (next.general.theme !== current.general.theme) persisted.previewTheme(next.general.theme);
    const version = versionRef.current + 1;
    versionRef.current = version;
    writerRef.current?.submit({ version, settings: next });
    setError(undefined);
    if (debounceRef.current !== undefined) window.clearTimeout(debounceRef.current);
    if (options?.persistence === "debounced") {
      setStatus("idle");
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = undefined;
        void flush().catch(() => undefined);
      }, AUTO_SAVE_DEBOUNCE_MS);
      return Promise.resolve();
    }
    debounceRef.current = undefined;
    return flush();
  }, [flush, persisted.previewTheme]);

  const retry = useCallback(() => flush(), [flush]);

  useEffect(() => () => {
    if (debounceRef.current !== undefined) window.clearTimeout(debounceRef.current);
  }, []);

  const value = useMemo<SettingsEditContextValue>(() => ({
    settings,
    credentialConfigured: persisted.credentialConfigured,
    credentialInput,
    setCredentialInput,
    activationState: getAgentActivationState(persisted.hydrated, settings, persisted.credentialConfigured || Boolean(credentialInput.trim())),
    status,
    error,
    updateSettings,
    flush,
    retry,
    storeCredential: persisted.storeCredential,
  }), [credentialInput, error, flush, persisted.credentialConfigured, persisted.hydrated, persisted.storeCredential, retry, settings, status, updateSettings]);

  return <SettingsEditContext.Provider value={value}>{children}</SettingsEditContext.Provider>;
}

export function useSettingsDraft(): SettingsEditContextValue {
  const value = useContext(SettingsEditContext);
  if (!value) throw new Error("useSettingsDraft must be used within SettingsEditProvider");
  return value;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used within SettingsProvider");
  return value;
}
