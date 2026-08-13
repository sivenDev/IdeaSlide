import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Markdown uses native character-tight selection without a second state model', async () => {
  const [hook, css] = await Promise.all([
    readSource('src/hooks/useCodeMirrorEditor.ts'),
    readSource('src/index.css'),
  ]);
  assert.doesNotMatch(hook, /\bdrawSelection\b/);
  assert.doesNotMatch(hook, /\.cm-selectionBackground|\.cm-selectionLayer/);
  assert.match(hook, /&\.cm-focused ::selection/);
  assert.match(hook, /&:not\(\.cm-focused\) ::selection/);
  assert.match(hook, /--ideanote-editor-selection-unfocused/);
  assert.equal((hook.match(/new EditorView/g) ?? []).length, 1);
  assert.match(css, /--ideanote-editor-selection-unfocused:/);
  assert.doesNotMatch(hook, /--ideanote-editor-selection-border/);
  assert.doesNotMatch(css, /--ideanote-editor-selection-border:/);
  assert.doesNotMatch(hook, /useState\([^)]*selection|selectionCompartment/);
});
