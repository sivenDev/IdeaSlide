import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('final response actions require a completed Turn and settled presentation', async () => {
  const transcript = await readFile(new URL('../src/components/agent/AgentTranscript.tsx', import.meta.url), 'utf8');
  const item = await readFile(new URL('../src/components/agent/AgentItem.tsx', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(transcript, /turnStatus/);
  assert.match(transcript, /completionDurationMs/);
  assert.match(transcript, /turn\.status === "completed"/);
  assert.match(item, /turnStatus === "completed"/);
  assert.match(item, /item\.status === "completed"/);
  assert.match(item, /presentationStatus !== "revealing"/);
  assert.match(item, /Clock3/);
  assert.match(item, /aria-label=\{`Completed in \$\{completionDuration\}`\}/);
  assert.match(item, /<span>\{completionDuration\}<\/span>/);
  assert.doesNotMatch(item, /<time>Completed in/);
  assert.doesNotMatch(item, /evidence\.runtimeLabel|evidence\.model|evidence\.reasoningEffort/);
  assert.doesNotMatch(transcript, /evidence=\{evidence\}/);
  assert.match(styles, /\.ideanote-agent-response-evidence__actions \{ flex: 0 0 auto; margin-left: 0; \}/);
  assert.match(item, /aria-label="Response actions"/);
  assert.match(item, /Copy response/);
  assert.doesNotMatch(item, /ThumbsUp|ThumbsDown|Like response|Dislike response/);
});

test('successful completion no longer stores duration in the Working lifecycle item', async () => {
  const store = await readFile(new URL('../src/lib/agent/agentStore.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(store, /label: `Completed in/);
  assert.match(store, /item\.id !== `\$\{event\.turnId\}:activity`/);
});
