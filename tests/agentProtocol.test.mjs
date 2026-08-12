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
    approvals: true,
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

test('the native core normalizes provider capabilities, public activity, telemetry, and classified errors', async () => {
  const runtime = await readFile(new URL('../src/lib/agent/agentRuntime.ts', import.meta.url), 'utf8');
  const native = await readFile(new URL('../src-tauri/src/agent/mod.rs', import.meta.url), 'utf8');
  assert.match(runtime, /emit\(event\.event\)/);
  assert.match(native, /"capabilitiesUpdated"/);
  assert.match(native, /ProviderProgress::PublicActivityDelta/);
  assert.match(native, /"kind": "activity"/);
  assert.doesNotMatch(native, /"kind": "reasoningSummary"/);
  assert.match(native, /ProviderProgress::Telemetry/);
  assert.match(native, /"telemetryUpdated"/);
  assert.match(native, /"turnFailed"/);
  assert.match(native, /failure\.diagnostic/);
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

test('runtime diagnostics use a transport-neutral exact-or-unavailable context contract', async () => {
  const source = await readFile(new URL('../src/lib/agent/protocol.ts', import.meta.url), 'utf8');
  assert.match(source, /interface AgentContextSnapshot/);
  assert.match(source, /status: "available" \| "unavailable" \| "unknown"/);
  assert.match(source, /modelContextWindow\?: number/);
  assert.match(source, /usedPercent\?: number/);
  assert.match(source, /runtimeCompactedAt\?: number/);
  assert.match(source, /localReplayTruncatedBeforeTurnId\?: string/);
  assert.match(source, /interface AgentRuntimeDiagnostic/);
  assert.match(source, /effectivePolicy: AgentEffectivePolicy/);
  assert.doesNotMatch(source, /chainOfThought|rawProviderPayload|estimatedTokens/);
});

test('managed Skill contracts are additive, origin-qualified, and persist provenance only', async () => {
  const protocol = await readFile(new URL('../src/lib/agent/protocol.ts', import.meta.url), 'utf8');
  const types = await readFile(new URL('../src/lib/agent/types.ts', import.meta.url), 'utf8');
  const native = await readFile(new URL('../src-tauri/src/agent/skill_registry.rs', import.meta.url), 'utf8');
  assert.match(types, /origin: "bundled" \| "custom"/);
  assert.match(types, /selectedSkillIds: string\[\]/);
  assert.match(types, /activationMode: AgentSkillActivationMode/);
  assert.match(protocol, /interface AgentSkillActivatedEvent/);
  assert.match(protocol, /skillProvenance: AgentSkillProvenance\[\]/);
  assert.match(native, /custom:/);
  assert.match(native, /"persistable": false/);
  assert.doesNotMatch(protocol, /instructions: string|relativePath|absolutePath/);
});
