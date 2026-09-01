import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAgentThreadState,
  hydrateAgentThreadState,
  prepareAgentThreadTitleState,
  renameAgentThreadState,
  reconcileSettledAgentTurn,
  reduceAgentEvent,
  retryPromptFromState,
  retryTurnIdFromState,
} from '../src/lib/agent/agentStore.ts';
import {
  COMPATIBILITY_AGENT_CAPABILITIES,
  createAgentEventId,
  createSettledTurnCompletedEvent,
} from '../src/lib/agent/protocol.ts';

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
  effectivePolicy: {
    maxSteps: 8,
    contextWarningPercent: 75,
    newThreadPercent: 90,
    diagnosticRetention: 5,
    compatibilityReplayMessageLimit: 60,
    showDeliveryTelemetry: true,
    capturedAt: 10,
  },
});

const assistantAdded = (sequence = 1) => event('itemAdded', sequence, {
  item: {
    id: 'turn-1:assistant', kind: 'message', role: 'assistant', content: '', status: 'running', createdAt: 11,
  },
});

test('new, generated, manual, and legacy Thread titles retain explicit provenance', () => {
  const created = initial();
  assert.equal(created.thread.titleSource, 'initial');

  const generated = renameAgentThreadState(created, 'Conversation titles', 'generated', 2);
  assert.equal(generated.thread.title, 'Conversation titles');
  assert.equal(generated.thread.titleSource, 'generated');
  assert.equal(generated.thread.updatedAt, 2);

  const manual = renameAgentThreadState(generated, 'My saved name', 'manual', 3);
  assert.equal(manual.thread.titleSource, 'manual');
  assert.equal(prepareAgentThreadTitleState(manual, 'A different first prompt', 4), manual);
  assert.equal(prepareAgentThreadTitleState(generated, 'A later prompt', 4), generated);

  const prepared = prepareAgentThreadTitleState(created, '## Generate stable conversation titles', 4);
  assert.equal(prepared.thread.title, 'Generate stable conversation titles');
  assert.equal(prepared.thread.titleSource, 'generated');
  assert.equal(prepareAgentThreadTitleState(created, '```\n```', 4), created);

  const legacyRecord = {
    schemaVersion: 1,
    thread: { ...created.thread },
    capabilities: created.capabilities,
    runtime: created.runtime,
  };
  delete legacyRecord.thread.titleSource;
  assert.equal(hydrateAgentThreadState(legacyRecord).thread.titleSource, 'manual');
});

test('ordered reducer buffers gaps and flushes incremental text without duplication', () => {
  let state = initial();
  state = reduceAgentEvent(state, event('itemDelta', 3, { itemId: 'turn-1:assistant', text: 'world' }));
  assert.equal(state.thread.turns.length, 1);
  assert.equal(state.diagnostics.at(-1).code, 'missingSequence');

  state = reduceAgentEvent(state, started());
  state = reduceAgentEvent(state, assistantAdded());
  state = reduceAgentEvent(state, event('itemDelta', 2, { itemId: 'turn-1:assistant', text: 'Hello ' }));
  const turn = state.thread.turns.at(-1);
  assert.equal(turn.items.find((item) => item.id === 'turn-1:assistant').content, 'Hello world');
  assert.equal(state.nextSequenceByTurn['turn-1'], 4);

  state = reduceAgentEvent(state, event('itemDelta', 2, { itemId: 'turn-1:assistant', text: 'duplicate' }));
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
  assert.equal(turn.items.find((item) => item.id === 'turn-1:assistant'), undefined);
  assert.equal(state.diagnostics.at(-1).code, 'terminalEvent');
  assert.equal(retryPromptFromState(state), 'Make a title');
  assert.equal(retryTurnIdFromState(state), 'turn-1');
});

test('a settled runtime without a terminal event is reconciled and cannot leave Working stuck', () => {
  let state = reduceAgentEvent(initial(), started());
  state = reconcileSettledAgentTurn(state, 'turn-1', 'failed', {
    code: 'runtimeUnavailable', message: 'Runtime ended unexpectedly.', retryable: true,
  }, 50);
  assert.equal(state.activeTurnId, undefined);
  assert.equal(state.thread.turns.at(-1).status, 'failed');

  const unchanged = reconcileSettledAgentTurn(state, 'turn-1', 'cancelled', undefined, 60);
  assert.equal(unchanged, state);
});

test('native command completion closes the Turn before a delayed duplicate Channel terminal event', () => {
  let state = reduceAgentEvent(initial(), started());
  const completed = createSettledTurnCompletedEvent({
    threadId: 'thread-1',
    turnId: 'turn-1',
    finalText: 'Applied.',
    nextSequence: 2,
    assistantItemId: 'turn-1:assistant',
    at: 50,
  });

  state = reduceAgentEvent(state, completed);
  assert.equal(state.activeTurnId, undefined);
  assert.equal(state.thread.turns.at(-1).status, 'completed');
  assert.equal(state.thread.turns.at(-1).items.find((item) => item.id === 'turn-1:assistant').content, 'Applied.');

  state = reduceAgentEvent(state, completed);
  assert.equal(state.thread.turns.at(-1).status, 'completed');
  assert.equal(state.diagnostics.at(-1).code, 'duplicateEvent');
});

test('assistant Markdown grows from genuine deltas before completion and reconciles without duplication', () => {
  let state = reduceAgentEvent(initial(), started());
  state = reduceAgentEvent(state, assistantAdded());
  state = reduceAgentEvent(state, event('itemDelta', 2, { itemId: 'turn-1:assistant', text: '# Live\n\n' }));
  assert.equal(state.thread.turns.at(-1).status, 'running');
  assert.equal(state.thread.turns.at(-1).items.find((item) => item.id === 'turn-1:assistant').content, '# Live\n\n');
  state = reduceAgentEvent(state, event('itemDelta', 3, { itemId: 'turn-1:assistant', text: '- first' }));
  state = reduceAgentEvent(state, event('turnCompleted', 4, {
    assistantItemId: 'turn-1:assistant', finalText: '# Live\n\n- first',
  }));
  const turn = state.thread.turns.at(-1);
  assert.equal(turn.items.find((item) => item.id === 'turn-1:assistant').content, '# Live\n\n- first');
  assert.equal(turn.items.find((item) => item.id === 'turn-1:activity'), undefined);
});

test('Compatibility fallback preserves a healthy Codex Tool binding for a later Turn', () => {
  let state = reduceAgentEvent(initial(), started());
  state = reduceAgentEvent(state, event('runtimeUpdated', 1, {
    runtime: {
      kind: 'codexAppServer',
      label: 'Codex',
      model: 'test-model',
      upstreamThreadId: 'upstream-1',
      upstreamToolSignature: 'sha256-0123456789abcdef',
      degraded: false,
    },
  }));
  state = reduceAgentEvent(state, event('runtimeUpdated', 2, {
    runtime: {
      kind: 'compatibility',
      label: 'Compatibility',
      model: 'test-model',
      degraded: true,
    },
  }));
  assert.equal(state.runtime.kind, 'compatibility');
  assert.equal(state.runtime.upstreamThreadId, 'upstream-1');
  assert.equal(state.runtime.upstreamToolSignature, 'sha256-0123456789abcdef');
});

test('assistant segments and real Tool rows retain chronological transcript order', () => {
  let state = reduceAgentEvent(initial(), started());
  const message = (id, content, status) => ({
    id, kind: 'message', role: 'assistant', content, status, createdAt: 11,
  });
  const tool = (id, callId, name, status, summary) => ({
    id, kind: 'tool', callId, name, status, summary, createdAt: 11,
  });
  state = reduceAgentEvent(state, event('itemAdded', 1, { item: message('turn-1:assistant', '', 'running') }));
  state = reduceAgentEvent(state, event('itemDelta', 2, {
    itemId: 'turn-1:assistant', text: 'Inspecting the Page.',
  }));
  state = reduceAgentEvent(state, event('itemUpdated', 3, {
    item: message('turn-1:assistant', 'Inspecting the Page.', 'completed'),
  }));
  state = reduceAgentEvent(state, event('itemAdded', 4, {
    item: tool('turn-1:tool:read-1', 'read-1', 'read_active_page', 'running', 'Running editor Tool'),
  }));
  state = reduceAgentEvent(state, event('itemUpdated', 5, {
    item: tool('turn-1:tool:read-1', 'read-1', 'read_active_page', 'completed', 'Read active Page'),
  }));
  state = reduceAgentEvent(state, event('itemAdded', 6, {
    item: message('turn-1:assistant:1', '', 'running'),
  }));
  state = reduceAgentEvent(state, event('itemDelta', 7, {
    itemId: 'turn-1:assistant:1', text: 'Preparing the update.',
  }));
  state = reduceAgentEvent(state, event('itemUpdated', 8, {
    item: message('turn-1:assistant:1', 'Preparing the update.', 'completed'),
  }));
  state = reduceAgentEvent(state, event('itemAdded', 9, {
    item: tool('turn-1:tool:replace-1', 'replace-1', 'replace_page_elements', 'running', 'Running editor Tool'),
  }));
  state = reduceAgentEvent(state, event('itemUpdated', 10, {
    item: tool('turn-1:tool:replace-1', 'replace-1', 'replace_page_elements', 'completed', 'Replaced Page elements'),
  }));
  state = reduceAgentEvent(state, event('itemAdded', 11, {
    item: message('turn-1:assistant:2', '', 'running'),
  }));
  state = reduceAgentEvent(state, event('itemDelta', 12, {
    itemId: 'turn-1:assistant:2', text: 'Updated the Page.',
  }));
  state = reduceAgentEvent(state, event('turnCompleted', 13, {
    assistantItemId: 'turn-1:assistant:2', finalText: 'Updated the Page.',
  }));

  const orderedActivity = state.thread.turns.at(-1).items
    .filter((item) => item.kind === 'tool' || (item.kind === 'message' && item.role === 'assistant'))
    .map((item) => item.kind === 'tool' ? item.name : item.content);
  assert.deepEqual(orderedActivity, [
    'Inspecting the Page.',
    'read_active_page',
    'Preparing the update.',
    'replace_page_elements',
    'Updated the Page.',
  ]);
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
  state = reduceAgentEvent(state, event('runtimeUpdated', 1, {
    runtime: {
      kind: 'codexAppServer', label: 'Codex app-server', model: 'test',
      upstreamThreadId: 'upstream-1', diagnostic: 'Pinned runtime selected.', degraded: false,
    },
  }));
  state = reduceAgentEvent(state, event('capabilitiesUpdated', 2, {
    capabilities: {
      ...COMPATIBILITY_AGENT_CAPABILITIES,
      reasoningSummary: true,
      toolEvents: true,
    },
  }));
  state = reduceAgentEvent(state, event('telemetryUpdated', 3, {
    telemetry: {
      strategy: 'responses',
      attempts: 2,
      requestMs: 31,
      firstEventMs: 520,
      firstTextMs: 526,
      textSpanMs: 12,
      totalMs: 544,
      textDeltaCount: 8,
      textCharacterCount: 256,
      p50InterDeltaMs: 1,
      p95InterDeltaMs: 2,
      densestWindowPercent: 100,
      behavior: 'burst',
    },
  }));

  const turn = state.thread.turns.at(-1);
  assert.equal(state.capabilities.reasoningSummary, true);
  assert.equal(state.capabilities.toolEvents, true);
  assert.equal(state.runtime.kind, 'codexAppServer');
  assert.equal(state.runtime.upstreamThreadId, 'upstream-1');
  assert.equal(turn.telemetry.behavior, 'burst');
  assert.equal(turn.items.find((item) => item.id === 'turn-1:streaming'), undefined);
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

test('legacy persisted Change Review items are removed during hydration', () => {
  const state = hydrateAgentThreadState({
    schemaVersion: 1,
    thread: {
      id: 'legacy', title: 'Legacy', createdAt: 1, updatedAt: 2,
      turns: [{
        id: 'legacy-turn', threadId: 'legacy', status: 'completed', createdAt: 1, completedAt: 2,
        binding,
        telemetry: {
          strategy: 'responses', attempts: 1, requestMs: 5, firstEventMs: 10, firstTextMs: 10,
          eventSpanMs: 4, totalMs: 20, eventCount: 8, behavior: 'buffered',
        },
        items: [{
          id: 'legacy-review', kind: 'changeReview', status: 'completed', createdAt: 1,
          changeSet: {
            id: 'legacy-change', extensionId: 'ideasketch-agent', documentId: 'doc-a', baseRevision: 7,
            sourceFingerprint: 'source-a', summary: 'Legacy', operations: [], status: 'stale',
          },
        }],
      }],
    },
    capabilities: COMPATIBILITY_AGENT_CAPABILITIES,
    runtime: { kind: 'compatibility', label: 'Compatibility', model: 'test', degraded: true },
  });
  assert.deepEqual(state.thread.turns[0].items, []);
  assert.equal(state.thread.turns[0].telemetry.behavior, 'burst');
  assert.equal(state.thread.turns[0].telemetry.textSpanMs, 4);
  assert.equal(state.thread.turns[0].telemetry.textDeltaCount, 8);
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

test('effective Turn policy, exact context, and bounded runtime diagnostics reduce in order', () => {
  let state = reduceAgentEvent(initial(), started());
  state = reduceAgentEvent(state, event('contextUpdated', 1, {
    context: {
      status: 'available', source: 'runtime', modelContextWindow: 200, usedPercent: 75,
      total: { totalTokens: 150, inputTokens: 120, cachedInputTokens: 40, cacheWriteInputTokens: 0, outputTokens: 30, reasoningOutputTokens: 8 },
      last: { totalTokens: 20, inputTokens: 15, cachedInputTokens: 4, cacheWriteInputTokens: 0, outputTokens: 5, reasoningOutputTokens: 2 },
    },
  }));
  for (let index = 0; index < 7; index += 1) {
    state = reduceAgentEvent(state, event('runtimeDiagnosticRecorded', index + 2, {
      diagnostic: {
        id: `diagnostic-${index}`, at: index + 12, category: 'provider', severity: 'warning',
        code: 'provider.retry', message: `Retry ${index}`, retryable: true,
      },
    }));
  }
  assert.equal(state.thread.turns.at(-1).effectivePolicy.maxSteps, 8);
  assert.equal(state.context.usedPercent, 75);
  assert.equal(state.context.total.totalTokens, 150);
  assert.equal(state.runtimeDiagnostics.length, 5);
  assert.equal(state.runtimeDiagnostics[0].id, 'diagnostic-2');
});

test('an unavailable context update clears stale exact usage from an earlier Turn', () => {
  let state = reduceAgentEvent(initial(), started());
  state = reduceAgentEvent(state, event('contextUpdated', 1, {
    context: {
      status: 'available', source: 'runtime', modelContextWindow: 200, usedPercent: 75,
      total: { totalTokens: 150, inputTokens: 120, cachedInputTokens: 40, cacheWriteInputTokens: 0, outputTokens: 30, reasoningOutputTokens: 8 },
      last: { totalTokens: 20, inputTokens: 15, cachedInputTokens: 4, cacheWriteInputTokens: 0, outputTokens: 5, reasoningOutputTokens: 2 },
    },
  }));
  state = reduceAgentEvent(state, event('contextUpdated', 2, {
    context: { status: 'unavailable', source: 'none', message: 'No exact usage yet.' },
  }));

  assert.equal(state.context.status, 'unavailable');
  assert.equal(state.context.total, undefined);
  assert.equal(state.context.last, undefined);
  assert.equal(state.context.modelContextWindow, undefined);
  assert.equal(state.context.usedPercent, undefined);
});

test('legacy compaction marker hydrates only as a local Compatibility replay boundary', () => {
  const base = initial();
  const hydrated = hydrateAgentThreadState({
    schemaVersion: 1,
    thread: base.thread,
    capabilities: base.capabilities,
    runtime: {
      kind: 'compatibility', label: 'Compatibility', model: 'test', degraded: true,
      compactedBeforeTurnId: 'legacy-turn',
    },
  });
  assert.equal(hydrated.runtime.localReplayTruncatedBeforeTurnId, 'legacy-turn');
  assert.equal(hydrated.context.localReplayTruncatedBeforeTurnId, 'legacy-turn');
  assert.equal(hydrated.context.runtimeCompactedAt, undefined);
});

test('Skill provenance is captured at Turn start and implicit activation is idempotent', () => {
  let state = reduceAgentEvent(initial(), {
    ...started(),
    skillProvenance: [{
      id: 'ideasketch', name: 'IdeaSketch', origin: 'bundled', digest: 'built-in',
      activationMode: 'mandatory', editorScope: 'ideasketch',
    }],
  });
  const activation = event('skillActivated', 1, {
    provenance: {
      id: 'custom:polish', name: 'Polish', origin: 'custom', digest: 'abc',
      activationMode: 'implicit', editorScope: 'ideasketch',
    },
  });
  state = reduceAgentEvent(state, activation);
  state = reduceAgentEvent(state, { ...activation, eventId: createAgentEventId('turn-1', 2, 'skillActivated'), sequence: 2 });
  assert.deepEqual(state.thread.turns.at(-1).skillProvenance.map((skill) => skill.id), ['ideasketch', 'custom:polish']);
});
