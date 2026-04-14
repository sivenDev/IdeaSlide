import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/lib/previewKeys.ts');
  } catch {
    return {};
  }
}

test('buildSlidePreviewKey is stable for equivalent scene data', async () => {
  const { buildSlidePreviewKey } = await loadModule();

  assert.equal(typeof buildSlidePreviewKey, 'function');

  const first = buildSlidePreviewKey(
    [{ id: 'shape-1', version: 1, x: 0, y: 0, width: 10, height: 10 }],
    {},
  );
  const second = buildSlidePreviewKey(
    [{ id: 'shape-1', version: 1, x: 0, y: 0, width: 10, height: 10 }],
    {},
  );

  assert.equal(first, second);
});

test('extractPreviewAppState keeps only preview-relevant appState', async () => {
  const { extractPreviewAppState } = await loadModule();

  assert.equal(typeof extractPreviewAppState, 'function');
  assert.deepEqual(
    extractPreviewAppState({
      viewBackgroundColor: '#fefefe',
      selectedElementIds: { a: true },
      scrollX: 120,
      collaborators: new Map([['u1', {}]]),
    }),
    {
      viewBackgroundColor: '#fefefe',
    },
  );
});

test('buildSlidePreviewKey changes when the slide scene changes', async () => {
  const { buildSlidePreviewKey } = await loadModule();

  assert.equal(typeof buildSlidePreviewKey, 'function');

  const first = buildSlidePreviewKey(
    [{ id: 'shape-1', version: 1, x: 0, y: 0, width: 10, height: 10 }],
    {},
  );
  const second = buildSlidePreviewKey(
    [{ id: 'shape-1', version: 2, x: 0, y: 0, width: 10, height: 10 }],
    {},
  );

  assert.notEqual(first, second);
});

test('buildSlidePreviewKey changes when the exported background changes', async () => {
  const { buildSlidePreviewKey } = await loadModule();

  assert.equal(typeof buildSlidePreviewKey, 'function');

  const first = buildSlidePreviewKey(
    [{ id: 'shape-1', version: 1, x: 0, y: 0, width: 10, height: 10 }],
    {},
    { viewBackgroundColor: '#ffffff' },
  );
  const second = buildSlidePreviewKey(
    [{ id: 'shape-1', version: 1, x: 0, y: 0, width: 10, height: 10 }],
    {},
    { viewBackgroundColor: '#f5f5f5' },
  );

  assert.notEqual(first, second);
});

test('buildCameraPreviewKey is stable for equivalent camera preview metadata', async () => {
  const { buildCameraPreviewKey } = await loadModule();

  assert.equal(typeof buildCameraPreviewKey, 'function');

  const first = buildCameraPreviewKey({
    sceneFingerprint: 'scene-v1',
    cameraSignature: 'camera-1:1:10,20,100,80:#1e90ff',
    background: '{"viewBackgroundColor":"#ffffff"}',
  });
  const second = buildCameraPreviewKey({
    sceneFingerprint: 'scene-v1',
    cameraSignature: 'camera-1:1:10,20,100,80:#1e90ff',
    background: '{"viewBackgroundColor":"#ffffff"}',
  });

  assert.equal(first, second);
});

test('buildCameraPreviewKey changes when non-camera scene content changes', async () => {
  const { buildCameraPreviewKey } = await loadModule();

  assert.equal(typeof buildCameraPreviewKey, 'function');

  const first = buildCameraPreviewKey({
    sceneFingerprint: 'scene-v1',
    cameraSignature: 'camera-1:1:10,20,100,80:#1e90ff',
    background: '{"viewBackgroundColor":"#ffffff"}',
  });
  const second = buildCameraPreviewKey({
    sceneFingerprint: 'scene-v2',
    cameraSignature: 'camera-1:1:10,20,100,80:#1e90ff',
    background: '{"viewBackgroundColor":"#ffffff"}',
  });

  assert.notEqual(first, second);
});

test('buildCameraPreviewKey changes when camera bounds change', async () => {
  const { buildCameraPreviewKey } = await loadModule();

  assert.equal(typeof buildCameraPreviewKey, 'function');

  const first = buildCameraPreviewKey({
    cameraSignature: 'camera-1:1:10,20,100,80:#1e90ff',
    background: '{"viewBackgroundColor":"#ffffff"}',
  });
  const second = buildCameraPreviewKey({
    cameraSignature: 'camera-1:1:12,20,100,80:#1e90ff',
    background: '{"viewBackgroundColor":"#ffffff"}',
  });

  assert.notEqual(first, second);
});

test('buildCameraPreviewKey changes when the exported background changes', async () => {
  const { buildCameraPreviewKey } = await loadModule();

  assert.equal(typeof buildCameraPreviewKey, 'function');

  const first = buildCameraPreviewKey({
    cameraSignature: 'camera-1:1:10,20,100,80:#1e90ff',
    background: '{"viewBackgroundColor":"#ffffff"}',
  });
  const second = buildCameraPreviewKey({
    cameraSignature: 'camera-1:1:10,20,100,80:#1e90ff',
    background: '{"viewBackgroundColor":"#f5f5f5"}',
  });

  assert.notEqual(first, second);
});

test('buildLiveCameraRenderKey changes when non-camera scene content changes', async () => {
  const { buildLiveCameraRenderKey } = await loadModule();

  assert.equal(typeof buildLiveCameraRenderKey, 'function');

  const first = buildLiveCameraRenderKey(
    [{ id: 'shape-1', version: 1, x: 0, y: 0, width: 10, height: 10 }],
    {},
    [{ id: 'camera-1', order: 1, bounds: { x: 10, y: 20, width: 100, height: 80 } }],
    { viewBackgroundColor: '#ffffff' },
  );
  const second = buildLiveCameraRenderKey(
    [{ id: 'shape-1', version: 2, x: 0, y: 0, width: 10, height: 10 }],
    {},
    [{ id: 'camera-1', order: 1, bounds: { x: 10, y: 20, width: 100, height: 80 } }],
    { viewBackgroundColor: '#ffffff' },
  );

  assert.notEqual(first, second);
});

test('buildLiveCameraRenderKey ignores transient selection and scroll state', async () => {
  const { buildLiveCameraRenderKey } = await loadModule();

  assert.equal(typeof buildLiveCameraRenderKey, 'function');

  const first = buildLiveCameraRenderKey(
    [{ id: 'shape-1', version: 1, x: 0, y: 0, width: 10, height: 10 }],
    {},
    [{ id: 'camera-1', order: 1, bounds: { x: 10, y: 20, width: 100, height: 80 } }],
    {
      viewBackgroundColor: '#ffffff',
      selectedElementIds: { 'camera-1': true },
      scrollX: 120,
      scrollY: 80,
    },
  );
  const second = buildLiveCameraRenderKey(
    [{ id: 'shape-1', version: 1, x: 0, y: 0, width: 10, height: 10 }],
    {},
    [{ id: 'camera-1', order: 1, bounds: { x: 10, y: 20, width: 100, height: 80 } }],
    {
      viewBackgroundColor: '#ffffff',
      selectedElementIds: {},
      scrollX: 0,
      scrollY: 0,
    },
  );

  assert.equal(first, second);
});
