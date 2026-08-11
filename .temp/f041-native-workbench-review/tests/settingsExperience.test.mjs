import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings, MockSettingsApi } from "../src/mock/mockSettingsApi.js";

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key),
};

test("mock settings persist status without retaining credential input", async () => {
  const api = new MockSettingsApi();
  const settings = structuredClone(defaultSettings);
  settings.theme = "dark";
  settings.provider.credentialConfigured = false;
  await api.save(settings);
  const loaded = await api.load();
  assert.equal(loaded.theme, "dark");
  assert.equal(loaded.provider.credentialConfigured, false);
  assert.deepEqual(await api.setCredential("mock-secret"), { configured: true });
  assert.equal([...memory.values()].join("\n").includes("mock-secret"), false);
});
