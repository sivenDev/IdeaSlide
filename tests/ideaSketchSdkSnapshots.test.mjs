import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeDocumentDigest,
  computeSceneDigest,
} from '../src/lib/ideasketch-sdk/canonicalDigest.ts';
import { createSnapshotStore } from '../src/lib/ideasketch-sdk/snapshots.ts';

const baseScene = {
  elements: [{ id: 'shape-1', type: 'rectangle', version: 1, isDeleted: false }],
  appState: {
    viewBackgroundColor: '#ffffff',
    selectedElementIds: { 'shape-1': true },
    scrollX: 10,
    scrollY: 20,
      zoom: { value: 1.5 },
      openDialog: { name: 'imageExport' },
      offsetLeft: 24,
      offsetTop: 36,
      width: 1200,
      height: 800,
  },
  files: {
    'asset-1': { id: 'asset-1', mimeType: 'image/png', dataURL: 'data:image/png;base64,AAAA' },
  },
};

test('canonical scene digests include persistent state and exclude ephemeral editor state', async () => {
  const original = await computeSceneDigest(baseScene);
  const ephemeral = await computeSceneDigest({
    ...baseScene,
    appState: {
      ...baseScene.appState,
      selectedElementIds: {},
      scrollX: 999,
      scrollY: -50,
      zoom: { value: 0.25 },
      openDialog: null,
      activeTool: { type: 'text' },
      offsetLeft: 999,
      offsetTop: -999,
      width: 400,
      height: 300,
    },
  });
  const persistent = await computeSceneDigest({
    ...baseScene,
    appState: { ...baseScene.appState, viewBackgroundColor: '#000000' },
  });
  const fileChanged = await computeSceneDigest({
    ...baseScene,
    files: {
      'asset-1': { ...baseScene.files['asset-1'], dataURL: 'data:image/png;base64,BBBB' },
    },
  });

  assert.equal(ephemeral, original);
  assert.notEqual(persistent, original);
  assert.notEqual(fileChanged, original);

  const activePreviewId = 'camera-preview:opaque-host-token';
  const withCameraPreview = await computeSceneDigest({
    ...baseScene,
    elements: [
      ...baseScene.elements,
      { id: activePreviewId, type: 'rectangle', x: 100, y: 100 },
    ],
  }, { ephemeralElementIds: new Set([activePreviewId]) });
  assert.equal(withCameraPreview, original);
  const clonedPreview = structuredClone({
    ...baseScene,
    elements: [
      ...baseScene.elements,
      { id: activePreviewId, type: 'rectangle', x: 100, y: 100 },
    ],
  });
  assert.equal(
    await computeSceneDigest(clonedPreview, { ephemeralElementIds: new Set([activePreviewId]) }),
    original,
  );

  const legitimateOldPreviewId = await computeSceneDigest({
    ...baseScene,
    elements: [...baseScene.elements, { id: 'camera-preview', type: 'rectangle', x: 100, y: 100 }],
  });
  assert.notEqual(legitimateOldPreviewId, original);
});

test('document digests include Page order and titles', async () => {
  const first = await computeDocumentDigest({
    type: 'ideasketch',
    formatVersion: '1.0',
    created: '2026-09-02T00:00:00.000Z',
    modified: '2026-09-02T00:00:00.000Z',
    pages: [
      { id: 'page-1', title: 'One', ...baseScene },
      { id: 'page-2', title: 'Two', ...baseScene },
    ],
  });
  const reordered = await computeDocumentDigest({
    type: 'ideasketch',
    formatVersion: '1.0',
    created: '2026-09-02T00:00:00.000Z',
    modified: '2026-09-02T00:00:00.000Z',
    pages: [
      { id: 'page-2', title: 'Two', ...baseScene },
      { id: 'page-1', title: 'One', ...baseScene },
    ],
  });
  assert.notEqual(reordered, first);
});

test('scene snapshots are caller-bound, cumulative, and stale on native interaction epochs', () => {
  const store = createSnapshotStore({ sessionId: 'session-1' });
  const issued = store.issueScene({
    documentId: 'document-1',
    pageId: 'page-1',
    digest: 'digest-1',
    editVersion: 2,
    nativeInteractionEpoch: 4,
    revision: 9,
    documentStatus: 'editable',
    sourceMarker: 'source-1',
    identityRefs: ['element:shape-1'],
    mutationReadyRefs: [],
    complete: false,
  });
  assert.equal(issued.status, 'succeeded');
  assert.deepEqual(Object.keys(issued.value), [
    'snapshotId',
    'identityRefs',
    'mutationReadyRefs',
    'complete',
  ]);
  assert.equal('digest' in issued.value, false);
  assert.equal('nativeInteractionEpoch' in issued.value, false);

  const extended = store.extendSceneCoverage({
    snapshotId: issued.value.snapshotId,
    identityRefs: ['element:text-1'],
    mutationReadyRefs: ['element:shape-1', 'element:text-1'],
    complete: true,
  });
  assert.equal(extended.status, 'succeeded');
  assert.deepEqual(extended.value.mutationReadyRefs, ['element:shape-1', 'element:text-1']);
  assert.equal(extended.value.complete, true);

  assert.equal(store.getScene(issued.value.snapshotId, {
    documentId: 'document-1',
    pageId: 'page-1',
    digest: 'digest-1',
    editVersion: 2,
    nativeInteractionEpoch: 4,
    revision: 9,
    documentStatus: 'editable',
    sourceMarker: 'source-1',
  }).status, 'succeeded');
  assert.equal(store.getScene(issued.value.snapshotId, {
    documentId: 'document-1',
    pageId: 'page-1',
    digest: 'digest-1',
    editVersion: 2,
    nativeInteractionEpoch: 5,
    revision: 9,
    documentStatus: 'editable',
    sourceMarker: 'source-1',
  }).error.code, 'snapshot_stale');
  assert.equal(store.getScene(issued.value.snapshotId, {
    documentId: 'document-1',
    pageId: 'page-1',
    digest: 'digest-1',
    editVersion: 2,
    nativeInteractionEpoch: 4,
    revision: 10,
    documentStatus: 'editable',
    sourceMarker: 'source-1',
  }).error.code, 'snapshot_stale');
});

test('busy and disposed snapshot stores fail closed across every token surface', () => {
  const store = createSnapshotStore({ sessionId: 'session-1' });
  assert.equal(store.issueDocument({
    documentId: 'document-1',
    digest: 'digest-1',
    editVersion: 1,
    nativeInteractionEpoch: 1,
    busy: true,
  }).error.code, 'editor_busy');

  const issued = store.issueScene({
    documentId: 'document-1',
    pageId: 'page-1',
    digest: 'digest-1',
    editVersion: 1,
    nativeInteractionEpoch: 1,
  });
  store.dispose();
  assert.equal(store.extendSceneCoverage({ snapshotId: issued.value.snapshotId }).error.code, 'session_closed');
  assert.equal(store.issueCursor('scene', issued.value.snapshotId, 0).error.code, 'session_closed');
});
