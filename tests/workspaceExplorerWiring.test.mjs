import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('workspace explorer provides folder and canvas creation, rename, and tree drag interactions', async () => {
  const source = await readSource('src/components/WorkspaceExplorer.tsx');
  assert.match(source, /New Folder/);
  assert.match(source, /New Canvas/);
  assert.match(source, /onRename/);
  assert.match(source, /onMove/);
  assert.match(source, /overflow-y-auto/);
  assert.doesNotMatch(source, /thumbnail/i);
});

test('workspace resource rows expose keyboard selection and inline rename', async () => {
  const source = await readSource('src/components/WorkspaceResourceRow.tsx');
  assert.match(source, /F2/);
  assert.match(source, /Enter/);
  assert.match(source, /Escape/);
  assert.match(source, /draggable/);
});
