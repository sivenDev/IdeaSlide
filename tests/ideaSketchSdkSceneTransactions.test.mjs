import test from 'node:test';
import assert from 'node:assert/strict';

import { createIdeaSketchHostCaller, createIdeaSketchSdkHost } from '../src/lib/ideasketch-sdk/host.ts';
import { op } from './ideaSketchSdkTestUtils.mjs';

function hostWithScene(sceneState) {
  return createIdeaSketchSdkHost(() => ({
    documentSessionId: 'document-1', documentId: 'document-1', activePageId: 'page-1', documentStatus: 'editable', revision: sceneState.revision ?? 1, readOnly: false, mountedPageId: 'page-1', pageEditVersion: sceneState.pageEditVersion ?? 1,
    nativeInteraction: sceneState.nativeInteraction ?? { epoch: 1, busy: false, reasons: [] },
    document: { type: 'ideasketch', formatVersion: '1.0', created: '2026-01-01', modified: '2026-01-01', pages: [{ id: 'page-1', title: 'Page 1', elements: sceneState.elements ?? [], appState: sceneState.appState ?? {}, files: sceneState.files ?? {} }] },
    scene: { elements: sceneState.elements ?? [], appState: sceneState.appState ?? {}, files: sceneState.files ?? {} }, services: { mountedCanvas: true, writable: true, scene: true, operations: true, cameras: true, assets: true },
    commitScene: (next) => { sceneState.elements = next.elements; sceneState.appState = next.appState; sceneState.files = next.files; sceneState.pageEditVersion += 1; },
  }));
}

test('scene.read/applyPlan use one receipt-bound service and commit once', async () => {
  const state = { elements: [], appState: {}, files: {}, pageEditVersion: 1 };
  const host = hostWithScene(state);
  const caller = createIdeaSketchHostCaller({ id: 'external', profile: 'future-external', grantedScopes: ['scene.read', 'scene.write'] });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal(session.status, 'succeeded');
  const sdk = session.value;
  const read = await sdk.scene.read({ limit: 10 });
  assert.equal(read.status, 'succeeded');
  const result = await sdk.scene.applyPlan({ requestId: 'scene-1', snapshotId: read.value.snapshotId, operations: [op('create-text', { ref: 'temp:t', x: 0, y: 0, text: 'hello' })] });
  assert.equal(result.status, 'succeeded');
  assert.equal(state.elements.filter((item) => item.type === 'text').length, 1);
  const replay = await sdk.scene.applyPlan({ requestId: 'scene-1', snapshotId: read.value.snapshotId, operations: [op('create-text', { ref: 'temp:t', x: 0, y: 0, text: 'hello' })] });
  assert.equal(replay.status, 'succeeded');
  assert.equal(state.elements.filter((item) => item.type === 'text').length, 1);
});

test('scene.applyPlan preserves operationIndex for adapter-level semantic rejection', async () => {
  const state = { elements: [], appState: {}, files: {}, pageEditVersion: 1 };
  const host = hostWithScene(state);
  const caller = createIdeaSketchHostCaller({ id: 'indexed-writer', profile: 'future-external', grantedScopes: ['scene.read', 'scene.write'] });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  const sdk = session.value;
  const read = await sdk.scene.read({});
  assert.equal(read.status, 'succeeded');
  const result = await sdk.scene.applyPlan({
    requestId: 'indexed-apply',
    snapshotId: read.value.snapshotId,
    operations: [
      op('create-text', { ref: 'temp:t', x: 0, y: 0, text: 'ok' }),
      op('create-text', { ref: 'temp:t2', x: 10, y: 10, text: 'bad', style: { verticalAlign: 'middle' } }),
    ],
  });
  assert.equal(result.status, 'rejected');
  assert.equal(result.error.code, 'unsupported_operation');
  assert.equal(result.error.operationIndex, 1);
});

test('busy native interaction rejects scene reads and stale cursors', async () => {
  const state = { elements: [], appState: {}, files: {}, pageEditVersion: 1, nativeInteraction: { epoch: 1, busy: true, reasons: ['text'] } };
  const host = hostWithScene(state);
  const caller = createIdeaSketchHostCaller({ id: 'external', profile: 'future-external', grantedScopes: ['scene.read'] });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal((await session.value.scene.read({})).error.code, 'editor_busy');
});

test('busy native interaction wins over stale snapshot during scene apply', async () => {
  const state = { elements: [], appState: {}, files: {}, pageEditVersion: 1, nativeInteraction: { epoch: 1, busy: false, reasons: [] } };
  const host = hostWithScene(state);
  const caller = createIdeaSketchHostCaller({ id: 'busy-writer', profile: 'future-external', grantedScopes: ['scene.read', 'scene.write'] });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  const sdk = session.value;
  const read = await sdk.scene.read({});
  state.nativeInteraction = { epoch: 1, busy: true, reasons: ['text'] };
  const result = await sdk.scene.applyPlan({ requestId: 'busy-apply', snapshotId: read.value.snapshotId, operations: [op('create-text', { ref: 'temp:t', x: 0, y: 0, text: 'blocked' })] });
  assert.equal(result.status, 'rejected');
  assert.equal(result.error.code, 'editor_busy');
});

test('scene snapshots become stale when the native edit version or interaction epoch advances without a digest change', async () => {
  const state = { elements: [], appState: {}, files: {}, pageEditVersion: 1, nativeInteraction: { epoch: 1, busy: false, reasons: [] } };
  const host = hostWithScene(state);
  const caller = createIdeaSketchHostCaller({ id: 'epoch-writer', profile: 'future-external', grantedScopes: ['scene.read', 'scene.write'] });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  const sdk = session.value;

  const editVersionRead = await sdk.scene.read({});
  state.pageEditVersion += 1;
  const staleEditVersion = await sdk.scene.applyPlan({
    requestId: 'stale-edit-version',
    snapshotId: editVersionRead.value.snapshotId,
    operations: [op('create-text', { ref: 'temp:t1', x: 0, y: 0, text: 'blocked' })],
  });
  assert.equal(staleEditVersion.error.code, 'snapshot_stale');

  const epochRead = await sdk.scene.read({});
  state.nativeInteraction = { epoch: 2, busy: false, reasons: [] };
  const staleEpoch = await sdk.scene.applyPlan({
    requestId: 'stale-native-epoch',
    snapshotId: epochRead.value.snapshotId,
    operations: [op('create-text', { ref: 'temp:t2', x: 0, y: 0, text: 'blocked' })],
  });
  assert.equal(staleEpoch.error.code, 'snapshot_stale');
  assert.equal(state.elements.length, 0);
});

test('scene cursors become stale after a Page edit and malformed public reads never throw', async () => {
  const state = { elements: [
    { id: 'one', type: 'rectangle', x: 0, y: 0, width: 20, height: 20, angle: 0, version: 1, versionNonce: 1, updated: 1, isDeleted: false, locked: false, groupIds: [], frameId: null, boundElements: null },
    { id: 'two', type: 'ellipse', x: 40, y: 0, width: 20, height: 20, angle: 0, version: 1, versionNonce: 2, updated: 1, isDeleted: false, locked: false, groupIds: [], frameId: null, boundElements: null },
  ], appState: {}, files: {}, pageEditVersion: 1 };
  const host = hostWithScene(state);
  const caller = createIdeaSketchHostCaller({ id: 'reader', profile: 'future-external', grantedScopes: ['scene.read'] });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  const sdk = session.value;
  const first = await sdk.scene.read({ limit: 1 });
  assert.equal(first.status, 'succeeded');
  state.elements = [...state.elements, { id: 'three', type: 'diamond', x: 80, y: 0, width: 20, height: 20, angle: 0, version: 1, versionNonce: 3, updated: 1, isDeleted: false, locked: false, groupIds: [], frameId: null, boundElements: null }];
  state.pageEditVersion += 1;
  assert.equal((await sdk.scene.read({ cursor: first.value.nextCursor })).error.code, 'snapshot_stale');
  assert.doesNotThrow(() => sdk.scene.read(null));
  assert.equal((await sdk.scene.read(null)).error.code, 'invalid_request');
  assert.equal((await sdk.scene.getElements({ snapshotId: first.value.snapshotId, refs: ['element:one'], extra: true })).error.code, 'invalid_request');
});

test('scene cursor tokens are immutable continuation anchors', async () => {
  const state = { elements: [
    { id: 'one', type: 'rectangle', x: 0, y: 0, width: 20, height: 20, angle: 0, version: 1, versionNonce: 1, updated: 1, isDeleted: false, locked: false, groupIds: [], frameId: null, boundElements: null },
    { id: 'two', type: 'ellipse', x: 40, y: 0, width: 20, height: 20, angle: 0, version: 1, versionNonce: 2, updated: 1, isDeleted: false, locked: false, groupIds: [], frameId: null, boundElements: null },
    { id: 'three', type: 'diamond', x: 80, y: 0, width: 20, height: 20, angle: 0, version: 1, versionNonce: 3, updated: 1, isDeleted: false, locked: false, groupIds: [], frameId: null, boundElements: null },
  ], appState: {}, files: {}, pageEditVersion: 1 };
  const host = hostWithScene(state);
  const caller = createIdeaSketchHostCaller({ id: 'cursor-reader', profile: 'future-external', grantedScopes: ['scene.read'] });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  const sdk = session.value;
  const first = await sdk.scene.read({ limit: 1 });
  assert.equal(first.status, 'succeeded');
  const cursor = first.value.nextCursor;
  assert.ok(cursor);
  const second = await sdk.scene.read({ cursor, limit: 1 });
  const repeated = await sdk.scene.read({ cursor, limit: 1 });
  assert.equal(second.status, 'succeeded');
  assert.equal(repeated.status, 'succeeded');
  assert.deepEqual(repeated.value.elements, second.value.elements);
  assert.equal(repeated.value.nextCursor, second.value.nextCursor);
});

test('terminal request replay is idempotent while a different payload conflicts', async () => {
  const state = { elements: [], appState: {}, files: {}, pageEditVersion: 1 };
  const host = hostWithScene(state);
  const caller = createIdeaSketchHostCaller({ id: 'writer', profile: 'future-external', grantedScopes: ['scene.read', 'scene.write'] });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  const sdk = session.value;
  const read = await sdk.scene.read({});
  const first = await sdk.scene.applyPlan({ requestId: 'same', snapshotId: read.value.snapshotId, operations: [op('create-text', { ref: 'temp:t', x: 0, y: 0, text: 'hello' })] });
  assert.equal(first.status, 'succeeded');
  const replay = await sdk.scene.applyPlan({ requestId: 'same', snapshotId: read.value.snapshotId, operations: [op('create-text', { ref: 'temp:t', x: 0, y: 0, text: 'hello' })] });
  assert.equal(replay.status, 'succeeded');
  const conflict = await sdk.scene.applyPlan({ requestId: 'same', snapshotId: read.value.snapshotId, operations: [op('create-text', { ref: 'temp:t', x: 0, y: 0, text: 'different' })] });
  assert.equal(conflict.status, 'rejected');
  assert.equal(conflict.error.code, 'idempotency_conflict');
});

test('scene applyPlan enforces requiredCapabilities without allowing scope escalation', async () => {
  const state = { elements: [], appState: {}, files: {}, pageEditVersion: 1 };
  const host = hostWithScene(state);
  const caller = createIdeaSketchHostCaller({ id: 'writer', profile: 'future-external', grantedScopes: ['scene.read', 'scene.write'] });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  const sdk = session.value;
  const read = await sdk.scene.read({});
  const operation = op('create-text', { ref: 'temp:t', x: 0, y: 0, text: 'hello' });
  const denied = await sdk.scene.applyPlan({ requestId: 'required-denied', snapshotId: read.value.snapshotId, operations: [operation], requiredCapabilities: ['selection.control'] });
  assert.equal(denied.status, 'rejected');
  assert.equal(denied.error.code, 'capability_denied');
  const granted = await sdk.scene.applyPlan({ requestId: 'required-granted', snapshotId: read.value.snapshotId, operations: [operation], requiredCapabilities: ['scene.write'] });
  assert.equal(granted.status, 'succeeded');
});

test('scene validate/apply enforce the negotiated operation allowlist server-side', async () => {
  const state = { elements: [], appState: {}, files: {}, pageEditVersion: 1 };
  const host = hostWithScene(state);
  const caller = createIdeaSketchHostCaller({ id: 'agent-v1', profile: 'agent-v1' });
  const session = await host.createSession({
    caller,
    sdkProtocolVersion: { major: 1, minor: 0 },
    agentToolProtocolVersion: { major: 1, minor: 0 },
    expectedAgentSchemaDigest: 'agent-tool-v1:eight-tools',
  });
  assert.equal(session.status, 'succeeded');
  const sdk = session.value;
  const capabilities = await sdk.context.getCapabilities();
  assert.equal(capabilities.status, 'succeeded');
  assert.ok(!capabilities.value.availableOperationKinds.includes('create-text'));
  const read = await sdk.scene.read({});
  assert.equal(read.status, 'succeeded');
  // Bypass the v1 builder and submit a hand-crafted, otherwise valid
  // operation envelope directly to prove the service boundary is enforced.
  const operation = { kind: 'create-text', version: 1, ref: 'temp:t', x: 0, y: 0, text: 'blocked' };
  const validated = await sdk.scene.validatePlan({ snapshotId: read.value.snapshotId, operations: [operation] });
  assert.equal(validated.status, 'rejected');
  assert.equal(validated.error.code, 'unsupported_operation');
  const applied = await sdk.scene.applyPlan({ requestId: 'blocked-text', snapshotId: read.value.snapshotId, operations: [operation] });
  assert.equal(applied.status, 'rejected');
  assert.equal(applied.error.code, 'unsupported_operation');
  assert.equal(state.elements.length, 0);
});

test('malformed relations stay identity-only and fail closed before scene commit', async () => {
  const state = {
    elements: [{
      id: 'shape', type: 'rectangle', x: 0, y: 0, width: 20, height: 20, angle: 0,
      version: 1, versionNonce: 1, updated: 1, isDeleted: false, locked: false,
      groupIds: [], frameId: null, boundElements: [{ id: 'arrow' }],
    }],
    appState: {}, files: {}, pageEditVersion: 1,
  };
  const host = hostWithScene(state);
  const caller = createIdeaSketchHostCaller({ id: 'malformed-reader', profile: 'future-external', grantedScopes: ['scene.read', 'scene.write'] });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  const sdk = session.value;
  const read = await sdk.scene.read({});
  assert.equal(read.status, 'succeeded');
  assert.deepEqual(read.value.coverage.mutationReadyRefs, []);
  const before = structuredClone(state.elements);
  const applied = await sdk.scene.applyPlan({
    requestId: 'malformed-relation',
    snapshotId: read.value.snapshotId,
    operations: [op('move-element', { elementRef: 'element:shape', dx: 10, dy: 0 })],
  });
  assert.equal(applied.status, 'rejected');
  assert.equal(applied.error.code, 'incomplete_read');
  assert.deepEqual(state.elements, before);
  assert.equal(state.pageEditVersion, 1);
});

test('capabilities do not advertise destructive clear when the host has no confirmation adapter', async () => {
  const state = { elements: [], appState: {}, files: {}, pageEditVersion: 1 };
  const host = createIdeaSketchSdkHost(() => ({
    documentSessionId: 'document-1', documentId: 'document-1', activePageId: 'page-1', documentStatus: 'editable', revision: 1, readOnly: false, mountedPageId: 'page-1', pageEditVersion: state.pageEditVersion,
    nativeInteraction: { epoch: 1, busy: false, reasons: [] },
    document: { type: 'ideasketch', formatVersion: '1.0', created: '2026-01-01', modified: '2026-01-01', pages: [{ id: 'page-1', title: 'Page 1', elements: state.elements, appState: state.appState, files: state.files }] },
    scene: { elements: state.elements, appState: state.appState, files: state.files },
    services: { mountedCanvas: true, writable: true, scene: true, operations: true },
    commitScene: () => {},
  }));
  const caller = createIdeaSketchHostCaller({ id: 'trusted', profile: 'trusted-ui' });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal(session.status, 'succeeded');
  const capabilities = (await session.value.context.getCapabilities()).value;
  assert.ok(!capabilities.availableMethods.scene.includes('requestClearConfirmation'));
  assert.ok(!capabilities.availableOperationKinds.includes('clear-scene'));
});

test('implemented scene, Camera, and asset methods still obey dynamic method availability', async () => {
  const state = { elements: [], appState: {}, files: {}, pageEditVersion: 1 };
  let services = { mountedCanvas: true, writable: true, scene: false, operations: true, cameras: false, assets: false };
  const host = createIdeaSketchSdkHost(() => ({
    documentSessionId: 'document-1', documentId: 'document-1', activePageId: 'page-1', documentStatus: 'editable', revision: 1, readOnly: false, mountedPageId: 'page-1', pageEditVersion: state.pageEditVersion,
    nativeInteraction: { epoch: 1, busy: false, reasons: [] },
    document: { type: 'ideasketch', formatVersion: '1.0', created: '2026-01-01', modified: '2026-01-01', pages: [{ id: 'page-1', title: 'Page 1', elements: state.elements, appState: state.appState, files: state.files }] },
    scene: { elements: state.elements, appState: state.appState, files: state.files },
    services,
    commitScene: (next) => { state.elements = next.elements; state.appState = next.appState; state.files = next.files; state.pageEditVersion += 1; },
  }));
  const caller = createIdeaSketchHostCaller({ id: 'trusted', profile: 'trusted-ui' });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal(session.status, 'succeeded');
  const sdk = session.value;
  const unavailableRead = await sdk.scene.read({});
  assert.equal(unavailableRead.status, 'rejected');
  assert.equal(unavailableRead.error.code, 'unsupported_operation');

  services = { ...services, scene: true };
  const read = await sdk.scene.read({});
  assert.equal(read.status, 'succeeded');
  const operation = op('create-text', { ref: 'temp:t', x: 0, y: 0, text: 'available once' });
  const firstApply = await sdk.scene.applyPlan({ requestId: 'availability-replay', snapshotId: read.value.snapshotId, operations: [operation] });
  assert.equal(firstApply.status, 'succeeded');
  services = { ...services, scene: false };
  const replay = await sdk.scene.applyPlan({ requestId: 'availability-replay', snapshotId: read.value.snapshotId, operations: [operation] });
  assert.equal(replay.status, 'succeeded');
  const cameraList = await sdk.cameras.list({ snapshotId: read.value.snapshotId });
  assert.equal(cameraList.status, 'rejected');
  assert.equal(cameraList.error.code, 'unsupported_operation');
  const assetList = await sdk.assets.listMetadata({ snapshotId: read.value.snapshotId });
  assert.equal(assetList.status, 'rejected');
  assert.equal(assetList.error.code, 'unsupported_operation');
});

test('asset metadata pagination stays on the scene snapshot and reports cumulative coverage', async () => {
  const state = {
    elements: [
      { id: 'image-1', type: 'image', x: 0, y: 0, width: 20, height: 20, angle: 0, version: 1, versionNonce: 1, updated: 1, isDeleted: false, locked: false, groupIds: [], frameId: null, boundElements: null, fileId: 'a' },
      { id: 'image-2', type: 'image', x: 30, y: 0, width: 20, height: 20, angle: 0, version: 1, versionNonce: 2, updated: 1, isDeleted: false, locked: false, groupIds: [], frameId: null, boundElements: null, fileId: 'b' },
    ],
    files: { a: { mimeType: 'image/png', byteLength: 10 }, b: { mimeType: 'image/jpeg', byteLength: 20 } },
    appState: {}, pageEditVersion: 1,
  };
  const host = hostWithScene(state);
  const caller = createIdeaSketchHostCaller({ id: 'asset-reader', profile: 'future-external', grantedScopes: ['scene.read', 'asset.read'] });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  const sdk = session.value;
  const read = await sdk.scene.read({});
  const first = await sdk.assets.listMetadata({ snapshotId: read.value.snapshotId, limit: 1 });
  assert.equal(first.status, 'succeeded');
  assert.equal(first.value.assets.length, 1);
  assert.ok(first.value.nextCursor);
  assert.ok(first.value.coverage.identityRefs.includes('asset:a'));
  const second = await sdk.assets.listMetadata({ snapshotId: read.value.snapshotId, cursor: first.value.nextCursor, limit: 1 });
  assert.equal(second.status, 'succeeded');
  assert.equal(second.value.complete, true);
  assert.ok(second.value.coverage.identityRefs.includes('asset:a'));
  assert.ok(second.value.coverage.identityRefs.includes('asset:b'));
});

test('asset metadata omits unsafe native file and element ids', async () => {
  const state = {
    elements: [{ id: 'image\nid', type: 'image', fileId: 'asset\nid', isDeleted: false }],
    files: { 'asset\nid': { mimeType: 'image/png', byteLength: 1 }, safe: { mimeType: 'image/png', byteLength: 2 } },
    appState: {}, pageEditVersion: 1,
  };
  const host = hostWithScene(state);
  const caller = createIdeaSketchHostCaller({ id: 'unsafe-asset-reader', profile: 'future-external', grantedScopes: ['scene.read', 'asset.read'] });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  const read = await session.value.scene.read({});
  const result = await session.value.assets.listMetadata({ snapshotId: read.value.snapshotId });
  assert.equal(result.status, 'succeeded');
  assert.deepEqual(result.value.assets.map((asset) => asset.ref), ['asset:safe']);
});

test('Camera and asset cursor retries preserve the same continuation token', async () => {
  const state = {
    elements: [
      { id: 'camera-1', type: 'rectangle', x: 0, y: 0, width: 40, height: 30, customData: { type: 'camera', order: 1 }, version: 1, versionNonce: 1, isDeleted: false, boundElements: null },
      { id: 'camera-2', type: 'rectangle', x: 60, y: 0, width: 40, height: 30, customData: { type: 'camera', order: 2 }, version: 1, versionNonce: 2, isDeleted: false, boundElements: null },
    ],
    files: { a: { mimeType: 'image/png', byteLength: 1 }, b: { mimeType: 'image/png', byteLength: 2 } },
    appState: {}, pageEditVersion: 1,
  };
  const host = hostWithScene(state);
  const caller = createIdeaSketchHostCaller({ id: 'cursor-reader', profile: 'future-external', grantedScopes: ['scene.read', 'asset.read'] });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  const sdk = session.value;
  const read = await sdk.scene.read({});
  const cameraFirst = await sdk.cameras.list({ snapshotId: read.value.snapshotId, limit: 1 });
  assert.equal(cameraFirst.status, 'succeeded');
  const cameraRetry = await sdk.cameras.list({ snapshotId: read.value.snapshotId, cursor: cameraFirst.value.nextCursor, limit: 1 });
  const cameraRetryAgain = await sdk.cameras.list({ snapshotId: read.value.snapshotId, cursor: cameraFirst.value.nextCursor, limit: 1 });
  assert.equal(cameraRetry.status, 'succeeded');
  assert.equal(cameraRetryAgain.status, 'succeeded');
  assert.equal(cameraRetryAgain.value.nextCursor, cameraRetry.value.nextCursor);

  const assetFirst = await sdk.assets.listMetadata({ snapshotId: read.value.snapshotId, limit: 1 });
  assert.equal(assetFirst.status, 'succeeded');
  const assetRetry = await sdk.assets.listMetadata({ snapshotId: read.value.snapshotId, cursor: assetFirst.value.nextCursor, limit: 1 });
  const assetRetryAgain = await sdk.assets.listMetadata({ snapshotId: read.value.snapshotId, cursor: assetFirst.value.nextCursor, limit: 1 });
  assert.equal(assetRetry.status, 'succeeded');
  assert.equal(assetRetryAgain.status, 'succeeded');
  assert.equal(assetRetryAgain.value.nextCursor, assetRetry.value.nextCursor);
});
