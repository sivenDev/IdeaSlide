import test from 'node:test';
import assert from 'node:assert/strict';

test('presentation order follows the workspace canvas projection', async () => {
  const { projectWorkspaceToSlides } = await import('../src/lib/workspaceResources.ts');
  const slides = projectWorkspaceToSlides({
    resources: [
      { id: 'canvas-root', type: 'canvas', name: 'Root', parentId: null, order: 1, contentRef: 'canvases/canvas-root.json' },
      { id: 'folder', type: 'folder', name: 'Folder', parentId: null, order: 0 },
      { id: 'canvas-child', type: 'canvas', name: 'Child', parentId: 'folder', order: 0, contentRef: 'canvases/canvas-child.json' },
    ],
    contents: {
      'canvas-root': { elements: [], appState: {}, files: {} },
      'canvas-child': { elements: [], appState: {}, files: {} },
    },
    activeResourceId: 'canvas-root',
  });
  assert.deepEqual(slides.map((slide) => slide.id), ['canvas-child', 'canvas-root']);
});
