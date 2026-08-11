const STORAGE_KEY = "ideanote-complete-review-settings-v1";

export const defaultSettings = {
  theme: "light",
  aiEnabled: true,
  provider: { baseUrl: "https://api.openai.com/v1", model: "gpt-5.2", retryEnabled: true, maxAttempts: 3, credentialConfigured: true },
  agent: { runtime: "automatic", model: "gpt-5.6-sol", reasoningEffort: "medium", maxSteps: 12, exactContextWarning: 78, showToolActivity: true, deliveryMode: "incremental", diagnostics: 20, replayEvents: 200 },
  ideaSketch: { laserEnabled: true },
  skills: [
    { id: "workspace-review", name: "Workspace Review", source: "bundled", enabled: true, scope: "all", autonomous: true, valid: true },
    { id: "ideasketch-structure", name: "IdeaSketch Structure", source: "bundled", enabled: true, scope: "ideasketch", autonomous: true, valid: true },
    { id: "markdown-editor", name: "Markdown Editor", source: "bundled", enabled: true, scope: "markdown", autonomous: true, valid: true },
  ],
};

const clone = (value) => structuredClone(value);

function normalizeSettings(settings) {
  const safe = clone(settings);
  const suppliedSkills = Array.isArray(safe.skills) ? safe.skills : [];
  const suppliedById = new Map(suppliedSkills.map((skill) => [skill.id, skill]));
  const bundled = defaultSettings.skills.map((skill) => ({ ...skill, ...suppliedById.get(skill.id), source: "bundled", enabled: true }));
  const custom = suppliedSkills.filter((skill) => skill.source === "custom");
  safe.skills = [...bundled, ...custom];
  return safe;
}

export class MockSettingsApi {
  constructor() { this.failure = null; }

  async load() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return clone(defaultSettings);
    try { return normalizeSettings({ ...clone(defaultSettings), ...JSON.parse(saved) }); } catch { return clone(defaultSettings); }
  }

  async save(settings) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    if (this.failure) throw new Error(this.failure);
    const safe = normalizeSettings(settings);
    safe.provider.credentialConfigured = Boolean(settings.provider.credentialConfigured);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    return safe;
  }

  async setCredential(value) {
    await new Promise((resolve) => setTimeout(resolve, 160));
    if (!value?.trim()) throw new Error("Enter a mock credential value first.");
    return { configured: true };
  }

  async testProvider({ baseUrl, token, hasConfiguredCredential = false }) {
    await new Promise((resolve) => setTimeout(resolve, 180));
    if (!baseUrl?.trim()) throw new Error("Enter a Provider Base URL.");
    if (!token?.trim() && !hasConfiguredCredential) throw new Error("Enter a Provider token.");
    if (!/^https?:\/\//i.test(baseUrl) || /offline|invalid|fail/i.test(baseUrl)) throw new Error("Could not reach Provider. Check the Base URL and token.");
    return { ok: true, configured: true, models: ["gpt-5.2", "gpt-5.2-mini", "gpt-4.1"] };
  }

  async deleteCredential() {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { configured: false };
  }

  async importSkill() {
    await new Promise((resolve) => setTimeout(resolve, 180));
    return { id: `custom-${Date.now()}`, name: "Editorial Clarity", source: "custom", enabled: true, scope: "markdown", autonomous: false, valid: true, path: "/Mock/Skills/editorial-clarity/SKILL.md" };
  }

  reset() { localStorage.removeItem(STORAGE_KEY); return normalizeSettings(defaultSettings); }
}

export const mockSettingsApi = new MockSettingsApi();
