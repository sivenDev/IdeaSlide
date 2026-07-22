import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('EditorLayout keeps the active Canvas session projection stable across unrelated renders', async () => {
  const source = await readFile(
    new URL('../src/components/EditorLayout.tsx', import.meta.url),
    'utf8',
  );

  assert.match(
    source,
    /const currentSlide = useMemo\(\s*\(\) => canvasContentToSlide\(workspace, sessionCanvasResource\),\s*\[workspace, sessionCanvasResource\],?\s*\);/s,
  );
  assert.doesNotMatch(
    source,
    /const currentSlide = canvasContentToSlide\(workspace, sessionCanvasResource\);/,
  );
});
