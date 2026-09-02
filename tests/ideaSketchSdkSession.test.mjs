import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createIdeaSketchHostCaller,
  createIdeaSketchSdkHost,
} from '../src/lib/ideasketch-sdk/host.ts';
import { createRequestLedger } from '../src/lib/ideasketch-sdk/requestLedger.ts';
import { createSessionController } from '../src/lib/ideasketch-sdk/session.ts';

function createHost(cleanupSession) {
  return createIdeaSketchSdkHost(() => ({
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
    services: { events: true },
    cleanupSession,
  }));
}

test('successful disposal cleans subscriptions and closes every token-bearing surface', async () => {
  let cleanupCalls = 0;
  const host = createHost(async () => { cleanupCalls += 1; });
  const caller = createIdeaSketchHostCaller({ id: 'ui-1', profile: 'trusted-ui' });
  const created = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  const sdk = created.value;
  let eventCalls = 0;
  const subscription = sdk.events.onAvailabilityChange(() => { eventCalls += 1; });
  assert.equal(subscription.status, 'succeeded');

  const disposed = await sdk.session.dispose();
  assert.equal(disposed.status, 'succeeded');
  assert.equal(cleanupCalls, 1);
  assert.equal((await sdk.session.getInfo()).value.lifecycle, 'disposed');
  assert.equal((await sdk.context.get()).error.code, 'session_closed');
  assert.doesNotThrow(() => subscription.value());
  assert.doesNotThrow(() => subscription.value());
  assert.equal(eventCalls, 0);
  assert.equal((await sdk.session.dispose()).value.outcome, 'noop');
});

test('failed cleanup leaves the facade active instead of half-disposed', async () => {
  const host = createHost(async () => { throw new Error('cleanup failed'); });
  const caller = createIdeaSketchHostCaller({ id: 'ui-1', profile: 'trusted-ui' });
  const created = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  const sdk = created.value;

  const disposed = await sdk.session.dispose();
  assert.equal(disposed.error.code, 'internal_error');
  assert.equal((await sdk.session.getInfo()).value.lifecycle, 'active');
  assert.equal((await sdk.context.get()).status, 'succeeded');
});

test('disposal refuses in-flight and indeterminate ledgers until they reach a terminal result', async () => {
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const controller = createSessionController({
    sessionId: 'session-1',
    callerProfile: 'trusted-ui',
    sdkProtocolVersion: { major: 1, minor: 0 },
    documentFormatVersion: '1.0',
    ledger,
    invalidateCallerResources: () => {},
  });
  const inFlight = ledger.reserve({ requestId: 'request-1', payloadDigest: 'payload-1' });
  assert.equal((await controller.namespace.dispose()).error.code, 'editor_busy');

  const indeterminate = ledger.markIndeterminate(inFlight.value.handle, {
    beforeDigest: 'before',
    expectedAfterDigest: 'after',
    getLiveDigest: async () => 'before',
    createSucceededResult: () => { throw new Error('must not be called'); },
  });
  assert.equal((await controller.namespace.dispose()).error.code, 'commit_indeterminate');
  const reconciled = await ledger.reconcile({
    reconciliationToken: indeterminate.reconciliationToken,
  });
  assert.equal(reconciled.error.code, 'commit_indeterminate');
  assert.equal((await controller.namespace.dispose()).status, 'succeeded');
});

test('concurrent disposal shares one cleanup attempt', async () => {
  let cleanupCalls = 0;
  let releaseCleanup;
  const cleanupGate = new Promise((resolve) => { releaseCleanup = resolve; });
  const host = createHost(async () => {
    cleanupCalls += 1;
    await cleanupGate;
  });
  const caller = createIdeaSketchHostCaller({ id: 'ui-1', profile: 'trusted-ui' });
  const created = await host.createSession({ caller, sdkProtocolVersion: { major: 1, minor: 0 } });
  const first = created.value.session.dispose();
  const second = created.value.session.dispose();
  assert.equal((await created.value.context.get()).error.code, 'session_closed');
  releaseCleanup();
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult.status, 'succeeded');
  assert.deepEqual(secondResult, firstResult);
  assert.equal(cleanupCalls, 1);
});

test('dispose atomically blocks reservations while cleanup is awaiting', async () => {
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  let releaseCleanup;
  const cleanupGate = new Promise((resolve) => { releaseCleanup = resolve; });
  const controller = createSessionController({
    sessionId: 'session-1',
    callerProfile: 'trusted-ui',
    sdkProtocolVersion: { major: 1, minor: 0 },
    documentFormatVersion: '1.0',
    ledger,
    cleanupSession: async () => cleanupGate,
    invalidateCallerResources: () => {},
  });

  const disposal = controller.namespace.dispose();
  assert.equal(
    ledger.reserve({ requestId: 'late', payloadDigest: 'payload' }).error.code,
    'session_closed',
  );
  releaseCleanup();
  assert.equal((await disposal).status, 'succeeded');
});

test('dispose cancels a host interaction through cleanup before closing its reservation', async () => {
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  let cleanupCalls = 0;
  const controller = createSessionController({
    sessionId: 'session-1',
    callerProfile: 'trusted-ui',
    sdkProtocolVersion: { major: 1, minor: 0 },
    documentFormatVersion: '1.0',
    ledger,
    cleanupSession: async () => { cleanupCalls += 1; },
    invalidateCallerResources: () => {},
  });
  const reserved = ledger.reserveComposite({ requestId: 'picker-1', payloadDigest: 'payload' });
  const joined = ledger.reserveComposite({ requestId: 'picker-1', payloadDigest: 'payload' });

  const disposed = await controller.namespace.dispose();
  assert.equal(disposed.status, 'succeeded');
  assert.equal(cleanupCalls, 1);
  assert.equal((await joined.value.result).status, 'cancelled');
  assert.equal(controller.isDisposed(), true);
  assert.equal(reserved.status, 'succeeded');
});

test('dispose refuses a host interaction when no cleanup boundary can cancel it', async () => {
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const controller = createSessionController({
    sessionId: 'session-1',
    callerProfile: 'trusted-ui',
    sdkProtocolVersion: { major: 1, minor: 0 },
    documentFormatVersion: '1.0',
    ledger,
    invalidateCallerResources: () => {},
  });
  ledger.reserveComposite({ requestId: 'picker-1', payloadDigest: 'payload' });

  assert.equal((await controller.namespace.dispose()).error.code, 'editor_busy');
  assert.equal(controller.isActive(), true);
  assert.equal(ledger.hasHostInteractionInFlight(), true);
});

test('caller-resource invalidation failure leaves the facade active without closing its ledger', async () => {
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const controller = createSessionController({
    sessionId: 'session-1',
    callerProfile: 'trusted-ui',
    sdkProtocolVersion: { major: 1, minor: 0 },
    documentFormatVersion: '1.0',
    ledger,
    invalidateCallerResources: () => { throw new Error('local invalidation failure'); },
  });

  assert.equal((await controller.namespace.dispose()).error.code, 'internal_error');
  assert.equal(controller.isDisposed(), false);
  assert.equal(controller.isActive(), true);
  assert.equal(ledger.reserve({ requestId: 'still-open', payloadDigest: 'payload' }).status, 'succeeded');
});

test('host interactions become terminal even when later caller-resource invalidation fails', async () => {
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const controller = createSessionController({
    sessionId: 'session-1',
    callerProfile: 'trusted-ui',
    sdkProtocolVersion: { major: 1, minor: 0 },
    documentFormatVersion: '1.0',
    ledger,
    cleanupSession: async () => {},
    invalidateCallerResources: () => { throw new Error('invalidation failed'); },
  });
  ledger.reserveComposite({ requestId: 'picker-1', payloadDigest: 'payload' });
  const joined = ledger.reserveComposite({ requestId: 'picker-1', payloadDigest: 'payload' });

  assert.equal((await controller.namespace.dispose()).error.code, 'internal_error');
  assert.equal((await joined.value.result).status, 'cancelled');
  assert.equal(ledger.getMutationResult('picker-1').status, 'cancelled');
  assert.equal(controller.isActive(), true);
});
