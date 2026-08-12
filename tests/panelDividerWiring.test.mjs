import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('side panel divider exposes vertical left and right collapse markers', async () => {
  const source = await readFile(new URL('../src/components/ResizableDivider.tsx', import.meta.url), 'utf8');
  assert.match(source, /side: "left" \| "right"/);
  assert.match(source, /panelLabel\?: string/);
  assert.match(source, /panelLabel \?\? \(isLeft \? "workspace" : "navigator"\)/);
  assert.match(source, /`\$\{isVisible \? "Hide" : "Show"\} \$\{panelName\}`/);
  assert.match(source, /idea-slide-resize-rail/);
  assert.match(source, /idea-slide-resize-rail__toggle/);
  assert.match(source, /TooltipProvider/);
  assert.match(source, /TooltipTrigger asChild/);
  assert.match(source, /TooltipContent/);
  assert.doesNotMatch(source, /title=/);
});

test('divider supports independently bounded resizing for Workspace, Agent, and editor Navigator', async () => {
  const divider = await readFile(new URL('../src/components/ResizableDivider.tsx', import.meta.url), 'utf8');
  const editor = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');
  const ideaSketchEditor = await readFile(new URL('../src/components/IdeaSketchEditor.tsx', import.meta.url), 'utf8');

  assert.match(divider, /onResize\?:/);
  assert.match(divider, /setPointerCapture/);
  assert.match(divider, /onPointerMove/);
  assert.match(divider, /cursor-col-resize/);
  assert.match(divider, /role=\{canResize \? "separator" : undefined\}/);
  assert.match(divider, /aria-orientation="vertical"/);
  assert.match(divider, /aria-valuemin/);
  assert.match(divider, /aria-valuemax/);
  assert.match(divider, /aria-valuenow/);
  assert.match(divider, /event\.key === "Home"/);
  assert.match(divider, /event\.key === "End"/);
  assert.match(editor, /WORKSPACE_PANEL_DEFAULT_WIDTH/);
  assert.match(editor, /WORKSPACE_PANEL_MIN_WIDTH/);
  assert.match(editor, /WORKSPACE_PANEL_MAX_WIDTH/);
  assert.match(editor, /clampWorkspacePanelWidth/);
  assert.match(editor, /side="left"[\s\S]*onResize=/);
  assert.match(editor, /const AGENT_PANEL_DEFAULT_WIDTH = 352/);
  assert.match(editor, /const AGENT_PANEL_MIN_WIDTH = 260/);
  assert.match(editor, /const AGENT_PANEL_MAX_WIDTH = 420/);
  assert.match(editor, /const \[isResizingAgent, setIsResizingAgent\] = useState\(false\)/);
  assert.match(editor, /side="right"[\s\S]*panelLabel="Agent"[\s\S]*onResizeStart=\{\(\) => setIsResizingAgent\(true\)\}[\s\S]*onResizeEnd=\{\(\) => setIsResizingAgent\(false\)\}[\s\S]*onResize=/);
  assert.match(editor, /className=\{`h-full flex-shrink-0 overflow-hidden \$\{isResizingAgent \? "" : "transition-\[width\] duration-200"\}`\}/);
  assert.match(ideaSketchEditor, /const DEFAULT_DRAWER_WIDTH = 244/);
  assert.match(ideaSketchEditor, /const MIN_DRAWER_WIDTH = 220/);
  assert.match(ideaSketchEditor, /const MAX_DRAWER_WIDTH = 420/);
  assert.match(ideaSketchEditor, /const \[isResizingDrawer, setIsResizingDrawer\] = useState\(false\)/);
  assert.match(ideaSketchEditor, /side="left"[\s\S]*showToggle=\{false\}[\s\S]*onResizeStart=\{\(\) => setIsResizingDrawer\(true\)\}[\s\S]*onResizeEnd=\{\(\) => setIsResizingDrawer\(false\)\}[\s\S]*onResize=/);
});

test('Workspace navigation is visible by default across workbench modes and remains collapsible', async () => {
  const editor = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(editor, /useState\(initialPanelState\.workspaceOpen \?\? true\)/);
  assert.match(editor, /style=\{\{ width: showWorkspace \? workspacePanelWidth : 0 \}\}/);
  assert.match(editor, /ideanote-workspace-motion/);
  assert.match(editor, /showWorkspace \? "is-open" : "is-closed"/);
  assert.match(editor, /isResizingWorkspace \? "is-resizing" : ""/);
  assert.match(editor, /ideanote-workspace-motion__content/);
  assert.match(editor, /!showWorkspace && <div className="ideanote-workspace-motion__seam" aria-hidden="true" \/>/);
  assert.match(editor, /showWorkspace && \([\s\S]*?<ResizableDivider[\s\S]*?side="left"/);
  assert.match(editor, /agentAvailable && showAgent && \([\s\S]*?<ResizableDivider[\s\S]*?side="right"/);
  assert.match(editor, /onToggle=\{\(\) => setShowWorkspace/);
  assert.match(editor, /onToggle=\{\(\) => setShowAgent/);
  assert.match(styles, /\.ideanote-workspace-motion\s*\{[\s\S]*?transition:\s*width var\(--workspaces-motion-duration\) var\(--workspaces-motion-easing\)/);
  assert.match(styles, /\.ideanote-workspace-motion\.is-resizing[\s\S]*?transition:\s*none/);
  assert.match(styles, /\.ideanote-workspace-motion__seam\s*\{[\s\S]*?width:\s*7px[\s\S]*?flex:\s*0 0 7px[\s\S]*?margin:\s*0 -3px/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce[\s\S]*?\.ideanote-workspace-motion[\s\S]*?transition:\s*none\s*!important/);
});

test('resize rail styling exposes a full-height interaction gutter and visible active state', async () => {
  const source = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(source, /\.idea-slide-resize-rail/);
  assert.match(source, /\.idea-slide-resize-rail\s*\{[\s\S]*?width:\s*7px/);
  assert.match(source, /\.idea-slide-resize-rail\s*\{[\s\S]*?flex:\s*0 0 7px[\s\S]*?margin:\s*0 -3px/);
  assert.match(source, /\.idea-slide-resize-rail__line\s*\{[\s\S]*?width:\s*1px/);
  assert.match(source, /\.idea-slide-resize-rail:hover[\s\S]*?width:\s*3px/);
  assert.match(source, /\.is-resizing/);
  assert.match(source, /background:\s*var\(--focus\)/);
});
