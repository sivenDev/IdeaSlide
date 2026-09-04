import test from 'node:test';
import assert from 'node:assert/strict';

import { createIdeaSketchHostCaller, createIdeaSketchSdkHost } from '../src/lib/ideasketch-sdk/host.ts';
import { buildIdeaSketchOperation } from '../src/lib/ideasketch-sdk/operationSchemas.ts';

function harness({ documentStatus = 'editable', readOnly = false, servicesWritable = true } = {}) {
  const target = {
    documentSessionId: 'd', documentId: 'd', activePageId: 'a', documentStatus, revision: 1,
    readOnly, mountedPageId: 'a', pageEditVersion: 1,
    nativeInteraction: { epoch: 0, busy: false, reasons: [] },
    document: { type: 'ideasketch', formatVersion: '1.0', created: '2026', modified: '2026', pages: [
      { id: 'a', title: 'A', elements: [{ id: 'shape-a', type: 'rectangle', x: 0, y: 0, width: 40, height: 30, angle: 0, version: 1, versionNonce: 1, updated: 1, isDeleted: false, locked: false, groupIds: [], frameId: null, boundElements: null }], appState: { viewBackgroundColor: '#fff' }, files: { 'asset-a': { id: 'asset-a', mimeType: 'image/png' } } },
      { id: 'b', title: 'B', elements: [], appState: {}, files: {} },
    ] },
    scene: { elements: [], appState: {}, files: {} },
    services: { pages: true, scene: true, operations: true, writable: servicesWritable },
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
  const state = harness(...arguments);
  const result = await state.host.createSession({ caller: state.caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal(result.status, 'succeeded');
  return { ...state, sdk: result.value };
}

async function applyPageOperation(sdk, requestId, operation) {
  const listed = await sdk.pages.list();
  assert.equal(listed.status, 'succeeded');
  return sdk.pages.applyPlan({
    requestId,
    documentSnapshotId: listed.value.documentSnapshotId,
    operations: [operation],
  });
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

for (const documentStatus of ['external-change', 'conflict']) {
  test(`trusted Page rename, duplicate, and delete remain in-memory writable during ${documentStatus}`, async () => {
    const { sdk, target } = await open({ documentStatus });
    const capabilities = await sdk.context.getCapabilities();
    const context = await sdk.context.get();
    assert.equal(capabilities.status, 'succeeded');
    assert.equal(context.status, 'succeeded');
    assert.equal(capabilities.value.available.writable, true);
    assert.equal(context.value.writable, true);
    for (const kind of ['rename-page', 'duplicate-page', 'delete-page']) {
      assert.ok(capabilities.value.availableOperationKinds.includes(kind));
    }

    const renamed = await applyPageOperation(
      sdk,
      `${documentStatus}-rename`,
      op('rename-page', { pageRef: 'page:a', title: '  Renamed  ' }),
    );
    assert.equal(renamed.status, 'succeeded', renamed.status === 'rejected' ? renamed.error.message : 'rename failed');
    assert.equal(target.document.pages[0].title, 'Renamed');

    const duplicated = await applyPageOperation(
      sdk,
      `${documentStatus}-duplicate`,
      op('duplicate-page', { ref: 'temp:copy', sourcePageRef: 'page:a' }),
    );
    assert.equal(duplicated.status, 'succeeded', duplicated.status === 'rejected' ? duplicated.error.message : 'duplicate failed');
    const copyRef = duplicated.value.createdRefs['temp:copy'];
    const copyId = copyRef.slice('page:'.length);
    const copyIndex = target.document.pages.findIndex((page) => page.id === copyId);
    assert.equal(copyIndex, 1);
    assert.equal(target.activePageId, copyId);
    assert.deepEqual(target.document.pages[copyIndex].elements, target.document.pages[0].elements);
    assert.deepEqual(target.document.pages[copyIndex].appState, target.document.pages[0].appState);
    assert.deepEqual(target.document.pages[copyIndex].files, target.document.pages[0].files);

    const deleted = await applyPageOperation(
      sdk,
      `${documentStatus}-delete`,
      op('delete-page', { pageRef: `page:${copyId}` }),
    );
    assert.equal(deleted.status, 'succeeded', deleted.status === 'rejected' ? deleted.error.message : 'delete failed');
    assert.equal(target.document.pages.some((page) => page.id === copyId), false);
    assert.equal(target.activePageId, 'b');
  });
}

test('Agent and protected Page targets do not inherit trusted in-memory writability', async () => {
  const agentState = harness({ documentStatus: 'conflict' });
  const agentCaller = createIdeaSketchHostCaller({ id: 'agent', profile: 'agent-v2' });
  const agentSession = await agentState.host.createSession({
    caller: agentCaller,
    sdkProtocolVersion: { major: 1, minor: 0 },
    agentToolProtocolVersion: { major: 2, minor: 0 },
    expectedAgentSchemaDigest: 'agent-tool-v2:semantic',
  });
  assert.equal(agentSession.status, 'succeeded');
  const agentCapabilities = await agentSession.value.context.getCapabilities();
  const agentContext = await agentSession.value.context.get();
  assert.equal(agentCapabilities.value.available.writable, false);
  assert.equal(agentContext.value.writable, false);
  assert.deepEqual(agentCapabilities.value.availableOperationKinds, []);

  for (const options of [{ documentStatus: 'read-only', readOnly: true }, { documentStatus: 'conflict', servicesWritable: false }]) {
    const { sdk } = await open(options);
    const capabilities = await sdk.context.getCapabilities();
    const context = await sdk.context.get();
    assert.equal(capabilities.value.available.writable, false);
    assert.equal(context.value.writable, false);
    assert.deepEqual(capabilities.value.availableOperationKinds, []);
  }
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
