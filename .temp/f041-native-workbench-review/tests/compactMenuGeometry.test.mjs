import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("compact menu tokens and anchors stay bounded", async () => {
  const [primitive, agent, css] = await Promise.all([
    read("../src/components/primitives/AppMenu.jsx"),
    read("../src/components/agent/AgentPanel.jsx"),
    read("../src/styles.css"),
  ]);

  assert.match(primitive, /contentClassName/);
  assert.match(primitive, /alignOffset/);
  assert.match(css, /\.app-menu\s*\{[^}]*min-width:\s*148px;[^}]*max-width:\s*196px;/s);
  assert.match(css, /\.app-menu--compact\s*\{[^}]*min-width:\s*128px;[^}]*max-width:\s*160px;/s);
  assert.match(css, /\.conversation-popover\s*\{[^}]*width:\s*min\(268px,/s);
  assert.match(agent, /alignOffset=\{-132\}/);
  assert.match(agent, /side="right"[\s\S]*?align="start"[\s\S]*?sideOffset=\{4\}/);
});
