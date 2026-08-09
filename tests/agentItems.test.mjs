import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('normalized items render as distinct message, reasoning, plan, tool, approval, review, error, and lifecycle surfaces', async () => {
  const source = await readFile(new URL('../src/components/agent/AgentItem.tsx', import.meta.url), 'utf8');
  for (const kind of ['message', 'reasoningSummary', 'plan', 'tool', 'approval', 'changeReview', 'error', 'lifecycle']) {
    assert.match(source, new RegExp(`case "${kind}"`));
  }
  assert.match(source, /AgentLifecycleActivity/);
  assert.match(source, /\(elapsed \/ 1000\)\.toFixed\(1\)/);
  assert.match(source, /renderChangeReview\(item\)/);
  assert.match(source, /<AgentMarkdown content=\{item\.content\}/);
});

test('reasoning UI shows only supplied summaries and tool activity preserves real status', async () => {
  const reasoning = await readFile(new URL('../src/components/agent/AgentReasoningSummary.tsx', import.meta.url), 'utf8');
  const tool = await readFile(new URL('../src/components/agent/AgentToolActivity.tsx', import.meta.url), 'utf8');
  assert.match(reasoning, /<AgentMarkdown content=\{content \|\| "Waiting for a summary…"\}/);
  assert.doesNotMatch(reasoning, /token|chain.of.thought|simulate/i);
  assert.match(tool, /is-\$\{item\.status\}/);
  assert.match(tool, /item\.status === "running"/);
  assert.match(tool, /item\.status === "completed"/);
  assert.match(tool, /<details/);
  assert.match(tool, /JSON\.stringify\(item\.input/);
  assert.match(tool, /JSON\.stringify\(item\.output/);
});
