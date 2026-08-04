import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorkspaceStateSnapshot,
  mayPersistWorkspaceState,
  projectVisibleWorkspaceRows,
  restoreWorkspaceDocuments,
} from '../src/lib/workspaceState.ts';
import {
  applyWorkspaceEntryOrder,
  flattenWorkspaceEntryOrder,
  projectWorkspaceEntryDrop,
  remapWorkspaceEntryOrder,
} from '../src/lib/workspaceOrdering.ts';

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
  const reordered = workspace(null);
  reordered.metadata.exists = false;
  reordered.entryOrder = ['drawing.is'];
  assert.equal(mayPersistWorkspaceState(reordered), false);
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
  assert.equal(result.schemaVersion, 3);
  assert.equal('openTabs' in result, false);
  assert.equal(result.activePath, 'drawing.is');
  assert.deepEqual(result.entryOrder, []);
});

test('snapshot clears legacy custom order even when the session still carries it', () => {
  const legacyWorkspace = workspace(null);
  legacyWorkspace.entryOrder = ['readme.md', 'drawing.is'];
  const result = createWorkspaceStateSnapshot({
    mode: 'workspace',
    workspace: legacyWorkspace,
    documents: [],
    presentationMode: 'none',
    editorRefreshToken: 0,
  });
  assert.deepEqual(result.entryOrder, []);
});

test('schema v3 restores one active document like schema v2', () => {
  const restored = restoreWorkspaceDocuments(workspace({
    schemaVersion: 3,
    activePath: 'drawing.is',
    expandedPaths: [],
    entryOrder: ['drawing.is'],
  }));
  assert.equal(restored.activePath, 'drawing.is');
});

test('custom Workspace order supports mixed root and nested siblings', () => {
  const entries = [
    { path: 'folder', name: 'folder', kind: 'directory', readOnly: false, children: [
      { path: 'folder/a.is', name: 'a.is', kind: 'file', readOnly: false, fileType: 'ideasketch', children: [] },
      { path: 'folder/b.is', name: 'b.is', kind: 'file', readOnly: false, fileType: 'ideasketch', children: [] },
    ] },
    { path: 'drawing.is', name: 'drawing.is', kind: 'file', readOnly: false, fileType: 'ideasketch', children: [] },
  ];
  const ordered = applyWorkspaceEntryOrder(entries, ['drawing.is', 'folder', 'folder/b.is', 'folder/a.is']);
  assert.deepEqual(flattenWorkspaceEntryOrder(ordered), ['drawing.is', 'folder', 'folder/b.is', 'folder/a.is']);
});

test('Workspace drop projection reorders siblings and remaps moved subtrees', () => {
  const entries = [
    { path: 'a', name: 'a', kind: 'directory', readOnly: false, children: [
      { path: 'a/drawing.is', name: 'drawing.is', kind: 'file', readOnly: false, fileType: 'ideasketch', children: [] },
    ] },
    { path: 'b', name: 'b', kind: 'directory', readOnly: false, children: [] },
  ];
  const moved = projectWorkspaceEntryDrop(entries, {
    sourcePath: 'a/drawing.is',
    targetPath: 'b',
    position: 'inside',
  });
  assert.equal(moved.changed, true);
  assert.equal(moved.destinationParentPath, 'b');
  assert.equal(moved.movedPath, 'b/drawing.is');
  assert.deepEqual(flattenWorkspaceEntryOrder(moved.entries), ['a', 'b', 'b/drawing.is']);
  assert.deepEqual(remapWorkspaceEntryOrder(['a', 'a/drawing.is'], 'a', 'renamed'), ['renamed', 'renamed/drawing.is']);
});

test('Workspace drop projection rejects same-parent ordering intents', () => {
  const entries = [
    { path: 'a.is', name: 'a.is', kind: 'file', readOnly: false, fileType: 'ideasketch', children: [] },
    { path: 'b.is', name: 'b.is', kind: 'file', readOnly: false, fileType: 'ideasketch', children: [] },
  ];
  assert.equal(projectWorkspaceEntryDrop(entries, {
    sourcePath: 'a.is', targetPath: 'b.is', position: 'after',
  }).changed, false);
  assert.equal(projectWorkspaceEntryDrop(entries, {
    sourcePath: 'a.is', position: 'inside',
  }).changed, false);
});

test('Workspace drop projection rejects collisions and descendant targets', () => {
  const entries = [
    { path: 'a', name: 'a', kind: 'directory', readOnly: false, children: [
      { path: 'a/child', name: 'child', kind: 'directory', readOnly: false, children: [] },
    ] },
    { path: 'b', name: 'b', kind: 'directory', readOnly: false, children: [
      { path: 'b/a', name: 'a', kind: 'directory', readOnly: false, children: [] },
    ] },
  ];
  assert.equal(projectWorkspaceEntryDrop(entries, {
    sourcePath: 'a', targetPath: 'a/child', position: 'inside',
  }).changed, false);
  assert.equal(projectWorkspaceEntryDrop(entries, {
    sourcePath: 'a', targetPath: 'b', position: 'inside',
  }).changed, false);
});

test('Workspace drop projection rejects read-only and Symlink sources', () => {
  for (const source of [
    { path: 'locked.is', name: 'locked.is', kind: 'file', readOnly: true, fileType: 'ideasketch', children: [] },
    { path: 'linked', name: 'linked', kind: 'symlink', readOnly: false, children: [] },
  ]) {
    const entries = [source, { path: 'target', name: 'target', kind: 'directory', readOnly: false, children: [] }];
    assert.equal(projectWorkspaceEntryDrop(entries, {
      sourcePath: source.path, targetPath: 'target', position: 'inside',
    }).changed, false);
  }
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
