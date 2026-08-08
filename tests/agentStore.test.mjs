import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAgentThreadState,
  reduceAgentEvent,
  retryPromptFromState,
  retryTurnIdFromState,
} from '../src/lib/agent/agentStore.ts';
import { COMPATIBILITY_AGENT_CAPABILITIES, createAgentEventId } from '../src/lib/agent/protocol.ts';

const binding = {
  documentId: 'doc-a',
  documentName: 'diagram.is',
  extensionId: 'ideasketch-agent',
  fileType: 'ideasketch',
  skillId: 'ideasketch',
  revision: 7,
  sourceModified: 'source-a',
};

function initial() {
  return createAgentThreadState({
    threadId: 'thread-1',
    title: 'diagram.is',
    welcome: 'Ready',
    capabilities: COMPATIBILITY_AGENT_CAPABILITIES,
    now: 1,
  });
}

function event(type, sequence, payload = {}) {
  return {
    type,
    eventId: createAgentEventId('turn-1', sequence, type),
    threadId: 'thread-1',
    turnId: 'turn-1',
    sequence,
    at: sequence + 10,
    ...payload,
  };
}

const started = () => event('turnStarted', 0, {
  prompt: 'Make a title',
  binding,
  userItemId: 'turn-1:user',
  assistantItemId: 'turn-1:assistant',
});

test('ordered reducer buffers gaps and flushes incremental text without duplication', () => {
  let state = initial();
  state = reduceAgentEvent(state, event('itemDelta', 2, { itemId: 'turn-1:assistant', text: 'world' }));
  assert.equal(state.thread.turns.length, 1);
  assert.equal(state.diagnostics.at(-1).code, 'missingSequence');

  state = reduceAgentEvent(state, started());
  state = reduceAgentEvent(state, event('itemDelta', 1, { itemId: 'turn-1:assistant', text: 'Hello ' }));
  const turn = state.thread.turns.at(-1);
  assert.equal(turn.items.find((item) => item.id === 'turn-1:assistant').content, 'Hello world');
  assert.equal(state.nextSequenceByTurn['turn-1'], 3);

  state = reduceAgentEvent(state, event('itemDelta', 1, { itemId: 'turn-1:assistant', text: 'duplicate' }));
  assert.equal(state.thread.turns.at(-1).items.find((item) => item.id === 'turn-1:assistant').content, 'Hello world');
  assert.equal(state.diagnostics.at(-1).code, 'duplicateEvent');
});

test('cancellation is terminal and a later completion cannot corrupt the transcript', () => {
  let state = reduceAgentEvent(initial(), started());
  state = reduceAgentEvent(state, event('turnCancelled', 1, { label: 'Stopped' }));
  state = reduceAgentEvent(state, event('turnCompleted', 2, {
    assistantItemId: 'turn-1:assistant',
    finalText: 'late output',
  }));

  const turn = state.thread.turns.at(-1);
  assert.equal(turn.status, 'cancelled');
  assert.notEqual(turn.items.find((item) => item.id === 'turn-1:assistant').content, 'late output');
  assert.equal(state.diagnostics.at(-1).code, 'terminalEvent');
  assert.equal(retryPromptFromState(state), 'Make a title');
  assert.equal(retryTurnIdFromState(state), 'turn-1');
});

test('a retried Turn retains explicit linkage to the failed Turn', () => {
  let state = reduceAgentEvent(initial(), started());
  state = reduceAgentEvent(state, event('turnFailed', 1, {
    assistantItemId: 'turn-1:assistant',
    error: { code: 'providerUnavailable', message: 'Unavailable', retryable: true },
  }));
  const retryStart = {
    ...started(),
    eventId: createAgentEventId('turn-2', 0, 'turnStarted'),
    turnId: 'turn-2',
    retryOfTurnId: 'turn-1',
    userItemId: 'turn-2:user',
    assistantItemId: 'turn-2:assistant',
  };
  state = reduceAgentEvent(state, retryStart);
  assert.equal(state.thread.turns.at(-1).retryOfTurnId, 'turn-1');
});

test('provider capabilities and honest streaming telemetry update normalized state', () => {
  let state = reduceAgentEvent(initial(), started());
  state = reduceAgentEvent(state, event('capabilitiesUpdated', 1, {
    capabilities: {
      ...COMPATIBILITY_AGENT_CAPABILITIES,
      reasoningSummary: true,
      toolEvents: true,
    },
  }));
  state = reduceAgentEvent(state, event('telemetryUpdated', 2, {
    telemetry: {
      strategy: 'responses',
      attempts: 2,
      requestMs: 31,
      firstEventMs: 520,
      firstTextMs: 526,
      eventSpanMs: 12,
      totalMs: 544,
      eventCount: 8,
      behavior: 'buffered',
    },
  }));

  const turn = state.thread.turns.at(-1);
  assert.equal(state.capabilities.reasoningSummary, true);
  assert.equal(state.capabilities.toolEvents, true);
  assert.equal(turn.telemetry.behavior, 'buffered');
  assert.match(turn.items.find((item) => item.id === 'turn-1:streaming').label, /Buffered gateway delivery/);
});

test('completed turns accept review updates at the next sequence and retain the captured binding', () => {
  const review = {
    id: 'turn-1:review',
    kind: 'changeReview',
    status: 'pending',
    createdAt: 11,
    changeSet: {
      id: 'change-1', extensionId: 'ideasketch-agent', documentId: 'doc-a', baseRevision: 7,
      sourceFingerprint: 'source-a', summary: 'Add title', operations: [], status: 'proposed',
    },
  };
  let state = reduceAgentEvent(initial(), started());
  state = reduceAgentEvent(state, event('itemAdded', 1, { item: review }));
  state = reduceAgentEvent(state, event('turnCompleted', 2, {
    assistantItemId: 'turn-1:assistant',
    finalText: 'Proposal ready.',
  }));
  state = reduceAgentEvent(state, event('itemUpdated', 3, {
    item: { ...review, status: 'completed', changeSet: { ...review.changeSet, status: 'applied' } },
  }));

  const turn = state.thread.turns.at(-1);
  assert.deepEqual(turn.binding, binding);
  assert.equal(turn.status, 'completed');
  assert.equal(turn.items.find((item) => item.id === review.id).changeSet.status, 'applied');
  assert.equal(state.nextSequenceByTurn['turn-1'], 4);
});

test('events for another thread are diagnosed and ignored', () => {
  const state = reduceAgentEvent(initial(), { ...started(), threadId: 'thread-2' });
  assert.equal(state.thread.turns.length, 1);
  assert.equal(state.diagnostics.at(-1).code, 'foreignThread');
});

test('plans and approvals remain first-class Items with explicit decisions', () => {
  let state = reduceAgentEvent(initial(), started());
  state = reduceAgentEvent(state, event('planUpdated', 1, {
    item: {
      id: 'turn-1:plan', kind: 'plan', title: 'Edit safely', status: 'running', createdAt: 11,
      steps: [{ id: 'step-1', label: 'Inspect', status: 'completed' }],
    },
  }));
  state = reduceAgentEvent(state, event('approvalRequested', 2, {
    item: {
      id: 'turn-1:approval', kind: 'approval', requestId: 'approval-1', title: 'Permission',
      description: 'Allow a bounded action?', status: 'pending', createdAt: 12,
    },
  }));
  state = reduceAgentEvent(state, event('approvalResolved', 3, {
    itemId: 'turn-1:approval', decision: 'rejected',
  }));
  const turn = state.thread.turns.at(-1);
  assert.equal(turn.items.find((item) => item.kind === 'plan').title, 'Edit safely');
  const approval = turn.items.find((item) => item.kind === 'approval');
  assert.equal(approval.decision, 'rejected');
  assert.equal(approval.status, 'completed');
});
