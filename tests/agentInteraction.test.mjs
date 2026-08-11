import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('bottom composer exposes model evidence, Stop, retry, and unsupported-steering gating', async () => {
  const source = await readFile(new URL('../src/components/agent/AgentComposer.tsx', import.meta.url), 'utf8');
  assert.match(source, /disabled=\{disabled \|\| \(running && !steeringAvailable\)\}/);
  assert.match(source, /Add direction to the current Turn/);
  assert.match(source, /<AgentModelSelector/);
  assert.match(source, /className="ideanote-agent-composer__footer"/);
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
  assert.match(source, /allEntries\.slice\(-MAX_VISIBLE_ITEMS\)/);
  assert.match(source, /evidence: index === lastAssistantIndex \? turn\.evidence/);
});

test('source deltas remain frame-batched while a separate presentation clock owns visible pacing', async () => {
  const source = await readFile(new URL('../src/hooks/useAgentThread.ts', import.meta.url), 'utf8');
  const presentationHook = await readFile(new URL('../src/hooks/useAgentPresentation.ts', import.meta.url), 'utf8');
  const presentation = await readFile(new URL('../src/lib/agent/agentTextPresentation.ts', import.meta.url), 'utf8');
  assert.match(source, /event\.type !== "itemDelta"/);
  assert.match(source, /window\.requestAnimationFrame\(flushQueuedEvents\)/);
  assert.match(source, /window\.cancelAnimationFrame/);
  assert.match(source, /events\.reduce\(reduceAgentEvent, current\)/);
  assert.match(presentationHook, /AgentTextPresentationController/);
  assert.match(presentationHook, /prefers-reduced-motion: reduce/);
  assert.match(presentationHook, /controller\.reset\(false\)/);
  assert.match(presentation, /presentationStatus: "idle" \| "revealing" \| "settled"/);
  assert.match(presentation, /Intl as typeof Intl/);
  assert.match(presentation, /isChronologicalBarrier/);
  assert.doesNotMatch(presentation, /codexAppServer|compatibility|ideasketch/);
});

test('native Agent Core owns lifecycle activity while TypeScript only forwards events and executes editor Tools', async () => {
  const runtime = await readFile(new URL('../src/lib/agent/agentRuntime.ts', import.meta.url), 'utf8');
  const native = await readFile(new URL('../src-tauri/src/agent/mod.rs', import.meta.url), 'utf8');
  assert.match(runtime, /if \(event\.type === "event"\)/);
  assert.match(runtime, /emit\(event\.event\)/);
  assert.match(runtime, /submitAgentToolResult\(input\.turnId, result\)/);
  assert.match(runtime, /if \(!activeTurns\.has\(input\.turnId\)\) return/);
  assert.match(runtime, /createSettledTurnCompletedEvent/);
  assert.match(native, /"turnCancelled"/);
  assert.match(native, /ProviderProgress::PublicActivityDelta/);
  assert.match(native, /ProviderProgress::ToolStarted/);
  assert.match(native, /"label": "Working"/);
  assert.match(native, /turn\.append_assistant_delta\(/);
  assert.match(native, /turn\.close_assistant_segment\(\)/);
  assert.match(native, /emit_tool_result/);
});
