import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildHtmlPreviewDocument,
  classifyCodeBlock,
  indexSpecialCodeBlocks,
  normalizeCodeLanguage,
  sanitizePreviewCss,
} from '../src/lib/markdownPreview.ts';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('code blocks normalize aliases and classify ordinary, Mermaid, HTML, and limited content', () => {
  assert.equal(normalizeCodeLanguage('language-js'), 'javascript');
  assert.equal(normalizeCodeLanguage('TSX'), 'typescript');
  assert.equal(classifyCodeBlock('const value = 1', 'js').kind, 'code');
  assert.equal(classifyCodeBlock('graph TD; A-->B', 'mermaid').kind, 'mermaid');
  assert.equal(classifyCodeBlock('<main>Hello</main>', 'html').kind, 'html');
  assert.equal(classifyCodeBlock('x'.repeat(60_000), 'mermaid').kind, 'limited');
  assert.equal(classifyCodeBlock('graph TD; A-->B', 'mermaid', 23).kind, 'mermaid');
  assert.equal(classifyCodeBlock('graph TD; A-->B', 'mermaid', 24).kind, 'limited');
});

test('rich preview indexing keeps the first 24 special fences available and limits later blocks', () => {
  const markdown = [
    '```javascript',
    'const ignored = "```html";',
    '```',
    ...Array.from({ length: 25 }, (_, index) => [
      index % 2 === 0 ? '```mermaid' : '~~~htm',
      index % 2 === 0 ? 'graph TD; A-->B' : '<main>Safe</main>',
      index % 2 === 0 ? '```' : '~~~',
    ]).flat(),
  ].join('\n');
  const indexes = [...indexSpecialCodeBlocks(markdown).values()];
  assert.deepEqual(indexes, Array.from({ length: 25 }, (_, index) => index));
  assert.equal(classifyCodeBlock('<main>Safe</main>', 'html', indexes[23]).kind, 'html');
  assert.equal(classifyCodeBlock('<main>Safe</main>', 'html', indexes[24]).kind, 'limited');
});

test('HTML fence CSS scrubbing and the generated document block active/network content', () => {
  const css = sanitizePreviewCss('@import "https://example.com/a.css"; padding: 8px; background: url(https://example.com/a.png)');
  assert.match(css, /padding: 8px/);
  assert.doesNotMatch(css, /https:\/\/|@import|url\(/i);
  const document = buildHtmlPreviewDocument('<main class="card">Safe</main>');
  assert.match(document, /default-src 'none'/);
  assert.match(document, /style-src 'unsafe-inline'/);
  assert.match(document, /img-src data: blob:/);
  assert.doesNotMatch(document, /allow-scripts|allow-same-origin/);
});

test('rich Markdown preview keeps raw HTML sanitization and special previews behind explicit components', async () => {
  const [preview, code, mermaid, html, security] = await Promise.all([
    readSource('src/components/MarkdownPreview.tsx'),
    readSource('src/components/MarkdownCodeBlock.tsx'),
    readSource('src/components/MermaidCodePreview.tsx'),
    readSource('src/components/HtmlCodePreview.tsx'),
    readSource('src/lib/htmlPreviewSecurity.ts'),
  ]);
  assert.match(preview, /rehypeRaw/);
  assert.match(preview, /rehypeSanitize/);
  assert.match(preview, /markdownHtmlSchema/);
  assert.match(preview, /MarkdownCodeBlock/);
  assert.match(code, /navigator\.clipboard\.writeText/);
  assert.match(code, /lowlight\.highlight/);
  assert.match(mermaid, /securityLevel:\s*"strict"/);
  assert.match(mermaid, /import\("mermaid"\)/);
  assert.match(html, /sandbox=""/);
  assert.match(html, /srcDoc=/);
  assert.match(security, /DOMPurify\.sanitize/);
  assert.match(security, /ALLOW_DATA_ATTR:\s*false/);
  assert.doesNotMatch(security, /sanitize-html/);
});
