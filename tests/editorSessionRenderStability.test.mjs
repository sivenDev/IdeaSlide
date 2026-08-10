import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('only the active heavy document editor is mounted', async () => {
  const editor = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');
  const host = await readFile(new URL('../src/components/DocumentEditorHost.tsx', import.meta.url), 'utf8');
  assert.match(editor, /const activeDocument = state\.documents\.find/);
  assert.match(editor, /<DocumentEditorHost[\s\S]*document=\{activeDocument\}/);
  assert.doesNotMatch(editor, /state\.documents\.map[\s\S]*DocumentEditorHost/);
  assert.match(host, /getEditorContribution/);
  assert.match(host, /<Editor document=\{document\}/);
  assert.doesNotMatch(editor, /<IdeaSketchEditor/);
});
