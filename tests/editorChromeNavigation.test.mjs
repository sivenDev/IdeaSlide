import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('EditorLayout gives the center to one editor and uses Explorer as the file switcher', async () => {
  const source = await readSource('src/components/EditorLayout.tsx');
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
  assert.doesNotMatch(source, /Agent/);
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
  assert.match(launch, /onClick=\{\(\) => void run\(onNewFile\)\}/);
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

test('Toolbar preserves the inactive macOS traffic-light footprint on a Shimo-style surface', async () => {
  const source = await readSource('src/components/Toolbar.tsx');
  const styles = await readSource('src/index.css');

  assert.match(source, /import \{ useEffect, useState \} from "react"/);
  assert.match(source, /const isTauriRuntime = "__TAURI_INTERNALS__" in window/);
  assert.match(source, /\.isFocused\(\)/);
  assert.match(source, /\.onFocusChanged\(/);
  assert.match(source, /unlisten\?\.\(\)/);
  assert.match(source, /isMac && !isWindowFocused/);
  assert.match(source, /idea-slide-window-toolbar__traffic-lights/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /<span \/>\s*<span \/>\s*<span \/>/);

  assert.match(styles, /\.idea-slide-window-toolbar\s*\{[\s\S]*?background:\s*#efefef/i);
  assert.match(styles, /\.idea-slide-window-toolbar__traffic-lights\s*\{[\s\S]*?left:\s*13px[\s\S]*?pointer-events:\s*none/i);
  assert.match(styles, /\.idea-slide-window-toolbar__traffic-lights > span\s*\{[\s\S]*?width:\s*12px[\s\S]*?height:\s*12px[\s\S]*?border-radius:\s*50%/i);
});
