import assert from "node:assert/strict";
import test from "node:test";
import { editorToolDecision } from "../src/lib/agentEditorPolicy.js";
import { resolveRuntime } from "../src/mock/mockAgentRuntime.js";

const adapter = { applyTransaction: () => true };

test("runtime fallback advertises reduced capabilities", () => {
  assert.equal(resolveRuntime("automatic").id, "codex");
  assert.equal(resolveRuntime("compatibility").id, "compatibility");
  assert.deepEqual(resolveRuntime("compatibility").capabilities, ["streaming", "threads"]);
});

test("Agent editor Tools reject stale, read-only, and missing documents", () => {
  assert.equal(editorToolDecision({ readOnly: true }, adapter).ok, false);
  assert.equal(editorToolDecision({ conflict: true }, adapter).ok, false);
  assert.equal(editorToolDecision({ missing: true }, adapter).ok, false);
  assert.equal(editorToolDecision({}, null).detail, "The active editor adapter is unavailable.");
  assert.equal(editorToolDecision({}, adapter).ok, true);
});
