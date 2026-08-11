import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { defaultSettings } from "../src/mock/mockSettingsApi.js";
import { MockDesktopApi } from "../src/mock/mockDesktopApi.js";
import { applyReviewScenario, resetReviewEnvironment, reviewScenarios, reviewStorageKeys } from "../src/scenarios/reviewScenarioRegistry.js";

const document = { sessionId: "workspace:ws-product:Planning/product-brief.md", mode: "workspace", workspaceId: "ws-product", path: "Planning/product-brief.md", name: "product-brief.md", type: "markdown", content: "# Brief", revision: 1, dirty: false };

test("every review scenario resolves through generic fixture overlays", async () => {
  for (const scenario of reviewScenarios) {
    const api = new MockDesktopApi({ latency: 0 });
    const result = await applyReviewScenario(scenario.id, { desktopApi: api, settings: structuredClone(defaultSettings), activeDocument: document });
    assert.equal(result.scenario.id, scenario.id);
    assert.equal(typeof result.documentPatch, "object");
    assert.equal(typeof result.message, "string");
  }
});

test("read-only review remains document-scoped", async () => {
  const api = new MockDesktopApi({ latency: 0 });
  const result = await applyReviewScenario("read-only", { desktopApi: api, settings: structuredClone(defaultSettings), activeDocument: document });
  assert.equal(result.documentPatch.readOnly, true);
  assert.equal(api.snapshot().workspaces.every((workspace) => !("readOnly" in workspace)), true);
  assert.equal(reviewScenarios.some((scenario) => scenario.label === "Read-only Workspace"), false);
});

test("reset is deterministic and clears only namespaced review storage", async () => {
  const api = new MockDesktopApi({ latency: 0 });
  const initial = api.snapshot();
  await api.createEntry("ws-product", "", "markdown", "Transient");
  const memory = new Map([...reviewStorageKeys.map((key) => [key, "saved"]), ["unrelated", "keep"]]);
  const storage = { removeItem: (key) => memory.delete(key) };
  assert.deepEqual(resetReviewEnvironment({ desktopApi: api, storage }), initial);
  assert.equal(memory.get("unrelated"), "keep");
  reviewStorageKeys.forEach((key) => assert.equal(memory.has(key), false));
});

test("scenario ids do not leak into product components", async () => {
  const files = [
    "src/app/DemoApp.jsx",
    "src/components/editor/EditorHost.jsx",
    "src/components/agent/AgentPanel.jsx",
  ];
  const source = (await Promise.all(files.map((path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")))).join("\n");
  for (const scenario of reviewScenarios.filter((item) => !["normal", "unsupported"].includes(item.id))) assert.equal(source.includes(`\"${scenario.id}\"`), false);
});
