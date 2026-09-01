import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeStreamingAgentMarkdown } from '../src/lib/agent/agentMarkdownPresentation.ts';

test('Agent Markdown uses maintained GFM rendering with safe links and no raw HTML plugin', async () => {
  const source = await readFile(new URL('../src/components/agent/AgentMarkdown.tsx', import.meta.url), 'utf8');
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(manifest.dependencies['react-markdown'], '^10.1.0');
  assert.equal(manifest.dependencies['remark-gfm'], '^4.0.1');
  assert.match(source, /<ReactMarkdown/);
  assert.match(source, /remarkPlugins=\{\[remarkGfm\]\}/);
  assert.match(source, /target="_blank" rel="noreferrer noopener"/);
  assert.match(source, /aria-label="Copy code"/);
  assert.doesNotMatch(source, /rehypeRaw|dangerouslySetInnerHTML/);
  assert.match(source, /disabled=\{!copyEnabled\}/);
  assert.match(source, /settled = true/);
  assert.match(source, /normalizeStreamingAgentMarkdown/);
});

test('streaming Agent Markdown balances incomplete emphasis and fenced code without changing settled bytes', () => {
  assert.equal(
    normalizeStreamingAgentMarkdown('## Summary\n\nThis is **importan'),
    '## Summary\n\nThis is importan',
  );
  assert.equal(
    normalizeStreamingAgentMarkdown('```ts\nconst x = 1;'),
    '```ts\nconst x = 1;\n```',
  );
  assert.equal(
    normalizeStreamingAgentMarkdown('This is **complete**.'),
    'This is **complete**.',
  );
  assert.equal(
    normalizeStreamingAgentMarkdown('This is *incomple'),
    'This is incomple',
  );
  assert.equal(
    normalizeStreamingAgentMarkdown('Paragraph\n\n- first\n- second'),
    'Paragraph\n\n- first\n- second',
  );
  assert.equal(
    normalizeStreamingAgentMarkdown('Paragraph\n- first'),
    'Paragraph\n\n- first',
  );
});
