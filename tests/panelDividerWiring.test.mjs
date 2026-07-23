import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('side panel divider exposes vertical left and right collapse markers', async () => {
  const source = await readFile(new URL('../src/components/ResizableDivider.tsx', import.meta.url), 'utf8');
  assert.match(source, /side: "left" \| "right"/);
  assert.match(source, /Hide workspace|Show workspace/);
  assert.match(source, /Hide cameras|Show cameras/);
  assert.match(source, /w-px/);
});

test('divider supports optional pointer resizing without requiring it for the fixed Cameras side', async () => {
  const divider = await readFile(new URL('../src/components/ResizableDivider.tsx', import.meta.url), 'utf8');
  const editor = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');

  assert.match(divider, /onResize\?:/);
  assert.match(divider, /setPointerCapture/);
  assert.match(divider, /onPointerMove/);
  assert.match(divider, /cursor-col-resize/);
  assert.match(editor, /WORKSPACE_PANEL_DEFAULT_WIDTH/);
  assert.match(editor, /clampWorkspacePanelWidth/);
  assert.match(editor, /side="left"[\s\S]*onResize=/);
  assert.doesNotMatch(editor, /side="right"[\s\S]*onResize=/);
});
