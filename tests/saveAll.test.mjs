import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { saveAllDocuments, saveDocumentsForExit } from '../src/lib/saveCoordinator.ts';

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

test('session exit saves one dirty document directly without classifying cancellation as a batch failure', async () => {
  const attempted = [];
  const result = await saveDocumentsForExit(
    [{ ...document('untitled'), filePath: '', displayName: 'Untitled.is' }, document('clean', false)],
    async (item) => {
      attempted.push(item.id);
      return false;
    },
  );

  assert.deepEqual(attempted, ['untitled']);
  assert.equal(result.kind, 'single');
  assert.equal(result.saved, false);
  assert.deepEqual(result.results.map((item) => [item.sessionId, item.saved]), [['untitled', false]]);
});

test('session exit preserves Save All isolation for multiple dirty documents', async () => {
  const result = await saveDocumentsForExit(
    [document('one'), document('two')],
    async (item) => item.id === 'one',
  );

  assert.equal(result.kind, 'batch');
  assert.equal(result.saved, false);
  assert.deepEqual(result.results.map((item) => [item.sessionId, item.saved]), [
    ['one', true],
    ['two', false],
  ]);
});

test('window shutdown awaits the exit decision and reports only true batch failures', async () => {
  const source = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');
  assert.match(source, /saveDocumentsForExit/);
  assert.doesNotMatch(source, /if \(shouldSave\) return handleSaveAll\(\)/);
  assert.match(source, /Save All/);
  assert.match(source, /okLabel: "Discard"/);
  assert.match(source, /cancelLabel: "Cancel"/);
  assert.match(source, /onCloseRequested\(async \(event\) =>/);
  assert.match(source, /const confirmed = await confirmSessionExit\(\)/);
  assert.match(source, /if \(!confirmed\) \{\s*event\.preventDefault\(\)/);
  assert.match(source, /catch \(error\) \{\s*event\.preventDefault\(\)/);
  assert.match(source, /title: "Close Error"/);
  assert.match(source, /await exitApplication\(\);\s*shouldExit = true/);
  assert.match(source, /if \(!shouldExit\) closeInProgress\.current = false/);
  assert.match(source, /exitApplication\(\)/);
});
