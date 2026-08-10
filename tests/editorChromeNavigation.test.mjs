import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('EditorLayout gives the center to one editor, Explorer to the left, and Agent to the right', async () => {
  const source = await readSource('src/components/EditorLayout.tsx');
  const ideaSketchEditor = await readSource('src/components/IdeaSketchEditor.tsx');
  assert.match(source, /from "\.\/WorkspaceExplorer"/);
  assert.match(source, /from "\.\/DocumentEditorHost"/);
  assert.match(source, /<WorkspaceExplorer/);
  assert.match(source, /<DocumentEditorHost/);
  assert.match(source, /flushActiveDocumentSnapshot\(\)/);
  assert.match(source, /const dirty = activeDocument\?\.isDirty \?\? false/);
  assert.doesNotMatch(source, /DocumentTabs/);
  assert.doesNotMatch(source, /ACTIVATE_DOCUMENT/);
  assert.doesNotMatch(source, /recentlyClosed/);
  assert.doesNotMatch(source, /REOPEN_LAST_DOCUMENT/);
  assert.doesNotMatch(source, /CloseOthers|CloseRight/);
  assert.match(source, /side="left"/);
  assert.doesNotMatch(source, /ResourceEditorHost/);
  assert.match(source, /from "\.\/RightSidebarHost"/);
  assert.match(source, /<\/main>\s*\{agentAvailable && \(/);
  assert.doesNotMatch(ideaSketchEditor, /<AgentPanel|<RightSidebarHost/);
});

test('EditorLayout captures Save and Save As shortcuts before an editor can consume them', async () => {
  const source = await readSource('src/components/EditorLayout.tsx');
  assert.match(source, /event\.key\.toLowerCase\(\) !== "s"/);
  assert.match(source, /event\.shiftKey/);
  assert.doesNotMatch(source, /event\.altKey/);
  assert.doesNotMatch(source, /handleSaveAll/);
  assert.match(source, /window\.addEventListener\("keydown", handleKeyDown, true\)/);
});

test('App routes presentation exit through the application reducer refresh token', async () => {
  const app = await readSource('src/App.tsx');
  const reducer = await readSource('src/lib/appStoreReducer.ts');
  assert.match(app, /dispatch\(\{ type: "EXIT_PRESENTATION" \}\)/);
  assert.match(app, /onExit=\{handlePresentationExit\}/);
  assert.match(reducer, /editorRefreshToken: state\.editorRefreshToken \+ 1/);
});

test('system file-open requests are coordinated by EditorLayout before replacing the foreground file', async () => {
  const app = await readSource('src/App.tsx');
  const editor = await readSource('src/components/EditorLayout.tsx');
  assert.match(app, /pendingStandalonePath/);
  assert.match(app, /requestStandalonePath/);
  assert.match(app, /pendingStandalonePath=\{pendingStandalonePath\}/);
  assert.match(app, /onPendingStandalonePathHandled/);
  assert.doesNotMatch(app, /listen<string>\("file-open"[\s\S]*?openStandalonePath\(event\.payload\)/);
  assert.match(editor, /if \(!await confirmSessionExit\(\)\) return/);
  assert.match(editor, /openStandaloneDocument\(pendingStandalonePath\)/);
});

test('Toolbar keeps generic file commands and centered IdeaNote document title', async () => {
  const source = await readSource('src/components/Toolbar.tsx');
  const saveIndicator = await readSource('src/components/SaveIndicator.tsx');
  const styles = await readSource('src/index.css');
  const editor = await readSource('src/components/EditorLayout.tsx');
  const launch = await readSource('src/components/LaunchScreen.tsx');
  const workspace = await readSource('src/components/WorkspaceExplorer.tsx');
  const saveOptions = source.match(/<DropdownMenu>[\s\S]*?tooltip="More Save options"[\s\S]*?<\/DropdownMenu>/)?.[0] ?? '';
  assert.match(source, /from "lucide-react"/);
  assert.match(source, /<House /);
  assert.doesNotMatch(source, /\bFilePlus2\b/);
  assert.match(source, /<FolderOpen /);
  assert.match(source, /<Save /);
  assert.match(source, /<ChevronDown /);
  assert.match(source, /<FileInput /);
  assert.match(source, /<FileOutput /);
  assert.doesNotMatch(source, /\bSaveAll\b/);
  assert.match(source, /<FilePenLine /);
  assert.doesNotMatch(source, /[⌂＋▱⌑⌄]/);
  assert.doesNotMatch(source, /aria-label="New File"/);
  assert.doesNotMatch(source, /\bonNewFile\b/);
  assert.doesNotMatch(editor, /\bhandleNewFile\b/);
  assert.doesNotMatch(editor, /onNewFile=/);
  assert.match(launch, /onNewFile\("ideasketch"\)/);
  assert.match(launch, /onNewFile\("markdown"\)/);
  assert.match(launch, />New File</);
  assert.match(workspace, /tooltip="New File" aria-label="New File"/);
  assert.match(source, /Open Workspace/);
  assert.match(source, /Open File/);
  assert.match(source, /aria-label="Save"/);
  assert.match(saveOptions, /Save As/);
  assert.doesNotMatch(saveOptions, /<DropdownMenuItem onSelect=\{onSave\}>/);
  assert.doesNotMatch(saveOptions, /Save All/);
  assert.doesNotMatch(source, /onSaveAll/);
  assert.match(source, /idea-slide-window-toolbar__title/);
  assert.match(source, /fileName \|\| "IdeaNote"/);
  assert.match(source, /fileType === "ideasketch"/);
  assert.doesNotMatch(source, /aria-label="Present"/);
  assert.doesNotMatch(source, /aria-label="Cameras"/);
  assert.match(saveIndicator, /isDirty \? "dirty" : "saved"/);
  assert.match(saveIndicator, /idea-slide-save-indicator is-\$\{state\}/);
  assert.match(styles, /--idea-slide-danger:\s*#c83f47/i);
  assert.match(styles, /\.idea-slide-save-indicator\.is-dirty \.idea-slide-save-indicator__dot\s*\{[\s\S]*?background:\s*var\(--idea-slide-danger\)/i);
  assert.match(styles, /\.idea-slide-save-indicator\.is-dirty \.idea-slide-save-indicator__dot\s*\{[\s\S]*?box-shadow:\s*0 0 0 3px rgb\(200 63 71 \/ 14%\)/i);
  assert.match(styles, /\.idea-slide-save-indicator\.is-dirty \.idea-slide-save-indicator__label\s*\{[\s\S]*?color:\s*var\(--idea-slide-danger\)/i);
  assert.match(styles, /\.idea-slide-save-indicator\.is-dirty \.idea-slide-save-indicator__label\s*\{[\s\S]*?font-weight:\s*600/);
});

test('Toolbar reserves the native macOS traffic-light footprint without drawing synthetic controls', async () => {
  const source = await readSource('src/components/Toolbar.tsx');
  const styles = await readSource('src/index.css');
  const config = JSON.parse(await readSource('src-tauri/tauri.conf.json'));
  const macToolbar = styles.match(/\.idea-slide-window-toolbar\.is-mac\s*\{[\s\S]*?\}/)?.[0] ?? '';

  assert.match(source, /import \{ useEffect, useState \} from "react"/);
  assert.match(source, /const isTauriRuntime = "__TAURI_INTERNALS__" in window/);
  assert.doesNotMatch(source, /\.isFocused\(\)|\.onFocusChanged\(/);
  assert.doesNotMatch(source, /idea-slide-window-toolbar__traffic-lights/);
  assert.doesNotMatch(styles, /\.idea-slide-window-toolbar__traffic-lights/);

  assert.match(styles, /\.idea-slide-window-toolbar\s*\{[\s\S]*?background:\s*#dedee3/i);
  assert.match(macToolbar, /padding-left:\s*5rem/i);
  assert.equal(config.app.windows[0].trafficLightPosition.x, 13);
  assert.equal(config.app.windows[0].trafficLightPosition.y, 26);
});

test('Toolbar releases native macOS and Windows control footprints while fullscreen is active', async () => {
  const source = await readSource('src/components/Toolbar.tsx');
  const styles = await readSource('src/index.css');
  const macFullscreenRule = styles.match(
    /\.idea-slide-window-toolbar\.is-mac\.is-fullscreen\s*\{[\s\S]*?\}/,
  )?.[0] ?? '';
  const windowsFullscreenRule = styles.match(
    /\.idea-slide-window-toolbar\.is-windows\.is-fullscreen\s*\{[\s\S]*?\}/,
  )?.[0] ?? '';
  const nonMacRule = styles.match(
    /\.idea-slide-window-toolbar\.is-non-mac\s*\{[\s\S]*?\}/,
  )?.[0] ?? '';

  assert.match(source, /const isWindows = \/Windows\/\.test\(navigator\.userAgent\)/);
  assert.match(source, /const \[isWindowFullscreen, setIsWindowFullscreen\] = useState\(false\)/);
  assert.match(source, /if \(\(!isMac && !isWindows\) \|\| !isTauriRuntime\) return/);
  assert.match(source, /\.isFullscreen\(\)/);
  assert.match(source, /\.onResized\(/);
  assert.match(source, /unlistenResize\?\.\(\)/);
  assert.match(source, /\}, \[isMac, isWindows, isTauriRuntime\]\)/);
  assert.match(source, /isWindows \? ['"]is-windows['"] : ['"]['"]/);
  assert.match(source, /isWindowFullscreen \? ['"]is-fullscreen['"] : ['"]['"]/);
  assert.match(macFullscreenRule, /padding-left:\s*0\.75rem/i);
  assert.match(nonMacRule, /padding-right:\s*9rem/i);
  assert.match(windowsFullscreenRule, /padding-right:\s*0\.75rem/i);
  assert.doesNotMatch(source, /window-controls|window-control-button|traffic-lights/);
});

test('Excalidraw main menu uses the IdeaNote cool-gray violet surface', async () => {
  const styles = await readSource('src/index.css');
  const menuTrigger = styles.match(/\.excalidraw \.main-menu-trigger\s*\{[\s\S]*?\}/)?.[0] ?? '';

  assert.match(styles, /\.idea-slide-window-toolbar\s*\{[\s\S]*?border-bottom:\s*1px solid #cfd0d8[\s\S]*?background:\s*#dedee3/i);
  assert.match(menuTrigger, /border:\s*1px solid #d8d6e8/i);
  assert.match(menuTrigger, /color:\s*#56536d/i);
  assert.match(menuTrigger, /background:\s*#f0eff7/i);
  assert.match(styles, /\.excalidraw \.main-menu-trigger:hover\s*\{[\s\S]*?color:\s*#4f4aa8[\s\S]*?background:\s*#e9e7f4/i);
  assert.match(styles, /\.excalidraw \.main-menu-trigger:focus-visible\s*\{[\s\S]*?0 0 0 3px rgb\(105 101 219 \/ 24%\)/i);
});

test('Toolbar separator remains visible on the cool-gray title surface', async () => {
  const styles = await readSource('src/index.css');

  assert.match(styles, /\.idea-slide-window-toolbar__separator\s*\{[\s\S]*?height:\s*1\.5rem[\s\S]*?background:\s*#c4c5ce/i);
});

test('macOS overlay chrome does not require the private transparency API', async () => {
  const config = JSON.parse(await readSource('src-tauri/tauri.conf.json'));
  const mainWindow = config.app.windows[0];

  assert.equal(mainWindow.titleBarStyle, 'Overlay');
  assert.equal(mainWindow.decorations, true);
  assert.equal(mainWindow.transparent ?? false, false);
});

test('Main window preserves the approved 850-pixel desktop bounds', async () => {
  const config = JSON.parse(await readSource('src-tauri/tauri.conf.json'));
  const mainWindow = config.app.windows[0];

  assert.equal(mainWindow.width, 1200);
  assert.equal(mainWindow.height, 850);
  assert.equal(mainWindow.minWidth, 850);
  assert.equal(mainWindow.minHeight, 850);
});
