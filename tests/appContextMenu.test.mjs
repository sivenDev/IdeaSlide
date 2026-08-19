import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('the application boundary suppresses the native WebView context menu in capture phase', async () => {
  const app = await readSource('src/App.tsx');

  assert.match(app, /addEventListener\(\s*["']contextmenu["'][\s\S]*?,\s*true\s*\)/);
  assert.match(app, /removeEventListener\(\s*["']contextmenu["'][\s\S]*?,\s*true\s*\)/);
  assert.match(app, /contextMenuEvent\.preventDefault\(\)|event\.preventDefault\(\)/);
});
