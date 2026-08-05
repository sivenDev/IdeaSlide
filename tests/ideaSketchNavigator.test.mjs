import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('IdeaSketch navigator switches between fixed Pages and Cameras tabs', async () => {
  const source = await readSource('src/components/IdeaSketchNavigator.tsx');

  assert.match(source, /<Tabs/);
  assert.match(source, /value=\{activeTab\}/);
  assert.match(source, /onValueChange=/);
  assert.match(source, /<TabsTrigger value="pages"/);
  assert.match(source, /<TabsTrigger value="cameras"/);
  assert.match(source, /<TabsContent value="pages"/);
  assert.match(source, /<TabsContent value="cameras"/);
  assert.match(source, /<PageOrganizer/);
  assert.match(source, /<CameraList/);
  assert.match(source, /pages\.length/);
  assert.match(source, /cameras\.length/);
  assert.doesNotMatch(source, /Collapsible/);
  assert.match(source, /activePageDraft/);
});

test('IdeaSketch editor owns one open-by-default compact navigator without a duplicate Page shortcut', async () => {
  const source = await readSource('src/components/IdeaSketchEditor.tsx');

  assert.match(source, /const NAVIGATOR_PANEL_WIDTH = 220/);
  assert.match(source, /const \[showNavigator, setShowNavigator\] = useState\(true\)/);
  assert.match(source, /const \[navigatorTab, setNavigatorTab\].*"pages"/);
  assert.match(source, /openNavigator\("cameras"\)/);
  assert.match(source, /toggleNavigator/);
  assert.match(source, /<IdeaSketchNavigator/);
  assert.match(source, /activeTab=\{navigatorTab\}/);
  assert.match(source, /isVisible=\{showNavigator\}/);
  assert.doesNotMatch(source, /onToggleNavigator=/);
  assert.match(source, /<ResizableDivider side="right" isVisible=\{showNavigator\} onToggle=\{toggleNavigator\} \/>/);
  assert.match(source, /onAddCamera=/);
  assert.doesNotMatch(source, /const \[showCameras, setShowCameras\]/);
  assert.doesNotMatch(source, /<CameraList/);
  assert.doesNotMatch(source, /Show Pages\. Current Page/);
  assert.doesNotMatch(source, /ideanote-ideasketch-editor__chrome/);
});
