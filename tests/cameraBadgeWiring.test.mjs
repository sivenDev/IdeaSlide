import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('SlideCanvas wires a non-interactive camera badge overlay for edit mode only', async () => {
  const source = await readSource('src/components/SlideCanvas.tsx');

  assert.match(source, /from "\.\.\/lib\/cameraBadges"/);
  assert.match(source, /onScrollChange/);
  assert.match(source, /const containerRef = useRef<HTMLDivElement>\(null\)/);
  assert.match(source, /containerRef\.current\?\.getBoundingClientRect\(\)/);
  assert.match(source, /new ResizeObserver/);
  assert.match(source, /ref=\{containerRef\}/);
  assert.match(source, /pointer-events-none absolute inset-0 z-20 overflow-hidden/);
  assert.match(source, /!viewMode && cameraBadges.length > 0/);
  assert.match(source, /backgroundColor: getBadgeBackgroundColor\(badge\.strokeColor\)/);
  assert.match(source, /transform: "translate\(-28%, -52%\)"/);
  assert.match(source, /const alpha = 0\.76/);
});
