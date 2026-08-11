import assert from "node:assert/strict";
import test from "node:test";
import { MockAgentRuntime } from "../src/mock/mockAgentRuntime.js";

const document = { sessionId: "s", name: "note.md", type: "markdown", revision: 2 };

test("mock Agent emits public activity, Tool chronology, and completion", async () => {
  const runtime = new MockAgentRuntime();
  const events = [];
  await runtime.run({
    prompt: "edit the document",
    document,
    deliveryMode: "atomic",
    onEvent: async (event) => events.push(event),
    toolExecutor: async () => ({ ok: true, detail: "one CodeMirror transaction" }),
  });
  assert.deepEqual(events.map((event) => event.type), ["turn-started", "activity", "tool-started", "tool-completed", "message-delta", "turn-completed"]);
});

test("mock Agent cancellation stops before terminal completion", async () => {
  const runtime = new MockAgentRuntime();
  const controller = new AbortController();
  const running = runtime.run({ prompt: "outline", document, deliveryMode: "incremental", signal: controller.signal, onEvent: async () => {}, toolExecutor: async () => ({ ok: true, detail: "read" }) });
  setTimeout(() => controller.abort(), 40);
  await assert.rejects(running, /Cancelled/);
});
