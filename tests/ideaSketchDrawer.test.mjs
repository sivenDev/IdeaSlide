import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('IdeaSketch keeps the open control on Canvas and moves the close control into the drawer header', async () => {
  const editor = await readSource('src/components/IdeaSketchEditor.tsx');
  const styles = await readSource('src/index.css');

  assert.match(editor, /IDEASKETCH_DRAWER_STORAGE_KEY/);
  assert.match(editor, /const \[drawerOpen, setDrawerOpen\] = useState\(settings\.ideaSketch\.openSidebarByDefault\)/);
  assert.match(editor, /import \{ PanelLeft, PanelLeftClose \} from "lucide-react"/);
  assert.match(editor, /className="ideanote-ideasketch-drawer-trigger is-drawer is-open"[\s\S]*?aria-label="Close IdeaSketch menu"[\s\S]*?<PanelLeftClose aria-hidden size=\{16\} strokeWidth=\{1\.9\} \/>/);
  assert.match(editor, /const \[selectionControlsActive, setSelectionControlsActive\] = useState\(false\)/);
  assert.match(editor, /const lowerLeftTriggerActive = !drawerOpen && selectionControlsActive/);
  assert.match(editor, /className=\{`ideanote-ideasketch-canvas \$\{lowerLeftTriggerActive \? "has-lower-left-trigger" : ""\}`\}/);
  assert.match(editor, /className=\{`ideanote-ideasketch-drawer-trigger is-canvas \$\{lowerLeftTriggerActive \? "is-lower-left" : ""\}`\}/);
  assert.match(editor, /aria-label="Open IdeaSketch menu"[\s\S]*?<PanelLeft aria-hidden size=\{18\} strokeWidth=\{1\.9\} \/>/);
  assert.match(editor, /onSelectionPresenceChange=\{setSelectionControlsActive\}/);
  assert.match(editor, /headerAction=\{drawerOpen \? \([\s\S]*?ideanote-ideasketch-drawer-trigger is-drawer/);
  assert.match(editor, /\{!drawerOpen && \([\s\S]*?ideanote-ideasketch-drawer-trigger is-canvas/);
  assert.doesNotMatch(editor, /aria-label=\{drawerOpen \?/);
  assert.doesNotMatch(editor, /\bMenu\b/);
  assert.match(editor, /className="ideanote-ideasketch-drawer"/);
  assert.match(editor, /<ResizableDivider[\s\S]*?side="left"[\s\S]*?panelLabel="IdeaSketch menu"[\s\S]*?showToggle=\{false\}/);
  assert.doesNotMatch(editor, /side="right"/);
  assert.doesNotMatch(editor, /DEFAULT_RIGHT_SIDEBAR_WIDTH|rightSidebarWidth|showNavigator/);
  assert.match(styles, /\.ideanote-ideasketch-drawer-trigger\.is-canvas\s*\{[\s\S]*?top:\s*1rem;[\s\S]*?left:\s*1rem/);
  assert.match(styles, /\.ideanote-ideasketch-drawer-trigger\.is-canvas\.is-lower-left\s*\{[\s\S]*?top:\s*auto;[\s\S]*?bottom:\s*1rem/);
  assert.match(styles, /\.ideanote-ideasketch-canvas\.has-lower-left-trigger \.excalidraw \.layer-ui__wrapper__footer-left\s*\{[\s\S]*?margin-inline-start:\s*calc\(var\(--ideanote-ideasketch-trigger-size\) \+ 0\.75rem\)/);
  assert.match(styles, /\.ideanote-ideasketch-drawer-trigger\.is-drawer\s*\{[\s\S]*?--ideanote-ideasketch-trigger-size:\s*2rem;[\s\S]*?top:\s*0\.375rem;[\s\S]*?right:\s*0\.375rem;[\s\S]*?border-radius:\s*0\.375rem;[\s\S]*?box-shadow:\s*none/);
  assert.match(styles, /\.ideanote-ideasketch-drawer-trigger\.is-drawer\.is-open\s*\{[\s\S]*?color:\s*var\(--text-secondary\);[\s\S]*?box-shadow:\s*none/);
  assert.match(styles, /@media screen and \(min-device-width:\s*1921px\)[\s\S]*?\.ideanote-ideasketch-canvas\s*\{[\s\S]*?--ideanote-ideasketch-trigger-size:\s*3rem/);
  assert.match(styles, /\.idea-slide-ideasketch-navigator__tab-bar\s*\{[\s\S]*?position:\s*relative;[\s\S]*?padding:\s*0 2\.625rem 0 0\.375rem/);
  assert.doesNotMatch(styles, /is-drawer-open \.ideanote-ideasketch-drawer-trigger[\s\S]*?left:\s*calc\(min\(244px/);
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
  assert.doesNotMatch(styles, /left:\s*calc\(min\(244px, 100cqw - 3rem\) - var\(--ideanote-ideasketch-trigger-size\) - 0\.25rem\)/);
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

test('the actions menu is a default-hidden disclosure toggled from the Drag Pages row', async () => {
  const commands = await readSource('src/components/IdeaSketchDrawerCommands.tsx');
  const editor = await readSource('src/components/IdeaSketchEditor.tsx');
  const navigator = await readSource('src/components/IdeaSketchNavigator.tsx');
  const organizer = await readSource('src/components/PageOrganizer.tsx');

  // The editor owns the default-hidden expanded state and a single toggle handler.
  assert.match(editor, /const \[actionsExpanded, setActionsExpanded\] = useState\(false\)/);
  assert.match(
    editor,
    /const toggleActions = useCallback\(\(\) => \{\s*setActionsExpanded\(\(value\) => !value\);\s*\}, \[\]\)/,
  );

  // The up/down toggle button rides the Pages "Drag Pages" hint row.
  assert.match(
    editor,
    /hintTrailing=\{\s*<ActionsToggleButton\s+expanded=\{actionsExpanded\}\s+onToggle=\{toggleActions\}\s*\/>\s*\}/,
  );
  assert.match(navigator, /hintTrailing=\{hintTrailing\}/);
  assert.match(organizer, /className="ideanote-page-organizer__hint"[\s\S]*?\{hintTrailing\}/);

  // The command body is controlled; its header toggle only appears off the Pages tab.
  assert.match(editor, /expanded=\{actionsExpanded\}/);
  assert.match(editor, /showHeaderToggle=\{navigatorTab !== "pages"\}/);
  assert.match(editor, /onToggle=\{toggleActions\}/);
  assert.match(commands, /showHeaderToggle && \(/);
  assert.match(commands, /className="ideanote-ideasketch-drawer-commands__toggle"/);

  // The shared toggle is an accessible disclosure with an up/down chevron.
  assert.match(commands, /export function ActionsToggleButton/);
  assert.match(commands, /aria-expanded=\{expanded\}/);
  assert.match(commands, /aria-controls=\{IDEASKETCH_ACTIONS_BODY_ID\}/);
  assert.match(commands, /expanded \? \(\s*<ChevronDown/);
  assert.match(commands, /\) : \(\s*<ChevronUp/);

  // The toggle carries its own hover tooltip so it works on the Pages hint row too.
  assert.match(commands, /const label = expanded \? "Hide actions" : "Show actions"/);
  assert.match(
    commands,
    /<TooltipProvider>\s*<Tooltip>\s*<TooltipTrigger asChild>[\s\S]*?aria-label=\{label\}[\s\S]*?<TooltipContent side="top">\{label\}<\/TooltipContent>/,
  );

  // The command component is controlled (no internal state) and collapses to nothing.
  assert.doesNotMatch(commands, /useState/);
  assert.match(commands, /if \(!expanded && !showHeaderToggle\) \{\s*return null;/);
  assert.match(commands, /\{expanded && \(/);

  // Export image and Export draw.io live in the Page group; Canvas keeps only background + clear.
  const pageGroup = commands.slice(
    commands.indexOf('aria-label="Page"'),
    commands.indexOf('aria-label="Canvas"'),
  );
  const canvasGroup = commands.slice(commands.indexOf('aria-label="Canvas"'));
  assert.match(pageGroup, /label="Export image"/);
  assert.match(pageGroup, /label="Export draw\.io"/);
  assert.doesNotMatch(canvasGroup, /label="Export image"/);
  assert.doesNotMatch(canvasGroup, /label="Export draw\.io"/);
  assert.match(canvasGroup, /Canvas background/);
  assert.match(canvasGroup, /label="Clear canvas"/);
});

test('the command groups drop their headings and divide Canvas with a rule', async () => {
  const commands = await readSource('src/components/IdeaSketchDrawerCommands.tsx');
  const styles = await readSource('src/index.css');

  // The visible group headings are gone in both markup and styles.
  assert.doesNotMatch(commands, /__group-title/);
  assert.doesNotMatch(styles, /__group-title/);

  // The accessible group names remain on the wrappers.
  assert.match(commands, /role="group"\s+aria-label="Page"/);
  assert.match(commands, /role="group"\s+aria-label="Canvas"/);

  // The Canvas group is set apart by a divider rule.
  assert.match(commands, /__group--divided"[\s\S]*?aria-label="Canvas"/);
  assert.match(
    styles,
    /\.ideanote-ideasketch-drawer-commands__group--divided\s*\{[\s\S]*?border-top:\s*1px solid var\(--border-subtle\)/,
  );
});
