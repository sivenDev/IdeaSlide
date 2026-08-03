import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('EditorLayout composes the real Workspace Explorer, document Tabs, and generic host', async () => {
  const source = await readSource('src/components/EditorLayout.tsx');
  assert.match(source, /from "\.\/WorkspaceExplorer"/);
  assert.match(source, /from "\.\/DocumentTabs"/);
  assert.match(source, /from "\.\/DocumentEditorHost"/);
  assert.match(source, /<WorkspaceExplorer/);
  assert.match(source, /<DocumentTabs/);
  assert.match(source, /<DocumentEditorHost/);
  assert.match(source, /side="left"/);
  assert.doesNotMatch(source, /ResourceEditorHost/);
  assert.doesNotMatch(source, /Agent/);
});

test('EditorLayout captures Save, Save As, and Save All shortcuts before an editor can consume them', async () => {
  const source = await readSource('src/components/EditorLayout.tsx');
  assert.match(source, /event\.key\.toLowerCase\(\) !== "s"/);
  assert.match(source, /event\.altKey/);
  assert.match(source, /event\.shiftKey/);
  assert.match(source, /window\.addEventListener\("keydown", handleKeyDown, true\)/);
});

test('App routes presentation exit through the application reducer refresh token', async () => {
  const app = await readSource('src/App.tsx');
  const reducer = await readSource('src/lib/appStoreReducer.ts');
  assert.match(app, /dispatch\(\{ type: "EXIT_PRESENTATION" \}\)/);
  assert.match(app, /onExit=\{handlePresentationExit\}/);
  assert.match(reducer, /editorRefreshToken: state\.editorRefreshToken \+ 1/);
});

test('Toolbar keeps generic file commands and centered IdeaNote document title', async () => {
  const source = await readSource('src/components/Toolbar.tsx');
  assert.match(source, /aria-label="New File"/);
  assert.match(source, /Open Workspace/);
  assert.match(source, /Open File/);
  assert.match(source, /aria-label="Save"/);
  assert.match(source, /Save As/);
  assert.match(source, /Save All/);
  assert.match(source, /idea-slide-window-toolbar__title/);
  assert.match(source, /fileName \|\| "IdeaNote"/);
  assert.doesNotMatch(source, /aria-label="Present"/);
  assert.doesNotMatch(source, /aria-label="Cameras"/);
});
