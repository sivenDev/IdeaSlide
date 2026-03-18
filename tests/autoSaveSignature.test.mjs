import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/lib/autoSaveSignature.ts');
  } catch {
    return {};
  }
}

test('buildAutoSaveTriggerKey is stable for equivalent save inputs', async () => {
  const { buildAutoSaveTriggerKey } = await loadModule();

  assert.equal(typeof buildAutoSaveTriggerKey, 'function');

  const first = buildAutoSaveTriggerKey({
    filePath: '/tmp/demo.is',
    isDirty: true,
    debounceMs: 2000,
    slides: [
      {
        id: 'slide-1',
        elements: [{ id: 'shape-1', version: 1, x: 0, y: 0, width: 10, height: 10 }],
        appState: { viewBackgroundColor: '#ffffff' },
        files: {},
      },
    ],
  });

  const second = buildAutoSaveTriggerKey({
    filePath: '/tmp/demo.is',
    isDirty: true,
    debounceMs: 2000,
    slides: [
      {
        id: 'slide-1',
        elements: [{ id: 'shape-1', version: 1, x: 0, y: 0, width: 10, height: 10 }],
        appState: { viewBackgroundColor: '#ffffff' },
        files: {},
      },
    ],
  });

  assert.equal(first, second);
});

test('buildAutoSaveTriggerKey changes when slide content changes', async () => {
  const { buildAutoSaveTriggerKey } = await loadModule();

  assert.equal(typeof buildAutoSaveTriggerKey, 'function');

  const first = buildAutoSaveTriggerKey({
    filePath: '/tmp/demo.is',
    isDirty: true,
    debounceMs: 2000,
    slides: [
      {
        id: 'slide-1',
        elements: [{ id: 'shape-1', version: 1, x: 0, y: 0, width: 10, height: 10 }],
        appState: { viewBackgroundColor: '#ffffff' },
        files: {},
      },
    ],
  });

  const second = buildAutoSaveTriggerKey({
    filePath: '/tmp/demo.is',
    isDirty: true,
    debounceMs: 2000,
    slides: [
      {
        id: 'slide-1',
        elements: [{ id: 'shape-1', version: 2, x: 0, y: 0, width: 10, height: 10 }],
        appState: { viewBackgroundColor: '#ffffff' },
        files: {},
      },
    ],
  });

  assert.notEqual(first, second);
});

test('buildAutoSaveTriggerKey changes when persisted appState changes', async () => {
  const { buildAutoSaveTriggerKey } = await loadModule();

  assert.equal(typeof buildAutoSaveTriggerKey, 'function');

  const first = buildAutoSaveTriggerKey({
    filePath: '/tmp/demo.is',
    isDirty: true,
    debounceMs: 2000,
    slides: [
      {
        id: 'slide-1',
        elements: [],
        appState: { viewBackgroundColor: '#ffffff' },
        files: {},
      },
    ],
  });

  const second = buildAutoSaveTriggerKey({
    filePath: '/tmp/demo.is',
    isDirty: true,
    debounceMs: 2000,
    slides: [
      {
        id: 'slide-1',
        elements: [],
        appState: { viewBackgroundColor: '#f5f5f5' },
        files: {},
      },
    ],
  });

  assert.notEqual(first, second);
});
