import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('runtime inspector keeps diagnostics, context, policy, and delivery outside the transcript', async () => {
  const inspector = await readFile(new URL('../src/components/agent/AgentRuntimeInspector.tsx', import.meta.url), 'utf8');
  const panel = await readFile(new URL('../src/components/AgentPanel.tsx', import.meta.url), 'utf8');
  const header = await readFile(new URL('../src/components/agent/AgentThreadHeader.tsx', import.meta.url), 'utf8');
  assert.match(inspector, /Agent runtime inspector/);
  assert.match(inspector, /Effective Turn policy/);
  assert.match(inspector, /Runtime diagnostics/);
  assert.match(inspector, /Source delivery/);
  assert.match(inspector, /selectAgentDiagnosticView\(state, effectivePolicy\)/);
  assert.match(inspector, /effectivePolicy\.showDeliveryTelemetry/);
  assert.match(inspector, /localReplayTruncatedBeforeTurnId/);
  assert.match(inspector, /runtimeCompactedAt/);
  assert.match(panel, /<AgentRuntimeInspector/);
  assert.match(header, /Open Agent runtime inspector/);
  assert.doesNotMatch(inspector, /reasoning summary|chain.of.thought/i);
});
