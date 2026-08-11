import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { MockDesktopApi } from "../src/mock/mockDesktopApi.js";

test("creation targets the selected Workspace directory", async () => {
  const api = new MockDesktopApi({ latency: 0 });
  const root = await api.createEntry("ws-product", "", "markdown", "Root note");
  const nested = await api.createEntry("ws-product", "Planning", "markdown", "Nested note");
  assert.equal(root.path, "Root note.md");
  assert.equal(nested.path, "Planning/Nested note.md");
});

test("Workspace rows own create actions while files expose overflow only", async () => {
  const source = await readFile(new URL("../src/components/workspace/WorkspacePanel.jsx", import.meta.url), "utf8");
  const toolbar = source.match(/<div className="workspace-toolbar">([\s\S]*?)<\/div>/)?.[1] ?? "";
  assert.equal(toolbar.includes("<button"), false);
  assert.match(source, /Create in \$\{workspace\.name\}/);
  assert.match(source, /isDirectory && <button className="row-action row-action--create"/);
  assert.match(source, /tree-entry--file/);
  assert.equal(source.includes('recent.kind === "workspace"'), false);
  assert.match(source, /Standalone files you open will appear here/);
});

test("Open Workspace remains available outside the section header", async () => {
  const commands = await readFile(new URL("../src/components/commands/commandRegistry.js", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/app/DemoApp.jsx", import.meta.url), "utf8");
  assert.match(commands, /id: "open-workspace"/);
  assert.match(app, /id === "open-workspace"/);
});

test("context menus yield cleanly to dialogs and stay closed on cancel", async () => {
  const app = await readFile(new URL("../src/app/DemoApp.jsx", import.meta.url), "utf8");
  assert.match(app, /!state\.modal && state\.contextMenu\?\.kind === "new"/);
  assert.match(app, /!state\.modal && state\.contextMenu\?\.kind === "workspace"/);
  assert.match(app, /!state\.modal && state\.contextMenu\?\.kind === "entry"/);
  assert.match(app, /title="Rename item"[\s\S]*?set-context-menu/);
  assert.match(app, /title="Move item to Trash\?"[\s\S]*?set-context-menu/);
});
