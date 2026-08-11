import assert from "node:assert/strict";
import test from "node:test";
import { MockDesktopApi } from "../src/mock/mockDesktopApi.js";

test("mock desktop reset is deterministic", async () => {
  const api = new MockDesktopApi({ latency: 0 });
  const before = await api.listHome();
  await api.createEntry("ws-product", "", "markdown", "Scratch");
  api.reset();
  const after = await api.listHome();
  assert.deepEqual(after, before);
});

test("workspace mutations share one authoritative tree", async () => {
  const api = new MockDesktopApi({ latency: 0 });
  const created = await api.createEntry("ws-product", "", "markdown", "Review");
  assert.equal(created.path, "Review.md");
  const renamed = await api.renameEntry("ws-product", created.path, "Decision.md");
  assert.equal(renamed.path, "Decision.md");
  const moved = await api.moveEntry("ws-product", renamed.path, "Archive");
  assert.equal(moved.path, "Archive/Decision.md");
  await api.trashEntry("ws-product", moved.path);
  await assert.rejects(() => api.openWorkspaceFile("ws-product", moved.path), /could not be found/);
});

test("save failures are injectable and recovery is isolated", async () => {
  const api = new MockDesktopApi({ latency: 0 });
  const file = await api.openStandalone("standalone-notes");
  api.injectFailure("saveDocument", "Disk review failure");
  await assert.rejects(() => api.saveDocument({ ...file, sessionId: "s1" }), /Disk review failure/);
  await api.writeRecovery("s1", "draft");
  assert.equal(api.snapshot().recovery.s1.content, "draft");
});
