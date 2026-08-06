import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('generic Editor Host loads only the active document and preserves safe fallbacks', async () => {
  const source = await readFile(new URL('../src/components/DocumentEditorHost.tsx', import.meta.url), 'utf8');
  assert.match(source, /getFileTypeDefinition/);
  assert.match(source, /document\.status === "loading"/);
  assert.match(source, /UnsupportedFileView/);
  assert.match(source, /definition\?\.editor === "ideasketch"/);
  assert.match(source, /renderIdeaSketch/);
  assert.match(source, /const isMissing = document\.status === "missing"/);
  assert.match(source, /hidden=\{isMissing\}/);
  assert.match(source, /aria-hidden=\{isMissing\}/);
  assert.match(source, /renderIdeaSketch\(document\)/);
  assert.doesNotMatch(source, /File missing/);
  assert.doesNotMatch(source, /if\s*\(document\.status === "missing"\)\s*\{?\s*return\s*<UnsupportedFileView/);
});

test('unsupported page offers reveal and external open without editing content', async () => {
  const source = await readFile(new URL('../src/components/UnsupportedFileView.tsx', import.meta.url), 'utf8');
  assert.match(source, /revealItemInDir/);
  assert.match(source, /openPath/);
  assert.match(source, /has not been read or modified/);
});
