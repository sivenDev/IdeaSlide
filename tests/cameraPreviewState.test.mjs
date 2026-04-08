import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/lib/previewKeys.ts');
  } catch {
    return {};
  }
}

test('previewKeys does not expose stale camera preview state helper API', async () => {
  const { buildCameraPreviewStateKey } = await loadModule();

  assert.equal(buildCameraPreviewStateKey, undefined);
});

test('buildCameraPreviewKey changes when non-camera scene content changes', async () => {
  const { buildCameraPreviewKey } = await loadModule();

  assert.equal(typeof buildCameraPreviewKey, 'function');

  const first = buildCameraPreviewKey(
    [{ id: 'shape-1', version: 1, x: 0, y: 0, width: 10, height: 10 }],
    {},
    [{ id: 'camera-1', order: 1, bounds: { x: 10, y: 20, width: 100, height: 80 } }],
    { viewBackgroundColor: '#ffffff' },
  );
  const second = buildCameraPreviewKey(
    [{ id: 'shape-1', version: 2, x: 0, y: 0, width: 10, height: 10 }],
    {},
    [{ id: 'camera-1', order: 1, bounds: { x: 10, y: 20, width: 100, height: 80 } }],
    { viewBackgroundColor: '#ffffff' },
  );

  assert.notEqual(first, second);
});

test('buildCameraPreviewKey changes when camera geometry changes', async () => {
  const { buildCameraPreviewKey } = await loadModule();

  assert.equal(typeof buildCameraPreviewKey, 'function');

  const first = buildCameraPreviewKey(
    [{ id: 'shape-1', version: 1, x: 0, y: 0, width: 10, height: 10 }],
    {},
    [{ id: 'camera-1', order: 1, bounds: { x: 10, y: 20, width: 100, height: 80 } }],
    { viewBackgroundColor: '#ffffff' },
  );
  const second = buildCameraPreviewKey(
    [{ id: 'shape-1', version: 1, x: 0, y: 0, width: 10, height: 10 }],
    {},
    [{ id: 'camera-1', order: 1, bounds: { x: 12, y: 20, width: 100, height: 80 } }],
    { viewBackgroundColor: '#ffffff' },
  );

  assert.notEqual(first, second);
});
