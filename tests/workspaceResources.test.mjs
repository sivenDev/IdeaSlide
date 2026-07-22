import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/lib/workspaceResources.ts');
  } catch {
    return {};
  }
}

test('workspace resources project canvases in deterministic depth-first order', async () => {
  const { getOrderedCanvasResources } = await loadModule();
  assert.equal(typeof getOrderedCanvasResources, 'function');

  const resources = [
    { id: 'canvas-root', type: 'canvas', name: 'Root', parentId: null, order: 1, contentRef: 'canvases/canvas-root.json' },
    { id: 'folder-a', type: 'folder', name: 'Folder', parentId: null, order: 0 },
    { id: 'canvas-b', type: 'canvas', name: 'B', parentId: 'folder-a', order: 1, contentRef: 'canvases/canvas-b.json' },
    { id: 'canvas-a', type: 'canvas', name: 'A', parentId: 'folder-a', order: 0, contentRef: 'canvases/canvas-a.json' },
  ];

  assert.deepEqual(
    getOrderedCanvasResources(resources).map((resource) => resource.id),
    ['canvas-a', 'canvas-b', 'canvas-root'],
  );
});

test('workspace validation rejects cycles and accepts unknown resource types', async () => {
  const { validateWorkspaceResources } = await loadModule();
  assert.equal(typeof validateWorkspaceResources, 'function');

  assert.throws(() => validateWorkspaceResources([
    { id: 'folder-a', type: 'folder', name: 'A', parentId: 'folder-b', order: 0 },
    { id: 'folder-b', type: 'folder', name: 'B', parentId: 'folder-a', order: 0 },
    { id: 'canvas-1', type: 'canvas', name: 'Canvas', parentId: null, order: 0, contentRef: 'canvases/canvas-1.json' },
  ]), /cycle/i);

  assert.doesNotThrow(() => validateWorkspaceResources([
    { id: 'canvas-1', type: 'canvas', name: 'Canvas', parentId: null, order: 0, contentRef: 'canvases/canvas-1.json' },
    { id: 'data-1', type: 'dataset', name: 'Data', parentId: null, order: 1, contentRef: 'datasets/data-1.json', pluginMetadata: { schema: 3 } },
  ]));
});

test('canvas compatibility projection preserves names and scene content', async () => {
  const { projectWorkspaceToSlides } = await loadModule();
  assert.equal(typeof projectWorkspaceToSlides, 'function');

  const workspace = {
    resources: [
      { id: 'canvas-1', type: 'canvas', name: 'Sketch', parentId: null, order: 0, contentRef: 'canvases/canvas-1.json' },
    ],
    contents: {
      'canvas-1': { type: 'excalidraw', version: 2, elements: [{ id: 'shape-1' }], appState: {}, files: {} },
    },
    activeResourceId: 'canvas-1',
  };

  assert.deepEqual(projectWorkspaceToSlides(workspace), [{
    id: 'canvas-1',
    title: 'Sketch',
    elements: [{ id: 'shape-1' }],
    appState: {},
    files: {},
  }]);
});

test('resource type registry separates registered editors from unknown fallback types', async () => {
  const { getResourceTypeDefinition, isRegisteredResourceType } = await import('../src/lib/resourceTypeRegistry.ts');
  assert.equal(getResourceTypeDefinition('canvas').editor, 'canvas');
  assert.equal(getResourceTypeDefinition('canvas').participatesInPresentation, true);
  assert.equal(getResourceTypeDefinition('folder').editor, 'folder');
  assert.equal(isRegisteredResourceType('dataset'), false);
});
