import test from 'node:test';
import assert from 'node:assert/strict';

import { createIdeaSketchHostCaller, createIdeaSketchSdkHost } from '../src/lib/ideasketch-sdk/host.ts';
import { buildIdeaSketchOperation } from '../src/lib/ideasketch-sdk/operationSchemas.ts';

function harness() {
  const target = {
    documentSessionId: 'd', documentId: 'd', activePageId: 'a', documentStatus: 'editable', revision: 1,
    readOnly: false, mountedPageId: 'a', pageEditVersion: 1,
    nativeInteraction: { epoch: 0, busy: false, reasons: [] },
    document: { type: 'ideasketch', formatVersion: '1.0', created: '2026', modified: '2026', pages: [
      { id: 'a', title: 'A', elements: [], appState: {}, files: {} },
      { id: 'b', title: 'B', elements: [], appState: {}, files: {} },
    ] },
    scene: { elements: [], appState: {}, files: {} },
    services: { pages: true, scene: true, operations: true, writable: true },
    commits: [],
    commitDocument(next, preferredPageId) { this.document = next; this.activePageId = preferredPageId ?? this.activePageId; this.revision += 1; this.pageEditVersion += 1; },
    selectPage(pageId) { this.activePageId = pageId; },
    recordDocumentCommit(record) { this.commits.push(record); },
  };
  const host = createIdeaSketchSdkHost(() => target);
  const caller = createIdeaSketchHostCaller({ id: 'ui', profile: 'trusted-ui' });
  return { target, host, caller };
}

async function open() {
  const state = harness();
  const result = await state.host.createSession({ caller: state.caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal(result.status, 'succeeded');
  return { ...state, sdk: result.value };
}

function op(kind, input) {
  const result = buildIdeaSketchOperation(kind, input);
  assert.equal(result.status, 'succeeded', result.status === 'rejected' ? result.error.message : 'builder failed');
  return result.value;
}

test('Page structure plans commit atomically and preserve duplicate payloads', async () => {
  const { sdk, target } = await open();
  const listed = await sdk.pages.list();
  const operations = [
    op('duplicate-page', { ref: 'temp:copy', sourcePageRef: 'page:a' }),
    op('rename-page', { pageRef: 'temp:copy', title: 'Copied' }),
    op('reorder-page', { pageRef: 'temp:copy', toIndex: 0 }),
  ];
  const validated = await sdk.pages.validatePlan({ documentSnapshotId: listed.value.documentSnapshotId, operations });
  assert.equal(validated.status, 'succeeded');
  const applied = await sdk.pages.applyPlan({ requestId: 'pages-1', documentSnapshotId: listed.value.documentSnapshotId, operations });
  assert.equal(applied.status, 'succeeded', applied.status === 'rejected' ? applied.error.message : 'apply failed');
  assert.equal(target.document.pages[0].title, 'Copied');
  assert.notEqual(target.activePageId, 'a');
  assert.equal(applied.value.createdPageRefs.length, 1);
  assert.ok(target.commits[0].operationKinds.includes('duplicate-page'));
  assert.equal(applied.value.history.document, 'unavailable');
});

test('Page deletion retains one page and rejects out-of-range reorder', async () => {
  const { sdk } = await open();
  const listed = await sdk.pages.list();
  const invalid = await sdk.pages.applyPlan({ requestId: 'bad-order', documentSnapshotId: listed.value.documentSnapshotId, operations: [op('reorder-page', { pageRef: 'page:a', toIndex: 2 })] });
  assert.equal(invalid.status, 'rejected');
  assert.equal(invalid.error.code, 'invalid_request');

  const deleted = await sdk.pages.applyPlan({ requestId: 'delete-a', documentSnapshotId: listed.value.documentSnapshotId, operations: [op('delete-page', { pageRef: 'page:a' })] });
  assert.equal(deleted.status, 'succeeded');
  const next = await sdk.pages.list();
  const last = await sdk.pages.applyPlan({ requestId: 'delete-b', documentSnapshotId: next.value.documentSnapshotId, operations: [op('delete-page', { pageRef: 'page:b' })] });
  assert.equal(last.status, 'rejected');
  assert.equal(last.error.code, 'invalid_request');
});

test('add-page initialScene is detached and returns scoped created refs', async () => {
  const { sdk, target } = await open();
  const listed = await sdk.pages.list();
  const add = op('add-page', {
    ref: 'temp:new', title: 'Seeded', initialScene: { operations: [
      op('create-shape', { ref: 'temp:shape', shape: 'rectangle', bounds: { x: 0, y: 0, width: 120, height: 80 }, boundText: { ref: 'temp:text', text: 'Hello' } }),
    ] },
  });
  const applied = await sdk.pages.applyPlan({ requestId: 'add-seed', documentSnapshotId: listed.value.documentSnapshotId, operations: [add] });
  assert.equal(applied.status, 'succeeded', applied.status === 'rejected' ? applied.error.message : 'apply failed');
  const pageRef = applied.value.createdRefs['temp:new'];
  assert.match(pageRef, /^page:/);
  assert.equal(applied.value.createdRefs['temp:text'].pageRef, pageRef);
  const created = target.document.pages.find((page) => page.id === pageRef.slice('page:'.length));
  assert.equal(created.title, 'Seeded');
  assert.equal(created.elements.filter((element) => element.isDeleted !== true).length, 2);
});

test('queued Page requests revalidate the predecessor snapshot', async () => {
  const { sdk } = await open();
  const listed = await sdk.pages.list();
  const rename = op('rename-page', { pageRef: 'page:a', title: 'Changed' });
  const first = await sdk.pages.applyPlan({ requestId: 'queue-1', documentSnapshotId: listed.value.documentSnapshotId, operations: [rename] });
  assert.equal(first.status, 'succeeded');
  const second = await sdk.pages.applyPlan({ requestId: 'queue-2', documentSnapshotId: listed.value.documentSnapshotId, operations: [rename] });
  assert.equal(second.status, 'rejected');
  assert.equal(second.error.code, 'snapshot_stale');
});

test('Page selection invalidates old snapshots after flushing and stops owned presentation', async () => {
  const state = harness();
  let stopped = 0;
  state.target.stopPresentation = () => { stopped += 1; };
  const result = await state.host.createSession({ caller: state.caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  const sdk = result.value;
  const listed = await sdk.pages.list({ limit: 1 });
  const selected = await sdk.pages.select({ pageRef: 'page:b' });
  assert.equal(selected.status, 'succeeded');
  assert.equal(state.target.activePageId, 'b');
  assert.equal(stopped, 1);
  const stale = await sdk.pages.list({ cursor: listed.value.nextCursor });
  assert.equal(stale.status, 'rejected');
  assert.equal(stale.error.code, 'snapshot_required');
});
