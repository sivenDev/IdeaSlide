import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const { appStoreReducer, createInitialAppState } = await import('../src/lib/appStoreReducer.ts');

test('application starts directly in the empty production shell without Home routing', async () => {
  const app = await readSource('src/App.tsx');
  const types = await readSource('src/types.ts');
  const reducer = await readSource('src/lib/appStoreReducer.ts');
  const toolbar = await readSource('src/components/Toolbar.tsx');

  assert.equal(createInitialAppState().mode, 'empty');
  assert.match(app, /<EditorLayout/);
  assert.doesNotMatch(app, /LaunchScreen|mode === "launch"/);
  assert.match(types, /"empty" \| "workspace" \| "standalone"/);
  assert.match(reducer, /case "RESET_SESSION"/);
  assert.doesNotMatch(reducer, /GO_HOME|mode: "launch"/);
  assert.doesNotMatch(toolbar, /Back to Home|House|onGoHome/);
});

test('Workspace shell preserves start actions, recents, Settings, and a persistent command rail', async () => {
  const sidebar = await readSource('src/components/WorkspaceSidebar.tsx');
  const start = await readSource('src/components/WorkspaceStart.tsx');

  assert.match(sidebar, /ideanote-workspace-rail/);
  assert.match(sidebar, /mode !== "empty"/);
  assert.match(sidebar, /onResetSession/);
  assert.match(start, /New IdeaSketch/);
  assert.match(start, /New Markdown/);
  assert.match(start, /Open Workspace/);
  assert.match(start, /Open File/);
  assert.match(start, /getRecentWorkspaces\(\)/);
  assert.match(start, /getRecentFiles\(\)/);
  assert.match(start, /removeRecentWorkspace/);
  assert.match(start, /removeRecentFile/);
  assert.match(start, /Open Settings/);
});

test('closing the final standalone document and resetting a session return to empty state', () => {
  const standalone = {
    ...createInitialAppState(),
    mode: 'standalone',
    documents: [{ id: 'one', mode: 'standalone', filePath: '/one.md', fileType: 'markdown', status: 'editable', isDirty: false, revision: 0 }],
    activeSessionId: 'one',
  };
  assert.equal(appStoreReducer(standalone, { type: 'CLOSE_DOCUMENT', sessionId: 'one' }).mode, 'empty');
  assert.deepEqual(appStoreReducer(standalone, { type: 'RESET_SESSION' }), createInitialAppState());
});
