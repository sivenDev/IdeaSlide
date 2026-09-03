import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('IdeaSketch Agent canvas edits use native Excalidraw history without a custom history stack', async () => {
  const source = await readFile(new URL('../src/components/IdeaSketchEditor.tsx', import.meta.url), 'utf8');
  const types = await readFile(new URL('../src/lib/agent/types.ts', import.meta.url), 'utf8');
  assert.match(source, /operation\.kind === "replace-page-elements"/);
  assert.match(source, /excalidrawApiRef\.current/);
  assert.match(source, /excalidrawSlideIdRef\.current !== operation\.pageId/);
  assert.match(source, /captureUpdate: CaptureUpdateAction\.IMMEDIATELY/);
  assert.doesNotMatch(source, /AGENT_HISTORY_LIMIT|agentHistoryRef|handleUndoAgentChange|handleRedoAgentChange/);
  assert.doesNotMatch(source, /preserveAgentHistory|clearAgentHistory|manualCanvasMutationPendingRef/);
  assert.doesNotMatch(types, /\bundo: \(\) => void|\bredo: \(\) => void|\bcanUndo: boolean|\bcanRedo: boolean/);
});

test('document synchronization stays non-captured while Agent replacement is captured natively', async () => {
  const editor = await readFile(new URL('../src/components/IdeaSketchEditor.tsx', import.meta.url), 'utf8');
  assert.match(editor, /const syncMountedCanvasToPage = useCallback/);
  assert.match(editor, /captureUpdate: CaptureUpdateAction\.NEVER/);
  assert.match(editor, /operation\.kind === "replace-page-elements"[\s\S]*captureUpdate: CaptureUpdateAction\.IMMEDIATELY/);
  assert.doesNotMatch(editor, /UPDATE_PAGE_SCENE[\s\S]*syncMountedCanvasToPage\(nextPage\)/);
});

test('semantic drawing plans are validated and committed through the canonical SDK adapter', async () => {
  const editor = await readFile(new URL('../src/components/IdeaSketchEditor.tsx', import.meta.url), 'utf8');
  const adapter = await readFile(new URL('../src/lib/agent/extensions/ideaSketchAgentSdkAdapter.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(editor, /buildIdeaSketchDrawingPlanScene/);
  assert.match(adapter, /call\.name === "apply_drawing_plan"/);
  assert.match(adapter, /semanticOperations\(/);
  assert.match(adapter, /sdk\.scene\.applyPlan\(/);
  assert.match(adapter, /sceneSnapshotId/);
  assert.match(adapter, /pageRef\(args\.pageId\) !== activePageRef/);
});

test('semantic layout plans use one canonical SDK scene transaction and remain Page-scoped', async () => {
  const editor = await readFile(new URL('../src/components/IdeaSketchEditor.tsx', import.meta.url), 'utf8');
  const adapter = await readFile(new URL('../src/lib/agent/extensions/ideaSketchAgentSdkAdapter.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(editor, /buildIdeaSketchLayoutPlanScene/);
  assert.match(adapter, /call\.name === "apply_layout_plan"/);
  assert.match(adapter, /semanticOperations\(/);
  assert.match(adapter, /sdk\.scene\.applyPlan\(/);
  assert.match(adapter, /sceneSnapshotId/);
  assert.match(adapter, /pageRef\(args\.pageId\) !== activePageRef/);
});

test('editor shell leaves Undo and Redo entirely to the active editor', async () => {
  const layout = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');
  const crown = await readFile(new URL('../src/components/WorkbenchCrown.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(layout, /handleAgentHistoryKeyDown|agentBinding\?\.canUndo|agentBinding\?\.canRedo|agentBinding\.undo\(|agentBinding\.redo\(/);
  assert.doesNotMatch(crown, /Undo Agent edit|Redo Agent edit|onUndoAgentEdit|onRedoAgentEdit|canUndoAgentEdit|canRedoAgentEdit/);
});
