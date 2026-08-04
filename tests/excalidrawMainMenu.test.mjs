import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('SlideCanvas keeps Excalidraw MainMenu free of a duplicate Navigator control', async () => {
  const source = await readSource('src/components/SlideCanvas.tsx');

  assert.doesNotMatch(source, /\bPanelRight\b/);
  assert.doesNotMatch(source, /<MainMenu\.Item/);
  assert.doesNotMatch(source, /isNavigatorOpen/);
  assert.doesNotMatch(source, /onToggleNavigator/);
  assert.doesNotMatch(source, />\s*Navigator\s*</);
  assert.doesNotMatch(source, /<MainMenu\.Separator\s*\/>/);
  assert.match(source, /<MainMenu\.DefaultItems\.SaveAsImage \/>/);
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
  assert.doesNotMatch(slideCanvas, /isNavigatorOpen=/);
  assert.doesNotMatch(slideCanvas, /onToggleNavigator=/);
  assert.match(slideCanvas, /cameraDrawingRequestToken=\{cameraDrawingRequestToken\}/);
  assert.match(source, /<ResizableDivider side="right" isVisible=\{showNavigator\} onToggle=\{toggleNavigator\} \/>/);
  assert.match(navigator, /onAddCamera=\{readOnly \? undefined : handleAddCamera\}/);
});
