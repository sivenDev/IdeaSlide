import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('SlideCanvas keeps camera badge sync out of the persisted onChange fast path', async () => {
  const source = await readSource('src/components/SlideCanvas.tsx');

  assert.match(source, /const stableOnChange = useRef\(/);
  assert.match(source, /onChangeRef\.current\(els, state, sceneFiles \|\| \{\}\);/);
  assert.doesNotMatch(source, /syncCameraBadgesRef\.current\(els, state\);\s*onChangeRef\.current\(els, state, sceneFiles \|\| \{\}\);/);
});

test('SlideCanvas enables image export while native scene saves stay in IdeaSlide', async () => {
  const source = await readSource('src/components/SlideCanvas.tsx');

  assert.match(source, /saveAsImage:\s*true/);
  assert.match(source, /<MainMenu\.DefaultItems\.SaveAsImage\s*\/>/);
  assert.match(source, /export:\s*\{\s*saveFileToDisk:\s*false,\s*\}/);
  assert.match(source, /saveToActiveFile:\s*false/);
  assert.match(source, /saveToActiveFile:\s*false,\s*saveFileToDisk:\s*false/s);
  assert.match(source, />\s*Export as draw\.io\s*</);
  assert.match(source, /getSceneElements\(\)/);
  assert.match(source, /getFiles\(\)/);
});

test('SlideCanvas refreshes Excalidraw after presentation exit layout changes settle', async () => {
  const source = await readSource('src/components/SlideCanvas.tsx');

  assert.match(source, /editorRefreshToken: number;/);
  assert.match(source, /const refreshEditorCanvas = \(\) => \{\s*api\.refresh\(\);/);
  assert.match(source, /requestAnimationFrame\(\(\) => \{\s*refreshFrameId = requestAnimationFrame\(refreshEditorCanvas\);/);
  assert.match(source, /window\.setTimeout\(refreshEditorCanvas, 120\)/);
  assert.match(source, /cancelAnimationFrame\(firstFrameId\)/);
  assert.match(source, /cancelAnimationFrame\(refreshFrameId\)/);
  assert.match(source, /window\.clearTimeout\(timeoutId\)/);
});

test('PresentationMode applies the first camera viewport immediately before animating later camera changes', async () => {
  const source = await readSource('src/components/PresentationMode.tsx');

  assert.match(source, /const hasAppliedInitialCameraViewportRef = useRef\(false\);/);
  assert.match(source, /hasAppliedInitialCameraViewportRef\.current = false;/);
  assert.match(source, /if \(!hasAppliedInitialCameraViewportRef\.current\) \{/);
  assert.match(source, /api\.updateScene\(\{\s*appState: \{\s*scrollX: target\.scrollX,/s);
  assert.match(source, /animator\.animateTo\(target, \{/);
});

test('camera thumbnails build a snapshot-backed render request and parse SVGs once per completed render', async () => {
  const hookSource = await readSource('src/hooks/useCameraThumbnails.ts');
  const navigatorSource = await readSource('src/components/CameraNavigator.tsx');

  assert.match(hookSource, /export interface CameraPreviewSnapshot \{/);
  assert.match(hookSource, /snapshot: CameraPreviewSnapshot \| null;/);
  assert.match(hookSource, /const snapshotRef = useRef<CameraPreviewSnapshot \| null>\(snapshot\);/);
  assert.match(hookSource, /const renderKey = snapshot[\s\S]*buildCameraPreviewKey\(\{[\s\S]*sceneFingerprint: snapshot\.sceneFingerprint,[\s\S]*cameraSignature: snapshot\.cameraSignature,[\s\S]*background: snapshot\.background,[\s\S]*\}\)[\s\S]*: null;/);
  assert.match(hookSource, /useEffect\([\s\S]*\}, \[debounceMs, enabled, renderKey\]\);/);
  assert.match(hookSource, /buildCameraPreviewKey\(\{[\s\S]*sceneFingerprint: snapshot\.sceneFingerprint,[\s\S]*cameraSignature: snapshot\.cameraSignature,[\s\S]*background: snapshot\.background,[\s\S]*\}\)/);
  assert.match(hookSource, /const svgElement = parseSvgMarkup\(svgMarkup\);/);
  assert.match(hookSource, /next\.set\(camera\.id, svgElement\);/);

  assert.match(navigatorSource, /const previewAppState = useMemo\(/);
  assert.match(navigatorSource, /extractPreviewAppState\(appState\)/);
  assert.match(navigatorSource, /const previewState = buildLiveCameraPreviewState\(elements, files, cameras, appState\);/);
  assert.match(navigatorSource, /cameraSignature: buildCameraCollectionSignature\(cameras\)/);
  assert.match(navigatorSource, /sceneFingerprint: previewState\.sceneFingerprint/);
  assert.match(navigatorSource, /const thumbnails = useCameraThumbnails\(\{ snapshot, debounceMs: 0, enabled: true \}\);/);
});
