import test from 'node:test';
import assert from 'node:assert/strict';

import { createRequestLedger } from '../src/lib/ideasketch-sdk/requestLedger.ts';

function success(requestId, afterDigest = 'after') {
  return {
    status: 'succeeded',
    value: {
      changeSetId: `change:${requestId}`,
      requestId,
      outcome: 'applied',
      beforeDigest: 'before',
      afterDigest,
      beforeEditVersion: 1,
      afterEditVersion: 2,
      createdRefs: {},
      updatedRefs: [],
      deletedRefs: [],
      cascadedRefs: [],
      operations: [],
      diagnostics: [],
      history: { nativeCanvas: 'created', document: 'none', agentCustom: 'not-supported' },
    },
  };
}

test('identical concurrent requests join one reservation and replay one terminal result', async () => {
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const first = ledger.reserve({ requestId: 'request-1', payloadDigest: 'payload-a' });
  const joined = ledger.reserve({ requestId: 'request-1', payloadDigest: 'payload-a' });
  assert.equal(first.value.kind, 'reserved');
  assert.equal(joined.value.kind, 'joined');

  const result = success('request-1');
  ledger.complete(first.value.handle, result);
  assert.deepEqual(await joined.value.result, result);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.value), true);

  const replay = ledger.reserve({ requestId: 'request-1', payloadDigest: 'payload-a' });
  assert.equal(replay.value.kind, 'replay');
  assert.deepEqual(replay.value.result, result);
});

test('payload collisions and bounded capacity fail closed without eviction', () => {
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 1 });
  const first = ledger.reserve({ requestId: 'request-1', payloadDigest: 'payload-a' });
  assert.equal(first.status, 'succeeded');
  assert.equal(
    ledger.reserve({ requestId: 'request-1', payloadDigest: 'payload-b' }).error.code,
    'idempotency_conflict',
  );
  assert.equal(
    ledger.reserve({ requestId: 'request-2', payloadDigest: 'payload-c' }).error.code,
    'request_ledger_full',
  );
});

test('reconciliation is observational until the live digest resolves the original request', async () => {
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const reserved = ledger.reserve({ requestId: 'request-1', payloadDigest: 'payload-a' });
  const indeterminate = ledger.markIndeterminate(reserved.value.handle, {
    beforeDigest: 'before',
    expectedAfterDigest: 'after',
    getLiveDigest: async () => 'after',
    createSucceededResult: () => success('request-1', 'after'),
  });
  assert.equal(indeterminate.status, 'indeterminate');
  assert.equal(ledger.getMutationResult('request-1').status, 'indeterminate');

  const reconciled = await ledger.reconcile({
    reconciliationToken: indeterminate.reconciliationToken,
  });
  assert.equal(reconciled.status, 'succeeded');
  assert.equal(ledger.getMutationResult('request-1').status, 'succeeded');
});

test('composite reservations are host-only and consumed exactly once', () => {
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const reservation = ledger.reserveComposite({ requestId: 'camera-1', payloadDigest: 'payload-camera' });
  assert.equal(reservation.status, 'succeeded');
  assert.equal(reservation.value.kind, 'reserved');
  assert.deepEqual(
    ledger.consumeCompositeReservation(reservation.value.handle, { requestId: 'camera-1' }).value,
    { requestId: 'camera-1', payloadDigest: 'payload-camera' },
  );
  assert.equal(
    ledger.consumeCompositeReservation(reservation.value.handle, { requestId: 'camera-1' }).error.code,
    'invalid_request',
  );
});

test('unresolved reconciliation consumes tokens and stays attached to the original request', async () => {
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const reserved = ledger.reserve({ requestId: 'request-1', payloadDigest: 'payload-a' });
  let liveDigest = 'neither';
  const indeterminate = ledger.markIndeterminate(reserved.value.handle, {
    beforeDigest: 'before',
    expectedAfterDigest: 'after',
    getLiveDigest: async () => liveDigest,
    createSucceededResult: () => success('request-1'),
  });
  const unresolved = await ledger.reconcile({
    reconciliationToken: indeterminate.reconciliationToken,
  });
  assert.equal(unresolved.status, 'indeterminate');
  assert.notEqual(unresolved.reconciliationToken, indeterminate.reconciliationToken);
  liveDigest = 'after';
  assert.equal((await ledger.reconcile({
    reconciliationToken: indeterminate.reconciliationToken,
  })).error.code, 'request_not_found');
  assert.equal(ledger.getMutationResult('request-1').reconciliationToken, unresolved.reconciliationToken);
  assert.equal(
    ledger.reserve({ requestId: 'request-2', payloadDigest: 'different-payload' }).error.code,
    'commit_indeterminate',
  );
});

test('reconciliation observation failures rotate the token instead of orphaning the ledger', async () => {
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const reserved = ledger.reserve({ requestId: 'request-1', payloadDigest: 'payload-a' });
  let observationFails = true;
  let resultCreationFails = false;
  const indeterminate = ledger.markIndeterminate(reserved.value.handle, {
    beforeDigest: 'before',
    expectedAfterDigest: 'after',
    getLiveDigest: async () => {
      if (observationFails) throw new Error('temporarily unavailable');
      return 'after';
    },
    createSucceededResult: () => {
      if (resultCreationFails) throw new Error('cannot reconstruct');
      return success('request-1');
    },
  });
  const observationFailed = await ledger.reconcile({
    reconciliationToken: indeterminate.reconciliationToken,
  });
  assert.equal(observationFailed.status, 'indeterminate');
  assert.notEqual(observationFailed.reconciliationToken, indeterminate.reconciliationToken);

  observationFails = false;
  resultCreationFails = true;
  const resultCreationFailed = await ledger.reconcile({
    reconciliationToken: observationFailed.reconciliationToken,
  });
  assert.equal(resultCreationFailed.status, 'indeterminate');
  assert.notEqual(resultCreationFailed.reconciliationToken, observationFailed.reconciliationToken);
  assert.equal(ledger.getMutationResult('request-1').reconciliationToken, resultCreationFailed.reconciliationToken);
});

test('disposal closes reservation admission before any asynchronous cleanup can begin', () => {
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const disposal = ledger.beginDisposal();
  assert.equal(disposal.status, 'succeeded');
  assert.equal(
    ledger.reserve({ requestId: 'late-request', payloadDigest: 'payload' }).error.code,
    'session_closed',
  );
  assert.equal(ledger.finishDisposal(disposal.value).status, 'succeeded');
});

test('cancelled disposal tickets cannot close a later disposal attempt', () => {
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const first = ledger.beginDisposal();
  ledger.cancelDisposal(first.value);
  const second = ledger.beginDisposal();

  assert.equal(ledger.finishDisposal(first.value).error.code, 'invalid_request');
  assert.equal(ledger.finishDisposal(second.value).status, 'succeeded');
});

test('composite reservations are bound to the outer request id', () => {
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const reservation = ledger.reserveComposite({ requestId: 'outer', payloadDigest: 'payload' });
  assert.equal(
    ledger.consumeCompositeReservation(reservation.value.handle, { requestId: 'inner' }).error.code,
    'invalid_request',
  );
  assert.equal(
    ledger.consumeCompositeReservation(reservation.value.handle, { requestId: 'outer' }).status,
    'succeeded',
  );
});
