import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  indexSpecialCodeBlocks,
  stripMarkdownFrontmatter,
} from '../src/lib/markdownPreview.ts';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('stripMarkdownFrontmatter removes a complete leading YAML block only', () => {
  const source = [
    '---',
    'title: Example',
    'draft: false',
    '---',
    '',
    '# Body',
    '',
    'Content.',
  ].join('\n');

  assert.equal(stripMarkdownFrontmatter(source), '\n# Body\n\nContent.');
});

test('frontmatter preview projection supports BOM, CRLF, empty metadata, and the YAML document end marker', () => {
  assert.equal(
    stripMarkdownFrontmatter('\uFEFF---\r\ntitle: Example\r\n...\r\n# Body'),
    '# Body',
  );
  assert.equal(stripMarkdownFrontmatter('---\n---\n# Body'), '# Body');
  assert.equal(stripMarkdownFrontmatter('---\ntitle: Example\n...'), '');
});

test('special-code-block indexing starts from the projected body', () => {
  const source = [
    '---',
    'title: Example',
    '---',
    '```mermaid',
    'graph TD; A-->B',
    '```',
  ].join('\n');

  assert.deepEqual(
    [...indexSpecialCodeBlocks(stripMarkdownFrontmatter(source)).entries()],
    [[1, 0]],
  );
});

test('incomplete or non-leading delimiters remain ordinary Markdown', () => {
  const incomplete = '---\ntitle: Example\n# Body';
  const horizontalRule = '---\n\n# Body';
  const laterDelimiter = '# Body\n\n---\ntitle: Example\n---\n';

  assert.equal(stripMarkdownFrontmatter(incomplete), incomplete);
  assert.equal(stripMarkdownFrontmatter(horizontalRule), horizontalRule);
  assert.equal(stripMarkdownFrontmatter(laterDelimiter), laterDelimiter);
});

test('MarkdownPreview applies frontmatter projection before rich rendering and fence indexing', async () => {
  const [preview, editor] = await Promise.all([
    readSource('src/components/MarkdownPreview.tsx'),
    readSource('src/components/MarkdownEditor.tsx'),
  ]);

  assert.match(preview, /stripMarkdownFrontmatter/);
  assert.match(preview, /const renderedText = useMemo\(\(\) => stripMarkdownFrontmatter\(text\)/);
  assert.match(preview, /indexSpecialCodeBlocks\(renderedText\)/);
  assert.match(preview, />\{renderedText\}<\/ReactMarkdown>/);
  assert.doesNotMatch(editor, /stripMarkdownFrontmatter/);
});
