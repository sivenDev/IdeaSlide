import test from 'node:test';
import assert from 'node:assert/strict';

async function loadFingerprintModule() {
  try {
    return await import('../src/lib/sceneFingerprint.ts');
  } catch {
    return {};
  }
}

test('buildSceneFingerprint changes when element geometry changes without changing array length', async () => {
  const { buildSceneFingerprint } = await loadFingerprintModule();

  assert.equal(typeof buildSceneFingerprint, 'function');

  const baseElements = [
    {
      id: 'shape-1',
      version: 1,
      versionNonce: 10,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      isDeleted: false,
      customData: undefined,
    },
  ];
  const movedElements = [
    {
      ...baseElements[0],
      x: 120,
    },
  ];

  assert.notEqual(
    buildSceneFingerprint(baseElements, {}),
    buildSceneFingerprint(movedElements, {}),
  );
});

test('buildSceneFingerprint changes when file metadata changes', async () => {
  const { buildSceneFingerprint } = await loadFingerprintModule();

  assert.equal(typeof buildSceneFingerprint, 'function');

  const elements = [
    {
      id: 'shape-1',
      version: 1,
      versionNonce: 10,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      isDeleted: false,
      customData: undefined,
    },
  ];

  const firstFiles = {
    'file-1': { id: 'file-1', mimeType: 'image/png', size: 10 },
  };
  const updatedFiles = {
    'file-1': { id: 'file-1', mimeType: 'image/png', size: 12 },
  };

  assert.notEqual(
    buildSceneFingerprint(elements, firstFiles),
    buildSceneFingerprint(elements, updatedFiles),
  );
});
