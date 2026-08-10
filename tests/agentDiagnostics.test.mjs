import test from 'node:test';
import assert from 'node:assert/strict';
import { selectAgentDiagnosticView } from '../src/lib/agent/agentDiagnostics.ts';
import { createAgentThreadState } from '../src/lib/agent/agentStore.ts';
import { COMPATIBILITY_AGENT_CAPABILITIES } from '../src/lib/agent/protocol.ts';

const policy = {
  maxSteps: 8,
  contextWarningPercent: 75,
  newThreadPercent: 90,
  diagnosticRetention: 20,
  compatibilityReplayMessageLimit: 60,
  showDeliveryTelemetry: true,
};

function state() {
  return createAgentThreadState({
    threadId: 'thread-1', title: 'Document', welcome: 'Ready', now: 1,
    capabilities: COMPATIBILITY_AGENT_CAPABILITIES,
    runtime: { kind: 'codexAppServer', label: 'Runtime', model: 'model', degraded: false, health: 'healthy' },
  });
}

test('context guidance uses only exact runtime percentages and configured thresholds', () => {
  const current = state();
  current.context = { status: 'available', source: 'runtime', modelContextWindow: 200, usedPercent: 75 };
  assert.equal(selectAgentDiagnosticView(current, policy).state, 'approaching-limit');
  current.context.usedPercent = 90;
  assert.equal(selectAgentDiagnosticView(current, policy).state, 'high-pressure');
  assert.equal(selectAgentDiagnosticView(current, policy).recommendNewThread, true);
});

test('missing context windows remain unavailable and are never estimated', () => {
  const current = state();
  current.context = {
    status: 'available', source: 'provider',
    total: { totalTokens: 100, inputTokens: 80, cachedInputTokens: 0, cacheWriteInputTokens: 0, outputTokens: 20, reasoningOutputTokens: 0 },
  };
  const view = selectAgentDiagnosticView(current, policy);
  assert.equal(view.state, 'healthy');
  assert.equal(view.usedPercent, undefined);
  assert.match(view.detail, /did not supply a context window/);
});

test('runtime compaction and degraded runtime are distinct states', () => {
  const current = state();
  current.context = { status: 'unknown', source: 'runtime', runtimeCompactedAt: 100 };
  assert.equal(selectAgentDiagnosticView(current, policy).state, 'compacted');
  current.context = { status: 'unavailable', source: 'none' };
  current.runtime = { ...current.runtime, degraded: true, health: 'degraded' };
  assert.equal(selectAgentDiagnosticView(current, policy).state, 'degraded');
});
