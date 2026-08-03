import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorkspaceStateSnapshot,
  mayPersistWorkspaceState,
  projectVisibleWorkspaceRows,
  restoreWorkspaceDocuments,
} from '../src/lib/workspaceState.ts';

function workspace(state) {
  return {
    root: '/workspace',
    name: 'workspace',
    readOnly: false,
    entries: [
      { path: 'drawing.is', name: 'drawing.is', kind: 'file', readOnly: false, fileType: 'ideasketch', children: [] },
      { path: 'readme.md', name: 'readme.md', kind: 'file', readOnly: false, fileType: null, children: [] },
    ],
    metadata: { exists: true, state, diagnostics: [] },
    expandedPaths: state?.expandedPaths ?? [],
  };
}

test('schema v2 restores at most one lightweight active document', () => {
  const restored = restoreWorkspaceDocuments(workspace({
    schemaVersion: 2,
    activePath: 'drawing.is',
    expandedPaths: [],
  }));
  assert.deepEqual(restored.documents.map((item) => item.status), ['loading']);
  assert.deepEqual(restored.skippedPaths, []);
  assert.equal(restored.activePath, 'drawing.is');
  assert.equal(restored.documents[0].model, undefined);
});

test('legacy schema v1 openTabs chooses one compatible active file without restoring a collection', () => {
  const restored = restoreWorkspaceDocuments(workspace({
    schemaVersion: 1,
    openTabs: ['missing.is', 'readme.md', 'drawing.is'],
    activePath: 'missing.is',
    expandedPaths: [],
  }));
  assert.deepEqual(restored.documents.map((item) => item.filePath), ['readme.md']);
  assert.deepEqual(restored.skippedPaths, ['missing.is']);
  assert.equal(restored.activePath, 'readme.md');
  assert.equal(restored.documents[0].status, 'unsupported');
});

test('schema v2 missing active file is skipped without opening another file', () => {
  const restored = restoreWorkspaceDocuments(workspace({
    schemaVersion: 2,
    activePath: 'missing.is',
    expandedPaths: [],
  }));
  assert.deepEqual(restored.documents, []);
  assert.deepEqual(restored.skippedPaths, ['missing.is']);
  assert.equal(restored.activePath, undefined);
});

test('invalid or unsupported state schema falls back without blocking Workspace open', () => {
  const restored = restoreWorkspaceDocuments(workspace({ schemaVersion: 99, openTabs: ['drawing.is'], expandedPaths: [] }));
  assert.deepEqual(restored.documents, []);
});

test('state persistence is disabled until metadata already exists', () => {
  const untouched = workspace(null);
  untouched.metadata.exists = false;
  assert.equal(mayPersistWorkspaceState(untouched), false);
  assert.equal(mayPersistWorkspaceState(workspace(null)), true);
});

test('snapshot stores only the active Workspace path and Explorer state', () => {
  const result = createWorkspaceStateSnapshot({
    mode: 'workspace',
    workspace: workspace(null),
    documents: [
      { id: 'one', mode: 'workspace', filePath: 'drawing.is', fileType: 'ideasketch', status: 'editable', isDirty: false, revision: 0 },
      { id: 'two', mode: 'standalone', filePath: '/other.is', fileType: 'ideasketch', status: 'editable', isDirty: false, revision: 0 },
    ],
    activeSessionId: 'one',
    presentationMode: 'none',
    editorRefreshToken: 0,
  });
  assert.equal(result.schemaVersion, 2);
  assert.equal('openTabs' in result, false);
  assert.equal(result.activePath, 'drawing.is');
});

test('visible-row projection handles thousands of metadata-only entries without document hydration', () => {
  const children = Array.from({ length: 5_000 }, (_, index) => ({
    path: `folder/file-${index}.is`,
    name: `file-${index}.is`,
    kind: 'file',
    readOnly: false,
    fileType: 'ideasketch',
    children: [],
  }));
  const rows = projectVisibleWorkspaceRows([
    { path: 'folder', name: 'folder', kind: 'directory', readOnly: false, children },
  ], new Set(['folder']));
  assert.equal(rows.length, 5_001);
  assert.equal(rows[1].depth, 1);
  assert.equal('model' in rows[1].entry, false);
});
