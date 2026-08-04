import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/PageOrganizer.tsx', import.meta.url), 'utf8');

test('Pages organizer is compact, thumbnail-free, and supports the complete v1 Page lifecycle', () => {
  assert.match(source, /aria-label="Pages"/);
  assert.match(source, /aria-label="Add Page"/);
  assert.match(source, /onRename/);
  assert.match(source, /onReorder/);
  assert.match(source, /<DndContext/);
  assert.match(source, /<SortableContext/);
  assert.match(source, /useSortable/);
  assert.match(source, /verticalListSortingStrategy/);
  assert.match(source, /sortableKeyboardCoordinates/);
  assert.match(source, /setActivatorNodeRef/);
  assert.match(source, /<GripVertical /);
  assert.match(source, /aria-label=\{"Drag " \+ page\.title\}/);
  assert.match(source, /disabled=\{pagesCount === 1\}/);
  assert.match(source, /onSelect/);
  assert.doesNotMatch(source, /aria-expanded/);
  assert.doesNotMatch(source, /__popover/);
  assert.doesNotMatch(source, /thumbnail/i);
  assert.doesNotMatch(source, /PAGE_DRAG_MIME/);
  assert.doesNotMatch(source, /draggable=/);
  assert.doesNotMatch(source, /dataTransfer/);
  assert.doesNotMatch(source, /data-drag-ignore/);
  assert.doesNotMatch(source, /resolveListDropIndex/);
});
