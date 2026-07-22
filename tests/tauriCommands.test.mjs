import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/lib/tauriCommands.ts');
  } catch {
    return {};
  }
}

test('v2 backend data converts to a workspace without dropping unknown metadata', async () => {
  const { convertFromIsFileData } = await loadModule();
  assert.equal(typeof convertFromIsFileData, 'function');

  const workspace = convertFromIsFileData({
    manifest: {
      version: '2.0', created: 'c', modified: 'm', workspaceTheme: 'violet',
      resources: [
        { id: 'canvas-1', type: 'canvas', name: 'Sketch', parentId: null, order: 0, contentRef: 'canvases/canvas-1.json' },
        { id: 'data-1', type: 'dataset', name: 'Data', parentId: null, order: 1, contentRef: 'datasets/data-1.json', pluginMetadata: { schema: 3 } },
      ],
    },
    contents: [
      { id: 'canvas-1', content: { elements: [], appState: {}, files: {} } },
      { id: 'data-1', content: { rows: [1, 2] } },
    ],
    media: [],
  });

  assert.equal(workspace.activeResourceId, 'canvas-1');
  assert.equal(workspace.resources[1].pluginMetadata.schema, 3);
  assert.equal(workspace.manifestExtra.workspaceTheme, 'violet');
  assert.deepEqual(workspace.contents['data-1'], { rows: [1, 2] });
});

test('workspace serialization writes only v2 resources and canvases paths', async () => {
  const { convertToIsFileData } = await loadModule();
  assert.equal(typeof convertToIsFileData, 'function');

  const data = convertToIsFileData({
    resources: [
      { id: 'canvas-1', type: 'canvas', name: 'Sketch', parentId: null, order: 0, contentRef: 'canvases/canvas-1.json' },
    ],
    contents: {
      'canvas-1': { elements: [], appState: {}, files: {} },
    },
    activeResourceId: 'canvas-1',
    manifestExtra: { workspaceTheme: 'violet' },
  }, 'created-at');

  assert.equal(data.manifest.version, '2.0');
  assert.equal(data.manifest.slides, undefined);
  assert.equal(data.manifest.resources[0].contentRef, 'canvases/canvas-1.json');
  assert.equal(data.manifest.workspaceTheme, 'violet');
  assert.equal(data.contents[0].id, 'canvas-1');
});

test('active canvas identity survives v2 serialization and reopen', async () => {
  const { convertFromIsFileData, convertToIsFileData } = await loadModule();
  const workspace = {
    resources: [
      { id: 'canvas-1', type: 'canvas', name: 'One', parentId: null, order: 0, contentRef: 'canvases/canvas-1.json' },
      { id: 'canvas-2', type: 'canvas', name: 'Two', parentId: null, order: 1, contentRef: 'canvases/canvas-2.json' },
    ],
    contents: {
      'canvas-1': { elements: [], appState: {}, files: {} },
      'canvas-2': { elements: [], appState: {}, files: {} },
    },
    activeResourceId: 'canvas-2',
  };

  const serialized = convertToIsFileData(workspace, 'created-at');
  assert.equal(serialized.manifest.activeResourceId, 'canvas-2');
  assert.equal(convertFromIsFileData(serialized).activeResourceId, 'canvas-2');
});
