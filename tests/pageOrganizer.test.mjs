import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/PageOrganizer.tsx', import.meta.url), 'utf8');

test('Pages organizer is compact, thumbnail-free, and supports the complete v1 Page lifecycle', () => {
  assert.match(source, /aria-label="Pages"/);
  assert.match(source, /aria-label="Add Page"/);
  assert.match(source, /onRename/);
  assert.match(source, /draggable=/);
  assert.match(source, /onReorder/);
  assert.match(source, /PAGE_DRAG_MIME/);
  assert.match(source, /resolveListDropIndex/);
  assert.match(source, /is-drop-/);
  assert.match(source, /data-drag-ignore/);
  assert.match(source, /disabled=\{pages\.length === 1\}/);
  assert.match(source, /onSelect/);
  assert.doesNotMatch(source, /aria-expanded/);
  assert.doesNotMatch(source, /__popover/);
  assert.doesNotMatch(source, /thumbnail/i);
});
