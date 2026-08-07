import { invoke } from "@tauri-apps/api/core";
import { load, type Store } from "@tauri-apps/plugin-store";

export const SETTINGS_SCHEMA_VERSION = 1;
const SETTINGS_STORE_PATH = "settings.json";
const SETTINGS_STORE_KEY = "settings";
const BROWSER_STORAGE_KEY = "ideanote.settings.v1";

export interface AppSettings {
  schemaVersion: number;
  general: {
    theme: "system" | "light" | "dark";
  };
  ai: {
    enabled: boolean;
    provider: "openai-compatible";
    baseUrl: string;
    model: string;
    systemPrompt: string;
  };
  agent: {
    maxSteps: number;
    showToolActivity: boolean;
  };
  ideaSketch: {
    previewLaserEnabled: boolean;
  };
}

export type AgentActivationState =
  | "loading"
  | "disabled"
  | "configuration-required"
  | "ready";

export const DEFAULT_SETTINGS = Object.freeze({
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  general: { theme: "system" },
  ai: {
    enabled: true,
    provider: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5-mini",
    systemPrompt: "You are IdeaNote's editor assistant. Use the active editor skill and propose changes for review before applying them.",
  },
  agent: {
    maxSteps: 8,
    showToolActivity: true,
  },
  ideaSketch: {
    previewLaserEnabled: true,
  },
} satisfies AppSettings);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeSettings(value: unknown): AppSettings {
  if (!isRecord(value)) return structuredClone(DEFAULT_SETTINGS);
  const general = isRecord(value.general) ? value.general : {};
  const ai = isRecord(value.ai) ? value.ai : {};
  const agent = isRecord(value.agent) ? value.agent : {};
  const ideaSketch = isRecord(value.ideaSketch) ? value.ideaSketch : {};
  const maxSteps = typeof agent.maxSteps === "number" && Number.isFinite(agent.maxSteps)
    ? Math.min(20, Math.max(1, Math.round(agent.maxSteps)))
    : DEFAULT_SETTINGS.agent.maxSteps;

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    general: {
      theme: general.theme === "light" || general.theme === "dark" ? general.theme : "system",
    },
    ai: {
      enabled: typeof ai.enabled === "boolean" ? ai.enabled : true,
      provider: "openai-compatible",
      baseUrl: typeof ai.baseUrl === "string" && ai.baseUrl.trim()
        ? ai.baseUrl.trim().replace(/\/$/, "")
        : DEFAULT_SETTINGS.ai.baseUrl,
      model: typeof ai.model === "string" && ai.model.trim() ? ai.model.trim() : DEFAULT_SETTINGS.ai.model,
      systemPrompt: typeof ai.systemPrompt === "string" && ai.systemPrompt.trim()
        ? ai.systemPrompt.trim()
        : DEFAULT_SETTINGS.ai.systemPrompt,
    },
    agent: {
      maxSteps,
      showToolActivity: typeof agent.showToolActivity === "boolean" ? agent.showToolActivity : true,
    },
    ideaSketch: {
      previewLaserEnabled: typeof ideaSketch.previewLaserEnabled === "boolean"
        ? ideaSketch.previewLaserEnabled
        : true,
    },
  };
}

let storePromise: Promise<Store> | undefined;

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function settingsStore(): Promise<Store> {
  storePromise ??= load(SETTINGS_STORE_PATH, { autoSave: false });
  return storePromise;
}

export async function loadSettings(): Promise<AppSettings> {
  if (!isTauriRuntime()) {
    try {
      const raw = window.localStorage.getItem(BROWSER_STORAGE_KEY);
      return normalizeSettings(raw ? JSON.parse(raw) : undefined);
    } catch {
      return structuredClone(DEFAULT_SETTINGS);
    }
  }
  const store = await settingsStore();
  return normalizeSettings(await store.get<unknown>(SETTINGS_STORE_KEY));
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const normalized = normalizeSettings(settings);
  if (!isTauriRuntime()) {
    window.localStorage.setItem(BROWSER_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }
  const store = await settingsStore();
  await store.set(SETTINGS_STORE_KEY, normalized);
  await store.save();
  return normalized;
}

export function getAgentActivationState(
  hydrated: boolean,
  settings: AppSettings,
  credentialConfigured: boolean,
): AgentActivationState {
  if (!hydrated) return "loading";
  if (!settings.ai.enabled) return "disabled";
  if (!credentialConfigured) return "configuration-required";
  return "ready";
}

export interface CredentialStatus {
  configured: boolean;
}

export async function getAiCredentialStatus(): Promise<CredentialStatus> {
  if (!isTauriRuntime()) return { configured: false };
  return invoke<CredentialStatus>("get_ai_credential_status");
}

export async function setAiCredential(apiKey: string): Promise<CredentialStatus> {
  if (!isTauriRuntime()) return { configured: apiKey.trim().length > 0 };
  return invoke<CredentialStatus>("set_ai_credential", { apiKey });
}

export async function deleteAiCredential(): Promise<CredentialStatus> {
  if (!isTauriRuntime()) return { configured: false };
  return invoke<CredentialStatus>("delete_ai_credential");
}
