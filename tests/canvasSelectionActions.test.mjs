import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const actions = await readFile(new URL('../src/components/CanvasSelectionActions.tsx', import.meta.url), 'utf8');
const canvas = await readFile(new URL('../src/components/SlideCanvas.tsx', import.meta.url), 'utf8');

test('Canvas selection action offers New Page first and Current Page second', () => {
  assert.match(actions, /Convert style/);
  assert.match(actions, /New Page/);
  assert.match(actions, /Current Page/);
  assert.ok(actions.indexOf('New Page') < actions.indexOf('Current Page'));
  assert.match(actions, /DropdownMenu/);
  assert.match(actions, /aria-label="Convert style"/);
  assert.match(actions, /<TooltipProvider>/);
});

test('SlideCanvas exposes only the contextual conversion action through public top-right UI', () => {
  assert.match(canvas, /renderTopRightUI/);
  assert.match(canvas, /<CanvasSelectionActions/);
  assert.match(canvas, /getStyleConversionAvailability/);
  assert.match(canvas, /onConvertSelection/);
  assert.doesNotMatch(canvas, /CanvasPresentationControls/);
  assert.doesNotMatch(canvas, />\s*Navigator\s*</);
  assert.doesNotMatch(canvas, />\s*Add camera\s*</);
});
