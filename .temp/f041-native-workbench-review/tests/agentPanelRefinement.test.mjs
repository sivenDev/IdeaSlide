import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Agent crown uses conversation history as its primary selector", async () => {
  const source = await readFile(new URL("../src/components/agent/AgentPanel.jsx", import.meta.url), "utf8");

  assert.match(source, /ConversationHistory/);
  assert.match(source, /AppPopover/);
  assert.match(source, /AppMenu/);
  assert.match(source, /Rename/);
  assert.match(source, /Delete/);
  assert.equal(source.includes("Thread history"), false);
  assert.equal(source.includes("Show archived"), false);
  assert.equal(source.includes("Archive Thread"), false);
  assert.equal(source.includes("conversation-popover__header"), false);
  assert.match(source, /contentClassName="app-menu--compact"/);
  assert.match(source, /side="right"[\s\S]*?align="start"/);
});

test("Runtime Inspector is a dialog and the transcript owns remaining height", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../src/components/agent/AgentPanel.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /AppDialog/);
  assert.match(source, /Runtime Inspector/);
  assert.match(css, /\.agent-thread\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0;[^}]*overflow:\s*auto;/s);
  assert.match(css, /\.agent-composer\s*\{[^}]*flex:\s*0 0 auto;/s);
  assert.equal(css.includes(".runtime-inspector, .agent-history { position: absolute"), false);
});
