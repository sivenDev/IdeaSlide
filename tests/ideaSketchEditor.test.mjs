import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/IdeaSketchEditor.tsx', import.meta.url), 'utf8');

test('IdeaSketch editor binds Excalidraw drafts to document and Page identity', () => {
  const canvas = source.match(/<SlideCanvas[\s\S]*?\/>/)?.[0] ?? '';

  assert.match(source, /documentSessionId: document\.id/);
  assert.match(source, /page: activePage/);
  assert.match(source, /sessionId !== document\.id/);
  assert.match(source, /payload\.slide\.id !== pageId/);
  assert.match(source, /onRegisterSnapshot/);
  assert.match(canvas, /slideId=\{draft\.slideId\}/);
  assert.match(canvas, /elements=\{draft\.elements\}/);
  assert.match(canvas, /appState=\{draft\.appState\}/);
  assert.match(canvas, /files=\{draft\.files\}/);
  assert.doesNotMatch(canvas, /slideId=\{activePage\.id\}/);
});

test('Workspace-only autosave and Page-scoped Cameras remain inside IdeaSketch', () => {
  assert.match(source, /document\.mode === "workspace"/);
  assert.match(source, /<SlideCanvas/);
  assert.match(source, /<IdeaSketchNavigator/);
  assert.match(source, /<ResizableDivider side="right"/);
  assert.match(source, /const \[showNavigator, setShowNavigator\] = useState\(false\)/);
  assert.match(source, /navigatorTab/);
  assert.match(source, /model\.pages\.find/);
  assert.doesNotMatch(source, /PageThumbnail/);
  assert.doesNotMatch(source, /ideanote-ideasketch-editor__chrome/);
  assert.doesNotMatch(source, /Show Pages\. Current Page/);
});

test('Page selection records editor state without persisting a model mutation', () => {
  assert.match(source, /if \(next\.activePageId !== previous\.activePageId\) \{[\s\S]*?onEditorStateChange\(document\.id, next\.activePageId\);/);
  assert.match(source, /const selectPage = useCallback\(\(pageId: string\) => \{[\s\S]*?flushDraft\(\);[\s\S]*?applyAction\(\{ type: "SELECT_PAGE", pageId \}, false\);/);
});
