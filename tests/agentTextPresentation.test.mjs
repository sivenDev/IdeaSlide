import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentTextPresentationController, segmentAgentText } from '../src/lib/agent/agentTextPresentation.ts';
import { createAgentThreadState, reduceAgentEvent } from '../src/lib/agent/agentStore.ts';
import { COMPATIBILITY_AGENT_CAPABILITIES, createAgentEventId } from '../src/lib/agent/protocol.ts';

class FakeScheduler {
  nowMs = 0;
  nextId = 1;
  jobs = new Map();

  now = () => this.nowMs;
  setTimeout = (callback, delayMs) => {
    const id = this.nextId++;
    this.jobs.set(id, { at: this.nowMs + delayMs, callback });
    return id;
  };
  clearTimeout = (id) => this.jobs.delete(id);

  advance(ms) {
    const end = this.nowMs + ms;
    while (true) {
      const next = [...this.jobs.entries()]
        .filter(([, job]) => job.at <= end)
        .sort((left, right) => left[1].at - right[1].at || left[0] - right[0])[0];
      if (!next) break;
      const [id, job] = next;
      this.jobs.delete(id);
      this.nowMs = job.at;
      job.callback();
    }
    this.nowMs = end;
  }
}

const binding = {
  documentId: 'doc-a', documentName: 'diagram.is', extensionId: 'ideasketch-agent',
  fileType: 'ideasketch', skillId: 'ideasketch', revision: 1,
};

function initial() {
  return createAgentThreadState({
    threadId: 'thread-1', title: 'diagram.is', welcome: 'Ready',
    capabilities: COMPATIBILITY_AGENT_CAPABILITIES, now: 1,
  });
}

function event(type, sequence, payload = {}) {
  return {
    type, eventId: createAgentEventId('turn-1', sequence, type), threadId: 'thread-1',
    turnId: 'turn-1', sequence, at: sequence + 10, ...payload,
  };
}

function startedState() {
  let state = reduceAgentEvent(initial(), event('turnStarted', 0, {
    prompt: 'Explain the update', binding, userItemId: 'turn-1:user', assistantItemId: 'turn-1:assistant',
  }));
  state = reduceAgentEvent(state, event('itemAdded', 1, {
    item: { id: 'turn-1:assistant', kind: 'message', role: 'assistant', content: '', status: 'running', createdAt: 11 },
  }));
  return state;
}

function delivery(behavior, overrides = {}) {
  return {
    strategy: 'responses', attempts: 1, requestMs: 10, firstEventMs: 100, firstTextMs: 100,
    textSpanMs: behavior === 'incremental' ? 600 : 4, totalMs: 720, textDeltaCount: 8,
    textCharacterCount: 320, p50InterDeltaMs: 1, p95InterDeltaMs: 2,
    densestWindowPercent: behavior === 'incremental' ? 35 : 100, behavior, ...overrides,
  };
}

function createController(scheduler, updates, reducedMotion = false) {
  let controller;
  controller = new AgentTextPresentationController({
    scheduler,
    reducedMotion,
    onChange: () => updates.push(controller.getSnapshot()),
  });
  return controller;
}

test('burst answers reveal through multiple paints and reconcile exactly', () => {
  const scheduler = new FakeScheduler();
  const updates = [];
  const controller = createController(scheduler, updates);
  let state = startedState();
  controller.sync(state);
  const answer = `${'Readable streaming content. '.repeat(24)}\n\n- final item`;
  state = reduceAgentEvent(state, event('telemetryUpdated', 2, { telemetry: delivery('burst') }));
  state = reduceAgentEvent(state, event('itemDelta', 3, { itemId: 'turn-1:assistant', text: answer }));
  state = reduceAgentEvent(state, event('turnCompleted', 4, { assistantItemId: 'turn-1:assistant', finalText: answer }));
  controller.sync(state);
  assert.equal(state.activeTurnId, undefined);
  assert.equal(controller.getSnapshot().revealing, true);
  assert.notEqual(controller.getSnapshot().items['turn-1:assistant'].displayedContent, answer);
  scheduler.advance(2_600);
  const visibleLengths = [...new Set(updates.map((snapshot) => snapshot.items['turn-1:assistant']?.displayedContent.length ?? 0))];
  assert.ok(visibleLengths.length >= 6);
  assert.equal(controller.getSnapshot().items['turn-1:assistant'].displayedContent, answer);
  assert.equal(controller.getSnapshot().revealing, false);
});

test('atomic answers use the same bounded multi-update presentation path', () => {
  const scheduler = new FakeScheduler();
  const updates = [];
  const controller = createController(scheduler, updates);
  let state = startedState();
  controller.sync(state);
  const answer = 'One atomic provider answer with readable Markdown. '.repeat(28);
  state = reduceAgentEvent(state, event('telemetryUpdated', 2, {
    telemetry: delivery('atomic', { textDeltaCount: 1, textSpanMs: 0 }),
  }));
  state = reduceAgentEvent(state, event('itemDelta', 3, { itemId: 'turn-1:assistant', text: answer }));
  state = reduceAgentEvent(state, event('turnCompleted', 4, { assistantItemId: 'turn-1:assistant', finalText: answer }));
  controller.sync(state);
  scheduler.advance(2_600);
  const visibleLengths = [...new Set(updates.map((snapshot) => snapshot.items['turn-1:assistant']?.displayedContent.length ?? 0))];
  assert.ok(visibleLengths.length >= 6);
  assert.equal(controller.getSnapshot().items['turn-1:assistant'].displayedContent, answer);
});

test('incremental delivery projects source text directly', () => {
  const scheduler = new FakeScheduler();
  const controller = createController(scheduler, []);
  let state = startedState();
  state = reduceAgentEvent(state, event('telemetryUpdated', 2, { telemetry: delivery('incremental') }));
  controller.sync(state);
  for (const [sequence, text] of [[3, 'First '], [4, 'second '], [5, 'third']]) {
    state = reduceAgentEvent(state, event('itemDelta', sequence, { itemId: 'turn-1:assistant', text }));
    controller.sync(state);
    assert.equal(
      controller.getSnapshot().items['turn-1:assistant'].displayedContent,
      state.thread.turns.at(-1).items.find((item) => item.id === 'turn-1:assistant').content,
    );
    scheduler.advance(250);
  }
});

test('a Tool is a chronological barrier for preceding assistant text', () => {
  const scheduler = new FakeScheduler();
  const controller = createController(scheduler, []);
  let state = startedState();
  const answer = 'Inspecting the current Page before applying the requested editor update.'.repeat(4);
  state = reduceAgentEvent(state, event('telemetryUpdated', 2, { telemetry: delivery('burst') }));
  state = reduceAgentEvent(state, event('itemDelta', 3, { itemId: 'turn-1:assistant', text: answer }));
  controller.sync(state);
  assert.notEqual(controller.getSnapshot().items['turn-1:assistant'].displayedContent, answer);
  state = reduceAgentEvent(state, event('itemAdded', 4, {
    item: { id: 'turn-1:tool:read', kind: 'tool', name: 'read_active_page', callId: 'read', status: 'running', createdAt: 14 },
  }));
  controller.sync(state);
  assert.equal(controller.getSnapshot().items['turn-1:assistant'].displayedContent, answer);
});

test('cancellation stops queued reveal and hydration shows settled source immediately', () => {
  const scheduler = new FakeScheduler();
  const controller = createController(scheduler, []);
  let state = startedState();
  const answer = 'Queued answer text '.repeat(40);
  state = reduceAgentEvent(state, event('telemetryUpdated', 2, { telemetry: delivery('atomic', { textDeltaCount: 1 }) }));
  state = reduceAgentEvent(state, event('itemDelta', 3, { itemId: 'turn-1:assistant', text: answer }));
  controller.sync(state);
  scheduler.advance(120);
  const visibleAtCancel = controller.getSnapshot().items['turn-1:assistant'].displayedContent;
  state = reduceAgentEvent(state, event('turnCancelled', 4, { label: 'Stopped' }));
  controller.sync(state);
  scheduler.advance(5_000);
  assert.equal(controller.getSnapshot().items['turn-1:assistant'].displayedContent, visibleAtCancel);

  const resumed = createController(new FakeScheduler(), []);
  resumed.sync(state, { hydrate: true });
  assert.equal(resumed.getSnapshot().items['turn-1:assistant'].displayedContent, answer);
});

test('failure flushes received partial source before the single error boundary', () => {
  const scheduler = new FakeScheduler();
  const controller = createController(scheduler, []);
  let state = startedState();
  controller.sync(state);
  const partial = 'Partial source content remains readable. '.repeat(18);
  state = reduceAgentEvent(state, event('telemetryUpdated', 2, { telemetry: delivery('burst') }));
  state = reduceAgentEvent(state, event('itemDelta', 3, { itemId: 'turn-1:assistant', text: partial }));
  controller.sync(state);
  assert.equal(controller.getSnapshot().revealing, true);
  state = reduceAgentEvent(state, event('turnFailed', 4, {
    assistantItemId: 'turn-1:assistant',
    error: { code: 'providerUnavailable', message: 'Provider failed.', retryable: true },
  }));
  controller.sync(state);
  assert.equal(controller.getSnapshot().items['turn-1:assistant'].displayedContent, partial);
  assert.equal(controller.getSnapshot().revealing, false);
  assert.equal(state.thread.turns.at(-1).items.filter((item) => item.kind === 'error').length, 1);
});

test('reduced motion settles immediately and grapheme segmentation is safe', () => {
  const segments = segmentAgentText('A👨‍👩‍👧‍👦e\u0301B');
  assert.deepEqual(segments, ['A', '👨‍👩‍👧‍👦', 'e\u0301', 'B']);
  const scheduler = new FakeScheduler();
  const controller = createController(scheduler, [], true);
  let state = startedState();
  const answer = 'Accessible immediate answer '.repeat(30);
  state = reduceAgentEvent(state, event('telemetryUpdated', 2, { telemetry: delivery('burst') }));
  state = reduceAgentEvent(state, event('itemDelta', 3, { itemId: 'turn-1:assistant', text: answer }));
  controller.sync(state);
  assert.equal(controller.getSnapshot().items['turn-1:assistant'].displayedContent, answer);
  assert.equal(controller.getSnapshot().revealing, false);
  controller.dispose();
  assert.equal(scheduler.jobs.size, 0);
});

test('reset clears timers and permits Strict Mode style reuse', () => {
  const scheduler = new FakeScheduler();
  const controller = createController(scheduler, []);
  let state = startedState();
  const answer = 'Reusable presentation state '.repeat(30);
  state = reduceAgentEvent(state, event('telemetryUpdated', 2, { telemetry: delivery('burst') }));
  state = reduceAgentEvent(state, event('itemDelta', 3, { itemId: 'turn-1:assistant', text: answer }));
  controller.sync(state);
  assert.ok(scheduler.jobs.size > 0);
  controller.reset();
  assert.equal(scheduler.jobs.size, 0);
  controller.sync(state);
  assert.equal(controller.getSnapshot().revealing, true);
});
