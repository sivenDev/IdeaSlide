import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Canvas presentation controls expose only the Cameras toggle and count', async () => {
  const source = await readSource('src/components/CanvasPresentationControls.tsx');

  assert.match(source, /Button as ExcalidrawButton/);
  assert.match(source, /idea-slide-canvas-controls/);
  assert.match(source, /idea-slide-canvas-control__label/);
  assert.match(source, /idea-slide-canvas-control__count/);
  assert.match(source, /aria-pressed=\{isCameraListOpen\}/);
  assert.doesNotMatch(source, /DropdownMenu/);
  assert.doesNotMatch(source, /aria-label="Present"/);
  assert.doesNotMatch(source, /onStartPreview/);
  assert.doesNotMatch(source, /onStartFullscreen/);
  assert.doesNotMatch(source, /controlClassName/);
});

test('Canvas presentation controls keep scoped no-wrap responsive styling without obsolete Present rules', async () => {
  const source = await readSource('src/index.css');

  assert.match(source, /\.idea-slide-canvas-controls/);
  assert.match(source, /white-space:\s*nowrap/);
  assert.match(source, /@media \(max-width:\s*1400px\)/);
  assert.doesNotMatch(source, /idea-slide-canvas-controls__divider/);
  assert.doesNotMatch(source, /idea-slide-canvas-control--present/);
});

test('SlideCanvas renders contextual controls and consumes each Add Camera request token once', async () => {
  const source = await readSource('src/components/SlideCanvas.tsx');

  assert.match(source, /from "\.\/CanvasPresentationControls"/);
  assert.match(source, /cameraDrawingRequestToken/);
  assert.match(source, /lastCameraDrawingRequestTokenRef/);
  assert.match(source, /startCameraDrawing\(\)/);
  assert.match(source, /<CanvasPresentationControls/);
  assert.doesNotMatch(source, /onStartPreview=\{onStartPreview\}/);
  assert.doesNotMatch(source, /onStartFullscreen=\{onStartFullscreen\}/);
  assert.doesNotMatch(source, /Draw a camera rectangle/);
  assert.doesNotMatch(source, /Drawing\.\.\./);
});

test('global Toolbar contains workspace actions only and no presentation menu', async () => {
  const source = await readSource('src/components/Toolbar.tsx');

  assert.doesNotMatch(source, /aria-label="Present"/);
  assert.doesNotMatch(source, /onStartPreview/);
  assert.doesNotMatch(source, /onStartFullscreen/);
  assert.match(source, /Open Workspace/);
  assert.match(source, /Save All/);
});

test('App passes only the active IdeaSketch document Page into camera-only PresentationMode', async () => {
  const app = await readSource('src/App.tsx');
  const presentation = await readSource('src/components/PresentationMode.tsx');

  assert.match(app, /presentationSessionId/);
  assert.match(app, /model\?\.type === "ideasketch"/);
  assert.match(app, /<PresentationMode[\s\S]*slide=\{model\.pages\[0\]\}/);
  assert.doesNotMatch(app, /projectWorkspaceToSlides/);

  assert.match(presentation, /slide: Slide/);
  assert.doesNotMatch(presentation, /ThumbnailNavigator/);
  assert.doesNotMatch(presentation, /setCurrentSlideIndex/);
  assert.match(presentation, /currentCameraIndex < cameras\.length - 1/);
  assert.match(presentation, /if \(!hasCameras\) \{[\s\S]*return baseAppState/);
  assert.match(presentation, /\{hasCameras && \([\s\S]*role="status"/);
});
