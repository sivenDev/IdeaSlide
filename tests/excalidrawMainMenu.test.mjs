import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('SlideCanvas exposes Navigator through Excalidraw MainMenu', async () => {
  const source = await readSource('src/components/SlideCanvas.tsx');

  assert.match(source, /<MainMenu\.Item/);
  assert.match(source, /icon=\{<PanelRight[^>]*\/>\}/);
  assert.match(source, /selected=\{isNavigatorOpen\}/);
  assert.match(source, /onSelect=\{onToggleNavigator\}/);
  assert.match(source, />\s*Navigator\s*<\/MainMenu\.Item>/);
  assert.match(source, /<MainMenu\.Separator\s*\/>/);
});

test('SlideCanvas does not render a detached control island or Camera creation action', async () => {
  const source = await readSource('src/components/SlideCanvas.tsx');

  assert.doesNotMatch(source, /CanvasPresentationControls/);
  assert.doesNotMatch(source, /renderTopRightUI/);
  assert.doesNotMatch(source, /onAddCamera/);
  assert.doesNotMatch(source, />\s*Add camera\s*</);
  assert.match(source, /cameraDrawingRequestToken/);
  assert.match(source, /lastCameraDrawingRequestTokenRef/);
});

test('IdeaSketchEditor keeps Camera creation in the navigator only', async () => {
  const source = await readSource('src/components/IdeaSketchEditor.tsx');
  const slideCanvas = source.match(/<SlideCanvas[\s\S]*?\/>/)?.[0] ?? '';
  const navigator = source.match(/<IdeaSketchNavigator\s[\s\S]*?\/>/)?.[0] ?? '';

  assert.doesNotMatch(slideCanvas, /onAddCamera=/);
  assert.match(slideCanvas, /onToggleNavigator=\{toggleNavigator\}/);
  assert.match(slideCanvas, /cameraDrawingRequestToken=\{cameraDrawingRequestToken\}/);
  assert.match(navigator, /onAddCamera=\{readOnly \? undefined : handleAddCamera\}/);
});
