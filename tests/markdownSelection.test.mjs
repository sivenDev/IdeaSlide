import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Markdown selection styling distinguishes focused and unfocused ranges without a second state model', async () => {
  const [hook, css] = await Promise.all([
    readSource('src/hooks/useCodeMirrorEditor.ts'),
    readSource('src/index.css'),
  ]);
  assert.match(hook, /drawSelection\(\)/);
  assert.match(hook, /&\.cm-focused .*\.cm-selectionBackground/);
  assert.match(hook, /&:not\(\.cm-focused\).*\.cm-selectionBackground/);
  assert.match(hook, /--ideanote-editor-selection-border/);
  assert.match(hook, /--ideanote-editor-selection-unfocused/);
  assert.equal((hook.match(/new EditorView/g) ?? []).length, 1);
  assert.match(css, /--ideanote-editor-selection-border:/);
  assert.match(css, /--ideanote-editor-selection-unfocused:/);
  assert.doesNotMatch(hook, /useState\([^)]*selection|selectionCompartment/);
});
