import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readPresentationSource = () => readFile(
  new URL('../src/components/PresentationMode.tsx', import.meta.url),
  'utf8',
);
const readPresentationStyles = () => readFile(
  new URL('../src/index.css', import.meta.url),
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
    /const handlePreviewPointerMove = useCallback\([\s\S]*?\}, \[mode, laserEnabled, animatePreviewLaser\]\);/,
  )?.[0] ?? '';

  assert.match(source, /const laserTargetRef = useRef<LaserPoint \| null>\(null\)/);
  assert.match(pointerHandler, /mode !== ['"]preview['"][\s\S]*?\|\| !laserEnabled/);
  assert.match(pointerHandler, /event\.pointerType && event\.pointerType !== ['"]mouse['"]/);
  assert.match(pointerHandler, /event\.currentTarget\.getBoundingClientRect\(\)/);
  assert.match(pointerHandler, /getCoalescedEvents/);
  assert.match(pointerHandler, /laserTargetRef\.current = point/);
  assert.doesNotMatch(pointerHandler, /setLaserPoint|setLaserTrail|updateScene|setActiveTool|onChange/);
  assert.match(source, /onPointerMove=\{handlePreviewPointerMove\}/);
  assert.match(source, /onPointerLeave=\{clearPreviewPointer\}/);
  assert.match(source, /cursor: mode === ['"]preview['"] && laserEnabled \? ['"]none['"] : undefined/);
  assert.match(source, /mode === ['"]preview['"] && laserEnabled && \(\s*<canvas/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /idea-slide-presentation-laser__canvas/);
  assert.match(source, /pointer-events-none/);
});

test('Preview renders a fixed-spacing, time-fading Canvas path and hides only its Excalidraw menu trigger', async () => {
  const source = await readPresentationSource();
  const styles = await readPresentationStyles();
  const pointerHandler = source.match(
    /const handlePreviewPointerMove = useCallback\([\s\S]*?\}, \[mode, laserEnabled, animatePreviewLaser\]\);/,
  )?.[0] ?? '';
  const clearHandler = source.match(
    /const clearPreviewPointer = useCallback\([\s\S]*?\}, \[\]\);/,
  )?.[0] ?? '';

  assert.match(source, /const LASER_TRAIL_LIFETIME_MS = 700/);
  assert.match(source, /const LASER_TRAIL_POINT_SPACING = 5/);
  assert.match(source, /const LASER_TRAIL_MAX_POINTS = 180/);
  assert.match(source, /const laserCanvasRef = useRef<HTMLCanvasElement>\(null\)/);
  assert.match(source, /const laserTrailRef = useRef<LaserTrailPoint\[]>\(\[\]\)/);
  assert.match(source, /const laserLastTrailPointRef = useRef<LaserTrailPoint \| null>\(null\)/);
  assert.match(source, /const laserAnimationFrameRef = useRef<number \| null>\(null\)/);
  assert.match(source, /Math\.floor\(distance \/ LASER_TRAIL_POINT_SPACING\)/);
  assert.match(source, /trail\.splice\(0, trail\.length - LASER_TRAIL_MAX_POINTS\)/);
  assert.match(source, /Math\.hypot\(deltaX, deltaY\)/);
  assert.match(source, /now - point\.createdAt < LASER_TRAIL_LIFETIME_MS/);
  assert.match(source, /1 - \(now - point\.createdAt\) \/ LASER_TRAIL_LIFETIME_MS/);
  assert.match(pointerHandler, /const pointerEvents = coalescedEvents\.length > 0 \? coalescedEvents : \[nativeEvent\]/);
  assert.match(pointerHandler, /for \(const pointerEvent of pointerEvents\)/);
  assert.match(pointerHandler, /appendLaserTrailSample\(/);
  assert.match(source, /context\.lineTo\(/);
  assert.match(source, /context\.stroke\(\)/);
  assert.match(source, /context\.arc\([\s\S]*?6,/);
  assert.match(source, /requestAnimationFrame\(animatePreviewLaser\)/);
  assert.match(source, /cancelAnimationFrame\(laserAnimationFrameRef\.current\)/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(pointerHandler, /updateScene|setActiveTool|onChange/);
  assert.match(clearHandler, /laserTargetRef\.current = null/);
  assert.match(clearHandler, /laserTrailRef\.current = \[\]/);
  assert.match(clearHandler, /laserLastTrailPointRef\.current = null/);
  assert.match(clearHandler, /clearRect\(/);
  assert.doesNotMatch(source, /const \[laserTrail, setLaserTrail\] = useState/);
  assert.doesNotMatch(source, /LASER_TRAIL_FOLLOW_RATE|laserParticlesRef/);
  assert.doesNotMatch(source, /idea-slide-presentation-laser__trail/);
  assert.match(source, /idea-slide-presentation[^\n]*\$\{mode === ['"]preview['"] \? ['"]is-preview['"] : ['"]is-fullscreen['"]\}/);

  assert.match(styles, /\.idea-slide-presentation\.is-preview \.excalidraw \.main-menu-trigger\s*\{[\s\S]*?display:\s*none !important/i);
  assert.doesNotMatch(styles, /@keyframes idea-slide-presentation-laser-trail/);
});

test('Preview settings expose a default-on laser pointer toggle with immediate cleanup', async () => {
  const source = await readPresentationSource();

  assert.match(source, /const \[laserEnabled, setLaserEnabled\] = useState\(true\)/);
  assert.match(source, /mode === ['"]preview['"] && \([\s\S]*?Laser pointer[\s\S]*?type="checkbox"/);
  assert.match(source, /checked=\{laserEnabled\}/);
  assert.match(source, /onChange=\{\(event\) => setLaserEnabled\(event\.target\.checked\)\}/);
  assert.match(source, /mode !== ['"]preview['"] \|\| !laserEnabled \|\| showCameraNav \|\| showSettings/);
  assert.match(source, /\[mode, laserEnabled, showCameraNav, showSettings, clearPreviewPointer\]/);
});
