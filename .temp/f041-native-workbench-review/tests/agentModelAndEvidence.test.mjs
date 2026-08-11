import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { agentModelCatalog, MockAgentRuntime } from "../src/mock/mockAgentRuntime.js";

const document = { sessionId: "s", name: "note.md", type: "markdown", revision: 2 };

test("Agent model catalog is deterministic and exposes supported reasoning effort", () => {
  assert.deepEqual(agentModelCatalog.map((model) => model.label), ["GPT 5.6 Sol", "GPT 5.6 Terra", "GPT 5.6 Luna", "GPT 5.5"]);
  assert.equal(agentModelCatalog.every((model) => model.efforts.includes("medium")), true);
});

test("mock Agent captures model and reasoning as immutable Turn completion evidence", async () => {
  const runtime = new MockAgentRuntime();
  const events = [];
  await runtime.run({
    prompt: "outline this",
    document,
    model: "gpt-5.6-terra",
    reasoningEffort: "high",
    deliveryMode: "atomic",
    onEvent: async (event) => events.push(structuredClone(event)),
    toolExecutor: async () => ({ ok: true, detail: "read" }),
  });

  const started = events.find((event) => event.type === "turn-started");
  const completed = events.find((event) => event.type === "turn-completed");
  assert.equal(started.model, "gpt-5.6-terra");
  assert.equal(started.reasoningEffort, "high");
  assert.deepEqual(completed.evidence, {
    model: "gpt-5.6-terra",
    reasoningEffort: "high",
    contextPercent: completed.contextPercent,
    elapsedMs: completed.evidence.elapsedMs,
  });
  assert.equal(completed.evidence.elapsedMs > 0, true);
});

test("Agent UI removes Skill and delivery vocabulary and renders model selection plus response evidence", async () => {
  const source = await readFile(new URL("../src/components/agent/AgentPanel.jsx", import.meta.url), "utf8");
  assert.equal(source.includes("Automatic Skill"), false);
  assert.equal(source.includes("Agent Skill"), false);
  assert.equal(source.includes("selectedSkill"), false);
  assert.match(source, /Model and reasoning/);
  assert.match(source, /Response evidence/);
  assert.match(source, /Context Window/);
  assert.match(source, /item\.evidence/);
});
