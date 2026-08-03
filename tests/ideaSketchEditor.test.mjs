import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/IdeaSketchEditor.tsx', import.meta.url), 'utf8');

test('IdeaSketch editor binds Excalidraw drafts to document and Page identity', () => {
  assert.match(source, /documentSessionId: document\.id/);
  assert.match(source, /page: activePage/);
  assert.match(source, /sessionId !== document\.id/);
  assert.match(source, /payload\.slide\.id !== pageId/);
  assert.match(source, /onRegisterSnapshot/);
});

test('Workspace-only autosave and Page-scoped Cameras remain inside IdeaSketch', () => {
  assert.match(source, /document\.mode === "workspace"/);
  assert.match(source, /<SlideCanvas/);
  assert.match(source, /<CameraList/);
  assert.match(source, /<ResizableDivider side="right"/);
  assert.match(source, /const \[showCameras, setShowCameras\] = useState\(false\)/);
  assert.match(source, /model\.pages\.find/);
  assert.doesNotMatch(source, /PageThumbnail/);
});
