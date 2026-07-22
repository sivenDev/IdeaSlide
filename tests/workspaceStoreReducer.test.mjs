import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/lib/workspaceStoreReducer.ts');
  } catch {
    return {};
  }
}

function initialState() {
  return {
    resources: [
      { id: 'folder-1', type: 'folder', name: 'Folder', parentId: null, order: 0 },
      { id: 'canvas-1', type: 'canvas', name: 'One', parentId: 'folder-1', order: 0, contentRef: 'canvases/canvas-1.json' },
      { id: 'canvas-2', type: 'canvas', name: 'Two', parentId: null, order: 1, contentRef: 'canvases/canvas-2.json' },
    ],
    contents: {
      'canvas-1': { elements: [{ id: 'one' }], appState: {}, files: {} },
      'canvas-2': { elements: [{ id: 'two' }], appState: {}, files: {} },
    },
    activeResourceId: 'canvas-1',
    filePath: '/tmp/test.is',
    isDirty: false,
    presentationMode: 'none',
    currentCameraIndex: 0,
    transitionSpeed: 'slow',
    activeSessions: new Map(),
  };
}

test('workspace reducer renames and moves resources by stable id', async () => {
  const { workspaceStoreReducer } = await loadModule();
  assert.equal(typeof workspaceStoreReducer, 'function');

  let state = workspaceStoreReducer(initialState(), {
    type: 'RENAME_RESOURCE', payload: { resourceId: 'canvas-1', name: 'Research' },
  });
  state = workspaceStoreReducer(state, {
    type: 'MOVE_RESOURCE', payload: { resourceId: 'canvas-1', parentId: null, index: 0 },
  });

  const moved = state.resources.find((resource) => resource.id === 'canvas-1');
  assert.equal(moved.name, 'Research');
  assert.equal(moved.parentId, null);
  assert.equal(moved.order, 0);
  assert.equal(state.activeResourceId, 'canvas-1');
  assert.equal(state.isDirty, true);
});

test('workspace reducer rejects moving a folder into its descendant', async () => {
  const { workspaceStoreReducer } = await loadModule();
  assert.equal(typeof workspaceStoreReducer, 'function');

  const state = initialState();
  const next = workspaceStoreReducer(state, {
    type: 'MOVE_RESOURCE', payload: { resourceId: 'folder-1', parentId: 'canvas-1', index: 0 },
  });
  assert.equal(next, state);
});

test('deleting the active subtree selects a deterministic surviving canvas and keeps the last canvas', async () => {
  const { workspaceStoreReducer } = await loadModule();
  assert.equal(typeof workspaceStoreReducer, 'function');

  const state = initialState();
  const next = workspaceStoreReducer(state, {
    type: 'DELETE_RESOURCE', payload: { resourceId: 'folder-1' },
  });
  assert.equal(next.activeResourceId, 'canvas-2');
  assert.equal(next.contents['canvas-1'], undefined);

  const guarded = workspaceStoreReducer(next, {
    type: 'DELETE_RESOURCE', payload: { resourceId: 'canvas-2' },
  });
  assert.equal(guarded, next);
});

test('canvas commits update content by resource id, independent of tree order', async () => {
  const { workspaceStoreReducer } = await loadModule();
  assert.equal(typeof workspaceStoreReducer, 'function');

  const state = initialState();
  const next = workspaceStoreReducer(state, {
    type: 'COMMIT_CANVAS',
    payload: {
      resourceId: 'canvas-1',
      slide: { id: 'canvas-1', elements: [{ id: 'updated' }], appState: {}, files: {} },
    },
  });
  assert.equal(next.contents['canvas-1'].elements[0].id, 'updated');
  assert.equal(next.contents['canvas-2'].elements[0].id, 'two');
});

test('unknown resources cannot be renamed or moved by registered workspace actions', async () => {
  const { workspaceStoreReducer } = await loadModule();
  const state = initialState();
  state.resources.push({
    id: 'data-1', type: 'dataset', name: 'Data', parentId: null, order: 2,
    contentRef: 'datasets/data-1.json', pluginMetadata: { schema: 3 },
  });
  state.contents['data-1'] = { rows: [1] };

  const renamed = workspaceStoreReducer(state, {
    type: 'RENAME_RESOURCE', payload: { resourceId: 'data-1', name: 'Changed' },
  });
  const moved = workspaceStoreReducer(state, {
    type: 'MOVE_RESOURCE', payload: { resourceId: 'data-1', parentId: 'folder-1', index: 0 },
  });
  assert.equal(renamed, state);
  assert.equal(moved, state);
});
