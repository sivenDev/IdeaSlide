import test from 'node:test';
import assert from 'node:assert/strict';

import { createIdeaSketchHostCaller, createIdeaSketchSdkHost } from '../src/lib/ideasketch-sdk/host.ts';

function createHostTarget(documentSessionId = 'document-1') {
  const elements = [];
  const appState = {};
  const files = {};
  return {
    documentSessionId,
    documentId: documentSessionId,
    activePageId: 'page-1',
    documentStatus: 'editable',
    revision: 1,
    readOnly: false,
    mountedPageId: 'page-1',
    pageEditVersion: 1,
    nativeInteraction: { epoch: 1, busy: false, reasons: [] },
    document: {
      type: 'ideasketch',
      formatVersion: '1.0',
      created: '2026-01-01',
      modified: '2026-01-01',
      pages: [{ id: 'page-1', title: 'Page 1', elements, appState, files }],
    },
    scene: { elements, appState, files },
    services: { mountedCanvas: true, writable: true, scene: true, operations: true },
    commitScene: () => undefined,
  };
}

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

test('scene public options require plain objects and own enumerable fields', async () => {
  const host = createHost();
  const caller = createIdeaSketchHostCaller({ id: 'plain-options-caller', profile: 'trusted-ui' });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal(session.status, 'succeeded');
  const sdk = session.value;

  const inherited = Object.create({ limit: 1 });
  const classInstance = new (class { limit = 1; })();
  const getter = {};
  Object.defineProperty(getter, 'limit', { enumerable: true, get() { throw new Error('getter failed'); } });
  const benignGetter = {};
  Object.defineProperty(benignGetter, 'limit', { enumerable: true, get() { return 1; } });

  for (const input of [inherited, classInstance, new Date(), getter, benignGetter]) {
    assert.equal((await sdk.scene.read(input)).error.code, 'invalid_request');
    assert.equal((await sdk.scene.getElements(input)).error.code, 'invalid_request');
    assert.equal((await sdk.cameras.list(input)).error.code, 'invalid_request');
    assert.equal((await sdk.assets.listMetadata(input)).error.code, 'invalid_request');
    assert.equal((await sdk.scene.validatePlan(input)).error.code, 'invalid_request');
    assert.equal((await sdk.scene.applyPlan(input)).error.code, 'invalid_request');
    assert.equal((await sdk.scene.requestClearConfirmation(input)).error.code, 'invalid_request');
  }

  const nullPrototype = Object.create(null);
  nullPrototype.limit = 1;
  assert.equal((await sdk.scene.read(nullPrototype)).status, 'succeeded');

  const read = await sdk.scene.read({});
  assert.equal(read.status, 'succeeded');
  const refs = new Proxy(['element:missing'], {
    get(target, property, receiver) {
      if (property === '0') throw new Error('ref getter failed');
      return Reflect.get(target, property, receiver);
    },
  });
  const malformedRefs = await sdk.scene.getElements({ snapshotId: read.value.snapshotId, refs });
  assert.equal(malformedRefs.status, 'rejected');
  assert.equal(malformedRefs.error.code, 'invalid_request');
});

test('scene read options reject malformed booleans and sparse reference arrays', async () => {
  const host = createHost();
  const caller = createIdeaSketchHostCaller({ id: 'strict-read-options', profile: 'trusted-ui' });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal(session.status, 'succeeded');
  const sdk = session.value;
  assert.equal((await sdk.scene.read({ includeDeleted: 'yes' })).error.code, 'invalid_request');
  assert.equal((await sdk.scene.getElements({ snapshotId: 'scene-snapshot:missing', refs: ['element:a'], includeDeleted: 1 })).error.code, 'invalid_request');
  const refs = [];
  refs.length = 1;
  assert.equal((await sdk.scene.getElements({ snapshotId: 'scene-snapshot:missing', refs })).error.code, 'invalid_request');
});

test('scene applyPlan rejects forged or malformed AbortSignal values at the public boundary', async () => {
  const host = createHost();
  const caller = createIdeaSketchHostCaller({ id: 'signal-boundary-caller', profile: 'trusted-ui' });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal(session.status, 'succeeded');
  const sdk = session.value;
  const read = await sdk.scene.read({});
  assert.equal(read.status, 'succeeded');
  const base = {
    requestId: 'malformed-signal',
    snapshotId: read.value.snapshotId,
    operations: [{ kind: 'create-text', version: 1, ref: 'temp:t', x: 0, y: 0, originalText: 'x' }],
  };
  const fakePrototypeSignal = Object.create(AbortSignal.prototype);
  const throwingSignal = {};
  Object.defineProperty(throwingSignal, 'aborted', { enumerable: true, get() { throw new Error('aborted getter failed'); } });

  for (const signal of [null, {}, { aborted: false }, fakePrototypeSignal, throwingSignal]) {
    const result = await sdk.scene.applyPlan({ ...base, requestId: `malformed-${String(signal)}`, signal });
    assert.equal(result.status, 'rejected');
    assert.equal(result.error.code, 'invalid_request');
  }
});

test('session factory classifies hostile input getters as invalid_request', async () => {
  const host = createHost();
  const caller = createIdeaSketchHostCaller({ id: 'factory-boundary-caller', profile: 'trusted-ui' });
  const factory = host.createSessionFactory(caller);
  const input = {};
  Object.defineProperty(input, 'sdkProtocolVersion', {
    enumerable: true,
    get() { throw new Error('version getter failed'); },
  });
  const result = await factory.createSession(input);
  assert.equal(result.status, 'rejected');
  assert.equal(result.error.code, 'invalid_request');

  const benign = {};
  Object.defineProperty(benign, 'sdkProtocolVersion', {
    enumerable: true,
    get() { return { major: 1, minor: 0 }; },
  });
  const benignResult = await factory.createSession(benign);
  assert.equal(benignResult.status, 'rejected');
  assert.equal(benignResult.error.code, 'invalid_request');
});

test('scene array payloads classify revoked and hostile Proxies as invalid_request', async () => {
  const host = createHost();
  const caller = createIdeaSketchHostCaller({ id: 'revoked-arrays-caller', profile: 'trusted-ui' });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal(session.status, 'succeeded');
  const sdk = session.value;

  const revokedRefs = Proxy.revocable(['element:missing'], {});
  revokedRefs.revoke();
  const getElements = await sdk.scene.getElements({
    snapshotId: 'scene-snapshot:missing',
    refs: revokedRefs.proxy,
  });
  assert.equal(getElements.status, 'rejected');
  assert.equal(getElements.error.code, 'invalid_request');

  const revokedOperations = Proxy.revocable([], {});
  revokedOperations.revoke();
  const validate = await sdk.scene.validatePlan({
    snapshotId: 'scene-snapshot:missing',
    operations: revokedOperations.proxy,
  });
  assert.equal(validate.status, 'rejected');
  assert.equal(validate.error.code, 'invalid_request');

  const apply = await sdk.scene.applyPlan({
    requestId: 'revoked-operations',
    snapshotId: 'scene-snapshot:missing',
    operations: revokedOperations.proxy,
  });
  assert.equal(apply.status, 'rejected');
  assert.equal(apply.error.code, 'invalid_request');

  const hostileCapabilities = new Proxy(['scene.read'], {
    get(target, property, receiver) {
      if (property === 'length') throw new Error('length getter failed');
      return Reflect.get(target, property, receiver);
    },
  });
  const capabilityResult = await sdk.scene.applyPlan({
    requestId: 'hostile-capabilities',
    snapshotId: 'scene-snapshot:missing',
    operations: [{ kind: 'create-text', version: 1, ref: 'temp:t', x: 0, y: 0, originalText: 'x' }],
    requiredCapabilities: hostileCapabilities,
  });
  assert.equal(capabilityResult.status, 'rejected');
  assert.equal(capabilityResult.error.code, 'invalid_request');
});

test('host operation builders and enabled Camera selection classify revoked Proxies without throwing', async () => {
  const host = createHost();
  const caller = createIdeaSketchHostCaller({ id: 'revoked-builder-caller', profile: 'trusted-ui' });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal(session.status, 'succeeded');
  const sdk = session.value;
  const revokedInput = Proxy.revocable({}, {});
  revokedInput.revoke();
  let built;
  assert.doesNotThrow(() => { built = sdk.operations.text.create(revokedInput.proxy); });
  assert.equal(built.status, 'rejected');
  assert.equal(built.error.code, 'invalid_request');

  const cameraHost = createIdeaSketchSdkHost(() => ({
    ...createHostTarget('camera-select-boundary'),
    services: {
      mountedCanvas: true,
      writable: true,
      scene: true,
      operations: true,
      cameras: true,
      assets: true,
      methods: { cameras: ['select'] },
    },
  }));
  const cameraCaller = createIdeaSketchHostCaller({ id: 'camera-select-caller', profile: 'trusted-ui' });
  const cameraSession = await cameraHost.createSession({ caller: cameraCaller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal(cameraSession.status, 'succeeded');
  const revokedSelection = Proxy.revocable({}, {});
  revokedSelection.revoke();
  const selected = await cameraSession.value.cameras.select(revokedSelection.proxy);
  assert.equal(selected.status, 'rejected');
  assert.equal(selected.error.code, 'invalid_request');
  const classSelection = await cameraSession.value.cameras.select(new Date());
  assert.equal(classSelection.status, 'rejected');
  assert.equal(classSelection.error.code, 'invalid_request');
});

test('host target inspection failures remain inside the SDK result boundary', async () => {
  const host = createIdeaSketchSdkHost(() => { throw new Error('target getter failed'); });
  const caller = createIdeaSketchHostCaller({ id: 'target-failure-caller', profile: 'trusted-ui' });
  const result = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal(result.status, 'rejected');
  assert.equal(result.error.code, 'internal_error');
});

test('context methods classify hostile live target getters as internal_error results', async () => {
  const target = createHostTarget('context-target-failure');
  const host = createIdeaSketchSdkHost(() => target);
  const caller = createIdeaSketchHostCaller({ id: 'context-target-failure-caller', profile: 'trusted-ui' });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal(session.status, 'succeeded');
  Object.defineProperty(target, 'documentStatus', {
    configurable: true,
    enumerable: true,
    get() { throw new Error('documentStatus getter failed'); },
  });
  const context = await session.value.context.get();
  assert.equal(context.status, 'rejected');
  assert.equal(context.error.code, 'internal_error');
  const capabilities = await session.value.context.getCapabilities();
  assert.equal(capabilities.status, 'rejected');
  assert.equal(capabilities.error.code, 'internal_error');
});

test('event subscriptions classify hostile capability reads without synchronous throws', async () => {
  const target = createHostTarget('events-target-failure');
  target.services.events = true;
  const host = createIdeaSketchSdkHost(() => target);
  const caller = createIdeaSketchHostCaller({ id: 'events-target-failure-caller', profile: 'trusted-ui' });
  const session = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal(session.status, 'succeeded');
  Object.defineProperty(target, 'services', {
    configurable: true,
    enumerable: true,
    get() { throw new Error('services getter failed'); },
  });
  let result;
  assert.doesNotThrow(() => { result = session.value.events.onContextChange(() => undefined); });
  assert.equal(result.status, 'rejected');
  assert.equal(result.error.code, 'internal_error');
});
