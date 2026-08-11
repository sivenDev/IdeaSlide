import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/lib/tauriCommands.ts');
  } catch {
    return {};
  }
}

test('Workspace open ignores legacy custom order and keeps deterministic scan order', async () => {
  const { createWorkspaceSessionFromOpenResult } = await loadModule();
  assert.equal(typeof createWorkspaceSessionFromOpenResult, 'function');
  const entries = [
    { path: 'folder', name: 'folder', kind: 'directory', readOnly: false, children: [] },
    { path: 'a.is', name: 'a.is', kind: 'file', readOnly: false, fileType: 'ideasketch', children: [] },
  ];
  const session = createWorkspaceSessionFromOpenResult({
    root: '/workspace',
    name: 'workspace',
    readOnly: false,
    entries,
    metadata: {
      exists: true,
      diagnostics: [],
      state: { schemaVersion: 3, expandedPaths: [], entryOrder: ['a.is', 'folder'] },
    },
  });
  assert.equal(session.entries, entries);
  assert.deepEqual(session.entryOrder, []);
});

test('desktop cancellation has a stable non-error classification', async () => {
  const { DesktopOperationCancelledError, isDesktopOperationCancelled } = await loadModule();
  assert.equal(typeof DesktopOperationCancelledError, 'function');
  assert.equal(typeof isDesktopOperationCancelled, 'function');
  assert.equal(isDesktopOperationCancelled(new DesktopOperationCancelledError('cancelled')), true);
  assert.equal(isDesktopOperationCancelled({ kind: 'cancelled' }), true);
  assert.equal(isDesktopOperationCancelled(new Error('failed')), false);
});
