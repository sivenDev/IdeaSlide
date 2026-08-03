import test from 'node:test';
import assert from 'node:assert/strict';

const { appStoreReducer, createInitialAppState, prepareDocumentSession } = await import('../src/lib/appStoreReducer.ts');

function document(id, path, mode = 'workspace') {
  return prepareDocumentSession({
    id,
    mode,
    filePath: path,
    fileType: 'ideasketch',
    status: 'loading',
    isDirty: false,
    revision: 0,
  }, '/workspace');
}

test('canonical Workspace paths activate one foreground document without duplicates', () => {
  let state = {
    ...createInitialAppState(),
    mode: 'workspace',
    workspace: { root: '/workspace', name: 'workspace', readOnly: false, entries: [], metadata: { exists: false, diagnostics: [] }, expandedPaths: [] },
  };
  state = appStoreReducer(state, { type: 'OPEN_DOCUMENT', document: document('one', 'folder\\drawing.is') });
  state = appStoreReducer(state, { type: 'OPEN_DOCUMENT', document: document('two', 'folder/drawing.is') });
  assert.equal(state.documents.length, 1);
  assert.equal(state.activeSessionId, 'one');
});

test('Workspace switching evicts clean inactive sessions and retains protected sessions', () => {
  const workspace = { root: '/workspace', name: 'workspace', readOnly: false, entries: [], metadata: { exists: false, diagnostics: [] }, expandedPaths: [] };
  let clean = { ...createInitialAppState(), mode: 'workspace', workspace };
  clean = appStoreReducer(clean, { type: 'OPEN_DOCUMENT', document: { ...document('a', 'a.is'), status: 'editable' } });
  clean = appStoreReducer(clean, { type: 'OPEN_DOCUMENT', document: { ...document('b', 'b.is'), status: 'editable' } });
  assert.deepEqual(clean.documents.map((item) => item.id), ['b']);

  for (const status of ['editable', 'conflict', 'missing', 'read-only', 'external-change', 'root-missing', 'error']) {
    const previous = { ...document(`a-${status}`, `a-${status}.is`), status, isDirty: status === 'editable' };
    let state = {
      ...createInitialAppState(),
      mode: 'workspace',
      workspace,
      documents: [previous],
      activeSessionId: previous.id,
    };
    state = appStoreReducer(state, { type: 'OPEN_DOCUMENT', document: { ...document(`b-${status}`, `b-${status}.is`), status: 'editable' } });
    assert.deepEqual(state.documents.map((item) => item.id), [previous.id, `b-${status}`], status);
    assert.equal(state.activeSessionId, `b-${status}`);
  }
});

test('reactivating a protected canonical session does not replace it with freshly opened data', () => {
  const workspace = { root: '/workspace', name: 'workspace', readOnly: false, entries: [], metadata: { exists: false, diagnostics: [] }, expandedPaths: [] };
  const dirty = { ...document('dirty', 'folder/drawing.is'), status: 'editable', isDirty: true, revision: 7 };
  const state = appStoreReducer({
    ...createInitialAppState(),
    mode: 'workspace',
    workspace,
    documents: [dirty, { ...document('clean', 'other.is'), status: 'editable' }],
    activeSessionId: 'clean',
  }, { type: 'OPEN_DOCUMENT', document: { ...document('fresh', 'folder\\drawing.is'), status: 'editable' } });
  assert.deepEqual(state.documents.map((item) => item.id), ['dirty']);
  assert.equal(state.documents[0].revision, 7);
  assert.equal(state.activeSessionId, 'dirty');
});

test('Standalone open replaces the previous foreground session and close leaves no implicit fallback', () => {
  let state = { ...createInitialAppState(), mode: 'standalone' };
  state = appStoreReducer(state, { type: 'OPEN_DOCUMENT', document: document('a', '/a.is', 'standalone') });
  state = appStoreReducer(state, { type: 'OPEN_DOCUMENT', document: document('b', '/b.is', 'standalone') });
  assert.deepEqual(state.documents.map((item) => item.id), ['b']);
  state = appStoreReducer(state, { type: 'CLOSE_DOCUMENT', sessionId: 'b' });
  assert.equal(state.activeSessionId, undefined);
  assert.deepEqual(state.documents, []);
  assert.equal('recentlyClosed' in state, false);
});

test('Workspace path remap updates open descendants without changing document identity', () => {
  let state = {
    ...createInitialAppState(),
    mode: 'workspace',
    workspace: { root: '/workspace', name: 'workspace', readOnly: false, entries: [], metadata: { exists: true, diagnostics: [] }, expandedPaths: [] },
    documents: [document('one', 'old/drawing.is')],
    activeSessionId: 'one',
  };
  state = appStoreReducer(state, { type: 'REMAP_WORKSPACE_PATH', fromPath: 'old', toPath: 'renamed' });
  assert.equal(state.documents[0].filePath, 'renamed/drawing.is');
  assert.equal(state.documents[0].id, 'one');
});

test('protected sessions cannot be dirtied through model updates', () => {
  const protectedDocument = { ...document('legacy', '/legacy.is', 'standalone'), status: 'legacy-protected' };
  const state = appStoreReducer({ ...createInitialAppState(), mode: 'standalone', documents: [protectedDocument] }, {
    type: 'UPDATE_DOCUMENT_MODEL',
    sessionId: 'legacy',
    model: { type: 'ideasketch', formatVersion: '1.0', created: '', modified: '', pages: [] },
  });
  assert.equal(state.documents[0].isDirty, false);
  assert.equal(state.documents[0].revision, 0);
});

test('conflict and missing sessions remain editable in memory for Save As recovery', () => {
  const model = { type: 'ideasketch', formatVersion: '1.0', created: '', modified: '', pages: [] };
  for (const status of ['conflict', 'missing', 'root-missing']) {
    const session = { ...document(status, `/${status}.is`, 'standalone'), status };
    const state = appStoreReducer({ ...createInitialAppState(), mode: 'standalone', documents: [session] }, {
      type: 'UPDATE_DOCUMENT_MODEL',
      sessionId: status,
      model,
    });
    assert.equal(state.documents[0].isDirty, true);
    assert.equal(state.documents[0].model, model);
  }
});

test('Workspace watcher transitions clean, dirty, deleted, renamed, and missing-root sessions safely', () => {
  const workspaceEntry = {
    path: 'folder', name: 'folder', kind: 'directory', readOnly: false, children: [
      { path: 'folder/drawing.is', name: 'drawing.is', kind: 'file', fileType: 'ideasketch', readOnly: false, children: [] },
    ],
  };
  const base = {
    ...createInitialAppState(),
    mode: 'workspace',
    workspace: { root: '/workspace', name: 'workspace', readOnly: false, entries: [workspaceEntry], metadata: { exists: true, diagnostics: [] }, expandedPaths: ['folder'] },
    documents: [{ ...document('one', 'folder/drawing.is'), status: 'editable', sourceModified: 'before' }],
    activeSessionId: 'one',
  };
  const modified = appStoreReducer(base, { type: 'APPLY_WORKSPACE_CHANGE', event: { kind: 'modify', path: 'folder/drawing.is', entry: { path: 'folder/drawing.is', name: 'drawing.is', kind: 'file', readOnly: false, modified: 'after', children: [] } } });
  assert.equal(modified.documents[0].status, 'external-change');
  const conflicted = appStoreReducer({ ...base, documents: [{ ...base.documents[0], isDirty: true }] }, { type: 'APPLY_WORKSPACE_CHANGE', event: { kind: 'modify', path: 'folder/drawing.is' } });
  assert.equal(conflicted.documents[0].status, 'conflict');
  const renamed = appStoreReducer(base, { type: 'APPLY_WORKSPACE_CHANGE', event: { kind: 'rename', oldPath: 'folder', newPath: 'renamed' } });
  assert.equal(renamed.documents[0].filePath, 'renamed/drawing.is');
  const removed = appStoreReducer(base, { type: 'APPLY_WORKSPACE_CHANGE', event: { kind: 'remove', path: 'folder' } });
  assert.equal(removed.documents[0].status, 'missing');
  assert.equal(removed.workspace.entries[0].children[0].path, 'folder/drawing.is');
  const rootMissing = appStoreReducer(base, { type: 'APPLY_WORKSPACE_CHANGE', event: { kind: 'rootMissing' } });
  assert.equal(rootMissing.workspace.status, 'root-missing');
  assert.equal(rootMissing.documents[0].status, 'root-missing');
  const writable = appStoreReducer({ ...base, documents: [{ ...base.documents[0], status: 'read-only', readOnly: true }] }, {
    type: 'APPLY_WORKSPACE_CHANGE',
    event: { kind: 'modify', path: 'folder/drawing.is', entry: { path: 'folder/drawing.is', name: 'drawing.is', kind: 'file', readOnly: false, modified: 'before', children: [] } },
  });
  assert.equal(writable.documents[0].status, 'editable');
  assert.equal(writable.documents[0].readOnly, false);
});
