import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  resolveDirtyDocumentsSequentially,
  saveDirtyDocumentBeforeTransition,
} from '../src/lib/unsavedChanges.ts';

const document = (id, dirty = true) => ({
  id,
  mode: 'workspace',
  filePath: `${id}.is`,
  displayName: `${id}.is`,
  fileType: 'ideasketch',
  status: 'editable',
  isDirty: dirty,
  revision: dirty ? 1 : 0,
});

test('dirty document saves directly before transition and failure blocks it', async () => {
  const attempted = [];
  const active = document('active');
  const proceed = await saveDirtyDocumentBeforeTransition(active, async (item) => {
    attempted.push(item.id);
    return false;
  });

  assert.deepEqual(attempted, ['active']);
  assert.equal(proceed, false);
});

test('clean document transitions without issuing a save', async () => {
  let attempted = false;
  const proceed = await saveDirtyDocumentBeforeTransition(document('clean', false), async () => {
    attempted = true;
    return true;
  });

  assert.equal(attempted, false);
  assert.equal(proceed, true);
});

test('legacy dirty documents resolve one at a time with the active document first', async () => {
  const attempted = [];
  const result = await resolveDirtyDocumentsSequentially(
    [document('one'), document('active'), document('clean', false), document('three')],
    'active',
    async (item) => {
      attempted.push(item.id);
      if (item.id === 'one') return 'discarded';
      if (item.id === 'three') return 'cancelled';
      return 'saved';
    },
  );

  assert.deepEqual(attempted, ['active', 'one', 'three']);
  assert.equal(result.proceed, false);
  assert.deepEqual(result.discarded.map((item) => item.id), ['one']);
});

test('Workspace switching and creation are save-gated with no Save All path', async () => {
  const editor = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');
  const openEntry = editor.slice(editor.indexOf('const openEntry ='), editor.indexOf('const handleCreateDocument ='));
  const createDocument = editor.slice(editor.indexOf('const handleCreateDocument ='), editor.indexOf('const requestClose ='));
  assert.match(editor, /saveDirtyDocumentBeforeTransition/);
  assert.match(editor, /resolveDirtyDocumentsSequentially/);
  assert.match(editor, /const openEntry = useCallback\(async/);
  assert.match(editor, /if \(!await prepareActiveDocumentTransition\(\)\) return/);
  assert.match(editor, /if \(!await prepareActiveDocumentTransition\(\)\) return undefined/);
  assert.match(openEntry, /activeDocument\.filePath === entry\.path\) \{[\s\S]*?SELECT_WORKSPACE_PATH[\s\S]*?return;[\s\S]*?\}/);
  const gatedOpen = openEntry.slice(openEntry.indexOf('if (!await prepareActiveDocumentTransition())'));
  assert.ok(gatedOpen.indexOf('prepareActiveDocumentTransition()') < gatedOpen.indexOf('SELECT_WORKSPACE_PATH'));
  assert.ok(gatedOpen.indexOf('SELECT_WORKSPACE_PATH') < gatedOpen.indexOf('activateWorkspaceEntry(entry)'));
  assert.ok(createDocument.indexOf('prepareActiveDocumentTransition()') < createDocument.indexOf('createWorkspaceDocument('));
  assert.doesNotMatch(editor, /Save All/);
  assert.doesNotMatch(editor, /handleSaveAll/);
  assert.doesNotMatch(editor, /saveCoordinator/);
  assert.doesNotMatch(editor, /event\.altKey/);
});

test('document close and session exit share one explicit three-result decision', async () => {
  const editor = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');
  const requestClose = editor.slice(editor.indexOf('const requestClose ='), editor.indexOf('const confirmSessionExit ='));
  const confirmExit = editor.slice(editor.indexOf('const confirmSessionExit ='), editor.indexOf('const confirmSessionExitRef ='));

  assert.match(requestClose, /requestUnsavedChangesDecision/);
  assert.match(requestClose, /decision === "save"/);
  assert.match(requestClose, /decision === "discard"/);
  assert.match(requestClose, /clearRecoveryForDocument/);
  assert.match(confirmExit, /requestUnsavedChangesDecision/);
  assert.match(confirmExit, /decision === "save"/);
  assert.match(confirmExit, /decision === "discard"/);
  assert.match(confirmExit, /"cancelled"/);
  assert.doesNotMatch(requestClose, /await ask\(/);
  assert.doesNotMatch(confirmExit, /await ask\(/);
});
