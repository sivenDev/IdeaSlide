import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Markdown is a registry-driven editor contribution and not an EditorLayout branch', async () => {
  const registry = await readSource('src/lib/editorRegistry.tsx');
  const layout = await readSource('src/components/EditorLayout.tsx');
  const host = await readSource('src/components/DocumentEditorHost.tsx');
  assert.match(registry, /\["markdown", \{ id: "markdown", component: MarkdownContribution \}\]/);
  assert.match(host, /getEditorContribution\(definition\.editor\)/);
  assert.doesNotMatch(layout, /fileType === "markdown"|model\.type === "markdown"/);
});

test('Markdown uses CodeMirror native history, one source of truth, and safe GFM preview', async () => {
  const editor = await readSource('src/components/MarkdownEditor.tsx');
  const hook = await readSource('src/hooks/useCodeMirrorEditor.ts');
  assert.match(editor, /useCodeMirrorEditor/);
  assert.match(editor, /ReactMarkdown/);
  assert.match(editor, /remarkGfm/);
  assert.doesNotMatch(editor, /rehypeRaw|dangerouslySetInnerHTML/);
  assert.match(hook, /history\(\)/);
  assert.match(hook, /historyKeymap/);
  assert.match(hook, /undo\(viewRef\.current\)/);
  assert.match(hook, /redo\(viewRef\.current\)/);
  assert.match(hook, /Transaction\.addToHistory\.of\(false\)/);
});

test('Markdown exposes Edit, Split, Preview, outline, autosave, and Recovery through shared services', async () => {
  const editor = await readSource('src/components/MarkdownEditor.tsx');
  assert.match(editor, /"edit"/);
  assert.match(editor, /"split"/);
  assert.match(editor, /"preview"/);
  assert.match(editor, /projectHeadings/);
  assert.match(editor, /useAutoSave/);
  assert.match(editor, /onWriteRecovery/);
  assert.match(editor, /Normalize line endings/);
});
