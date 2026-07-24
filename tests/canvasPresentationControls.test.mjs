import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Canvas presentation controls expose Cameras count and camera-gated Preview and Fullscreen actions', async () => {
  const source = await readSource('src/components/CanvasPresentationControls.tsx');

  assert.match(source, /Button as ExcalidrawButton/);
  assert.match(source, /idea-slide-canvas-controls/);
  assert.match(source, /idea-slide-canvas-control__label/);
  assert.match(source, /idea-slide-canvas-control__count/);
  assert.match(source, /aria-pressed=\{isCameraListOpen\}/);
  assert.match(source, /disabled=\{!hasCameras\}/);
  assert.match(source, /onStartPreview/);
  assert.match(source, /onStartFullscreen/);
  assert.doesNotMatch(source, /controlClassName/);
  assert.doesNotMatch(source, /From Beginning/);
});

test('Canvas presentation controls have scoped no-wrap and legible disabled styling', async () => {
  const source = await readSource('src/index.css');

  assert.match(source, /\.idea-slide-canvas-controls/);
  assert.match(source, /white-space:\s*nowrap/);
  assert.match(source, /\.idea-slide-canvas-control:disabled/);
  assert.match(source, /opacity:\s*1/);
  assert.match(source, /@media \(max-width:\s*1400px\)/);
});

test('SlideCanvas renders contextual controls and consumes each Add Camera request token once', async () => {
  const source = await readSource('src/components/SlideCanvas.tsx');

  assert.match(source, /from "\.\/CanvasPresentationControls"/);
  assert.match(source, /cameraDrawingRequestToken/);
  assert.match(source, /lastCameraDrawingRequestTokenRef/);
  assert.match(source, /startCameraDrawing\(\)/);
  assert.match(source, /<CanvasPresentationControls/);
  assert.doesNotMatch(source, /Draw a camera rectangle/);
  assert.doesNotMatch(source, /Drawing\.\.\./);
});

test('global Toolbar contains workspace actions only and no presentation menu', async () => {
  const source = await readSource('src/components/Toolbar.tsx');

  assert.doesNotMatch(source, /aria-label="Present"/);
  assert.doesNotMatch(source, /onStartPreview/);
  assert.doesNotMatch(source, /onStartFullscreen/);
  assert.doesNotMatch(source, /DropdownMenu/);
});

test('App passes only the active Canvas into camera-only PresentationMode', async () => {
  const app = await readSource('src/App.tsx');
  const presentation = await readSource('src/components/PresentationMode.tsx');

  assert.match(app, /canvasContentToSlide/);
  assert.match(app, /activeResource.*type === "canvas"/s);
  assert.match(app, /<PresentationMode[\s\S]*slide=\{/);
  assert.doesNotMatch(app, /projectWorkspaceToSlides/);

  assert.match(presentation, /slide: Slide/);
  assert.doesNotMatch(presentation, /ThumbnailNavigator/);
  assert.doesNotMatch(presentation, /setCurrentSlideIndex/);
  assert.match(presentation, /currentCameraIndex < cameras\.length - 1/);
});
