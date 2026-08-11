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

test("Workspace entries move inward, laterally, outward, and back to root", async () => {
  const api = new MockDesktopApi({ latency: 0 });
  const inward = await api.moveEntry("ws-product", "Research/field-notes.md", "Planning");
  assert.equal(inward.path, "Planning/field-notes.md");
  const lateral = await api.moveEntry("ws-product", "Planning/field-notes.md", "Archive");
  assert.equal(lateral.path, "Archive/field-notes.md");
  const outward = await api.moveEntry("ws-product", "Archive/field-notes.md", "");
  assert.equal(outward.path, "field-notes.md");
});

test("Workspace move rejects same-parent, collisions, and self-descendant targets without mutation", async () => {
  const api = new MockDesktopApi({ latency: 0 });
  await api.createEntry("ws-product", "Planning", "directory", "Nested");
  const before = api.snapshot();
  await assert.rejects(() => api.moveEntry("ws-product", "Research/field-notes.md", "Research"), /already in this folder/i);
  await assert.rejects(() => api.moveEntry("ws-product", "Planning", "Planning"), /itself|descendant/i);
  await assert.rejects(() => api.moveEntry("ws-product", "Planning", "Planning/Nested"), /itself|descendant/i);
  assert.deepEqual(api.snapshot(), before);
});

test("moving a directory remaps descendants and emits one move event", async () => {
  const api = new MockDesktopApi({ latency: 0 });
  const events = [];
  api.subscribe((event) => events.push(event));
  const moved = await api.moveEntry("ws-product", "Planning", "Archive");
  assert.equal(moved.path, "Archive/Planning");
  assert.equal(moved.children.every((entry) => entry.path.startsWith("Archive/Planning/")), true);
  assert.deepEqual(events.filter((event) => event.operation === "move"), [{
    type: "workspace-changed",
    workspaceId: "ws-product",
    operation: "move",
    path: "Planning",
    nextPath: "Archive/Planning",
  }]);
});

test("Workspace roots are writable and do not propagate a read-only state", async () => {
  const api = new MockDesktopApi({ latency: 0 });
  assert.equal(api.snapshot().workspaces.every((workspace) => !("readOnly" in workspace)), true);

  const created = await api.createEntry("ws-operations", "", "markdown", "Operations note");
  assert.equal(created.path, "Operations note.md");
  const opened = await api.openWorkspaceFile("ws-operations", created.path);
  assert.equal(opened.readOnly, undefined);
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
