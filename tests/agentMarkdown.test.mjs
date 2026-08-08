import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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
});
