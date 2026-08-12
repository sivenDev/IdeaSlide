import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('IdeaSketch starts with one custom top-left trigger and a closed left drawer', async () => {
  const editor = await readSource('src/components/IdeaSketchEditor.tsx');

  assert.match(editor, /IDEASKETCH_DRAWER_STORAGE_KEY/);
  assert.match(editor, /const \[drawerOpen, setDrawerOpen\] = useState\(false\)/);
  assert.match(editor, /className=\{`ideanote-ideasketch-drawer-trigger/);
  assert.match(editor, /aria-label=\{drawerOpen \? "Close IdeaSketch menu" : "Open IdeaSketch menu"\}/);
  assert.match(editor, /<PanelLeft aria-hidden size=\{18\}/);
  assert.doesNotMatch(editor, /\bMenu\b|PanelLeftClose/);
  assert.match(editor, /className="ideanote-ideasketch-drawer"/);
  assert.match(editor, /<ResizableDivider[\s\S]*?side="left"[\s\S]*?panelLabel="IdeaSketch menu"[\s\S]*?showToggle=\{false\}/);
  assert.doesNotMatch(editor, /side="right"/);
  assert.doesNotMatch(editor, /DEFAULT_RIGHT_SIDEBAR_WIDTH|rightSidebarWidth|showNavigator/);
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

  assert.match(editor, /window\.localStorage\.getItem\(IDEASKETCH_DRAWER_STORAGE_KEY\)/);
  assert.match(editor, /window\.localStorage\.setItem\(IDEASKETCH_DRAWER_STORAGE_KEY/);
  assert.match(editor, /event\.key !== "Escape" \|\| !drawerOpen/);
  assert.match(editor, /setDrawerOpen\(false\)/);
  assert.match(editor, /canvasLayoutRefreshToken/);
  assert.doesNotMatch(editor, /onEditorStateChange\([^\n]*drawer|onModelChange\([^\n]*drawer/i);
  assert.match(styles, /\.ideanote-ideasketch-editor\s*\{[\s\S]*?container-type:\s*inline-size/);
  assert.match(styles, /@container \(max-width:\s*700px\)[\s\S]*?\.ideanote-ideasketch-drawer/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?ideanote-ideasketch/);
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
