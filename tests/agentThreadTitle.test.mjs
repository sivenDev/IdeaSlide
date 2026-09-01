import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateAgentThreadTitle,
  MAX_GENERATED_AGENT_THREAD_TITLE_GRAPHEMES,
  NEW_AGENT_THREAD_TITLE,
  normalizeAgentThreadTitleSource,
} from '../src/lib/agent/agentThreadTitle.ts';

function graphemes(value) {
  return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value));
}

test('conversation titles come only from cleaned visible prompt text', () => {
  assert.equal(
    generateAgentThreadTitle('## **Generate conversation titles**\n\n- Keep [manual names](https://example.com)'),
    'Generate conversation titles Keep manual names',
  );
  assert.equal(
    generateAgentThreadTitle('> 根据首条用户消息生成标题，并在 Markdown 与 IdeaSketch 间保持稳定。'),
    '根据首条用户消息生成标题，并在 Markdown 与 IdeaSketch 间保持稳定',
  );
  assert.equal(generateAgentThreadTitle('```ts\n```'), NEW_AGENT_THREAD_TITLE);
  assert.equal(generateAgentThreadTitle('   \n\t'), NEW_AGENT_THREAD_TITLE);
  assert.equal(generateAgentThreadTitle('Fix `rename_agent_thread` persistence'), 'Fix rename_agent_thread persistence');
});

test('long titles truncate at a readable grapheme-safe boundary', () => {
  const english = generateAgentThreadTitle(
    'Implement persistent automatic conversation titles from the first visible user message without changing them after editor switches',
  );
  assert.equal(english, 'Implement persistent automatic conversation titles…');
  assert.ok(graphemes(english).length <= MAX_GENERATED_AGENT_THREAD_TITLE_GRAPHEMES);

  const emojiCluster = '\u{1F44D}\u{1F3FD}';
  const emoji = generateAgentThreadTitle(emojiCluster.repeat(80));
  assert.ok(emoji.endsWith('…'));
  assert.ok(graphemes(emoji).length <= MAX_GENERATED_AGENT_THREAD_TITLE_GRAPHEMES);
  assert.ok(!emoji.endsWith('\u200d…'));
});

test('legacy or invalid title provenance is conservatively manual', () => {
  assert.equal(normalizeAgentThreadTitleSource('initial'), 'initial');
  assert.equal(normalizeAgentThreadTitleSource('generated'), 'generated');
  assert.equal(normalizeAgentThreadTitleSource('manual'), 'manual');
  assert.equal(normalizeAgentThreadTitleSource(undefined), 'manual');
  assert.equal(normalizeAgentThreadTitleSource('unknown'), 'manual');
});
