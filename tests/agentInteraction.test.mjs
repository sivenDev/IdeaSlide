import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('composer exposes Stop and retry while gating unsupported steering', async () => {
  const source = await readFile(new URL('../src/components/agent/AgentComposer.tsx', import.meta.url), 'utf8');
  assert.match(source, /disabled=\{disabled \|\| \(running && !steeringAvailable\)\}/);
  assert.match(source, /running && steeringAvailable \? "Steer current Turn"/);
  assert.match(source, /retryAvailable && !running/);
  assert.match(source, /aria-label="Stop Agent run"/);
  assert.match(source, /aria-label="Send to Agent"/);
});

test('transcript stays anchored, offers Jump to latest, and bounds long histories', async () => {
  const source = await readFile(new URL('../src/components/agent/AgentTranscript.tsx', import.meta.url), 'utf8');
  assert.match(source, /const MAX_VISIBLE_ITEMS = 300/);
  assert.match(source, /viewport\.scrollTop = viewport\.scrollHeight/);
  assert.match(source, /scrollHeight - viewport\.scrollTop - viewport\.clientHeight < 48/);
  assert.match(source, /Jump to latest/);
  assert.match(source, /allItems\.slice\(-MAX_VISIBLE_ITEMS\)/);
});

test('stream deltas are frame-batched while lifecycle events flush immediately', async () => {
  const source = await readFile(new URL('../src/hooks/useAgentThread.ts', import.meta.url), 'utf8');
  assert.match(source, /event\.type !== "itemDelta"/);
  assert.match(source, /window\.requestAnimationFrame\(flushQueuedEvents\)/);
  assert.match(source, /window\.cancelAnimationFrame/);
  assert.match(source, /events\.reduce\(reduceAgentEvent, current\)/);
});

test('compatibility runtime emits normalized cancellation and never fabricates rich capabilities', async () => {
  const source = await readFile(new URL('../src/lib/agent/agentRuntime.ts', import.meta.url), 'utf8');
  assert.match(source, /type: "turnCancelled"/);
  assert.match(source, /cancelled \? "Agent run cancelled" : "Turn stopped locally"/);
  assert.match(source, /if \(!activeTurns\.has\(input\.turnId\)\) return/);
  assert.doesNotMatch(source, /reasoningSummary.*emitNext|type: "approval"|type: "plan"/s);
});
