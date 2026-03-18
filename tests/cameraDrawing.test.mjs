import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/lib/cameraDrawing.ts');
  } catch {
    return {};
  }
}

test('enterCameraDrawingMode activates the custom camera tool', async () => {
  const { enterCameraDrawingMode } = await loadModule();

  assert.equal(typeof enterCameraDrawingMode, 'function');

  const activeTools = [];
  const api = {
    setActiveTool(tool) {
      activeTools.push(tool);
    },
  };

  enterCameraDrawingMode(api);

  assert.deepEqual(activeTools, [{ type: 'custom', customType: 'camera' }]);
});

test('exitCameraDrawingMode clears the preview rectangle and restores selection mode', async () => {
  const { CAMERA_PREVIEW_ID, exitCameraDrawingMode } = await loadModule();

  assert.equal(typeof exitCameraDrawingMode, 'function');
  assert.equal(typeof CAMERA_PREVIEW_ID, 'string');

  const updates = [];
  const activeTools = [];
  const persistedElement = { id: 'shape-1', type: 'rectangle' };
  const previewElement = { id: CAMERA_PREVIEW_ID, type: 'rectangle' };

  const api = {
    getSceneElements() {
      return [persistedElement, previewElement];
    },
    updateScene(payload) {
      updates.push(payload);
    },
    setActiveTool(tool) {
      activeTools.push(tool);
    },
  };

  exitCameraDrawingMode(api);

  assert.deepEqual(updates, [
    {
      elements: [persistedElement],
    },
  ]);
  assert.deepEqual(activeTools, [{ type: 'selection' }]);
});
