import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  COMPATIBILITY_AGENT_CAPABILITIES,
  createAgentEventId,
} from '../src/lib/agent/protocol.ts';

test('compatibility capabilities describe only behavior the current runtime exposes', () => {
  assert.deepEqual(COMPATIBILITY_AGENT_CAPABILITIES, {
    textStreaming: true,
    reasoningSummary: false,
    plans: false,
    toolEvents: false,
    approvals: false,
    cancellation: true,
    steering: false,
    retry: true,
    persistence: false,
  });
  assert.equal(createAgentEventId('turn-1', 4, 'itemDelta'), 'turn-1:4:itemDelta');
});

test('the public protocol remains owned by IdeaNote and transport-neutral', async () => {
  const source = await readFile(new URL('../src/lib/agent/protocol.ts', import.meta.url), 'utf8');
  for (const name of ['AgentThread', 'AgentTurn', 'AgentItem', 'AgentEvent', 'AgentCapabilities', 'AgentError']) {
    assert.match(source, new RegExp(`(?:interface|type) ${name}`));
  }
  assert.doesNotMatch(source, /@tauri|assistant-ui|\bRig\b|\bCodex\b|\bACP\b|OpenAI/);
});

test('the compatibility runtime normalizes provider capabilities, summaries, telemetry, and classified errors', async () => {
  const source = await readFile(new URL('../src/lib/agent/agentRuntime.ts', import.meta.url), 'utf8');
  assert.match(source, /case "capabilities"/);
  assert.match(source, /type: "capabilitiesUpdated"/);
  assert.match(source, /case "reasoningSummaryDelta"/);
  assert.match(source, /kind: "reasoningSummary"/);
  assert.match(source, /case "telemetry"/);
  assert.match(source, /type: "telemetryUpdated"/);
  assert.match(source, /case "error"/);
  assert.match(source, /error: event\.error/);
});
