import assert from "node:assert/strict";
import test from "node:test";
import { activeDocument, demoReducer, initialState } from "../src/app/demoStore.js";

test("opening a document context-gates Agent state", () => {
  const opened = demoReducer(initialState, { type: "open-document", file: { id: "one", mode: "standalone", name: "one.md", path: "/Mock/one.md", type: "markdown", content: "# One" } });
  assert.equal(activeDocument(opened).name, "one.md");
  assert.equal(opened.agentOpen, false);
  const withAgent = demoReducer(opened, { type: "toggle-agent" });
  assert.equal(withAgent.agentOpen, true);
  assert.equal(demoReducer(initialState, { type: "toggle-agent" }).agentOpen, false);
});
