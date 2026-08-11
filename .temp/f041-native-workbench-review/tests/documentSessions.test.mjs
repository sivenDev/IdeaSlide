import assert from "node:assert/strict";
import test from "node:test";
import { createDocumentSession, discardSession, documentCondition, savedSession, updateSessionContent } from "../src/lib/documentSessions.js";

const file = { id: "one", mode: "standalone", name: "one.md", path: "/Mock/one.md", type: "markdown", content: "one" };

test("workspace and standalone documents use stable session identities", () => {
  assert.equal(createDocumentSession(file).sessionId, "standalone:one");
  assert.equal(createDocumentSession({ ...file, mode: "workspace", workspaceId: "ws", path: "one.md" }).sessionId, "workspace:ws:one.md");
});

test("dirty save and discard transitions preserve observable status", () => {
  const opened = createDocumentSession(file);
  const dirty = updateSessionContent(opened, "two");
  assert.equal(documentCondition(dirty).label, "Unsaved changes");
  const saved = savedSession(dirty, { fingerprint: "mock-2", savedAt: 2 });
  assert.equal(saved.dirty, false);
  assert.equal(saved.originalContent, "two");
  assert.equal(discardSession(updateSessionContent(saved, "three")).content, "two");
  assert.equal(updateSessionContent(saved, "two").dirty, false);
});
