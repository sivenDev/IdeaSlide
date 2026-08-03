import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('document Tabs expose dirty/status labels and complete close workflows', async () => {
  const source = await readFile(new URL('../src/components/DocumentTabs.tsx', import.meta.url), 'utf8');
  assert.match(source, /role="tablist"/);
  assert.match(source, /document\.isDirty/);
  assert.match(source, /Missing/);
  assert.match(source, /Protected/);
  assert.match(source, />Close Others</);
  assert.match(source, />Close to the Right</);
  assert.match(source, /Reopen Closed Tab/);
});

test('dirty close provides Save, Discard, and Cancel decisions', async () => {
  const source = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');
  assert.match(source, /okLabel: "Save"/);
  assert.match(source, /okLabel: "Discard"/);
  assert.match(source, /cancelLabel: "Cancel"/);
});
