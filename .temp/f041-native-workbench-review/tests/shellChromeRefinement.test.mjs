import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Editor Host remains pinned when either outer panel is unmounted", async () => {
  const css = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(css, /grid-template-areas: "workspace editor agent"/);
  assert.match(css, /\.workspace-region \{ grid-area: workspace/);
  assert.match(css, /\.editor-region \{ grid-area: editor/);
  assert.match(css, /\.agent-region \{ grid-area: agent/);
});

test("document status and close share one leading control", async () => {
  const source = await readFile(new URL("../src/components/editor/EditorHost.jsx", import.meta.url), "utf8");
  assert.match(source, /document-status-close/);
  assert.match(source, /Close \$\{document\.name\}/);
  assert.equal(source.includes("Save document"), false);
  assert.equal(source.includes("document-status-rail"), false);
  assert.equal(source.includes("owns editor"), false);
  assert.match(source, /agentEnabled && !agentOpen/);
});

test("open Agent owns its right-aligned panel toggle without feature copy", async () => {
  const source = await readFile(new URL("../src/components/agent/AgentPanel.jsx", import.meta.url), "utf8");
  assert.match(source, /agent-header-actions/);
  assert.match(source, /aria-label="Hide Agent"/);
  assert.equal(source.includes("Work with the active editor"), false);
  assert.equal(source.includes("Ask for an outline, request a bounded edit"), false);
});
