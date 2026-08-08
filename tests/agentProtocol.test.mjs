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
    persistence: true,
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

test('the captured retry policy crosses the generic Agent request boundary', async () => {
  const panel = await readFile(new URL('../src/components/AgentPanel.tsx', import.meta.url), 'utf8');
  const frontendTypes = await readFile(new URL('../src/lib/agent/types.ts', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../src/lib/agent/agentRuntime.ts', import.meta.url), 'utf8');
  const nativeTypes = await readFile(new URL('../src-tauri/src/agent/types.rs', import.meta.url), 'utf8');
  const provider = await readFile(new URL('../src-tauri/src/agent/provider.rs', import.meta.url), 'utf8');
  assert.match(panel, /retry: settings\.ai\.retry/);
  assert.match(frontendTypes, /interface AgentRetryPolicy/);
  assert.match(frontendTypes, /retry: AgentRetryPolicy/);
  assert.match(runtime, /retry: input\.retry/);
  assert.match(nativeTypes, /struct AgentRetryPolicy/);
  assert.match(nativeTypes, /max_attempts: u8/);
  assert.match(provider, /effective_max_attempts\(request\.retry\)/);
  assert.match(provider, /policy\.max_attempts\.clamp\(1, 5\)/);
});
