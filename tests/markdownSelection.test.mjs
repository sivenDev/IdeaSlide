import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Markdown uses native character-tight selection without a second state model', async () => {
  const [editor, hook, css] = await Promise.all([
    readSource('src/components/MarkdownEditor.tsx'),
    readSource('src/hooks/useCodeMirrorEditor.ts'),
    readSource('src/index.css'),
  ]);
  assert.doesNotMatch(hook, /\bdrawSelection\b/);
  assert.doesNotMatch(hook, /\.cm-selectionBackground|\.cm-selectionLayer/);
  assert.doesNotMatch(hook, /::selection/);
  assert.match(editor, /className="ideanote-markdown-source h-full"/);
  assert.match(css, /\.ideanote-markdown-source \.cm-content::selection/);
  assert.match(css, /\.ideanote-markdown-source \.cm-line::selection/);
  assert.match(css, /\.ideanote-markdown-source \.cm-line \*::selection/);
  assert.match(css, /background:\s*var\(--ideanote-editor-selection\)/);
  assert.equal((hook.match(/new EditorView/g) ?? []).length, 1);
  assert.doesNotMatch(hook, /--ideanote-editor-selection-border/);
  assert.doesNotMatch(css, /--ideanote-editor-selection-border:/);
  assert.doesNotMatch(hook, /useState\([^)]*selection|selectionCompartment/);
});
