import test from 'node:test';
import assert from 'node:assert/strict';

import { parseIdeaSketchFile, serializeIdeaSketchDocument } from '../src/lib/ideaSketchDocument.ts';
import { apply, op } from './ideaSketchSdkTestUtils.mjs';

test('semantic scene output survives .is serialize and reopen without losing native edit fields', () => {
  const applied = apply([
    op('create-shape', {
      ref: 'temp:shape',
      shape: 'rectangle',
      bounds: { x: 10, y: 20, width: 120, height: 80 },
      boundText: { ref: 'temp:label', originalText: 'Editable label', style: { fontSize: 24, textAlign: 'center' } },
    }),
    op('create-arrow', { ref: 'temp:arrow', points: [[0, 60], [220, 60]] }),
    op('bind-arrow', { arrowRef: 'temp:arrow', start: { endpoint: 'start', targetRef: 'temp:shape' } }),
    op('create-camera', { ref: 'temp:camera', bounds: { x: 0, y: 0, width: 160, height: 120 } }),
    op('set-background', { color: '#f7f7f7' }),
  ], { files: { asset: { id: 'asset', mimeType: 'image/png', dataURL: 'data:image/png;base64,AA==' } }, appState: { viewBackgroundColor: '#ffffff', zoom: { value: 1.25 }, activeTool: { type: 'selection' } } });

  const document = {
    type: 'ideasketch',
    formatVersion: '1.0',
    created: '2026-09-03T00:00:00.000Z',
    modified: '2026-09-03T00:00:00.000Z',
    pages: [{ id: 'page-1', title: 'Persistence', elements: applied.scene.elements, appState: applied.scene.appState, files: applied.scene.files }],
  };
  const reopened = parseIdeaSketchFile(serializeIdeaSketchDocument(document, '2026-09-03T00:01:00.000Z'));
  const page = reopened.pages[0];
  const shape = page.elements.find((element) => element.type === 'rectangle');
  const text = page.elements.find((element) => element.type === 'text');
  const arrow = page.elements.find((element) => element.type === 'arrow');
  const camera = page.elements.find((element) => element.customData?.type === 'camera');
  assert.equal(text.originalText, 'Editable label');
  assert.equal(text.containerId, shape.id);
  assert.ok(shape.boundElements.some((binding) => binding.id === text.id && binding.type === 'text'));
  assert.equal(arrow.startBinding.elementId, shape.id);
  assert.ok(Array.isArray(arrow.startBinding.fixedPoint));
  assert.equal(camera.customData.order, 1);
  assert.equal(page.appState.viewBackgroundColor, '#f7f7f7');
  assert.equal(page.appState.zoom.value, 1.25);
  assert.equal(page.files.asset.dataURL, 'data:image/png;base64,AA==');
});

test('tombstones and unrelated files remain persisted through reopen', () => {
  const applied = apply([op('create-shape', { ref: 'temp:shape', shape: 'rectangle', bounds: { x: 0, y: 0, width: 80, height: 40 } })]);
  const deleted = apply([op('delete-element', { elementRef: applied.createdRefs['temp:shape'] })], { elements: applied.scene.elements, appState: { viewBackgroundColor: '#fff' }, files: { keep: { id: 'keep', mimeType: 'text/plain', dataURL: 'data:text/plain;base64,QQ==' } } });
  const document = { type: 'ideasketch', formatVersion: '1.0', created: 'now', modified: 'now', pages: [{ id: 'page-1', title: 'Tombstone', elements: deleted.scene.elements, appState: deleted.scene.appState, files: deleted.scene.files }] };
  const reopened = parseIdeaSketchFile(serializeIdeaSketchDocument(document));
  assert.equal(reopened.pages[0].elements.find((element) => element.id === 'generated-1').isDeleted, true);
  assert.equal(reopened.pages[0].files.keep.dataURL, 'data:text/plain;base64,QQ==');
});
