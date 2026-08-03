import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorkspaceStateSnapshot,
  mayPersistWorkspaceState,
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

test('restore keeps lightweight supported and unsupported Tabs and skips missing files', () => {
  const restored = restoreWorkspaceDocuments(workspace({
    schemaVersion: 1,
    openTabs: ['missing.is', 'readme.md', 'drawing.is'],
    activePath: 'drawing.is',
    expandedPaths: [],
  }));
  assert.deepEqual(restored.documents.map((item) => item.status), ['unsupported', 'loading']);
  assert.deepEqual(restored.skippedPaths, ['missing.is']);
  assert.equal(restored.activePath, 'drawing.is');
  assert.equal(restored.documents[1].model, undefined);
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

test('snapshot stores only Workspace relative paths and the active Workspace Tab', () => {
  const result = createWorkspaceStateSnapshot({
    mode: 'workspace',
    workspace: workspace(null),
    documents: [
      { id: 'one', mode: 'workspace', filePath: 'drawing.is', fileType: 'ideasketch', status: 'editable', isDirty: false, revision: 0 },
      { id: 'two', mode: 'standalone', filePath: '/other.is', fileType: 'ideasketch', status: 'editable', isDirty: false, revision: 0 },
    ],
    activeSessionId: 'one',
    recentlyClosed: [],
    presentationMode: 'none',
    editorRefreshToken: 0,
  });
  assert.deepEqual(result.openTabs, ['drawing.is']);
  assert.equal(result.activePath, 'drawing.is');
});
