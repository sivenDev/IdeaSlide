import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Markdown keeps one CodeMirror host across every view mode", async () => {
  const source = await read("../src/editors/markdown/MarkdownEditor.jsx");

  assert.match(source, /Compartment/);
  assert.match(source, /requestMeasure/);
  assert.match(source, /<div className="markdown-source" ref=\{mountRef\} \/>/);
  assert.equal(source.includes('mode !== "preview" && <div className="markdown-source"'), false);
});

test("Markdown toolbar starts with Outline and history lives at the lower-left", async () => {
  const [source, styles] = await Promise.all([
    read("../src/editors/markdown/MarkdownEditor.jsx"),
    read("../src/styles.css"),
  ]);
  const toolbar = source.match(/<div className="editor-native-toolbar">([\s\S]*?)<\/div>\s*<div className="markdown-workspace">/)?.[1] ?? "";

  assert.ok(toolbar.indexOf("markdown-outline-toggle") < toolbar.indexOf("Markdown view mode"));
  ["Heading", "Bold", "Italic", "Link", "List", "Search", "Undo", "Redo"].forEach((label) => {
    assert.equal(toolbar.includes(`title="${label}"`), false);
  });
  assert.match(source, /className="markdown-history-controls"/);
  assert.match(source, /aria-label="Undo Markdown edit"/);
  assert.match(source, /aria-label="Redo Markdown edit"/);
  assert.match(styles, /\.markdown-history-controls/);
  assert.match(styles, /bottom:/);
  assert.match(styles, /left:/);
});

test("Markdown line numbers are default-off settings reconfigured through CodeMirror", async () => {
  const [settings, center, host, app, editor] = await Promise.all([
    read("../src/mock/mockSettingsApi.js"),
    read("../src/components/settings/SettingsCenter.jsx"),
    read("../src/components/editor/EditorHost.jsx"),
    read("../src/app/DemoApp.jsx"),
    read("../src/editors/markdown/MarkdownEditor.jsx"),
  ]);

  assert.match(settings, /markdown: \{ showLineNumbers: false \}/);
  assert.match(center, /\["markdown", "Markdown"\]/);
  assert.match(center, /label="Line numbers"/);
  assert.match(host, /markdownLineNumbers/);
  assert.match(app, /settings\.markdown\.showLineNumbers/);
  assert.match(editor, /lineNumberCompartment\.reconfigure/);
  assert.equal(editor.includes("lineNumbers(), highlightActiveLine()"), false);
});

test("Markdown uses native character-tight selection instead of CodeMirror rectangle layers", async () => {
  const [editor, styles] = await Promise.all([
    read("../src/editors/markdown/MarkdownEditor.jsx"),
    read("../src/styles.css"),
  ]);

  assert.doesNotMatch(editor, /\bdrawSelection\b/);
  assert.doesNotMatch(styles, /\.cm-selectionBackground/);
  assert.match(styles, /\.markdown-source[^{}]*::selection/);
  assert.equal((editor.match(/new EditorView/g) ?? []).length, 1);
  assert.doesNotMatch(editor, /useState\([^)]*selection|selectionCompartment/);
});
