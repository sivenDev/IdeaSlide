import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('side panel divider exposes vertical left and right collapse markers', async () => {
  const source = await readFile(new URL('../src/components/ResizableDivider.tsx', import.meta.url), 'utf8');
  assert.match(source, /side: "left" \| "right"/);
  assert.match(source, /Hide workspace|Show workspace/);
  assert.match(source, /Hide cameras|Show cameras/);
  assert.match(source, /idea-slide-resize-rail/);
  assert.match(source, /idea-slide-resize-rail__toggle/);
});

test('divider supports optional pointer resizing without requiring it for the fixed Cameras side', async () => {
  const divider = await readFile(new URL('../src/components/ResizableDivider.tsx', import.meta.url), 'utf8');
  const editor = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');

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
  assert.doesNotMatch(editor, /side="right"[\s\S]*onResize=/);
});

test('workspace and cameras panels start collapsed while both divider toggles remain mounted', async () => {
  const editor = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');

  assert.match(editor, /const \[showWorkspace, setShowWorkspace\] = useState\(false\)/);
  assert.match(editor, /const \[showCameras, setShowCameras\] = useState\(false\)/);
  assert.match(editor, /<ResizableDivider[\s\S]*side="left"[\s\S]*isVisible=\{showWorkspace\}/);
  assert.match(editor, /<ResizableDivider side="right" isVisible=\{showCameras\}/);
});

test('resize rail styling exposes a full-height interaction gutter and visible active state', async () => {
  const source = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(source, /\.idea-slide-resize-rail/);
  assert.match(source, /width:\s*0\.5rem/);
  assert.match(source, /\.idea-slide-resize-rail:hover/);
  assert.match(source, /\.is-resizing/);
  assert.match(source, /--idea-slide-accent/);
});
