import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/lib/documentSession.ts');
  } catch {
    return {};
  }
}

test('document sessions normalize path identity and track revisions', async () => {
  const { createDocumentSession, markDocumentSessionDirty } = await loadModule();
  assert.equal(typeof createDocumentSession, 'function');
  assert.equal(typeof markDocumentSessionDirty, 'function');

  const session = createDocumentSession({
    id: 'session-1',
    mode: 'workspace',
    filePath: 'folder\\drawing.is',
    fileType: 'ideasketch',
    model: { type: 'ideasketch' },
  });
  assert.equal(session.filePath, 'folder/drawing.is');
  assert.equal(session.revision, 0);

  const dirty = markDocumentSessionDirty(session);
  assert.equal(dirty.isDirty, true);
  assert.equal(dirty.revision, 1);
});

test('protected legacy sessions cannot become writable through dirty state', async () => {
  const { createProtectedDocumentSession, markDocumentSessionDirty } = await loadModule();
  const session = createProtectedDocumentSession({
    id: 'legacy-1',
    mode: 'standalone',
    filePath: '/tmp/legacy.is',
    fileType: 'ideasketch',
    version: '2.0',
    message: 'Legacy Workspace',
  });

  assert.equal(session.status, 'legacy-protected');
  assert.throws(() => markDocumentSessionDirty(session), /protected/i);
});
