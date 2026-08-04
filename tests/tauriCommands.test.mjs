import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/lib/tauriCommands.ts');
  } catch {
    return {};
  }
}

function v1Data() {
  return {
    manifest: {
      version: '1.0',
      created: 'created-at',
      modified: 'modified-at',
      slides: [
        { id: 'page-2', title: 'Research' },
        { id: 'page-1', title: 'Overview' },
      ],
    },
    slides: [
      { id: 'page-2', content: { type: 'excalidraw', version: 2, elements: [{ id: 'b' }], appState: {}, files: {} } },
      { id: 'page-1', content: { type: 'excalidraw', version: 2, elements: [{ id: 'a' }], appState: {}, files: {} } },
    ],
    media: [],
  };
}

test('v1 backend data converts to the temporary workspace bridge in Page order', async () => {
  const { convertFromIsFileData } = await loadModule();
  assert.equal(typeof convertFromIsFileData, 'function');

  const workspace = convertFromIsFileData(v1Data());
  assert.deepEqual(workspace.resources.map((resource) => resource.id), ['page-2', 'page-1']);
  assert.deepEqual(workspace.resources.map((resource) => resource.name), ['Research', 'Overview']);
  assert.equal(workspace.activeResourceId, 'page-2');
  assert.deepEqual(workspace.contents['page-1'].elements, [{ id: 'a' }]);
});

test('typed backend envelope routes IdeaSketch without leaking format fields into commands', async () => {
  const { convertFromIsFileData } = await loadModule();
  const workspace = convertFromIsFileData({ type: 'ideasketch', data: v1Data() });
  assert.deepEqual(workspace.resources.map((resource) => resource.id), ['page-2', 'page-1']);
});

test('workspace bridge serialization writes only v1 slides', async () => {
  const { convertToIsFileData } = await loadModule();
  assert.equal(typeof convertToIsFileData, 'function');

  const data = convertToIsFileData({
    resources: [
      { id: 'page-1', type: 'canvas', name: 'Overview', parentId: null, order: 0, contentRef: 'canvases/page-1.json' },
      { id: 'page-2', type: 'canvas', name: 'Research', parentId: null, order: 1, contentRef: 'canvases/page-2.json' },
    ],
    contents: {
      'page-1': { type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} },
      'page-2': { type: 'excalidraw', version: 2, elements: [{ id: 'shape' }], appState: {}, files: {} },
    },
    activeResourceId: 'page-2',
  }, 'created-at');

  assert.equal(data.manifest.version, '1.0');
  assert.equal(data.manifest.resources, undefined);
  assert.deepEqual(data.manifest.slides, [
    { id: 'page-1', title: 'Overview' },
    { id: 'page-2', title: 'Research' },
  ]);
  assert.equal(data.contents, undefined);
  assert.deepEqual(data.slides.map((slide) => slide.id), ['page-1', 'page-2']);
});

test('workspace bridge refuses hierarchy that v1 cannot represent', async () => {
  const { convertToIsFileData } = await loadModule();
  assert.equal(typeof convertToIsFileData, 'function');

  assert.throws(() => convertToIsFileData({
    resources: [
      { id: 'folder-1', type: 'folder', name: 'Folder', parentId: null, order: 0 },
      { id: 'page-1', type: 'canvas', name: 'Page', parentId: 'folder-1', order: 0, contentRef: 'canvases/page-1.json' },
    ],
    contents: {
      'page-1': { elements: [], appState: {}, files: {} },
    },
    activeResourceId: 'page-1',
  }), /cannot serialize.*v1/i);
});

test('v2 data is classified as protected legacy content and never flattened', async () => {
  const { convertFromIsFileData } = await loadModule();
  assert.equal(typeof convertFromIsFileData, 'function');

  assert.throws(() => convertFromIsFileData({
    manifest: {
      version: '2.0',
      created: 'created-at',
      modified: 'modified-at',
      resources: [],
    },
    contents: [],
  }), (error) => error?.kind === 'legacy-protected' && error?.version === '2.0');
});

test('Workspace open ignores legacy custom order and keeps deterministic scan order', async () => {
  const { createWorkspaceSessionFromOpenResult } = await loadModule();
  assert.equal(typeof createWorkspaceSessionFromOpenResult, 'function');
  const entries = [
    { path: 'folder', name: 'folder', kind: 'directory', readOnly: false, children: [] },
    { path: 'a.is', name: 'a.is', kind: 'file', readOnly: false, fileType: 'ideasketch', children: [] },
  ];
  const session = createWorkspaceSessionFromOpenResult({
    root: '/workspace',
    name: 'workspace',
    readOnly: false,
    entries,
    metadata: {
      exists: true,
      diagnostics: [],
      state: { schemaVersion: 3, expandedPaths: [], entryOrder: ['a.is', 'folder'] },
    },
  });
  assert.equal(session.entries, entries);
  assert.deepEqual(session.entryOrder, []);
});
