import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readPresentationSource = () => readFile(
  new URL('../src/components/PresentationMode.tsx', import.meta.url),
  'utf8',
);

test('presentation starts at Camera 1 and preserves the saved viewport without Cameras', async () => {
  const source = await readPresentationSource();

  assert.match(source, /const \[currentCameraIndex, setCurrentCameraIndex\] = useState\(0\)/);
  assert.match(source, /const camera = cameras\[currentCameraIndex\]/);
  assert.match(source, /if \(!hasAppliedInitialCameraViewportRef\.current\) \{[\s\S]*?api\.updateScene\(\{[\s\S]*?scrollX: target\.scrollX,[\s\S]*?scrollY: target\.scrollY,[\s\S]*?zoom: \{ value: target\.zoom \}/);
  assert.match(source, /if \(!hasCameras\) \{\s*return baseAppState;\s*\}/);
});

test('Preview owns a non-persistent laser pointer while Fullscreen keeps the normal cursor', async () => {
  const source = await readPresentationSource();
  const pointerHandler = source.match(
    /const handlePreviewPointerMove = useCallback\([\s\S]*?\}, \[mode\]\);/,
  )?.[0] ?? '';

  assert.match(source, /const \[laserPoint, setLaserPoint\] = useState/);
  assert.match(pointerHandler, /mode !== ['"]preview['"]/);
  assert.match(pointerHandler, /event\.pointerType && event\.pointerType !== ['"]mouse['"]/);
  assert.match(pointerHandler, /event\.currentTarget\.getBoundingClientRect\(\)/);
  assert.match(pointerHandler, /setLaserPoint\(/);
  assert.doesNotMatch(pointerHandler, /updateScene|setActiveTool|onChange/);
  assert.match(source, /onPointerMove=\{handlePreviewPointerMove\}/);
  assert.match(source, /onPointerLeave=\{clearPreviewPointer\}/);
  assert.match(source, /cursor: mode === ['"]preview['"] \? ['"]none['"] : undefined/);
  assert.match(source, /mode === ['"]preview['"] && laserPoint/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /idea-slide-presentation-laser/);
  assert.match(source, /pointer-events-none/);
});
