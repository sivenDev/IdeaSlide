import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('SlideCanvas moves the former Excalidraw MainMenu actions behind its live command API', async () => {
  const source = await readSource('src/components/SlideCanvas.tsx');
  const editor = await readSource('src/components/IdeaSketchEditor.tsx');

  assert.doesNotMatch(source, /\bMainMenu\b/);
  assert.doesNotMatch(source, /SlideCanvasCommandApi|exportDrawio|openImageExport|changeCanvasBackground|clearCanvas/);
  assert.doesNotMatch(source, /openHelp|name: "help"/);
  assert.match(editor, /const exportActivePageAsDrawio = useCallback/);
  assert.match(editor, /sdk\?\.io\.openImageExportDialog\(\)/);
  assert.match(editor, /sdk\.scene\.applyPlan\(/);
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
  assert.doesNotMatch(source, /mainMenu/);
});

test('IdeaSketchEditor keeps Camera creation in the navigator only', async () => {
  const source = await readSource('src/components/IdeaSketchEditor.tsx');
  const slideCanvas = source.match(/<SlideCanvas\n[\s\S]*?\/>/)?.[0] ?? '';

  assert.doesNotMatch(slideCanvas, /onAddCamera=/);
  assert.doesNotMatch(slideCanvas, /isNavigatorOpen=/);
  assert.doesNotMatch(slideCanvas, /onToggleNavigator=/);
  assert.match(slideCanvas, /cameraDrawingRequestToken=\{cameraDrawingRequestToken\}/);
  assert.match(source, /<ResizableDivider[\s\S]*?side="left"[\s\S]*?isVisible=\{drawerOpen\}[\s\S]*?showToggle=\{false\}[\s\S]*?onResize=/);
  assert.match(source, /<IdeaSketchNavigator[\s\S]*?onAddCamera=\{readOnly \? undefined : handleAddCamera\}[\s\S]*?onStartFullscreen=/);
});
