import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

test('native frame follows real fullscreen resize state without mock platform flags', async () => {
  const source = await readFile(new URL('../src/hooks/useNativeWindowFrame.ts', import.meta.url), 'utf8');
  const config = await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8');
  assert.match(source, /getCurrentWindow/);
  assert.match(source, /isFullscreen/);
  assert.match(source, /onResized/);
  assert.doesNotMatch(source, /onFocusChanged|isFocused|focused/);
  assert.match(source, /window\.addEventListener\("resize", refresh\)/);
  assert.match(source, /window\.removeEventListener\("resize", refresh\)/);
  assert.match(source, /refreshRequest/);
  assert.match(source, /return "macos"/);
  assert.match(source, /return "windows"/);
  assert.match(source, /className: `is-\$\{platform\}/);
  assert.doesNotMatch(source, /MockWindowApi|query|review scenario/i);
  assert.match(config, /"titleBarStyle": "Overlay"/);
  assert.match(config, /"trafficLightPosition": \{\s*"x": 13,\s*"y": 26\s*\}/);
});

test('macOS traffic lights remain native so the system owns inactive appearance', async () => {
  const workspace = await readFile(new URL('../src/components/WorkspaceSidebar.tsx', import.meta.url), 'utf8');
  const crown = await readFile(new URL('../src/components/WorkbenchCrown.tsx', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  const config = JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
  await assert.rejects(access(new URL('../src/components/NativeWindowControls.tsx', import.meta.url)));
  assert.doesNotMatch(workspace, /NativeWindowControls|native-traffic-lights/);
  assert.doesNotMatch(crown, /NativeWindowControls|native-traffic-lights/);
  assert.doesNotMatch(styles, /ideanote-native-traffic-lights/);
  assert.equal(config.app.windows[0].decorations, true);
  assert.equal(config.app.windows[0].titleBarStyle, 'Overlay');
});
