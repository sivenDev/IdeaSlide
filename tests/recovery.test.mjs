import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  classifyRecoveryDraft,
  createRecoveryDraft,
  recoveryScopeForDocument,
  RECOVERY_SCHEMA_VERSION,
} from '../src/lib/recovery.ts';

const model = { type: 'ideasketch', formatVersion: '1.0', created: '', modified: '', pages: [] };

test('Workspace and Standalone recovery scopes stay isolated', () => {
  const workspace = { id: 'w', mode: 'workspace', filePath: 'drawing.is', fileType: 'ideasketch', status: 'editable', isDirty: true, revision: 1 };
  const standalone = { ...workspace, id: 's', mode: 'standalone', filePath: '' };
  assert.deepEqual(recoveryScopeForDocument(workspace, '/root'), { mode: 'workspace', root: '/root', path: 'drawing.is' });
  assert.deepEqual(recoveryScopeForDocument(standalone), { mode: 'standalone', path: '', sessionId: 's' });
});

test('recovery drafts are versioned and detect source changes without overwriting', () => {
  const document = { id: 's', mode: 'standalone', filePath: '/drawing.is', fileType: 'ideasketch', status: 'editable', isDirty: true, revision: 1, sourceModified: 'before' };
  const draft = createRecoveryDraft(document, model);
  assert.equal(draft.schemaVersion, RECOVERY_SCHEMA_VERSION);
  assert.equal(classifyRecoveryDraft(draft, document), 'current');
  assert.equal(classifyRecoveryDraft(draft, { ...document, sourceModified: 'after' }), 'source-changed');
  assert.equal(classifyRecoveryDraft({ ...draft, schemaVersion: 99 }, document), 'invalid');
});

test('startup discovery and close lifecycle are wired for standalone drafts', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const editor = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');
  assert.match(app, /listStandaloneRecoveryDrafts/);
  assert.match(app, /deleteStandaloneRecoveryDraft/);
  assert.match(editor, /writeRecoveryDraft/);
  assert.match(editor, /clearRecoveryForDocument/);
  assert.match(editor, /onCloseRequested\(async \(event\) =>/);
  assert.match(editor, /const confirmed = await confirmSessionExit\(\)/);
  assert.match(editor, /resolveDirtyDocumentsSequentially/);
  assert.match(editor, /requestUnsavedChangesDecision/);
  assert.match(editor, /decision === "discard"/);
  assert.doesNotMatch(editor, /Save All/);
  assert.doesNotMatch(editor, /More Options/);
  assert.match(editor, /if \(!confirmed\) \{\s*event\.preventDefault\(\)/);
  assert.match(editor, /if \(!shouldExit\) closeInProgress\.current = false/);
  assert.match(editor, /exitApplication/);
});
