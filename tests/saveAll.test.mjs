import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { saveAllDocuments } from '../src/lib/saveCoordinator.ts';

const document = (id, dirty = true) => ({
  id,
  mode: 'standalone',
  filePath: `/${id}.is`,
  displayName: `${id}.is`,
  fileType: 'ideasketch',
  status: 'editable',
  isDirty: dirty,
  revision: dirty ? 1 : 0,
});

test('Save All isolates failures and retains successful results', async () => {
  const attempted = [];
  const results = await saveAllDocuments(
    [document('one'), document('two'), document('clean', false), document('three')],
    async (item) => {
      attempted.push(item.id);
      if (item.id === 'two') throw new Error('disk full');
      return item.id !== 'three';
    },
  );
  assert.deepEqual(attempted, ['one', 'two', 'three']);
  assert.deepEqual(results.map((result) => [result.sessionId, result.saved]), [
    ['one', true],
    ['two', false],
    ['three', false],
  ]);
});

test('window shutdown offers Save All, Discard, and Cancel before native exit', async () => {
  const source = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');
  assert.match(source, /Save All/);
  assert.match(source, /okLabel: "Discard"/);
  assert.match(source, /cancelLabel: "Cancel"/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /exitApplication\(\)/);
});
