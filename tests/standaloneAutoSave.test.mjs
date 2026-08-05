import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');

test('standalone autosave uses target inspection, the standalone writer, and stable completion metadata', () => {
  const handler = source.match(/const handleAutoSave = useCallback\([\s\S]*?\n  \}, \[[^\]]*\]\);/)?.[0] ?? '';

  assert.match(handler, /if \(!document \|\| !document\.filePath \|\| document\.status !== "editable"\)/);
  assert.match(handler, /await inspectDocumentTarget\(document\)/);
  assert.match(handler, /document\.mode === "workspace"/);
  assert.match(handler, /saveStandaloneDocumentWithTracking\(document, model\)/);
  assert.match(handler, /pendingAutoSaveModified\.current\.set\(sessionId, sourceModified\)/);
  assert.match(handler, /SET_DOCUMENT_SOURCE_MODIFIED/);
  assert.doesNotMatch(handler, /document\.mode !== "workspace"/);
});

test('manual and automatic standalone saves share application-owned write tracking', () => {
  assert.match(source, /const saveStandaloneDocumentWithTracking = useCallback/);
  assert.match(source, /standaloneWriteGeneration/);
  assert.match(source, /standaloneWritesInProgress/);
  assert.match(source, /standaloneExpectedModified/);
  assert.match(source, /isApplicationOwnedStandaloneInspection/);

  const calls = source.match(/saveStandaloneDocumentWithTracking\(/g) ?? [];
  assert.equal(calls.length, 2, 'manual and autosave calls should share one boundary');
});
