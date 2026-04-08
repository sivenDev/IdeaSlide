import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/lib/previewKeys.ts');
  } catch {
    return {};
  }
}

test('buildCameraPreviewKey ignores non-camera scene changes when camera preview state is reused', async () => {
  const { buildCameraPreviewKey } = await loadModule();

  assert.equal(typeof buildCameraPreviewKey, 'function');

  const first = buildCameraPreviewKey({
    cameraSignature: 'camera-1@1:10,20,100,80:#1e90ff',
    background: '#ffffff',
  });
  const second = buildCameraPreviewKey({
    cameraSignature: 'camera-1@1:10,20,100,80:#1e90ff',
    background: '#ffffff',
  });

  assert.equal(first, second);
});

test('buildCameraPreviewKey changes when camera geometry changes', async () => {
  const { buildCameraPreviewKey } = await loadModule();

  assert.equal(typeof buildCameraPreviewKey, 'function');

  const first = buildCameraPreviewKey({
    cameraSignature: 'camera-1@1:10,20,100,80:#1e90ff',
    background: '#ffffff',
  });
  const second = buildCameraPreviewKey({
    cameraSignature: 'camera-1@1:12,20,100,80:#1e90ff',
    background: '#ffffff',
  });

  assert.notEqual(first, second);
});
