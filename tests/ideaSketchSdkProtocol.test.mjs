import test from 'node:test';
import assert from 'node:assert/strict';

import {
  IDEA_SKETCH_PAGE_OPERATION_KINDS,
  IDEA_SKETCH_SCENE_OPERATION_KINDS,
  IDEA_SKETCH_SDK_METHOD_CATALOG,
  createCapabilityProjection,
  negotiateSdkProtocols,
} from '../src/lib/ideasketch-sdk/capabilities.ts';
import {
  createIdeaSketchHostCaller,
  createIdeaSketchSdkHost,
} from '../src/lib/ideasketch-sdk/host.ts';

function createHost() {
  return createIdeaSketchSdkHost(() => ({
    documentSessionId: 'document-1',
    documentId: 'document-1',
    activePageId: 'page-1',
    documentStatus: 'editable',
    revision: 3,
    sourceModified: 'source-1',
    readOnly: false,
    mountedPageId: 'page-1',
    pageEditVersion: 7,
    nativeInteraction: { epoch: 1, busy: false, reasons: [] },
    document: {
      type: 'ideasketch',
      formatVersion: '1.0',
      created: '2026-09-02T00:00:00.000Z',
      modified: '2026-09-02T00:00:00.000Z',
      pages: [{ id: 'page-1', title: 'Page 1', elements: [], appState: {}, files: {} }],
    },
    scene: { elements: [], appState: {}, files: {} },
    services: {},
  }));
}

test('the v1 method catalog exposes every RFC namespace exactly once', () => {
  assert.deepEqual(Object.keys(IDEA_SKETCH_SDK_METHOD_CATALOG), [
    'session',
    'context',
    'requests',
    'pages',
    'scene',
    'operations',
    'cameras',
    'selection',
    'view',
    'transforms',
    'presentation',
    'assets',
    'io',
    'events',
  ]);
  assert.deepEqual(IDEA_SKETCH_SDK_METHOD_CATALOG.events, [
    'onContextChange',
    'onDocumentCommitted',
    'onSceneCommitted',
    'onSelectionChange',
    'onAvailabilityChange',
    'onPresentationStateChange',
  ]);
  assert.ok(IDEA_SKETCH_SDK_METHOD_CATALOG.scene.includes('applyPlan'));
  assert.ok(IDEA_SKETCH_SDK_METHOD_CATALOG.pages.includes('applyPlan'));
  assert.ok(IDEA_SKETCH_SCENE_OPERATION_KINDS.includes('create-text'));
  assert.ok(IDEA_SKETCH_SCENE_OPERATION_KINDS.includes('upsert-bound-text'));
  assert.ok(IDEA_SKETCH_SCENE_OPERATION_KINDS.includes('set-text-style'));
  assert.ok(IDEA_SKETCH_PAGE_OPERATION_KINDS.includes('create-page-from-selection'));
});

test('caller profiles receive different immutable capability projections', () => {
  const trusted = createCapabilityProjection('trusted-ui', {});
  const agent = createCapabilityProjection('agent-v2', {}, { major: 2, minor: 0 });
  const external = createCapabilityProjection('future-external', {});
  const externalReader = createCapabilityProjection(
    'future-external',
    {},
    undefined,
    ['context.read', 'document.read'],
  );

  assert.ok(trusted.scopes.includes('scene.destructive-clear'));
  assert.ok(trusted.scopes.includes('user-mediated-io'));
  assert.ok(agent.scopes.includes('scene.write'));
  assert.ok(agent.scopes.includes('document.structure.write'));
  assert.ok(!agent.scopes.includes('scene.destructive-clear'));
  assert.ok(!agent.scopes.includes('user-mediated-io'));
  assert.deepEqual(external.scopes, []);
  assert.ok(!external.scopes.includes('legacy.raw-scene'));
  assert.deepEqual(external.supportedMethods.pages, []);
  assert.deepEqual(externalReader.supportedMethods.pages, ['list', 'select']);
  assert.ok(agent.supportedOperationKinds.includes('create-text'));
  assert.ok(agent.supportedOperationKinds.includes('add-page'));
  assert.ok(!external.supportedOperationKinds.includes('add-page'));
  assert.notEqual(trusted.schemaDigest, agent.schemaDigest);
  assert.ok(Object.isFrozen(trusted));
  assert.ok(Object.isFrozen(trusted.scopes));
});

test('protocol negotiation rejects unsupported majors and schema mismatches without downgrade', () => {
  assert.equal(negotiateSdkProtocols({ sdk: { major: 1, minor: 0 } }).status, 'succeeded');
  assert.equal(negotiateSdkProtocols({ sdk: { major: 2, minor: 0 } }).error.code, 'protocol_mismatch');
  assert.equal(
    negotiateSdkProtocols({
      sdk: { major: 1, minor: 0 },
      agentTool: { major: 2, minor: 0 },
      expectedAgentSchemaDigest: 'wrong',
    }).error.code,
    'protocol_mismatch',
  );
  assert.equal(
    negotiateSdkProtocols({ sdk: { major: 1, minor: Number.NaN } }).error.code,
    'protocol_mismatch',
  );
  assert.equal(
    negotiateSdkProtocols({ sdk: { major: 1, minor: 0 }, expectedAgentSchemaDigest: 'orphan' }).error.code,
    'invalid_request',
  );
});

test('sync builders and subscriptions fail through SdkSyncResult rather than throwing', async () => {
  const host = createHost();
  const caller = createIdeaSketchHostCaller({
    id: 'external-1',
    profile: 'future-external',
    grantedScopes: ['scene.write'],
  });
  const created = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal(created.status, 'succeeded');
  const sdk = created.value;

  assert.doesNotThrow(() => sdk.operations.shape.create({ arbitrary: true }));
  assert.equal(sdk.operations.shape.create({ arbitrary: true }).error.code, 'unsupported_operation');
  assert.equal(sdk.operations.shape.create('invalid').error.code, 'invalid_request');
  assert.equal(sdk.events.onContextChange(() => {}).error.code, 'capability_denied');

  const disposed = await sdk.session.dispose();
  assert.equal(disposed.status, 'succeeded');
  assert.equal(sdk.operations.text.create({ text: 'closed' }).error.code, 'session_closed');
  assert.equal(sdk.events.onSceneCommitted(() => {}).error.code, 'session_closed');
});

test('host callers cannot forge or widen their capability grants', async () => {
  const host = createHost();
  const forged = await host.createSession({
    caller: { id: 'forged', profile: 'host-internal' },
    sdkProtocolVersion: { major: 1, minor: 0 },
  });
  assert.equal(forged.error.code, 'invalid_request');

  const caller = createIdeaSketchHostCaller({
    id: 'restricted-external',
    profile: 'future-external',
    grantedScopes: ['context.read'],
  });
  const widened = await host.createSession({
    caller,
    sdkProtocolVersion: { major: 1, minor: 0 },
    requiredCapabilities: ['scene.write'],
  });
  assert.equal(widened.error.code, 'capability_denied');
});

test('a caller session never follows the active host registry into another document session', async () => {
  let target = {
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
      created: '2026-09-02T00:00:00.000Z',
      modified: '2026-09-02T00:00:00.000Z',
      pages: [{ id: 'page-1', title: 'Page 1', elements: [], appState: {}, files: {} }],
    },
    scene: { elements: [], appState: {}, files: {} },
    services: {},
  };
  const host = createIdeaSketchSdkHost(() => target);
  const caller = createIdeaSketchHostCaller({ id: 'ui-1', profile: 'trusted-ui' });
  const created = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  target = {
    ...target,
    documentSessionId: 'document-2',
    documentId: 'document-2',
    activePageId: 'page-2',
    mountedPageId: 'page-2',
    document: {
      ...target.document,
      pages: [{ id: 'page-2', title: 'Page 2', elements: [], appState: {}, files: {} }],
    },
  };
  assert.equal((await created.value.context.get()).error.code, 'editor_unavailable');
});

test('Agent caller profiles require their explicitly pinned Tool protocol major', async () => {
  const host = createHost();
  const v1Caller = createIdeaSketchHostCaller({ id: 'agent-v1', profile: 'agent-v1' });
  assert.equal((await host.createSession({
    caller: v1Caller,
    sdkProtocolVersion: { major: 1, minor: 0 },
  })).error.code, 'protocol_mismatch');
  assert.equal((await host.createSession({
    caller: v1Caller,
    sdkProtocolVersion: { major: 1, minor: 0 },
    agentToolProtocolVersion: { major: 2, minor: 0 },
  })).error.code, 'protocol_mismatch');
  assert.equal((await host.createSession({
    caller: v1Caller,
    sdkProtocolVersion: { major: 1, minor: 0 },
    agentToolProtocolVersion: { major: 1, minor: 0 },
    expectedAgentSchemaDigest: 'agent-tool-v1:eight-tools',
  })).status, 'succeeded');
});

test('Agent v1 and v2 expose exact version-pinned operation projections', () => {
  const v1 = createCapabilityProjection(
    'agent-v1',
    {},
    { major: 1, minor: 0 },
    undefined,
    { toolSchemaDigest: 'agent-tool-v1:eight-tools', documentFormatVersion: '1.0' },
  );
  const v2 = createCapabilityProjection(
    'agent-v2',
    {},
    { major: 2, minor: 0 },
    undefined,
    { toolSchemaDigest: 'agent-tool-v2:semantic', documentFormatVersion: '1.0' },
  );

  assert.deepEqual(v1.supportedOperationKinds, [
    'add-page',
    'delete-page',
    'reorder-page',
    'create-shape',
    'create-arrow',
    'bind-arrow',
    'move-element',
    'resize-element',
  ]);
  assert.deepEqual(v1.supportedMethods.operations, ['page', 'element', 'shape', 'connector']);
  assert.ok(!v1.supportedOperationKinds.includes('create-text'));
  assert.ok(!v1.supportedMethods.operations.includes('text'));
  assert.deepEqual(v2.supportedOperationKinds, [
    'add-page',
    'delete-page',
    'reorder-page',
    'create-shape',
    'create-arrow',
    'bind-arrow',
    'create-text',
    'bind-text',
    'unbind-text',
    'upsert-bound-text',
    'set-text',
    'set-text-style',
    'set-text-layout',
    'move-element',
    'resize-element',
  ]);
  assert.deepEqual(v2.supportedMethods.pages, ['list', 'validatePlan', 'applyPlan']);
  assert.deepEqual(v2.supportedMethods.scene, ['read', 'getElements', 'validatePlan', 'applyPlan']);
  assert.deepEqual(v2.supportedMethods.operations, ['page', 'element', 'shape', 'connector', 'text']);
  for (const forbidden of [
    'import-page',
    'duplicate-page',
    'rename-page',
    'create-page-from-selection',
    'create-camera',
    'update-camera-bounds',
    'set-camera-order',
    'delete-camera',
    'set-background',
    'delete-element',
    'apply-style-preset',
    'clear-scene',
  ]) {
    assert.ok(!v2.supportedOperationKinds.includes(forbidden), forbidden);
  }
  assert.deepEqual(v2.supportedMethods.cameras, []);
  assert.deepEqual(v2.supportedMethods.selection, []);
  assert.deepEqual(v2.supportedMethods.io, []);
  assert.equal(v1.toolSchemaDigest, 'agent-tool-v1:eight-tools');
  assert.equal(v2.toolSchemaDigest, 'agent-tool-v2:semantic');
});

test('session, context, and capabilities expose fixed tool and document versions', async () => {
  const host = createHost();
  const caller = createIdeaSketchHostCaller({ id: 'agent-v2', profile: 'agent-v2' });
  const created = await host.createSession({
    caller,
    sdkProtocolVersion: { major: 1, minor: 0 },
    agentToolProtocolVersion: { major: 2, minor: 0 },
    expectedAgentSchemaDigest: 'agent-tool-v2:semantic',
  });
  const [info, context, capabilities] = await Promise.all([
    created.value.session.getInfo(),
    created.value.context.get(),
    created.value.context.getCapabilities(),
  ]);
  assert.equal(info.value.toolSchemaDigest, 'agent-tool-v2:semantic');
  assert.equal(context.value.toolSchemaDigest, 'agent-tool-v2:semantic');
  assert.equal(capabilities.value.toolSchemaDigest, 'agent-tool-v2:semantic');
  assert.equal(info.value.documentFormatVersion, '1.0');
  assert.equal(context.value.documentFormatVersion, '1.0');
  assert.equal(capabilities.value.documentFormatVersion, '1.0');
  assert.equal(capabilities.value.available.writable, true);
});

test('the public barrel omits authority helpers and exports only the safe session factory contract', async () => {
  const sdkModule = await import('../src/lib/ideasketch-sdk/index.ts');
  assert.equal('createCapabilityProjection' in sdkModule, false);
  assert.equal('negotiateSdkProtocols' in sdkModule, false);
  assert.equal('createIdeaSketchHostCaller' in sdkModule, false);
});

test('one host caller cannot bypass an active ledger by opening another session', async () => {
  const host = createHost();
  const caller = createIdeaSketchHostCaller({ id: 'ui-1', profile: 'trusted-ui' });
  const first = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  assert.equal((await host.createSession({
    caller,
    sdkProtocolVersion: { major: 1, minor: 0 },
  })).error.code, 'editor_busy');
  assert.equal((await first.value.session.dispose()).status, 'succeeded');
  assert.equal((await host.createSession({
    caller,
    sdkProtocolVersion: { major: 1, minor: 0 },
  })).status, 'succeeded');
  assert.equal(host.mutationScheduler, host.mutationScheduler);
});
