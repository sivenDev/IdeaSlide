import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('IdeaSketch editor owns bounded atomic Agent undo and redo history', async () => {
  const source = await readFile(new URL('../src/components/IdeaSketchEditor.tsx', import.meta.url), 'utf8');
  assert.match(source, /AGENT_HISTORY_LIMIT/);
  assert.match(source, /agentHistoryRef/);
  assert.match(source, /undo: IdeaSketchEditorState\[\]/);
  assert.match(source, /redo: IdeaSketchEditorState\[\]/);
  assert.match(source, /handleUndoAgentChange/);
  assert.match(source, /handleRedoAgentChange/);
  assert.match(source, /preserveAgentHistory/);
  assert.match(source, /clearAgentHistory/);
  assert.match(source, /manualCanvasMutationPendingRef/);
  assert.match(source, /const preserveAgentHistory = !manualCanvasMutationPendingRef\.current/);
  assert.match(source, /if \(canvasInteractionActiveRef\.current\)/);
  assert.doesNotMatch(source, /agentUndoRef/);
});

test('programmatic canvas synchronization preserves Agent document history while user edits invalidate it', async () => {
  const editor = await readFile(new URL('../src/components/IdeaSketchEditor.tsx', import.meta.url), 'utf8');
  const canvas = await readFile(new URL('../src/components/SlideCanvas.tsx', import.meta.url), 'utf8');
  assert.match(editor, /manualCanvasMutationPendingRef\.current = true;\s*clearAgentHistory\(\);/);
  assert.match(editor, /UPDATE_PAGE_SCENE[\s\S]*preserveAgentHistory/);
  assert.match(canvas, /onPointerDownCapture=\{beginCanvasInteraction\}/);
  assert.match(canvas, /onKeyDownCapture=\{pulseCanvasInteraction\}/);
});

test('editor shell exposes Agent undo and redo without stealing native history when unavailable', async () => {
  const layout = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');
  const toolbar = await readFile(new URL('../src/components/Toolbar.tsx', import.meta.url), 'utf8');
  assert.match(layout, /agentBinding\?\.canUndo/);
  assert.match(layout, /agentBinding\?\.canRedo/);
  assert.match(layout, /event\.key\.toLowerCase\(\) !== "z"/);
  assert.match(layout, /event\.preventDefault\(\)/);
  assert.match(toolbar, /aria-label="Undo Agent edit"/);
  assert.match(toolbar, /aria-label="Redo Agent edit"/);
});
