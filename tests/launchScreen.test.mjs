import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

test('Home is removed and the empty editor renders the product Welcome surface', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const welcome = await readFile(new URL('../src/components/WorkbenchWelcome.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /LaunchScreen|mode === "launch"/);
  assert.match(app, /<EditorLayout/);
  assert.match(welcome, />Welcome</);
  assert.match(welcome, />Open File</);
  assert.match(welcome, />New File</);
  assert.doesNotMatch(welcome, />Open Workspace</);
  assert.doesNotMatch(welcome, /Settings/);
  assert.doesNotMatch(welcome, /AI-Powered|Agent Panel|mock/i);
  await assert.rejects(access(new URL('../src/components/LaunchScreen.tsx', import.meta.url)));
});

test('Workspaces and standalone Recents replace Home recent tabs', async () => {
  const sidebar = await readFile(new URL('../src/components/WorkspaceSidebar.tsx', import.meta.url), 'utf8');
  const editor = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');
  assert.match(sidebar, />Workspaces</);
  assert.match(sidebar, />Recents</);
  assert.doesNotMatch(sidebar, /Recent Workspaces|TabsTrigger/);
  assert.match(editor, /getRecentWorkspaces/);
  assert.match(editor, /getRecentFiles/);
  assert.match(editor, /handleOpenWorkspace\(path\)/);
  assert.match(editor, /handleOpenRecent\(path\)/);
});
