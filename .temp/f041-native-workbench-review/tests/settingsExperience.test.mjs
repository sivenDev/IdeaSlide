import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("Provider testing returns a model catalog without retaining the token", async () => {
  memory.clear();
  const api = new MockSettingsApi();
  const success = await api.testProvider({ baseUrl: "https://api.openai.com/v1", token: "mock-secret" });
  assert.equal(success.ok, true);
  assert.deepEqual(success.models, ["gpt-5.2", "gpt-5.2-mini", "gpt-4.1"]);
  assert.equal([...memory.values()].join("\n").includes("mock-secret"), false);

  await assert.rejects(
    api.testProvider({ baseUrl: "https://offline.example/v1", token: "mock-secret" }),
    /Could not reach Provider/,
  );
});

test("Settings source groups navigation and gates model selection on Test", async () => {
  const source = await readFile(new URL("../src/components/settings/SettingsCenter.jsx", import.meta.url), "utf8");

  assert.match(source, /APPLICATION/);
  assert.match(source, /AI/);
  assert.match(source, /EDITORS/);
  assert.match(source, /REVIEW/);
  assert.match(source, /type="password"/);
  assert.match(source, /Test connection/);
  assert.match(source, /testState\.status === "success"/);
  assert.equal(source.includes("Remove configured credential"), false);
  assert.equal(source.includes("credential-card"), false);
});
