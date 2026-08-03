import test from 'node:test';
import assert from 'node:assert/strict';

const { appStoreReducer, createInitialAppState } = await import('../src/lib/appStoreReducer.ts');

function page(id, cameraOrder) {
  return {
    id,
    title: id,
    elements: [{ id: `camera-${id}`, type: 'rectangle', customData: { type: 'camera', order: cameraOrder } }],
    appState: {},
    files: {},
  };
}

test('presentation freezes the originating document Page instead of traversing Pages or Tabs', () => {
  const origin = page('page-current', 2);
  const other = page('page-other', 1);
  let state = {
    ...createInitialAppState(),
    mode: 'standalone',
    documents: [
      { id: 'document-a', mode: 'standalone', filePath: '/a.is', fileType: 'ideasketch', status: 'editable', model: { type: 'ideasketch', formatVersion: '1.0', created: '', modified: '', pages: [origin, other] }, isDirty: false, revision: 0 },
      { id: 'document-b', mode: 'standalone', filePath: '/b.is', fileType: 'ideasketch', status: 'editable', model: { type: 'ideasketch', formatVersion: '1.0', created: '', modified: '', pages: [page('page-current', 9)] }, isDirty: false, revision: 0 },
    ],
    activeSessionId: 'document-a',
  };
  state = appStoreReducer(state, { type: 'START_PRESENTATION', sessionId: 'document-a', pageId: origin.id, page: origin, mode: 'preview' });
  state = appStoreReducer(state, { type: 'ACTIVATE_DOCUMENT', sessionId: 'document-b' });
  assert.equal(state.presentationSessionId, 'document-a');
  assert.equal(state.presentationPageId, 'page-current');
  assert.equal(state.presentationPage, origin);
});
