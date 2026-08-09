import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('normalized items render continuous public activity without a reasoning-summary card', async () => {
  const source = await readFile(new URL('../src/components/agent/AgentItem.tsx', import.meta.url), 'utf8');
  for (const kind of ['message', 'activity', 'plan', 'tool', 'approval', 'changeReview', 'error', 'lifecycle']) {
    assert.match(source, new RegExp(`case "${kind}"`));
  }
  assert.doesNotMatch(source, /AgentReasoningSummary|case "reasoningSummary"/);
  assert.match(source, /AgentLifecycleActivity/);
  assert.match(source, /\(elapsed \/ 1000\)\.toFixed\(1\)/);
  assert.match(source, /renderChangeReview\(item\)/);
  assert.match(source, /<AgentMarkdown content=\{item\.content\}/);
});

test('public activity is inline and tool activity preserves real status', async () => {
  const item = await readFile(new URL('../src/components/agent/AgentItem.tsx', import.meta.url), 'utf8');
  const tool = await readFile(new URL('../src/components/agent/AgentToolActivity.tsx', import.meta.url), 'utf8');
  assert.match(item, /ideanote-agent-public-activity/);
  assert.doesNotMatch(item, /Reasoning summary|Waiting for a summary/);
  assert.match(tool, /is-\$\{item\.status\}/);
  assert.match(tool, /item\.status === "running"/);
  assert.match(tool, /item\.status === "completed"/);
  assert.match(tool, /<details/);
  assert.match(tool, /JSON\.stringify\(item\.input/);
  assert.match(tool, /JSON\.stringify\(item\.output/);
});
