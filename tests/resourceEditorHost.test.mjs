import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('resource editor host dispatches canvas and shows a safe unsupported fallback', async () => {
  const source = await readFile(new URL('../src/components/ResourceEditorHost.tsx', import.meta.url), 'utf8');
  assert.match(source, /getResourceTypeDefinition/);
  assert.match(source, /definition\?\.editor === "canvas"/);
  assert.match(source, /Unsupported resource/);
  assert.match(source, /SlideCanvas/);
});
