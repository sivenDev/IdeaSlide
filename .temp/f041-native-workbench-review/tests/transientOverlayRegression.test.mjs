import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Workspace row actions use maintained transient primitives", async () => {
  const [workspaceSource, appSource, packageSource] = await Promise.all([
    read("../src/components/workspace/WorkspacePanel.jsx"),
    read("../src/app/DemoApp.jsx"),
    read("../package.json"),
  ]);

  assert.match(packageSource, /@radix-ui\/react-dropdown-menu/);
  assert.match(workspaceSource, /AppMenu/);
  assert.equal(workspaceSource.includes("function menuAnchor"), false);
  assert.equal(appSource.includes("NewEntryMenu"), false);
  assert.equal(appSource.includes("WorkspaceActionMenu"), false);
  assert.equal(appSource.includes("EntryActionMenu"), false);
});

test("Workspace menus contain only the approved object actions", async () => {
  const workspaceSource = await read("../src/components/workspace/WorkspacePanel.jsx");

  assert.match(workspaceSource, /Show in Finder/);
  assert.match(workspaceSource, /Remove from Workspaces/);
  assert.match(workspaceSource, /Move to Trash/);
  assert.equal(workspaceSource.includes("Move to Archive"), false);
  assert.equal(workspaceSource.includes(">Cancel<"), false);
});
