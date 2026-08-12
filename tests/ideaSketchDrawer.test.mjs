import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('IdeaSketch starts with one custom top-left trigger and a closed left drawer', async () => {
  const editor = await readSource('src/components/IdeaSketchEditor.tsx');
  const styles = await readSource('src/index.css');

  assert.match(editor, /IDEASKETCH_DRAWER_STORAGE_KEY/);
  assert.match(editor, /const \[drawerOpen, setDrawerOpen\] = useState\(false\)/);
  assert.match(editor, /className=\{`ideanote-ideasketch-drawer-trigger/);
  assert.match(editor, /aria-label=\{drawerOpen \? "Close IdeaSketch menu" : "Open IdeaSketch menu"\}/);
  assert.match(editor, /import \{ PanelLeft, PanelLeftClose \} from "lucide-react"/);
  assert.match(editor, /drawerOpen\s*\?\s*<PanelLeftClose aria-hidden size=\{18\} strokeWidth=\{1\.9\} \/>\s*:\s*<PanelLeft aria-hidden size=\{18\} strokeWidth=\{1\.9\} \/>/);
  assert.doesNotMatch(editor, /\bMenu\b/);
  assert.match(editor, /className="ideanote-ideasketch-drawer"/);
  assert.match(editor, /<ResizableDivider[\s\S]*?side="left"[\s\S]*?panelLabel="IdeaSketch menu"[\s\S]*?showToggle=\{false\}/);
  assert.doesNotMatch(editor, /side="right"/);
  assert.doesNotMatch(editor, /DEFAULT_RIGHT_SIDEBAR_WIDTH|rightSidebarWidth|showNavigator/);
  assert.match(styles, /\.ideanote-ideasketch-drawer-trigger\s*\{[\s\S]*?--ideanote-ideasketch-trigger-size:\s*2\.75rem;[\s\S]*?top:\s*1rem;[\s\S]*?width:\s*var\(--ideanote-ideasketch-trigger-size\);[\s\S]*?height:\s*var\(--ideanote-ideasketch-trigger-size\)/);
  assert.match(styles, /@media screen and \(min-device-width:\s*1921px\)[\s\S]*?\.ideanote-ideasketch-drawer-trigger\s*\{[\s\S]*?--ideanote-ideasketch-trigger-size:\s*3rem/);
});

test('the existing navigator stays intact above a separate Canvas command section', async () => {
  const editor = await readSource('src/components/IdeaSketchEditor.tsx');
  const navigator = await readSource('src/components/IdeaSketchNavigator.tsx');
  const navigatorIndex = editor.indexOf('<IdeaSketchNavigator');
  const commandsIndex = editor.indexOf('<IdeaSketchDrawerCommands');

  assert.ok(navigatorIndex >= 0);
  assert.ok(commandsIndex > navigatorIndex);
  assert.match(editor, /activeTab=\{navigatorTab\}/);
  assert.match(editor, /activePageDraft=\{draft\}/);
  assert.match(editor, /canvasInteractionActive=\{canvasInteractionActive\}/);
  assert.match(editor, /onAddCamera=\{readOnly \? undefined : handleAddCamera\}/);
  assert.match(navigator, /<PageOrganizer/);
  assert.match(navigator, /<CameraList/);
  assert.doesNotMatch(navigator, /Canvas & export|Export image|Export as draw\.io/);
});

test('drawer layout state is UI-only, Escape dismissible, responsive, and reduced-motion safe', async () => {
  const editor = await readSource('src/components/IdeaSketchEditor.tsx');
  const styles = await readSource('src/index.css');

  assert.match(editor, /ideanote:ideasketch-drawer:v2/);
  assert.match(editor, /const DEFAULT_DRAWER_WIDTH = 244/);
  assert.match(editor, /const MIN_DRAWER_WIDTH = 220/);
  assert.match(editor, /const MAX_DRAWER_WIDTH = 420/);
  assert.match(editor, /window\.localStorage\.getItem\(IDEASKETCH_DRAWER_STORAGE_KEY\)/);
  assert.match(editor, /window\.localStorage\.setItem\(IDEASKETCH_DRAWER_STORAGE_KEY/);
  assert.match(editor, /event\.key !== "Escape" \|\| !drawerOpen/);
  assert.match(editor, /setDrawerOpen\(false\)/);
  assert.match(editor, /canvasLayoutRefreshToken/);
  assert.doesNotMatch(editor, /onEditorStateChange\([^\n]*drawer|onModelChange\([^\n]*drawer/i);
  assert.match(styles, /\.ideanote-ideasketch-editor\s*\{[\s\S]*?container-type:\s*inline-size/);
  assert.match(styles, /@container \(max-width:\s*700px\)[\s\S]*?width:\s*min\(244px, calc\(100% - 3rem\)\) !important/);
  assert.match(styles, /left:\s*calc\(min\(244px, 100cqw - 3rem\) - var\(--ideanote-ideasketch-trigger-size\) - 0\.25rem\)/);
  assert.doesNotMatch(styles, /\.ideanote-ideasketch-drawer::before/);
  assert.match(styles, /\.ideanote-ideasketch-drawer\s*\{[\s\S]*?border-right:\s*0;[\s\S]*?box-shadow:\s*none/);
  assert.match(styles, /\.idea-slide-resize-rail__line\s*\{[\s\S]*?width:\s*1px;[\s\S]*?background:\s*var\(--line-strong\)/);
  assert.match(styles, /@container \(max-width:\s*700px\)[\s\S]*?\.ideanote-ideasketch-workspace\.is-drawer-open \.ideanote-ideasketch-drawer-shell[\s\S]*?box-shadow:\s*16px 0 34px/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?ideanote-ideasketch/);
});

test('drawer width tracks rapid pointer resizing without an animated shell gap', async () => {
  const editor = await readSource('src/components/IdeaSketchEditor.tsx');
  const styles = await readSource('src/index.css');

  assert.match(editor, /const \[isResizingDrawer, setIsResizingDrawer\] = useState\(false\)/);
  assert.match(editor, /className=\{`ideanote-ideasketch-drawer-shell \$\{isResizingDrawer \? "is-resizing" : ""\}`\}/);
  assert.match(editor, /panelLabel="IdeaSketch menu"[\s\S]*?onResizeStart=\{\(\) => setIsResizingDrawer\(true\)\}[\s\S]*?onResizeEnd=\{\(\) => setIsResizingDrawer\(false\)\}[\s\S]*?onResize=/);
  assert.match(styles, /\.ideanote-ideasketch-drawer-shell\.is-resizing\s*\{[\s\S]*?transition:\s*none/);
});

test('SlideCanvas exposes supported live commands without restoring Excalidraw MainMenu', async () => {
  const canvas = await readSource('src/components/SlideCanvas.tsx');
  const styles = await readSource('src/index.css');

  assert.doesNotMatch(canvas, /\bMainMenu\b/);
  assert.match(canvas, /export interface SlideCanvasCommandApi/);
  assert.match(canvas, /exportDrawio/);
  assert.match(canvas, /openImageExport/);
  assert.match(canvas, /changeCanvasBackground/);
  assert.match(canvas, /clearCanvas/);
  assert.doesNotMatch(canvas, /openHelp|name: "help"/);
  assert.match(canvas, /openDialog:\s*\{ name: "imageExport" \}/);
  assert.match(canvas, /exportExcalidrawToDrawio/);
  assert.match(canvas, /CaptureUpdateAction\.IMMEDIATELY/);
  assert.match(canvas, /newElementWith/);
  assert.match(canvas, /layoutRefreshToken/);
  assert.match(styles, /\.ideanote-ideasketch-canvas\s+\.excalidraw\s+\.main-menu-trigger\s*\{[\s\S]*?display:\s*none/);
});

test('the command footer keeps mutating actions read-only safe and clear requires confirmation', async () => {
  const commands = await readSource('src/components/IdeaSketchDrawerCommands.tsx');
  const dialog = await readSource('src/components/IdeaSketchClearCanvasDialog.tsx');
  const editor = await readSource('src/components/IdeaSketchEditor.tsx');

  assert.match(commands, /disabled=\{readOnly \|\| !ready\}/);
  assert.doesNotMatch(commands, /Canvas &amp; export|<h2>/);
  assert.match(commands, /Export image/);
  assert.match(commands, /Export draw\.io/);
  assert.match(commands, /Canvas background/);
  assert.match(commands, /Clear canvas/);
  assert.doesNotMatch(commands, /CircleHelp|>Help<|onHelp/);
  assert.match(dialog, /AlertDialog\.Root/);
  assert.match(dialog, /You can undo this action from the Canvas/);
  assert.match(editor, /onClearCanvas=\{\(\) => setClearCanvasDialogOpen\(true\)\}/);
  assert.match(editor, /canvasCommandApiRef\.current\?\.clearCanvas\(\)/);
});
