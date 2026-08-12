import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('production opens directly into one Workspaces, editor, and Agent lifecycle', async () => {
  const app = await readSource('src/App.tsx');
  const editor = await readSource('src/components/EditorLayout.tsx');
  const ideaSketchEditor = await readSource('src/components/IdeaSketchEditor.tsx');
  assert.match(app, /<EditorLayout/);
  assert.doesNotMatch(app, /LaunchScreen|state\.mode === "launch"/);
  assert.match(editor, /from "\.\/WorkspaceSidebar"/);
  assert.match(editor, /from "\.\/DocumentEditorHost"/);
  assert.match(editor, /from "\.\/RightSidebarHost"/);
  assert.match(editor, /<WorkspaceSidebar/);
  assert.match(editor, /<DocumentEditorHost/);
  assert.match(editor, /<RightSidebarHost/);
  assert.doesNotMatch(editor, /<Toolbar|onGoHome|GO_HOME/);
  assert.doesNotMatch(ideaSketchEditor, /<AgentPanel|<RightSidebarHost/);
  await assert.rejects(access(new URL('../src/components/LaunchScreen.tsx', import.meta.url)));
  await assert.rejects(access(new URL('../src/components/Toolbar.tsx', import.meta.url)));
});

test('EditorLayout captures Commands, Settings, Save, and Save As before editors consume them', async () => {
  const source = await readSource('src/components/EditorLayout.tsx');
  assert.match(source, /event\.key\.toLowerCase\(\) === "k"/);
  assert.match(source, /event\.key === ","/);
  assert.match(source, /event\.key\.toLowerCase\(\) !== "s"/);
  assert.match(source, /event\.shiftKey/);
  assert.match(source, /window\.addEventListener\("keydown", handleKeyDown, true\)/);
  assert.match(source, /<CommandPalette/);
});

test('system file-open requests are coordinated by the persistent EditorLayout', async () => {
  const app = await readSource('src/App.tsx');
  const editor = await readSource('src/components/EditorLayout.tsx');
  assert.match(app, /pendingStandalonePath/);
  assert.match(app, /requestStandalonePath/);
  assert.match(app, /pendingStandalonePath=\{pendingStandalonePath\}/);
  assert.doesNotMatch(app, /latestMode|mode === "launch"/);
  assert.match(editor, /if \(!await confirmSessionExitRef\.current\(\)\) return/);
  assert.match(editor, /openStandaloneDocument\(pendingStandalonePath\)/);
});

test('document crown contains status-close identity and no visible save or revision chrome', async () => {
  const crown = await readSource('src/components/WorkbenchCrown.tsx');
  const editor = await readSource('src/components/EditorLayout.tsx');
  assert.match(crown, /ideanote-document-status-close/);
  assert.match(crown, /Close \$\{document\.displayName\}/);
  assert.match(crown, /document\.isDirty/);
  assert.match(crown, /isSaving/);
  assert.doesNotMatch(crown, /\bSave\b|revision/);
  assert.match(editor, /<WorkbenchCrown/);
  assert.doesNotMatch(editor, /aria-label="Save"/);
});

test('Workspace restore control keeps crown geometry mounted through the panel transition', async () => {
  const crown = await readSource('src/components/WorkbenchCrown.tsx');
  const styles = await readSource('src/index.css');

  assert.doesNotMatch(crown, /!workspaceOpen && \(/);
  assert.match(crown, /aria-hidden=\{workspaceOpen\}/);
  assert.match(crown, /disabled=\{workspaceOpen\}/);
  assert.match(crown, /is-workspace[^`"]*\$\{workspaceOpen \? "is-hidden" : "is-visible"\}/);
  assert.match(styles, /--workspaces-motion-duration:\s*190ms/);
  assert.match(styles, /--workspaces-motion-easing:\s*cubic-bezier\(\.2,\s*\.8,\s*\.2,\s*1\)/);
  assert.match(styles, /\.ideanote-crown-action\.is-workspace[\s\S]*?position:\s*absolute[\s\S]*?transition:[\s\S]*?opacity calc\(var\(--workspaces-motion-duration\) \* \.72\) ease-out/);
  assert.match(styles, /\.ideanote-crown-action\.is-workspace\.is-hidden[\s\S]*?opacity:\s*0[\s\S]*?pointer-events:\s*none/);
  assert.match(styles, /\.ideanote-workbench-crown\.without-workspace\s*\{\s*padding-left:\s*53px/);
  assert.match(styles, /\.ideanote-workbench-crown\.without-workspace\.is-macos\.is-windowed\s*\{\s*padding-left:\s*122px/);
  assert.match(styles, /\.ideanote-workbench-crown\.without-workspace\.is-fullscreen\s*\{\s*padding-left:\s*50px/);
});

test('Agent restore is context-gated and open Agent closes from its own header', async () => {
  const crown = await readSource('src/components/WorkbenchCrown.tsx');
  const editor = await readSource('src/components/EditorLayout.tsx');
  const header = await readSource('src/components/agent/AgentThreadHeader.tsx');
  assert.match(crown, /agentAvailable && !agentOpen/);
  assert.match(crown, /aria-label="Show Agent"/);
  assert.match(editor, /agentAvailable && showAgent/);
  assert.match(header, /aria-label="Hide Agent"/);
});

test('native crown reserves real macOS and Windows control footprints and releases them fullscreen', async () => {
  const hook = await readSource('src/hooks/useNativeWindowFrame.ts');
  const sidebar = await readSource('src/components/WorkspaceSidebar.tsx');
  const styles = await readSource('src/index.css');
  const config = JSON.parse(await readSource('src-tauri/tauri.conf.json'));
  assert.match(hook, /\.isFullscreen\(\)/);
  assert.match(hook, /\.onResized\(/);
  assert.match(sidebar, /className=\{`ideanote-workspace-crown \$\{frame\.className\}`\}/);
  assert.match(styles, /\.ideanote-workspace-crown\.is-macos\.is-windowed\s*\{[\s\S]*?padding-left:\s*82px/);
  assert.match(styles, /\.ideanote-workspace-crown\.is-fullscreen\s*\{[\s\S]*?padding-left:\s*10px/);
  assert.match(styles, /\.ideanote-workbench-crown\.without-workspace\.is-fullscreen\s*\{[\s\S]*?padding-left:\s*50px/);
  assert.match(styles, /\.ideanote-workbench-crown\.is-windows\.is-windowed\s*\{[\s\S]*?padding-right:\s*142px/);
  assert.match(styles, /\.ideanote-workbench-crown\s*\{[\s\S]*?transition:[\s\S]*?padding-left var\(--workspaces-motion-duration\) var\(--workspaces-motion-easing\)/);
  assert.equal(config.app.windows[0].titleBarStyle, 'Overlay');
  assert.equal(config.app.windows[0].trafficLightPosition.x, 13);
  assert.equal(config.app.windows[0].trafficLightPosition.y, 26);
});

test('presentation exit and native window bounds remain production-owned', async () => {
  const app = await readSource('src/App.tsx');
  const reducer = await readSource('src/lib/appStoreReducer.ts');
  const config = JSON.parse(await readSource('src-tauri/tauri.conf.json'));
  assert.match(app, /dispatch\(\{ type: "EXIT_PRESENTATION" \}\)/);
  assert.match(reducer, /editorRefreshToken: state\.editorRefreshToken \+ 1/);
  assert.equal(config.app.windows[0].width, 1440);
  assert.equal(config.app.windows[0].height, 875);
  assert.equal(config.app.windows[0].minWidth, 850);
  assert.equal(config.app.windows[0].minHeight, 850);
});
