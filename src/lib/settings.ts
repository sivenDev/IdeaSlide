import { invoke } from "@tauri-apps/api/core";
import { load, type Store } from "@tauri-apps/plugin-store";

export const SETTINGS_SCHEMA_VERSION = 6;
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
    availableModels: string[];
    systemPrompt: string;
    retry: {
      enabled: boolean;
      maxAttempts: number;
    };
  };
  agent: {
    openPanelByDefault: boolean;
    maxSteps: number;
    showToolActivity: boolean;
    contextWarningPercent: number;
    newThreadPercent: number;
    diagnosticRetention: number;
    compatibilityReplayMessageLimit: number;
    showDeliveryTelemetry: boolean;
  };
  ideaSketch: {
    previewLaserEnabled: boolean;
    openSidebarByDefault: boolean;
    pageViewMode: "name" | "thumbnail";
  };
  markdown: {
    showLineNumbers: boolean;
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
    availableModels: ["gpt-5-mini"],
    systemPrompt: "You are IdeaNote's editor assistant. Use the active editor Skill and Tools, inspect required context first, and apply requested edits directly through editor Tools.",
    retry: {
      enabled: true,
      maxAttempts: 3,
    },
  },
  agent: {
    openPanelByDefault: false,
    maxSteps: 8,
    showToolActivity: true,
    contextWarningPercent: 75,
    newThreadPercent: 90,
    diagnosticRetention: 20,
    compatibilityReplayMessageLimit: 60,
    showDeliveryTelemetry: true,
  },
  ideaSketch: {
    previewLaserEnabled: true,
    openSidebarByDefault: false,
    pageViewMode: "name",
  },
  markdown: {
    showLineNumbers: false,
  },
} satisfies AppSettings);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.round(value)))
    : fallback;
}

export function normalizeSettings(value: unknown): AppSettings {
  if (!isRecord(value)) return structuredClone(DEFAULT_SETTINGS);
  const general = isRecord(value.general) ? value.general : {};
  const ai = isRecord(value.ai) ? value.ai : {};
  const retry = isRecord(ai.retry) ? ai.retry : {};
  const agent = isRecord(value.agent) ? value.agent : {};
  const ideaSketch = isRecord(value.ideaSketch) ? value.ideaSketch : {};
  const markdown = isRecord(value.markdown) ? value.markdown : {};
  const maxSteps = boundedInteger(agent.maxSteps, DEFAULT_SETTINGS.agent.maxSteps, 1, 20);
  const contextWarningPercent = boundedInteger(
    agent.contextWarningPercent,
    DEFAULT_SETTINGS.agent.contextWarningPercent,
    50,
    90,
  );
  const requestedNewThreadPercent = boundedInteger(
    agent.newThreadPercent,
    DEFAULT_SETTINGS.agent.newThreadPercent,
    60,
    100,
  );
  const newThreadPercent = requestedNewThreadPercent > contextWarningPercent
    ? requestedNewThreadPercent
    : Math.min(100, contextWarningPercent + 1);
  const selectedModel = typeof ai.model === "string" && ai.model.trim()
    ? ai.model.trim()
    : DEFAULT_SETTINGS.ai.model;
  const availableModels = Array.isArray(ai.availableModels)
    ? [...new Set(ai.availableModels
      .filter((model): model is string => typeof model === "string")
      .map((model) => model.trim())
      .filter((model) => model.length > 0 && model.length <= 128))].slice(0, 200)
    : [];
  if (!availableModels.includes(selectedModel)) availableModels.unshift(selectedModel);

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
      model: selectedModel,
      availableModels,
      systemPrompt: typeof ai.systemPrompt === "string" && ai.systemPrompt.trim()
        ? ai.systemPrompt.trim()
        : DEFAULT_SETTINGS.ai.systemPrompt,
      retry: {
        enabled: typeof retry.enabled === "boolean" ? retry.enabled : DEFAULT_SETTINGS.ai.retry.enabled,
        maxAttempts: typeof retry.maxAttempts === "number" && Number.isFinite(retry.maxAttempts)
          ? Math.min(5, Math.max(1, Math.round(retry.maxAttempts)))
          : DEFAULT_SETTINGS.ai.retry.maxAttempts,
      },
    },
    agent: {
      openPanelByDefault: typeof agent.openPanelByDefault === "boolean"
        ? agent.openPanelByDefault
        : DEFAULT_SETTINGS.agent.openPanelByDefault,
      maxSteps,
      showToolActivity: typeof agent.showToolActivity === "boolean" ? agent.showToolActivity : true,
      contextWarningPercent,
      newThreadPercent,
      diagnosticRetention: boundedInteger(
        agent.diagnosticRetention,
        DEFAULT_SETTINGS.agent.diagnosticRetention,
        5,
        100,
      ),
      compatibilityReplayMessageLimit: boundedInteger(
        agent.compatibilityReplayMessageLimit,
        DEFAULT_SETTINGS.agent.compatibilityReplayMessageLimit,
        10,
        200,
      ),
      showDeliveryTelemetry: typeof agent.showDeliveryTelemetry === "boolean"
        ? agent.showDeliveryTelemetry
        : DEFAULT_SETTINGS.agent.showDeliveryTelemetry,
    },
    ideaSketch: {
      previewLaserEnabled: typeof ideaSketch.previewLaserEnabled === "boolean"
        ? ideaSketch.previewLaserEnabled
        : DEFAULT_SETTINGS.ideaSketch.previewLaserEnabled,
      openSidebarByDefault: typeof ideaSketch.openSidebarByDefault === "boolean"
        ? ideaSketch.openSidebarByDefault
        : DEFAULT_SETTINGS.ideaSketch.openSidebarByDefault,
      pageViewMode: ideaSketch.pageViewMode === "thumbnail" ? "thumbnail" : "name",
    },
    markdown: {
      showLineNumbers: typeof markdown.showLineNumbers === "boolean"
        ? markdown.showLineNumbers
        : false,
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
