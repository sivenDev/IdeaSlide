import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('camera sidebar is a text-only vertical list', async () => {
  const source = await readFile(new URL('../src/components/CameraList.tsx', import.meta.url), 'utf8');
  assert.match(source, /Camera \{camera\.order\}/);
  assert.match(source, /overflow-y-auto/);
  assert.doesNotMatch(source, /CameraThumbnail/);
  assert.doesNotMatch(source, /thumbnails/);
  assert.doesNotMatch(source, /SVGSVGElement/);
});
