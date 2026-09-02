import test from 'node:test';
import assert from 'node:assert/strict';

import { createIdeaSketchHostCaller, createIdeaSketchSdkHost } from '../src/lib/ideasketch-sdk/host.ts';

function createHost() {
  const state = { elements: [], appState: {}, files: {}, pageEditVersion: 1 };
  const host = createIdeaSketchSdkHost(() => ({
    documentSessionId: 'document-1',
    documentId: 'document-1',
    activePageId: 'page-1',
    documentStatus: 'editable',
    revision: 1,
    readOnly: false,
    mountedPageId: 'page-1',
    pageEditVersion: state.pageEditVersion,
    nativeInteraction: { epoch: 1, busy: false, reasons: [] },
    document: {
      type: 'ideasketch',
      formatVersion: '1.0',
      created: '2026-01-01',
      modified: '2026-01-01',
      pages: [{ id: 'page-1', title: 'Page 1', elements: state.elements, appState: state.appState, files: state.files }],
    },
    scene: { elements: state.elements, appState: state.appState, files: state.files },
    services: { mountedCanvas: true, writable: true, scene: true, operations: true, cameras: true, assets: true },
    commitScene: () => undefined,
  }));
  return host;
}

test('createSession rejects malformed or unknown requiredCapabilities', async () => {
  const host = createHost();
  assert.equal((await host.createSession(null)).error.code, 'invalid_request');
  assert.equal((await host.createSession(undefined)).error.code, 'invalid_request');
  const caller = createIdeaSketchHostCaller({ id: 'caller', profile: 'future-external' });
  const unknown = await host.createSession({
    caller,
    sdkProtocolVersion: { major: 1, minor: 0 },
    requiredCapabilities: ['bogus'],
  });
  assert.equal(unknown.status, 'rejected');
  assert.equal(unknown.error.code, 'invalid_request');

  const malformed = await host.createSession({
    caller,
    sdkProtocolVersion: { major: 1, minor: 0 },
    requiredCapabilities: 'scene.read',
  });
  assert.equal(malformed.status, 'rejected');
  assert.equal(malformed.error.code, 'invalid_request');
});

test('disposed async scene methods return session_closed before payload validation', async () => {
  const host = createHost();
  const caller = createIdeaSketchHostCaller({ id: 'caller', profile: 'future-external', grantedScopes: ['scene.read', 'scene.write'] });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal(session.status, 'succeeded');
  const sdk = session.value;
  assert.equal((await sdk.session.dispose()).status, 'succeeded');

  assert.equal((await sdk.scene.read(null)).error.code, 'session_closed');
  assert.equal((await sdk.scene.getElements(null)).error.code, 'session_closed');
  assert.equal((await sdk.scene.validatePlan(null)).error.code, 'session_closed');
  assert.equal((await sdk.scene.applyPlan(null)).error.code, 'session_closed');
  assert.equal((await sdk.assets.listMetadata(null)).error.code, 'session_closed');
});

test('namespace availability does not advertise unimplemented Camera interactions', async () => {
  const host = createHost();
  const caller = createIdeaSketchHostCaller({ id: 'camera-reader', profile: 'trusted-ui' });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal(session.status, 'succeeded');
  const capabilities = (await session.value.context.getCapabilities());
  assert.equal(capabilities.status, 'succeeded');
  assert.deepEqual(capabilities.value.availableMethods.cameras, ['list']);
  assert.equal((await session.value.cameras.select({})).error.code, 'unsupported_operation');
  assert.equal((await session.value.cameras.beginCreate({})).error.code, 'unsupported_operation');
});

test('explicit service writability disables advertised mutation capabilities', async () => {
  const host = createIdeaSketchSdkHost(() => ({
    documentSessionId: 'read-only-service',
    documentId: 'read-only-service',
    activePageId: 'page-1',
    documentStatus: 'editable',
    revision: 1,
    readOnly: false,
    mountedPageId: 'page-1',
    pageEditVersion: 1,
    nativeInteraction: { epoch: 1, busy: false, reasons: [] },
    document: { type: 'ideasketch', formatVersion: '1.0', created: '2026', modified: '2026', pages: [] },
    scene: { elements: [], appState: {}, files: {} },
    services: { mountedCanvas: true, scene: true, operations: true, writable: false },
    commitScene: () => undefined,
  }));
  const caller = createIdeaSketchHostCaller({ id: 'read-only-service-caller', profile: 'trusted-ui' });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal(session.status, 'succeeded');
  const capabilities = await session.value.context.getCapabilities();
  assert.equal(capabilities.status, 'succeeded');
  assert.equal(capabilities.value.available.writable, false);
  assert.deepEqual(capabilities.value.availableOperationKinds, []);
});

test('unexpected adapter failures are classified as internal_error', async () => {
  const { applyIdeaSketchScenePlan } = await import('../src/lib/ideasketch-sdk/excalidrawSceneAdapter.ts');
  const result = applyIdeaSketchScenePlan({
    scene: {
      get elements() { throw new Error('scene getter failed'); },
      appState: {},
      files: {},
    },
    operations: [{ kind: 'create-text', version: 1, ref: 'temp:t', x: 0, y: 0, originalText: 'x' }],
  });
  assert.equal(result.status, 'rejected');
  assert.equal(result.error.code, 'internal_error');
});

test('public reconciliation rejects malformed opaque tokens before ledger lookup', async () => {
  const host = createHost();
  const caller = createIdeaSketchHostCaller({ id: 'reconcile-caller', profile: 'trusted-ui' });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal(session.status, 'succeeded');
  const result = await session.value.requests.reconcile('reconciliation-token:bad\nvalue');
  assert.equal(result.status, 'rejected');
  assert.equal(result.error.code, 'invalid_request');
});

test('clear confirmation rejects malformed scene snapshot tokens before lookup', async () => {
  const host = createHost();
  const caller = createIdeaSketchHostCaller({ id: 'clear-token-caller', profile: 'trusted-ui' });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal(session.status, 'succeeded');
  const result = await session.value.scene.requestClearConfirmation({
    snapshotId: 'not-a-scene-snapshot',
    scope: 'all-elements',
  });
  assert.equal(result.status, 'rejected');
  assert.equal(result.error.code, 'invalid_request');
});
