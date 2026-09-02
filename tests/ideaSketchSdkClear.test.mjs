import test from 'node:test';
import assert from 'node:assert/strict';

import { createIdeaSketchHostCaller, createIdeaSketchSdkHost } from '../src/lib/ideasketch-sdk/host.ts';
import { op } from './ideaSketchSdkTestUtils.mjs';

test('clear requires trusted confirmation and preserves Cameras for content-only scope', async () => {
  const state = { elements: [{ id: 'camera', type: 'rectangle', x: 0, y: 0, width: 20, height: 20, angle: 0, version: 1, versionNonce: 1, updated: 1, isDeleted: false, locked: false, groupIds: [], frameId: null, boundElements: null, strokeColor: '#1e90ff', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'dashed', roughness: 0, opacity: 60, roundness: null, customData: { type: 'camera', order: 1 } }], appState: {}, files: {}, pageEditVersion: 1 };
  const host = createIdeaSketchSdkHost(() => ({ documentSessionId: 'd', documentId: 'd', activePageId: 'p', documentStatus: 'editable', revision: 1, readOnly: false, mountedPageId: 'p', pageEditVersion: state.pageEditVersion, nativeInteraction: { epoch: 1, busy: false, reasons: [] }, document: { type: 'ideasketch', formatVersion: '1.0', created: '2026', modified: '2026', pages: [{ id: 'p', title: 'P', elements: state.elements, appState: state.appState, files: state.files }] }, scene: { elements: state.elements, appState: state.appState, files: state.files }, services: { mountedCanvas: true, writable: true, scene: true, operations: true }, confirmClear: async () => true, commitScene: (next) => { state.elements = next.elements; state.appState = next.appState; state.files = next.files; state.pageEditVersion += 1; } }));
  const caller = createIdeaSketchHostCaller({ id: 'ui', profile: 'trusted-ui' });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  const sdk = session.value;
  const read = await sdk.scene.read({ includeDeleted: true, limit: 10 });
  const receipt = await sdk.scene.requestClearConfirmation({ snapshotId: read.value.snapshotId, scope: 'content-only' });
  assert.equal(receipt.status, 'succeeded');
  const cleared = await sdk.scene.applyPlan({ requestId: 'clear-1', snapshotId: read.value.snapshotId, operations: [op('clear-scene', { scope: 'content-only', confirmationReceipt: receipt.value })] });
  assert.equal(cleared.status, 'succeeded');
  assert.equal(state.elements.find((item) => item.id === 'camera').isDeleted, false);
});

test('clear confirmation cancellation is a cancelled result and receipt is single-use', async () => {
  const state = { elements: [], appState: {}, files: {}, pageEditVersion: 1 };
  const host = createIdeaSketchSdkHost(() => ({ documentSessionId: 'd', documentId: 'd', activePageId: 'p', documentStatus: 'editable', revision: 1, readOnly: false, mountedPageId: 'p', pageEditVersion: state.pageEditVersion, nativeInteraction: { epoch: 1, busy: false, reasons: [] }, document: { type: 'ideasketch', formatVersion: '1.0', created: '2026', modified: '2026', pages: [{ id: 'p', title: 'P', elements: [], appState: {}, files: {} }] }, scene: state, services: { mountedCanvas: true, writable: true, scene: true, operations: true }, confirmClear: async () => false, commitScene: () => {} }));
  const session = await host.createSession({ caller: createIdeaSketchHostCaller({ id: 'ui', profile: 'trusted-ui' }), sdkProtocolVersion: { major: 1, minor: 0 } });
  const read = await session.value.scene.read({});
  const cancelled = await session.value.scene.requestClearConfirmation({ snapshotId: read.value.snapshotId, scope: 'all-elements' });
  assert.equal(cancelled.status, 'cancelled');
});

test('clear validation requires a live receipt and the clear operation to stand alone', async () => {
  const state = { elements: [{ id: 'shape', type: 'rectangle', x: 0, y: 0, width: 40, height: 40, angle: 0, version: 1, versionNonce: 1, updated: 1, isDeleted: false, locked: false, groupIds: [], frameId: null, boundElements: null }], appState: {}, files: {}, pageEditVersion: 1 };
  const host = createIdeaSketchSdkHost(() => ({ documentSessionId: 'd', documentId: 'd', activePageId: 'p', documentStatus: 'editable', revision: 1, readOnly: false, mountedPageId: 'p', pageEditVersion: state.pageEditVersion, nativeInteraction: { epoch: 1, busy: false, reasons: [] }, document: { type: 'ideasketch', formatVersion: '1.0', created: '2026', modified: '2026', pages: [{ id: 'p', title: 'P', elements: state.elements, appState: state.appState, files: state.files }] }, scene: state, services: { mountedCanvas: true, writable: true, scene: true, operations: true }, confirmClear: async () => true, commitScene: () => {} }));
  const session = await host.createSession({ caller: createIdeaSketchHostCaller({ id: 'ui', profile: 'trusted-ui' }), sdkProtocolVersion: { major: 1, minor: 0 } });
  const sdk = session.value;
  const read = await sdk.scene.read({ includeDeleted: true });
  const fake = op('clear-scene', { scope: 'all-elements', confirmationReceipt: 'confirmation-receipt:fake' });
  const invalidReceipt = await sdk.scene.validatePlan({ snapshotId: read.value.snapshotId, operations: [fake] });
  assert.equal(invalidReceipt.status, 'rejected');
  assert.equal(invalidReceipt.error.code, 'confirmation_required');
  const receipt = await sdk.scene.requestClearConfirmation({ snapshotId: read.value.snapshotId, scope: 'all-elements' });
  const mixed = await sdk.scene.validatePlan({ snapshotId: read.value.snapshotId, operations: [op('clear-scene', { scope: 'all-elements', confirmationReceipt: receipt.value }), op('set-background', { color: '#fff' })] });
  assert.equal(mixed.status, 'rejected');
  assert.equal(mixed.error.code, 'invalid_request');
});

test('an aborted authorized clear consumes its receipt and is replayable by request id', async () => {
  const state = { elements: [{ id: 'shape', type: 'rectangle', x: 0, y: 0, width: 40, height: 40, angle: 0, version: 1, versionNonce: 1, updated: 1, isDeleted: false, locked: false, groupIds: [], frameId: null, boundElements: null }], appState: {}, files: {}, pageEditVersion: 1 };
  const host = createIdeaSketchSdkHost(() => ({ documentSessionId: 'd', documentId: 'd', activePageId: 'p', documentStatus: 'editable', revision: 1, readOnly: false, mountedPageId: 'p', pageEditVersion: state.pageEditVersion, nativeInteraction: { epoch: 1, busy: false, reasons: [] }, document: { type: 'ideasketch', formatVersion: '1.0', created: '2026', modified: '2026', pages: [{ id: 'p', title: 'P', elements: state.elements, appState: state.appState, files: state.files }] }, scene: state, services: { mountedCanvas: true, writable: true, scene: true, operations: true }, confirmClear: async () => true, commitScene: (next) => { state.elements = next.elements; state.pageEditVersion += 1; } }));
  const session = await host.createSession({ caller: createIdeaSketchHostCaller({ id: 'ui', profile: 'trusted-ui' }), sdkProtocolVersion: { major: 1, minor: 0 } });
  const sdk = session.value;
  const read = await sdk.scene.read({ includeDeleted: true });
  const receipt = await sdk.scene.requestClearConfirmation({ snapshotId: read.value.snapshotId, scope: 'all-elements' });
  const controller = new AbortController();
  controller.abort();
  const operation = op('clear-scene', { scope: 'all-elements', confirmationReceipt: receipt.value });
  const cancelled = await sdk.scene.applyPlan({ requestId: 'aborted-clear', snapshotId: read.value.snapshotId, operations: [operation], signal: controller.signal });
  assert.equal(cancelled.status, 'cancelled');
  assert.equal((await sdk.scene.applyPlan({ requestId: 'aborted-clear', snapshotId: read.value.snapshotId, operations: [operation] })).status, 'cancelled');
  assert.equal((await sdk.scene.applyPlan({ requestId: 'different-clear', snapshotId: read.value.snapshotId, operations: [operation] })).error.code, 'confirmation_required');
});
