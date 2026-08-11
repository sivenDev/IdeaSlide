import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('final response actions require a completed Turn and settled presentation', async () => {
  const transcript = await readFile(new URL('../src/components/agent/AgentTranscript.tsx', import.meta.url), 'utf8');
  const item = await readFile(new URL('../src/components/agent/AgentItem.tsx', import.meta.url), 'utf8');

  assert.match(transcript, /turnStatus/);
  assert.match(transcript, /completionDurationMs/);
  assert.match(transcript, /turn\.status === "completed"/);
  assert.match(item, /turnStatus === "completed"/);
  assert.match(item, /item\.status === "completed"/);
  assert.match(item, /presentationStatus !== "revealing"/);
  assert.match(item, /Completed in/);
  assert.match(item, /Copy response/);
  assert.doesNotMatch(item, /ThumbsUp|ThumbsDown|Like response|Dislike response/);
});

test('successful completion no longer stores duration in the Working lifecycle item', async () => {
  const store = await readFile(new URL('../src/lib/agent/agentStore.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(store, /label: `Completed in/);
  assert.match(store, /item\.id !== `\$\{event\.turnId\}:activity`/);
});
