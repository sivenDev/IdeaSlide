import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('IdeaSketch navigator switches between fixed Pages and Cameras tabs', async () => {
  const source = await readSource('src/components/IdeaSketchNavigator.tsx');
  const styles = await readSource('src/index.css');

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
  assert.match(source, /canvasInteractionActive/);
  assert.match(source, /canvasInteractionActive=\{canvasInteractionActive\}/);
  assert.match(styles, /\.idea-slide-ideasketch-navigator__tab\s*\{[\s\S]*?font-size:\s*0\.6875rem/);
  assert.match(styles, /\.idea-slide-ideasketch-navigator__tab\[data-state="active"\]::after/);
  assert.match(styles, /\.idea-slide-ideasketch-navigator__tab-count/);
});

test('IdeaSketch editor keeps one compact navigator inside a closed-by-default left drawer', async () => {
  const source = await readSource('src/components/IdeaSketchEditor.tsx');

  assert.match(source, /const DEFAULT_DRAWER_WIDTH = 244/);
  assert.match(source, /const \[drawerWidth, setDrawerWidth\]/);
  assert.match(source, /const \[drawerOpen, setDrawerOpen\] = useState\(false\)/);
  assert.match(source, /const \[navigatorTab, setNavigatorTab\][\s\S]*?initialDrawerState\.tab \?\? "pages"/);
  assert.match(source, /openDrawer\("cameras"\)/);
  assert.match(source, /<IdeaSketchNavigator/);
  assert.match(source, /activeTab=\{navigatorTab\}/);
  assert.match(source, /isVisible=\{drawerOpen\}/);
  assert.doesNotMatch(source, /onToggleNavigator=/);
  assert.match(source, /<ResizableDivider[\s\S]*?side="left"[\s\S]*?isVisible=\{drawerOpen\}[\s\S]*?showToggle=\{false\}[\s\S]*?onResize=/);
  assert.match(source, /onAddCamera=/);
  assert.doesNotMatch(source, /const \[showCameras, setShowCameras\]/);
  assert.doesNotMatch(source, /<CameraList/);
  assert.doesNotMatch(source, /Show Pages\. Current Page/);
  assert.doesNotMatch(source, /ideanote-ideasketch-editor__chrome/);
  assert.match(source, /canvasInteractionActive=\{canvasInteractionActive\}/);
});
