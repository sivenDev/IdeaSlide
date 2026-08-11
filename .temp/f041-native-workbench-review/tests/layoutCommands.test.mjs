import assert from "node:assert/strict";
import test from "node:test";
import { buildCommandCatalog, commandById } from "../src/components/commands/commandRegistry.js";

test("command routing reflects document and panel context", () => {
  const clean = buildCommandCatalog({ document: null, recents: [], workspaceOpen: true, agentOpen: false, aiEnabled: true });
  assert.equal(commandById(clean, "save"), null);
  assert.equal(commandById(clean, "toggle-agent"), null);
  assert.equal(commandById(clean, "open-settings").shortcut, "⌘,");

  const dirtyDocument = { dirty: true, readOnly: false, conflict: false, missing: false };
  const active = buildCommandCatalog({ document: dirtyDocument, recents: [{ label: "one.md" }], workspaceOpen: false, agentOpen: true, aiEnabled: true });
  assert.equal(commandById(active, "save").id, "save");
  assert.equal(commandById(active, "open-recent").detail, "one.md");
  assert.equal(commandById(active, "toggle-workspaces").label, "Show Workspaces");
  assert.equal(commandById(active, "toggle-agent").label, "Hide Agent");
});

test("protected documents disable direct save but retain Save As", () => {
  const commands = buildCommandCatalog({ document: { dirty: true, readOnly: false, conflict: true, missing: false }, recents: [], workspaceOpen: true, agentOpen: false });
  assert.equal(commandById(commands, "save"), null);
  assert.equal(commandById(commands, "save-as").id, "save-as");
});
