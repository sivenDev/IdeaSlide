import assert from "node:assert/strict";
import test from "node:test";
import { activeDocument, demoReducer, initialState } from "../src/app/demoStore.js";
import { MockDesktopApi } from "../src/mock/mockDesktopApi.js";

const file = { id: "one", mode: "standalone", name: "one.md", path: "/Mock/one.md", type: "markdown", content: "one" };

test("active document patches preserve the session while exposing protected decisions", () => {
  const opened = demoReducer(initialState, { type: "open-document", file });
  const sessionId = activeDocument(opened).sessionId;
  const conflicted = demoReducer(opened, { type: "patch-document", sessionId, patch: { conflict: true, dirty: true, status: "dirty" } });
  assert.equal(activeDocument(conflicted).sessionId, sessionId);
  assert.equal(activeDocument(conflicted).conflict, true);
  assert.equal(activeDocument(conflicted).dirty, true);
  const cancelled = demoReducer(conflicted, { type: "patch-document", sessionId, patch: { problemDismissed: true } });
  assert.equal(activeDocument(cancelled).conflict, true, "Cancel must not silently clear conflict protection");
});

test("save failure injection is scoped and recovery remains separate", async () => {
  const api = new MockDesktopApi({ latency: 0 });
  const opened = await api.openStandalone("standalone-notes");
  api.injectFailure("saveDocument", "Scoped save failure");
  await assert.rejects(() => api.saveDocument({ ...opened, sessionId: "one" }), /Scoped save failure/);
  assert.equal((await api.listHome()).standalone.length > 0, true);
  api.clearFailure("saveDocument");
  await api.saveDocument({ ...opened, sessionId: "one" });
});

test("review reset closes documents and restores the default shell", () => {
  const opened = demoReducer(initialState, { type: "open-document", file });
  const reset = demoReducer(opened, { type: "reset-review", payload: { workspaces: [], recents: [], standalone: [] }, theme: "light" });
  assert.equal(reset.activeSessionId, null);
  assert.equal(reset.workspaceOpen, true);
  assert.equal(reset.agentOpen, false);
  assert.equal(reset.activeScenario, "normal");
});
