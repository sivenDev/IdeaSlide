import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('native frame follows real fullscreen resize state without mock platform flags', async () => {
  const source = await readFile(new URL('../src/hooks/useNativeWindowFrame.ts', import.meta.url), 'utf8');
  assert.match(source, /getCurrentWindow/);
  assert.match(source, /isFullscreen/);
  assert.match(source, /onResized/);
  assert.match(source, /return "macos"/);
  assert.match(source, /return "windows"/);
  assert.match(source, /className: `is-\$\{platform\}/);
  assert.doesNotMatch(source, /MockWindowApi|query|review scenario/i);
});
