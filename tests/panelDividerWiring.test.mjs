import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('side panel divider exposes vertical left and right collapse markers', async () => {
  const source = await readFile(new URL('../src/components/ResizableDivider.tsx', import.meta.url), 'utf8');
  assert.match(source, /side: "left" \| "right"/);
  assert.match(source, /Hide workspace|Show workspace/);
  assert.match(source, /Hide cameras|Show cameras/);
  assert.match(source, /w-px/);
});
