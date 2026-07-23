import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('EditorLayout composes the workspace, resource editor, and cameras as a three-pane shell', async () => {
  const source = await readSource('src/components/EditorLayout.tsx');
  assert.match(source, /from "\.\/WorkspaceExplorer"/);
  assert.match(source, /from "\.\/ResourceEditorHost"/);
  assert.match(source, /from "\.\/CameraList"/);
  assert.match(source, /from "\.\/ResizableDivider"/);
  assert.match(source, /<WorkspaceExplorer/);
  assert.match(source, /<ResourceEditorHost/);
  assert.match(source, /<CameraList/);
  assert.match(source, /side="left"/);
  assert.match(source, /side="right"/);
  assert.doesNotMatch(source, /useSlideThumbnails/);
  assert.doesNotMatch(source, /useCameraThumbnails/);
  assert.doesNotMatch(source, /w-\[280px\]/);
});

test('EditorLayout captures all save shortcuts before Excalidraw can export native files', async () => {
  const source = await readSource('src/components/EditorLayout.tsx');
  assert.match(source, /event\.key\.toLowerCase\(\) === "s"/);
  assert.match(source, /window\.addEventListener\("keydown", handleKeyDown, true\)/);
  assert.match(source, /window\.removeEventListener\("keydown", handleKeyDown, true\)/);
});

test('App increments an editor refresh token when presentation mode exits', async () => {
  const source = await readSource('src/App.tsx');
  assert.match(source, /const \[editorRefreshToken, setEditorRefreshToken\] = useState\(0\)/);
  assert.match(source, /dispatch\(\{ type: ['"]EXIT_PRESENTATION['"] \}\)/);
  assert.match(source, /setEditorRefreshToken\(\(value\) => value \+ 1\)/);
  assert.match(source, /onExit=\{handlePresentationExit\}/);
});

test('EditorLayout forwards the presentation-exit refresh token through ResourceEditorHost', async () => {
  const source = await readSource('src/components/EditorLayout.tsx');
  const host = await readSource('src/components/ResourceEditorHost.tsx');
  assert.match(source, /<ResourceEditorHost[\s\S]*editorRefreshToken=\{editorRefreshToken\}/);
  assert.match(host, /<SlideCanvas[\s\S]*editorRefreshToken=\{editorRefreshToken\}/);
});

test('Toolbar keeps workspace file actions but no presentation, slide, or cameras organizers', async () => {
  const source = await readSource('src/components/Toolbar.tsx');
  assert.match(source, /aria-label="New workspace"/);
  assert.match(source, /aria-label="Open workspace"/);
  assert.doesNotMatch(source, /aria-label="Present"/);
  assert.doesNotMatch(source, /aria-label="Slide"/);
  assert.doesNotMatch(source, /aria-label="Cameras"/);
  assert.doesNotMatch(source, /Add Slide/);
  assert.doesNotMatch(source, /Delete slide/);
});
