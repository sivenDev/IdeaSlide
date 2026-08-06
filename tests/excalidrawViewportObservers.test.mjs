import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Camera badge viewport projection operates on cached Cameras instead of scene elements', async () => {
  const { projectCameraBadges } = await import('../src/lib/cameraBadges.ts');
  const cameras = [{
    id: 'camera-1',
    order: 2,
    bounds: { x: 100, y: 50, width: 400, height: 300 },
    strokeColor: '#ff0000',
  }];

  assert.deepEqual(
    projectCameraBadges(
      cameras,
      { scrollX: 20, scrollY: -10, zoom: 2, offsetLeft: 80, offsetTop: 40 },
      { left: 30, top: 10 },
    ),
    [{
      id: 'camera-1',
      order: 2,
      left: 290,
      top: 110,
      strokeColor: '#ff0000',
    }],
  );
});

test('Camera badges subscribe in an isolated overlay and scroll updates do not fetch scene elements', async () => {
  const slideCanvas = await readSource('src/components/SlideCanvas.tsx');
  const overlay = await readSource('src/components/CameraBadgeOverlay.tsx');
  const scrollSubscription = overlay.match(/const unsubscribeScroll = api\.onScrollChange\([\s\S]*?\n\s*\);/)?.[0] ?? '';

  assert.match(slideCanvas, /<CameraBadgeOverlay/);
  assert.doesNotMatch(slideCanvas, /const \[cameraBadges, setCameraBadges\]/);
  assert.match(overlay, /const \[badges, setBadges\] = useState/);
  assert.match(overlay, /sceneElementsRef\.current !== nextElements/);
  assert.match(overlay, /camerasRef\.current = extractCameras\(nextElements\)/);
  assert.match(scrollSubscription, /scrollX: number, scrollY: number/);
  assert.match(scrollSubscription, /scheduleProjection\(\)/);
  assert.doesNotMatch(scrollSubscription, /getSceneElements/);
  assert.match(overlay, /requestAnimationFrame\(project\)/);
});

test('Camera drawing preview uses explicit activity instead of scanning every scene emission', async () => {
  const source = await readSource('src/components/SlideCanvas.tsx');
  const stableOnChange = source.match(/const stableOnChange = useRef\([\s\S]*?\n\s*\}\)\.current;/)?.[0] ?? '';

  assert.match(source, /const cameraPreviewActiveRef = useRef\(false\);/);
  assert.match(stableOnChange, /if \(cameraPreviewActiveRef\.current\) \{/);
  assert.doesNotMatch(stableOnChange, /\.some\(/);
  assert.match(source, /cameraPreviewActiveRef\.current = true;\s*api\.updateScene\(\{\s*elements: \[\.\.\.currentElements, previewElement\]/s);
  assert.match(source, /cameraPreviewActiveRef\.current = false;\s*api\.updateScene\(/s);
});

test('Unmounted Page canvases reject delayed Excalidraw change emissions', async () => {
  const source = await readSource('src/components/SlideCanvas.tsx');
  const stableOnChange = source.match(/const stableOnChange = useRef\([\s\S]*?\n\s*\}\)\.current;/)?.[0] ?? '';

  assert.match(source, /const isMountedRef = useRef\(true\);/);
  assert.match(source, /isMountedRef\.current = false;/);
  assert.match(stableOnChange, /if \(!isMountedRef\.current\) \{/);
});

test('Selection availability is keyed by scene identity and selected IDs', async () => {
  const { buildSelectedElementIdsSignature } = await import('../src/lib/excalidrawStyleConversion.ts');
  const source = await readSource('src/components/SlideCanvas.tsx');

  assert.equal(
    buildSelectedElementIdsSignature({ beta: true, ignored: false, alpha: true }),
    'alpha|beta',
  );
  assert.match(source, /const selectionObservationRef = useRef\(/);
  assert.match(source, /previousObservation\.elements === nextObservation\.elements/);
  assert.match(source, /previousObservation\.selectedIdsSignature === nextObservation\.selectedIdsSignature/);
  assert.match(source, /previousObservation\.readOnly === nextObservation\.readOnly/);
});

test('Custom Excalidraw menu and selection renderer keep stable callback identities', async () => {
  const source = await readSource('src/components/SlideCanvas.tsx');

  assert.match(source, /const mainMenu = useMemo\(\(\) => \(/);
  assert.match(source, /const renderSelectionActions = useCallback\(/);
  assert.match(source, /renderTopRightUI=\{!viewMode && canConvertSelection && onConvertSelection\s*\? renderSelectionActions/s);
});

test('Canvas interaction reporting is edge-triggered and idles after scroll or wheel bursts', async () => {
  const source = await readSource('src/components/SlideCanvas.tsx');

  assert.match(source, /const interactionActiveRef = useRef\(false\);/);
  assert.match(source, /if \(interactionActiveRef\.current\) return;/);
  assert.match(source, /onInteractionChangeRef\.current\?\.\(true\)/);
  assert.match(source, /window\.setTimeout\(\(\) => \{[\s\S]*?onInteractionChangeRef\.current\?\.\(false\);[\s\S]*?\}, 180\)/);
  assert.match(source, /api\.onScrollChange\(\(\) => \{\s*pulseCanvasInteraction\(\);/);
  assert.match(source, /onPointerDownCapture=\{beginCanvasInteraction\}/);
  assert.match(source, /onWheelCapture=\{pulseCanvasInteraction\}/);
});
