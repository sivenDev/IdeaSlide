import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('camera sidebar is a text-only vertical list', async () => {
  const source = await readFile(new URL('../src/components/CameraList.tsx', import.meta.url), 'utf8');
  assert.match(source, /idea-slide-side-panel/);
  assert.match(source, /idea-slide-navigator-toolbar/);
  assert.match(source, /idea-slide-camera-row/);
  assert.match(source, /idea-slide-camera-empty/);
  assert.match(source, /aria-label="Add camera"/);
  assert.match(source, /onAddCamera/);
  assert.match(source, /idea-slide-camera-header-actions/);
  assert.match(source, /idea-slide-camera-present-button/);
  assert.doesNotMatch(source, /disabled=\{cameras\.length === 0\}/);
  assert.match(source, /onStartPreview/);
  assert.match(source, /onStartFullscreen/);
  assert.match(source, />Preview</);
  assert.match(source, />Fullscreen</);
  assert.doesNotMatch(source, />\s*Add\s*</);
  assert.match(source, /Camera \{camera\.order\}/);
  assert.match(source, /overflow-y-auto/);
  assert.match(source, /<DndContext/);
  assert.match(source, /<SortableContext/);
  assert.match(source, /useSortable/);
  assert.match(source, /verticalListSortingStrategy/);
  assert.match(source, /sortableKeyboardCoordinates/);
  assert.match(source, /arrayMove/);
  assert.match(source, /setActivatorNodeRef/);
  assert.match(source, /<GripVertical /);
  assert.match(source, /aria-label=\{"Drag camera " \+ camera\.order\}/);
  assert.doesNotMatch(source, /CameraThumbnail/);
  assert.doesNotMatch(source, /thumbnails/);
  assert.doesNotMatch(source, /SVGSVGElement/);
  assert.doesNotMatch(source, /uppercase/);
  assert.doesNotMatch(source, /amber-/);
  assert.doesNotMatch(source, /CAMERA_DRAG_MIME/);
  assert.doesNotMatch(source, /draggable=/);
  assert.doesNotMatch(source, /dataTransfer/);
  assert.doesNotMatch(source, /data-drag-ignore/);
  assert.doesNotMatch(source, /resolveListDropIndex/);
  assert.doesNotMatch(source, /moveItemToIndex/);
});

test('camera sidebar header owns the single Camera creation action', async () => {
  const source = await readFile(new URL('../src/components/CameraList.tsx', import.meta.url), 'utf8');
  const presentIndex = source.indexOf('aria-label="Present"');
  const addIndex = source.indexOf('aria-label="Add camera"');

  assert.doesNotMatch(source, /Current Page|idea-slide-navigator-toolbar__context/);
  assert.ok(presentIndex >= 0);
  assert.ok(addIndex > presentIndex);
  assert.equal(source.match(/aria-label="Add camera"/g)?.length, 1);
  assert.equal(source.match(/onClick=\{onAddCamera\}/g)?.length, 1);
  assert.equal(source.match(/<TooltipContent>Add camera<\/TooltipContent>/g)?.length, 1);
});
