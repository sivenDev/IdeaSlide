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

test("Recents contain standalone files only", async () => {
  const api = new MockDesktopApi({ latency: 0 });
  const initial = api.snapshot().recents;
  assert.equal(initial.every((recent) => recent.kind === "standalone"), true);
  await api.openWorkspace("ws-product");
  await api.openWorkspaceFile("ws-product", "Planning/product-brief.md");
  assert.deepEqual(api.snapshot().recents, initial);
  await api.openStandalone("standalone-notes");
  const recents = api.snapshot().recents;
  assert.equal(recents[0].standaloneId, "standalone-notes");
  assert.equal(recents.filter((recent) => recent.standaloneId === "standalone-notes").length, 1);
  assert.equal(recents.every((recent) => recent.kind === "standalone"), true);
});

test("Workspace roots can be renamed, removed, and reopened from the mock catalog", async () => {
  const api = new MockDesktopApi({ latency: 0 });
  const renamed = await api.renameWorkspace("ws-research", "Research Desk");
  assert.equal(renamed.name, "Research Desk");
  await api.removeWorkspace("ws-research");
  assert.equal(api.snapshot().workspaces.some((workspace) => workspace.id === "ws-research"), false);
  const reopened = await api.chooseWorkspace();
  assert.equal(reopened.id, "ws-research");
  assert.equal(api.snapshot().workspaces.some((workspace) => workspace.id === "ws-research"), true);
});

test("save failures are injectable and recovery is isolated", async () => {
  const api = new MockDesktopApi({ latency: 0 });
  const file = await api.openStandalone("standalone-notes");
  api.injectFailure("saveDocument", "Disk review failure");
  await assert.rejects(() => api.saveDocument({ ...file, sessionId: "s1" }), /Disk review failure/);
  await api.writeRecovery("s1", "draft");
  assert.equal(api.snapshot().recovery.s1.content, "draft");
});
