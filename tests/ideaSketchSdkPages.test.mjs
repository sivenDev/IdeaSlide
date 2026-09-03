import test from 'node:test';
import assert from 'node:assert/strict';

import { createIdeaSketchHostCaller, createIdeaSketchSdkHost } from '../src/lib/ideasketch-sdk/host.ts';
import { buildIdeaSketchOperation } from '../src/lib/ideasketch-sdk/operationSchemas.ts';

function createHarness() {
  const target = {
    documentSessionId: 'document-1',
    documentId: 'document-1',
    activePageId: 'page-1',
    documentStatus: 'editable',
    revision: 1,
    readOnly: false,
    mountedPageId: 'page-1',
    pageEditVersion: 1,
    nativeInteraction: { epoch: 0, busy: false, reasons: [] },
    document: {
      type: 'ideasketch',
      formatVersion: '1.0',
      created: '2026-01-01',
      modified: '2026-01-01',
      pages: [
        { id: 'page-1', title: 'One', elements: [], appState: {}, files: {} },
        { id: 'page-2', title: 'Two', elements: [], appState: {}, files: {} },
      ],
    },
    scene: { elements: [], appState: {}, files: {} },
    services: { pages: true, writable: true },
    commitDocument(next, preferredPageId) {
      this.document = next;
      this.activePageId = preferredPageId ?? this.activePageId;
      this.pageEditVersion += 1;
      this.revision += 1;
    },
    selectPage(pageId) { this.activePageId = pageId; },
  };
  const host = createIdeaSketchSdkHost(() => target);
  const caller = createIdeaSketchHostCaller({ id: 'ui', profile: 'trusted-ui' });
  return { target, host, caller };
}

async function session() {
  const harness = createHarness();
  const result = await harness.host.createSession({ caller: harness.caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal(result.status, 'succeeded');
  return { ...harness, sdk: result.value };
}

test('pages.list returns a document snapshot with cumulative pagination', async () => {
  const { sdk } = await session();
  const first = await sdk.pages.list({ limit: 1 });
  assert.equal(first.status, 'succeeded');
  assert.equal(first.value.pages.length, 1);
  assert.equal(first.value.complete, false);
  assert.ok(first.value.nextCursor);
  const second = await sdk.pages.list({ cursor: first.value.nextCursor });
  assert.equal(second.status, 'succeeded');
  assert.equal(second.value.documentSnapshotId, first.value.documentSnapshotId);
  assert.equal(second.value.complete, true);
  assert.deepEqual(second.value.pages[0], { pageRef: 'page:page-2', index: 1, title: 'Two', elementCount: 0, cameraCount: 0 });
});

test('page operation builders reject raw scene fields and support strict page envelopes', () => {
  const valid = buildIdeaSketchOperation('add-page', { ref: 'temp:new', title: ' Added ' });
  assert.equal(valid.status, 'succeeded');
  assert.equal(valid.value.title, 'Added');
  assert.equal(buildIdeaSketchOperation('add-page', { ref: 'temp:new', elements: [] }).error.code, 'invalid_request');
  assert.equal(buildIdeaSketchOperation('reorder-page', { pageRef: 'page:one', toIndex: -1 }).error.code, 'invalid_request');
});

test('parseExcalidraw issues one-use caller-bound draft tokens', async () => {
  const { sdk } = await session();
  const parsed = await sdk.pages.parseExcalidraw(JSON.stringify({ type: 'excalidraw', elements: [{ id: 'shape', type: 'rectangle', x: 0, y: 0, width: 100, height: 60, angle: 0, version: 1, versionNonce: 1, updated: 1, isDeleted: false, locked: false, groupIds: [], frameId: null, boundElements: null }], appState: { viewBackgroundColor: '#fff' }, files: {} }));
  assert.equal(parsed.status, 'succeeded');
  assert.match(parsed.value, /^import:/);
  const listed = await sdk.pages.list();
  const op = buildIdeaSketchOperation('import-page', { ref: 'temp:imported', parsedPageDraftRef: parsed.value });
  assert.equal(op.status, 'succeeded');
  const applied = await sdk.pages.applyPlan({ requestId: 'import-1', documentSnapshotId: listed.value.documentSnapshotId, operations: [op.value] });
  assert.equal(applied.status, 'succeeded');
  assert.equal(applied.value.createdPageRefs.length, 1);
  const replay = await sdk.pages.applyPlan({ requestId: 'import-2', documentSnapshotId: listed.value.documentSnapshotId, operations: [op.value] });
  assert.equal(replay.status, 'rejected');
  assert.equal(replay.error.code, 'snapshot_stale');
});
