import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Canvas custom controls expose Navigator and Add camera tools', async () => {
  const source = await readSource('src/components/CanvasPresentationControls.tsx');

  assert.match(source, /Button as ExcalidrawButton/);
  assert.match(source, /idea-slide-canvas-controls/);
  assert.match(source, /aria-label=\{navigatorTooltip\}/);
  assert.match(source, /aria-pressed=\{isNavigatorOpen\}/);
  assert.match(source, /aria-label="Add camera"/);
  assert.match(source, /disabled=\{!onAddCamera\}/);
  assert.match(source, /onToggleNavigator/);
  assert.match(source, /onAddCamera/);
  assert.doesNotMatch(source, /cameraCount/);
  assert.doesNotMatch(source, />Cameras</);
  assert.doesNotMatch(source, /DropdownMenu/);
  assert.doesNotMatch(source, /aria-label="Present"/);
  assert.doesNotMatch(source, /onStartPreview/);
  assert.doesNotMatch(source, /onStartFullscreen/);
  assert.doesNotMatch(source, /controlClassName/);
});

test('Canvas custom controls keep compact toolbar-aligned styling without obsolete count rules', async () => {
  const source = await readSource('src/index.css');

  assert.match(source, /\.idea-slide-canvas-controls/);
  assert.match(source, /white-space:\s*nowrap/);
  assert.match(source, /layer-ui__wrapper__top-right/);
  assert.doesNotMatch(source, /idea-slide-canvas-controls__divider/);
  assert.doesNotMatch(source, /idea-slide-canvas-control--present/);
  assert.doesNotMatch(source, /idea-slide-canvas-control__count/);
});

test('SlideCanvas renders contextual controls and consumes each Add Camera request token once', async () => {
  const source = await readSource('src/components/SlideCanvas.tsx');

  assert.match(source, /from "\.\/CanvasPresentationControls"/);
  assert.match(source, /cameraDrawingRequestToken/);
  assert.match(source, /lastCameraDrawingRequestTokenRef/);
  assert.match(source, /startCameraDrawing\(\)/);
  assert.match(source, /<CanvasPresentationControls/);
  assert.match(source, /isNavigatorOpen=/);
  assert.match(source, /onToggleNavigator=/);
  assert.match(source, /onAddCamera=/);
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

test('App presents the frozen originating IdeaSketch Page snapshot', async () => {
  const app = await readSource('src/App.tsx');
  const presentation = await readSource('src/components/PresentationMode.tsx');

  assert.match(app, /presentationSessionId/);
  assert.match(app, /presentationPageId/);
  assert.match(app, /<PresentationMode[\s\S]*slide=\{state\.presentationPage\}/);
  assert.doesNotMatch(app, /model\.pages\[0\]/);
  assert.doesNotMatch(app, /projectWorkspaceToSlides/);

  assert.match(presentation, /slide: Slide/);
  assert.doesNotMatch(presentation, /ThumbnailNavigator/);
  assert.doesNotMatch(presentation, /setCurrentSlideIndex/);
  assert.match(presentation, /currentCameraIndex < cameras\.length - 1/);
  assert.match(presentation, /if \(!hasCameras\) \{[\s\S]*return baseAppState/);
  assert.match(presentation, /\{hasCameras && \([\s\S]*role="status"/);
});
