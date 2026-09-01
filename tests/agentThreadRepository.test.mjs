import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  agentRuntimeMessagesFromState,
  createAgentThreadState,
  hydrateAgentThreadState,
} from '../src/lib/agent/agentStore.ts';
import { COMPATIBILITY_AGENT_CAPABILITIES } from '../src/lib/agent/protocol.ts';

test('persisted records hydrate only durable Thread state and reset transport bookkeeping', () => {
  const initial = createAgentThreadState({
    threadId: 'thread-1', title: 'Architecture', welcome: 'Ready',
    capabilities: COMPATIBILITY_AGENT_CAPABILITIES, now: 1,
  });
  const hydrated = hydrateAgentThreadState({
    schemaVersion: 1,
    thread: initial.thread,
    capabilities: initial.capabilities,
    runtime: {
      kind: 'codexAppServer', label: 'Codex app-server', model: 'test',
      upstreamThreadId: 'upstream-1', upstreamToolSignature: 'sha256-0123456789abcdef', degraded: false,
    },
  });
  assert.deepEqual(hydrated.thread, initial.thread);
  assert.equal(hydrated.thread.titleSource, 'initial');
  assert.equal(hydrated.activeTurnId, undefined);
  assert.deepEqual(hydrated.processedEventIds, {});
  assert.deepEqual(hydrated.pendingEventsByTurn, {});
  assert.equal(hydrated.capabilities.persistence, true);
  assert.equal(hydrated.runtime.upstreamThreadId, 'upstream-1');
  assert.equal(hydrated.runtime.upstreamToolSignature, 'sha256-0123456789abcdef');
});

test('model context compaction leaves visible history intact', () => {
  const state = createAgentThreadState({
    threadId: 'thread-1', title: 'Long Thread', welcome: 'Ready',
    capabilities: COMPATIBILITY_AGENT_CAPABILITIES, now: 1,
  });
  for (let index = 0; index < 70; index += 1) {
    state.thread.turns.push({
      id: `turn-${index}`,
      threadId: 'thread-1',
      status: 'completed',
      createdAt: index + 2,
      completedAt: index + 2,
      binding: { documentId: 'doc', documentName: 'doc', extensionId: 'x', fileType: 'x', skillId: 'x', revision: index },
      items: [{ id: `message-${index}`, kind: 'message', role: index % 2 ? 'assistant' : 'user', content: `message ${index}`, status: 'completed', createdAt: index + 2 }],
    });
  }
  const compacted = agentRuntimeMessagesFromState(state, 20);
  assert.equal(compacted.messages.length, 20);
  assert.ok(compacted.localReplayTruncatedBeforeTurnId);
  assert.equal(state.thread.turns.length, 71);
});

test('native repository commands use application data and never Workspace metadata', async () => {
  const nativeSource = await readFile(new URL('../src-tauri/src/agent/repository.rs', import.meta.url), 'utf8');
  const commandSource = await readFile(new URL('../src-tauri/src/agent/mod.rs', import.meta.url), 'utf8');
  const clientSource = await readFile(new URL('../src/lib/agent/agentClient.ts', import.meta.url), 'utf8');
  assert.match(commandSource, /app_data_dir\(\)/);
  assert.match(nativeSource, /safe_write::write_bytes/);
  assert.match(nativeSource, /quarantine/);
  assert.doesNotMatch(nativeSource, /\.ideanote|Workspace/);
  assert.match(nativeSource, /pub\(crate\) fn delete\(&self, thread_id: &str\)/);
  assert.match(nativeSource, /"titleSource"/);
  assert.match(nativeSource, /Value::String\("manual"\.to_string\(\)\)/);
  assert.match(nativeSource, /ErrorKind::NotFound/);
  for (const command of ['save_agent_thread', 'get_agent_thread', 'list_agent_threads', 'rename_agent_thread', 'archive_agent_thread', 'delete_agent_thread']) {
    assert.match(clientSource, new RegExp(command));
  }
});
