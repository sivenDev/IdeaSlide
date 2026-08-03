import test from 'node:test';
import assert from 'node:assert/strict';

const { buildAutoSaveTriggerKey } = await import('../src/lib/autoSaveSignature.ts');

function input(overrides = {}) {
  return {
    enabled: true,
    sessionId: 'document-a',
    filePath: 'notes/demo.is',
    revision: 4,
    isDirty: true,
    debounceMs: 2000,
    ...overrides,
  };
}

test('buildAutoSaveTriggerKey is stable for equivalent document-session inputs', () => {
  assert.equal(buildAutoSaveTriggerKey(input()), buildAutoSaveTriggerKey(input()));
});

test('autosave identity changes by document and draft revision', () => {
  assert.notEqual(buildAutoSaveTriggerKey(input()), buildAutoSaveTriggerKey(input({ sessionId: 'document-b' })));
  assert.notEqual(buildAutoSaveTriggerKey(input()), buildAutoSaveTriggerKey(input({ revision: 5 })));
});

test('standalone policy can disable an otherwise dirty save trigger', () => {
  assert.notEqual(buildAutoSaveTriggerKey(input()), buildAutoSaveTriggerKey(input({ enabled: false })));
});
