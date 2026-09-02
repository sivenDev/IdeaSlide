import test from 'node:test';
import assert from 'node:assert/strict';

import { createRequestLedger } from '../src/lib/ideasketch-sdk/requestLedger.ts';
import {
  createDocumentMutationScheduler,
  executeSdkMutation,
} from '../src/lib/ideasketch-sdk/transactions.ts';
import { sdkRejected, sdkSucceeded } from '../src/lib/ideasketch-sdk/types.ts';
import { createSessionController } from '../src/lib/ideasketch-sdk/session.ts';

function stateDigest(state) {
  return Promise.resolve(`v:${state.version}:value:${state.value}`);
}

test('scene and document requests share one FIFO scheduler per document', async () => {
  const scheduler = createDocumentMutationScheduler();
  const firstLedger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const secondLedger = createRequestLedger({ sessionId: 'session-2', capacity: 4 });
  const state = { version: 0, value: '' };
  const order = [];

  const execute = (requestId, kind, wait, ledger) => executeSdkMutation({
    kind,
    documentSessionId: 'document-1',
    requestId,
    payload: { requestId, kind },
    scheduler,
    ledger,
    readState: () => ({ ...state }),
    computeDigest: stateDigest,
    prepare: async (before) => {
      order.push(`prepare:${requestId}:${before.version}`);
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      return { ...before, version: before.version + 1, value: before.value + requestId };
    },
    finalValidate: (before) => before.version === state.version
      ? sdkSucceeded(undefined)
      : sdkRejected('snapshot_stale', 'stale', true),
    commit: (next) => { Object.assign(state, next); },
    getEditVersion: () => state.version,
  });

  const first = execute('A', 'scene', 15, firstLedger);
  const second = execute('B', 'document', 0, secondLedger);
  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.equal(firstResult.status, 'succeeded');
  assert.equal(secondResult.status, 'succeeded');
  assert.deepEqual(order, ['prepare:A:0', 'prepare:B:1']);
  assert.equal(state.value, 'AB');
});

test('commit settlement keeps the ledger and FIFO scheduler open through host onChange acknowledgement', async () => {
  const scheduler = createDocumentMutationScheduler();
  const firstLedger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const secondLedger = createRequestLedger({ sessionId: 'session-2', capacity: 4 });
  const state = { version: 0, value: '' };
  let editVersion = 0;
  let acknowledgeCommit;
  let signalCommitStarted;
  const commitStarted = new Promise((resolve) => { signalCommitStarted = resolve; });
  const order = [];

  const first = executeSdkMutation({
    kind: 'scene',
    documentSessionId: 'document-1',
    requestId: 'first',
    payload: {},
    scheduler,
    ledger: firstLedger,
    readState: () => ({ ...state }),
    computeDigest: stateDigest,
    prepare: () => ({ version: 1, value: 'first' }),
    finalValidate: () => {
      order.push('final-validate');
      queueMicrotask(() => order.push('microtask'));
      return sdkSucceeded(undefined);
    },
    commit: (next) => {
      order.push('commit');
      Object.assign(state, next);
      signalCommitStarted();
      return {
        settlement: new Promise((resolve) => {
          acknowledgeCommit = () => {
            editVersion = 1;
            order.push('onChange-ack');
            resolve();
          };
        }),
      };
    },
    getEditVersion: () => editVersion,
  });
  const second = executeSdkMutation({
    kind: 'document',
    documentSessionId: 'document-1',
    requestId: 'second',
    payload: {},
    scheduler,
    ledger: secondLedger,
    readState: () => ({ ...state }),
    computeDigest: stateDigest,
    prepare: (before) => {
      order.push(`prepare-second:${before.version}`);
      return { version: 2, value: 'second' };
    },
    finalValidate: () => sdkSucceeded(undefined),
    commit: (next) => { Object.assign(state, next); },
    getEditVersion: () => editVersion,
  });

  await commitStarted;
  await Promise.resolve();
  assert.deepEqual(order, ['final-validate', 'commit', 'microtask']);
  assert.equal(firstLedger.getMutationResult('first').error.code, 'editor_busy');
  assert.equal(order.some((entry) => entry.startsWith('prepare-second')), false);

  acknowledgeCommit();
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult.status, 'succeeded');
  assert.equal(firstResult.value.afterEditVersion, 1);
  assert.equal(secondResult.status, 'succeeded');
  assert.deepEqual(order, [
    'final-validate',
    'commit',
    'microtask',
    'onChange-ack',
    'prepare-second:1',
  ]);
});

test('async commit adapters fail closed before they can yield past final validation', async () => {
  const scheduler = createDocumentMutationScheduler();
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const state = { version: 0, value: '' };
  let commitInvoked = false;

  const result = await executeSdkMutation({
    kind: 'scene',
    documentSessionId: 'document-1',
    requestId: 'async-commit',
    payload: {},
    scheduler,
    ledger,
    readState: () => ({ ...state }),
    computeDigest: stateDigest,
    prepare: () => ({ version: 1, value: 'must-not-commit' }),
    finalValidate: () => sdkSucceeded(undefined),
    commit: async (next) => {
      commitInvoked = true;
      await Promise.resolve();
      Object.assign(state, next);
    },
    getEditVersion: () => state.version,
  });

  await Promise.resolve();
  assert.equal(result.error.code, 'internal_error');
  assert.equal(commitInvoked, false);
  assert.deepEqual(state, { version: 0, value: '' });
});

test('malformed commit receipts fail closed without throwing through the SDK result boundary', async () => {
  const scheduler = createDocumentMutationScheduler();
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const state = { version: 0, value: '' };
  const result = await executeSdkMutation({
    kind: 'scene',
    documentSessionId: 'document-1',
    requestId: 'malformed-receipt',
    payload: {},
    scheduler,
    ledger,
    readState: () => ({ ...state }),
    computeDigest: stateDigest,
    prepare: () => ({ version: 1, value: 'unknown' }),
    finalValidate: () => sdkSucceeded(undefined),
    commit: () => ({}),
    getEditVersion: () => state.version,
  });

  assert.equal(result.status, 'indeterminate');
  assert.equal(ledger.getMutationResult('malformed-receipt').status, 'indeterminate');
});

test('commit receipt getter failures fail closed into reconciliation', async () => {
  const scheduler = createDocumentMutationScheduler();
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const state = { version: 0, value: '' };
  const receipt = {};
  Object.defineProperty(receipt, 'settlement', {
    get() {
      throw new Error('receipt getter failed');
    },
  });
  const result = await executeSdkMutation({
    kind: 'scene',
    documentSessionId: 'document-1',
    requestId: 'throwing-receipt',
    payload: {},
    scheduler,
    ledger,
    readState: () => ({ ...state }),
    computeDigest: stateDigest,
    prepare: () => ({ version: 1, value: 'unknown' }),
    finalValidate: () => sdkSucceeded(undefined),
    commit: () => receipt,
    getEditVersion: () => state.version,
  });

  assert.equal(result.status, 'indeterminate');
  assert.equal(ledger.getMutationResult('throwing-receipt').status, 'indeterminate');
});

test('identical concurrent requests apply once and cancellation before commit writes nothing', async () => {
  const scheduler = createDocumentMutationScheduler();
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const state = { version: 0, value: '' };
  let commits = 0;
  const options = {
    kind: 'scene',
    documentSessionId: 'document-1',
    requestId: 'same',
    payload: { requestId: 'same', kind: 'scene' },
    scheduler,
    ledger,
    readState: () => ({ ...state }),
    computeDigest: stateDigest,
    prepare: async (before) => ({ ...before, version: 1, value: 'once' }),
    finalValidate: () => sdkSucceeded(undefined),
    commit: (next) => { commits += 1; Object.assign(state, next); },
    getEditVersion: () => state.version,
  };
  const [first, second] = await Promise.all([executeSdkMutation(options), executeSdkMutation(options)]);
  assert.equal(first.status, 'succeeded');
  assert.deepEqual(second, first);
  assert.equal(commits, 1);

  const controller = new AbortController();
  controller.abort();
  const cancelled = await executeSdkMutation({
    ...options,
    requestId: 'cancelled',
    payload: { requestId: 'cancelled' },
    signal: controller.signal,
  });
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(commits, 1);
});

test('a post-commit exception reconciles against the expected after digest', async () => {
  const scheduler = createDocumentMutationScheduler();
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const state = { version: 0, value: '' };
  const result = await executeSdkMutation({
    kind: 'scene',
    documentSessionId: 'document-1',
    requestId: 'throw-after-write',
    payload: { requestId: 'throw-after-write' },
    scheduler,
    ledger,
    readState: () => ({ ...state }),
    computeDigest: stateDigest,
    prepare: async () => ({ version: 1, value: 'written' }),
    finalValidate: () => sdkSucceeded(undefined),
    commit: (next) => { Object.assign(state, next); throw new Error('uncertain host return'); },
    getEditVersion: () => state.version,
  });
  assert.equal(result.status, 'succeeded');
  assert.equal(result.value.afterDigest, 'v:1:value:written');
  assert.equal(ledger.getMutationResult('throw-after-write').status, 'succeeded');
});

test('queued requests revalidate stale snapshots and pre-commit adapter failures are terminal', async () => {
  const scheduler = createDocumentMutationScheduler();
  const firstLedger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const secondLedger = createRequestLedger({ sessionId: 'session-2', capacity: 4 });
  const state = { version: 0, value: '' };
  const execute = (requestId, ledger) => executeSdkMutation({
    kind: 'scene',
    documentSessionId: 'document-1',
    requestId,
    payload: { requestId },
    scheduler,
    ledger,
    readState: () => ({ ...state }),
    computeDigest: stateDigest,
    validateSnapshot: (before) => before.version === 0,
    prepare: async (before) => ({ ...before, version: before.version + 1, value: requestId }),
    finalValidate: (before) => before.version === state.version
      ? sdkSucceeded(undefined)
      : sdkRejected('snapshot_stale', 'stale', true),
    commit: (next) => { Object.assign(state, next); },
    getEditVersion: () => state.version,
  });
  const [first, second] = await Promise.all([
    execute('first', firstLedger),
    execute('second', secondLedger),
  ]);
  assert.equal(first.status, 'succeeded');
  assert.equal(second.error.code, 'snapshot_stale');
  assert.equal(state.value, 'first');

  const failingLedger = createRequestLedger({ sessionId: 'session-3', capacity: 4 });
  const failed = await executeSdkMutation({
    kind: 'document',
    documentSessionId: 'document-2',
    requestId: 'read-failure',
    payload: {},
    scheduler,
    ledger: failingLedger,
    readState: () => { throw new Error('cannot read'); },
    computeDigest: stateDigest,
    prepare: (before) => before,
    finalValidate: () => sdkSucceeded(undefined),
    commit: () => { throw new Error('must not run'); },
    getEditVersion: () => 0,
  });
  assert.equal(failed.error.code, 'internal_error');
  assert.equal(failingLedger.getMutationResult('read-failure').error.code, 'internal_error');
});

test('a host composite reservation is consumed once and cancellation after commit returns success', async () => {
  const scheduler = createDocumentMutationScheduler();
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 1 });
  const reservation = ledger.reserveComposite({ requestId: 'outer', payloadDigest: 'payload' });
  const state = { version: 0, value: '' };
  const controller = new AbortController();
  const options = {
    kind: 'scene',
    documentSessionId: 'document-1',
    requestId: 'outer',
    payload: {},
    scheduler,
    ledger,
    reservedRequestHandle: reservation.value.handle,
    signal: controller.signal,
    readState: () => ({ ...state }),
    computeDigest: stateDigest,
    prepare: () => ({ version: 1, value: 'committed' }),
    finalValidate: () => sdkSucceeded(undefined),
    commit: (next) => { Object.assign(state, next); controller.abort(); },
    getEditVersion: () => state.version,
  };
  const result = await executeSdkMutation(options);
  assert.equal(result.status, 'succeeded');
  assert.equal(state.value, 'committed');
  assert.equal((await executeSdkMutation(options)).error.code, 'invalid_request');
  assert.equal(ledger.reserve({ requestId: 'second', payloadDigest: 'second' }).error.code, 'request_ledger_full');
});

test('the kernel clones before preparation and rechecks cancellation immediately before commit', async () => {
  const scheduler = createDocumentMutationScheduler();
  const state = { version: 0, value: '' };
  const relationLedger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const rejected = await executeSdkMutation({
    kind: 'scene',
    documentSessionId: 'document-1',
    requestId: 'mutating-prepare',
    payload: {},
    scheduler,
    ledger: relationLedger,
    readState: () => state,
    computeDigest: stateDigest,
    prepare: (working) => { working.value = 'unsafe'; return working; },
    validatePostconditions: () => false,
    finalValidate: () => sdkSucceeded(undefined),
    commit: () => {},
    getEditVersion: () => state.version,
  });
  assert.equal(rejected.error.code, 'relation_conflict');
  assert.equal(state.value, '');

  const controller = new AbortController();
  let commits = 0;
  const cancellationLedger = createRequestLedger({ sessionId: 'session-2', capacity: 4 });
  const cancelled = await executeSdkMutation({
    kind: 'scene',
    documentSessionId: 'document-2',
    requestId: 'abort-in-final-guard',
    payload: {},
    scheduler,
    ledger: cancellationLedger,
    signal: controller.signal,
    readState: () => state,
    computeDigest: stateDigest,
    prepare: () => ({ version: 1, value: 'must-not-commit' }),
    finalValidate: () => { controller.abort(); return sdkSucceeded(undefined); },
    commit: () => { commits += 1; },
    getEditVersion: () => state.version,
  });
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(commits, 0);
});

test('prepare AbortError maps to cancelled before commit', async () => {
  const scheduler = createDocumentMutationScheduler();
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const controller = new AbortController();
  const state = { version: 0, value: '' };
  let commits = 0;
  const result = await executeSdkMutation({
    kind: 'scene',
    documentSessionId: 'document-1',
    requestId: 'prepare-abort',
    payload: {},
    scheduler,
    ledger,
    signal: controller.signal,
    readState: () => state,
    computeDigest: stateDigest,
    prepare: () => {
      controller.abort();
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    },
    finalValidate: () => sdkSucceeded(undefined),
    commit: () => { commits += 1; },
    getEditVersion: () => state.version,
  });

  assert.equal(result.status, 'cancelled');
  assert.equal(result.error.code, 'cancelled_before_commit');
  assert.equal(commits, 0);
});

test('the kernel enforces no-op result and history invariants over semantic result builders', async () => {
  const scheduler = createDocumentMutationScheduler();
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const state = { version: 7, value: 'unchanged' };
  let commits = 0;
  const result = await executeSdkMutation({
    kind: 'scene',
    documentSessionId: 'document-1',
    requestId: 'semantic-noop',
    payload: {},
    scheduler,
    ledger,
    readState: () => state,
    computeDigest: stateDigest,
    prepare: (before) => before,
    finalValidate: () => sdkSucceeded(undefined),
    commit: () => { commits += 1; },
    getEditVersion: () => state.version,
    createResult: () => ({
      changeSetId: 'semantic-change',
      requestId: 'wrong-request',
      outcome: 'applied',
      beforeDigest: 'wrong-before',
      afterDigest: 'wrong-after',
      beforeEditVersion: -1,
      afterEditVersion: 999,
      createdRefs: {},
      updatedRefs: [],
      deletedRefs: [],
      cascadedRefs: [],
      operations: [{ kind: 'move-element', outcome: 'updated' }],
      diagnostics: [],
      history: { nativeCanvas: 'created', document: 'unavailable', agentCustom: 'not-supported' },
    }),
  });

  assert.equal(result.status, 'succeeded');
  assert.equal(result.value.requestId, 'semantic-noop');
  assert.equal(result.value.outcome, 'noop');
  assert.equal(result.value.beforeDigest, await stateDigest(state));
  assert.equal(result.value.afterDigest, await stateDigest(state));
  assert.equal(result.value.beforeEditVersion, 7);
  assert.equal(result.value.afterEditVersion, 7);
  assert.deepEqual(result.value.history, {
    nativeCanvas: 'none',
    document: 'none',
    agentCustom: 'not-supported',
  });
  assert.equal(commits, 0);
});

test('FIFO admission happens before asynchronous payload hashing', async () => {
  const scheduler = createDocumentMutationScheduler();
  const firstLedger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const secondLedger = createRequestLedger({ sessionId: 'session-2', capacity: 4 });
  const state = { version: 0, value: '' };
  const order = [];
  const execute = (requestId, payload, ledger) => executeSdkMutation({
    kind: 'scene',
    documentSessionId: 'document-1',
    requestId,
    payload,
    scheduler,
    ledger,
    readState: () => ({ ...state }),
    computeDigest: stateDigest,
    prepare: (before) => {
      order.push(requestId);
      return { version: before.version + 1, value: before.value + requestId };
    },
    finalValidate: () => sdkSucceeded(undefined),
    commit: (next) => { Object.assign(state, next); },
    getEditVersion: () => state.version,
  });

  const first = execute('A', { data: 'x'.repeat(2_000_000) }, firstLedger);
  const second = execute('B', { data: 'small' }, secondLedger);
  await Promise.all([first, second]);
  assert.deepEqual(order, ['A', 'B']);
  assert.equal(state.value, 'AB');
});

test('dispose wins atomically over a mutation that has not reserved its request yet', async () => {
  const scheduler = createDocumentMutationScheduler();
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const controller = createSessionController({
    sessionId: 'session-1',
    callerProfile: 'trusted-ui',
    sdkProtocolVersion: { major: 1, minor: 0 },
    documentFormatVersion: '1.0',
    ledger,
    invalidateCallerResources: () => {},
  });
  const state = { version: 0, value: '' };
  let commits = 0;
  const mutation = executeSdkMutation({
    kind: 'scene',
    documentSessionId: 'document-1',
    requestId: 'late-reservation',
    payload: { data: 'x'.repeat(2_000_000) },
    scheduler,
    ledger,
    readState: () => ({ ...state }),
    computeDigest: stateDigest,
    prepare: () => ({ version: 1, value: 'must-not-commit' }),
    finalValidate: () => sdkSucceeded(undefined),
    commit: () => { commits += 1; },
    getEditVersion: () => state.version,
  });
  const disposal = controller.namespace.dispose();
  const [mutationResult, disposalResult] = await Promise.all([mutation, disposal]);
  assert.equal(disposalResult.status, 'succeeded');
  assert.equal(mutationResult.error.code, 'session_closed');
  assert.equal(commits, 0);
  assert.equal(state.version, 0);
});

test('post-commit edit-version failures become reconcilable without losing semantic results', async () => {
  const scheduler = createDocumentMutationScheduler();
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const state = { version: 0, value: '' };
  let editVersionCalls = 0;
  let editVersionReadable = false;
  const result = await executeSdkMutation({
    kind: 'scene',
    documentSessionId: 'document-1',
    requestId: 'metadata-failure',
    payload: { requestId: 'metadata-failure' },
    scheduler,
    ledger,
    readState: () => ({ ...state }),
    computeDigest: stateDigest,
    prepare: () => ({ version: 1, value: 'written' }),
    finalValidate: () => sdkSucceeded(undefined),
    commit: (next) => { Object.assign(state, next); },
    getEditVersion: () => {
      editVersionCalls += 1;
      if (editVersionCalls > 1 && !editVersionReadable) throw new Error('metadata unavailable');
      return state.version;
    },
    createResult: (input) => ({
      changeSetId: 'semantic-change',
      requestId: input.requestId,
      outcome: 'applied',
      beforeDigest: input.beforeDigest,
      afterDigest: input.afterDigest,
      beforeEditVersion: input.beforeEditVersion,
      afterEditVersion: input.afterEditVersion,
      createdRefs: {},
      updatedRefs: [{ pageRef: 'page:page-1', ref: 'element:shape-1' }],
      deletedRefs: [],
      cascadedRefs: [],
      operations: [{ kind: 'move-element', outcome: 'updated' }],
      diagnostics: ['semantic result retained'],
      history: { nativeCanvas: 'created', document: 'none', agentCustom: 'not-supported' },
    }),
  });
  assert.equal(result.status, 'indeterminate');
  editVersionReadable = true;
  const reconciled = await ledger.reconcile({ reconciliationToken: result.reconciliationToken });
  assert.equal(reconciled.status, 'succeeded');
  assert.deepEqual(reconciled.value.updatedRefs, [{ pageRef: 'page:page-1', ref: 'element:shape-1' }]);
  assert.deepEqual(reconciled.value.operations, [{ kind: 'move-element', outcome: 'updated' }]);
  assert.deepEqual(reconciled.value.diagnostics, ['semantic result retained']);
});

test('no-op mutations do not call the host commit or create native history', async () => {
  const scheduler = createDocumentMutationScheduler();
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const state = { version: 0, value: '' };
  let commits = 0;
  const result = await executeSdkMutation({
    kind: 'scene',
    documentSessionId: 'document-1',
    requestId: 'noop',
    payload: {},
    scheduler,
    ledger,
    readState: () => ({ ...state }),
    computeDigest: stateDigest,
    prepare: (before) => before,
    finalValidate: () => sdkSucceeded(undefined),
    commit: () => { commits += 1; },
    getEditVersion: () => state.version,
  });
  assert.equal(result.status, 'succeeded');
  assert.equal(result.value.outcome, 'noop');
  assert.equal(result.value.history.nativeCanvas, 'none');
  assert.equal(commits, 0);
});

test('strict payload and typed final guards fail closed with stable errors', async () => {
  const scheduler = createDocumentMutationScheduler();
  const state = { version: 0, value: '' };
  const execute = (requestId, payload, finalValidate = () => sdkSucceeded(undefined)) => executeSdkMutation({
    kind: 'scene',
    documentSessionId: 'document-1',
    requestId,
    payload,
    scheduler,
    ledger: createRequestLedger({ sessionId: requestId, capacity: 4 }),
    readState: () => ({ ...state }),
    computeDigest: stateDigest,
    prepare: () => ({ version: 1, value: 'unsafe' }),
    finalValidate,
    commit: (next) => { Object.assign(state, next); },
    getEditVersion: () => state.version,
  });

  for (const [requestId, payload] of [
    ['undefined', { value: undefined }],
    ['nan', { value: Number.NaN }],
    ['bigint', { value: 1n }],
    ['function', { value: () => {} }],
  ]) {
    const result = await execute(requestId, payload);
    assert.equal(result.error.code, 'invalid_request');
  }
  const cyclic = {};
  cyclic.self = cyclic;
  assert.equal((await execute('cycle', cyclic)).error.code, 'invalid_request');
  assert.equal((await execute('symbol-key', { [Symbol('hidden')]: true })).error.code, 'invalid_request');

  const readOnly = await execute(
    'typed-guard',
    {},
    () => sdkRejected('read_only', 'The document is read-only.'),
  );
  assert.equal(readOnly.error.code, 'read_only');
  assert.equal(state.version, 0);
});
