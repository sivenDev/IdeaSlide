import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('SlideCanvas adds only the draw.io export command to the custom Excalidraw MainMenu', async () => {
  const source = await readSource('src/components/SlideCanvas.tsx');

  assert.doesNotMatch(source, /\bPanelRight\b/);
  assert.equal((source.match(/<MainMenu\.Item/g) ?? []).length, 1);
  assert.match(source, /<MainMenu\.Item[\s\S]*?onSelect=\{handleExportDrawio\}[\s\S]*?>\s*Export as draw\.io\s*<\/MainMenu\.Item>/);
  assert.match(source, /api\.getSceneElements\(\)/);
  assert.match(source, /api\.getFiles\(\)/);
  assert.match(source, /exportExcalidrawToDrawio/);
  assert.doesNotMatch(source, /isNavigatorOpen/);
  assert.doesNotMatch(source, /onToggleNavigator/);
  assert.doesNotMatch(source, />\s*Navigator\s*</);
  assert.doesNotMatch(source, /<MainMenu\.Separator\s*\/>/);
  assert.match(source, /<MainMenu\.DefaultItems\.SaveAsImage \/>/);
});

test('SlideCanvas reserves public top-right UI for contextual selection conversion only', async () => {
  const source = await readSource('src/components/SlideCanvas.tsx');

  assert.doesNotMatch(source, /CanvasPresentationControls/);
  assert.match(source, /renderTopRightUI/);
  assert.match(source, /CanvasSelectionActions/);
  assert.doesNotMatch(source, /onAddCamera/);
  assert.doesNotMatch(source, />\s*Add camera\s*</);
  assert.doesNotMatch(source, />\s*Navigator\s*</);
  assert.match(source, /cameraDrawingRequestToken/);
  assert.match(source, /lastCameraDrawingRequestTokenRef/);
  assert.match(source, /!viewMode && mainMenu/);
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
