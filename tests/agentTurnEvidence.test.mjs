import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('runtimeUpdated freezes effective runtime, model, and reasoning on the active Turn', async () => {
  const store = await readFile(new URL('../src/lib/agent/agentStore.ts', import.meta.url), 'utf8');
  const protocol = await readFile(new URL('../src/lib/agent/protocol.ts', import.meta.url), 'utf8');
  assert.match(protocol, /export interface AgentTurnEvidence/);
  assert.match(protocol, /evidence\?: AgentTurnEvidence/);
  assert.match(store, /\(turn\) => turn\.evidence\s*\? turn\s*:\s*\{/);
  assert.match(store, /runtimeKind: event\.runtime\.kind/);
  assert.match(store, /runtimeLabel: event\.runtime\.label/);
  assert.match(store, /model: event\.runtime\.model/);
  assert.match(store, /reasoningEffort: event\.runtime\.reasoningEffort \?\? "standard"/);
  assert.match(store, /capturedAt: event\.at/);
});

test('native boundary rejects stale models and unsupported reasoning before execution', async () => {
  const native = await readFile(new URL('../src-tauri/src/agent/mod.rs', import.meta.url), 'utf8');
  assert.match(native, /selected model is no longer in the tested provider catalog/);
  assert.match(native, /reasoning_effort != "standard"/);
  assert.match(native, /active Agent runtime does not support that reasoning effort/);
  assert.match(native, /"reasoningEffort": "standard"/);
  assert.match(native, /"reasoningEffort": request\.reasoning_effort\.clone\(\)/);
});
