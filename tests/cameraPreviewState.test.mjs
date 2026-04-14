import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/lib/previewKeys.ts');
  } catch {
    return {};
  }
}

test('buildCameraPreviewKey is stable when the snapshot is unchanged', async () => {
  const { buildCameraPreviewKey } = await loadModule();

  assert.equal(typeof buildCameraPreviewKey, 'function');

  const snapshot = {
    sceneFingerprint: 'scene-v1',
    cameraSignature: 'camera-1:1:0,0,100,80:#1e90ff',
    background: '{"viewBackgroundColor":"#ffffff"}',
  };

  assert.equal(buildCameraPreviewKey(snapshot), buildCameraPreviewKey({ ...snapshot }));
});

test('buildCameraPreviewKey changes when non-camera scene content changes', async () => {
  const { buildCameraPreviewKey } = await loadModule();

  assert.equal(typeof buildCameraPreviewKey, 'function');

  const first = buildCameraPreviewKey({
    sceneFingerprint: 'scene-v1',
    cameraSignature: 'camera-1:1:0,0,100,80:#1e90ff',
    background: '{"viewBackgroundColor":"#ffffff"}',
  });
  const second = buildCameraPreviewKey({
    sceneFingerprint: 'scene-v2',
    cameraSignature: 'camera-1:1:0,0,100,80:#1e90ff',
    background: '{"viewBackgroundColor":"#ffffff"}',
  });

  assert.notEqual(first, second);
});

test('buildCameraPreviewKey changes when camera geometry changes', async () => {
  const { buildCameraPreviewKey } = await loadModule();

  assert.equal(typeof buildCameraPreviewKey, 'function');

  const first = buildCameraPreviewKey({
    cameraSignature: 'camera-1:1:0,0,100,80:#1e90ff',
    background: '{"viewBackgroundColor":"#ffffff"}',
  });
  const second = buildCameraPreviewKey({
    cameraSignature: 'camera-1:1:10,0,100,80:#1e90ff',
    background: '{"viewBackgroundColor":"#ffffff"}',
  });

  assert.notEqual(first, second);
});

test('buildCameraPreviewKey changes when background changes', async () => {
  const { buildCameraPreviewKey } = await loadModule();

  assert.equal(typeof buildCameraPreviewKey, 'function');

  const first = buildCameraPreviewKey({
    cameraSignature: 'camera-1:1:0,0,100,80:#1e90ff',
    background: '{"viewBackgroundColor":"#ffffff"}',
  });
  const second = buildCameraPreviewKey({
    cameraSignature: 'camera-1:1:0,0,100,80:#1e90ff',
    background: '{"viewBackgroundColor":"#f5f5f5"}',
  });

  assert.notEqual(first, second);
});

test('buildLiveCameraRenderKey still changes when non-camera scene content changes', async () => {
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
