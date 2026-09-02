import test from 'node:test';
import assert from 'node:assert/strict';

import { createSemanticSceneProjection } from '../src/lib/ideasketch-sdk/sceneProjection.ts';
import { element } from './ideaSketchSdkTestUtils.mjs';

test('scene projection paginates and upgrades cumulative relation coverage', () => {
  const projection = createSemanticSceneProjection({
    pageRef: 'page:one',
    maxLimit: 2,
    elements: [
      element('shape', 'rectangle', { boundElements: [{ id: 'text', type: 'text' }] }),
      element('text', 'text', { type: 'text', originalText: 'Hello', text: 'Hello', containerId: 'shape' }),
      element('other', 'ellipse', { x: 200 }),
    ],
  });
  const first = projection.read({ limit: 1 });
  assert.equal(first.status, 'succeeded');
  assert.equal(first.value.complete, false);
  assert.equal(first.value.elements[0].relationsComplete, false);
  assert.equal(first.value.coverage.mutationReadyRefs.includes('element:shape'), false);
  const second = projection.read({ snapshotId: first.value.snapshotId, cursor: first.value.nextCursor, limit: 2 });
  assert.equal(second.status, 'succeeded');
  assert.equal(second.value.complete, true);
  assert.ok(second.value.coverage.mutationReadyRefs.includes('element:shape'));
  assert.ok(second.value.coverage.mutationReadyRefs.includes('element:text'));
});

test('projection helpers reject malformed option payloads without throwing', () => {
  const projection = createSemanticSceneProjection({
    pageRef: 'page:one',
    elements: [],
    files: {},
  });
  assert.doesNotThrow(() => projection.read(null));
  assert.equal(projection.read(null).error.code, 'invalid_request');
  assert.doesNotThrow(() => projection.getElements(null));
  assert.equal(projection.getElements(null).error.code, 'invalid_request');
  assert.doesNotThrow(() => projection.assets.list(null));
  assert.equal(projection.assets.list(null).error.code, 'invalid_request');
});

test('projection read helpers reject malformed booleans, sparse refs, and inherited options', () => {
  const projection = createSemanticSceneProjection({ pageRef: 'page:one', elements: [], files: {} });
  assert.equal(projection.read({ includeDeleted: 'yes' }).error.code, 'invalid_request');
  const refs = [];
  refs.length = 1;
  assert.equal(projection.getElements({ snapshotId: 'scene-snapshot:missing', refs }).error.code, 'invalid_request');
  const inherited = Object.create({ limit: 1 });
  assert.equal(projection.read(inherited).error.code, 'invalid_request');
  assert.equal(projection.assets.list(Object.create({ limit: 1 })).error.code, 'invalid_request');
});

test('scene projection excludes deleted closure members from default mutation coverage', () => {
  const projection = createSemanticSceneProjection({
    pageRef: 'page:one',
    elements: [
      element('shape', 'rectangle', { boundElements: [{ id: 'text', type: 'text' }] }),
      element('text', 'text', { type: 'text', originalText: 'deleted', text: 'deleted', containerId: 'shape', isDeleted: true }),
    ],
  });
  const read = projection.read({ limit: 10 });
  assert.equal(read.status, 'succeeded');
  assert.deepEqual(read.value.elements.map((item) => item.ref), ['element:shape']);
  assert.deepEqual(read.value.coverage.mutationReadyRefs, []);
  assert.equal(read.value.elements[0].relationsComplete, false);
});

test('preserved-only elements remain identity-readable but never mutation-ready', () => {
  const projection = createSemanticSceneProjection({
    pageRef: 'page:one',
    elements: [
      { id: 'line', type: 'line', x: 0, y: 0, width: 10, height: 10, points: [[0, 0], [10, 10]], version: 1, versionNonce: 1 },
      { id: 'image', type: 'image', x: 20, y: 0, width: 10, height: 10, version: 1, versionNonce: 1 },
      { id: 'future', type: 'future-widget', x: 30, y: 0, width: 10, height: 10, version: 1, versionNonce: 4 },
      { id: 'shape', type: 'rectangle', x: 40, y: 0, width: 10, height: 10, version: 1, versionNonce: 1 },
    ],
  });
  const read = projection.read({ limit: 50 });
  assert.equal(read.status, 'succeeded');
  assert.deepEqual(read.value.coverage.mutationReadyRefs, ['element:shape']);
  assert.deepEqual(read.value.coverage.identityRefs, ['element:future', 'element:image', 'element:line', 'element:shape']);
});

test('includeDeleted reads expose tombstones without upgrading them to mutation-ready', () => {
  const projection = createSemanticSceneProjection({
    pageRef: 'page:one',
    elements: [element('deleted', 'rectangle', { isDeleted: true })],
  });
  const read = projection.read({ limit: 10, includeDeleted: true });
  assert.equal(read.status, 'succeeded');
  assert.deepEqual(read.value.elements.map((item) => item.ref), ['element:deleted']);
  assert.deepEqual(read.value.coverage.mutationReadyRefs, []);
});

test('deleted Camera tombstones do not poison live Camera order coverage', () => {
  const camera = (id, order, isDeleted = false) => element(id, 'rectangle', {
    width: 40,
    height: 40,
    isDeleted,
    customData: { type: 'camera', order },
    strokeColor: '#1e90ff',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'dashed',
    roughness: 0,
    opacity: 60,
    roundness: null,
  });
  const projection = createSemanticSceneProjection({
    pageRef: 'page:one',
    elements: [camera('c1', 1), camera('deleted-c2', 2, true), camera('c3', 2)],
  });
  const read = projection.read({ limit: 10 });
  assert.equal(read.status, 'succeeded');
  assert.deepEqual(read.value.coverage.mutationReadyRefs, ['camera:c1', 'camera:c3']);
  assert.equal(read.value.elements.find((item) => item.ref === 'camera:c3').relationsMalformed, false);
});

test('malformed one-sided relations never become mutation-ready', () => {
  const projection = createSemanticSceneProjection({
    pageRef: 'page:one',
    elements: [element('shape', 'rectangle', { boundElements: [{ id: 'arrow', type: 'arrow' }] }), element('arrow', 'arrow')],
  });
  const read = projection.read({ limit: 10 });
  assert.equal(read.status, 'succeeded');
  assert.equal(read.value.coverage.mutationReadyRefs.length, 0);
  assert.equal(read.value.elements.find((item) => item.ref === 'element:shape').relationsComplete, false);
});

test('malformed relation field shapes remain identity-only during reads', () => {
  for (const malformed of [
    element('shape', 'rectangle', { boundElements: 'not-an-array' }),
    element('arrow', 'arrow', { startBinding: 'not-a-binding' }),
    element('text', 'text', { type: 'text', originalText: 'label', text: 'label', containerId: 42 }),
  ]) {
    const projection = createSemanticSceneProjection({ pageRef: 'page:one', elements: [malformed] });
    const read = projection.read({ limit: 10 });
    assert.equal(read.status, 'succeeded');
    assert.equal(read.value.coverage.mutationReadyRefs.length, 0);
    assert.equal(read.value.elements[0].relationsMalformed, true);
    assert.equal('malformed' in read.value.elements[0].relations, false);
    assert.equal(read.value.elements[0].relationsComplete, false);
  }
});

test('standalone text with vertical-only alignment remains identity-only', () => {
  const projection = createSemanticSceneProjection({
    pageRef: 'page:one',
    elements: [element('text', 'text', {
      type: 'text',
      originalText: 'standalone',
      text: 'standalone',
      verticalAlign: 'middle',
    })],
  });
  const read = projection.read({ limit: 10 });
  assert.equal(read.status, 'succeeded');
  assert.equal(read.value.elements[0].relationsMalformed, true);
  assert.deepEqual(read.value.coverage.mutationReadyRefs, []);
});

test('unsafe native ids are omitted from public refs and malformed relations stay fail-closed', () => {
  const projection = createSemanticSceneProjection({
    pageRef: 'page:one',
    elements: [
      element('safe', 'rectangle', { boundElements: [{ id: 'bad\nid', type: 'arrow' }] }),
      element('bad\nid', 'ellipse'),
    ],
  });
  const read = projection.read({ limit: 10 });
  assert.equal(read.status, 'succeeded');
  assert.deepEqual(read.value.elements.map((item) => item.ref), ['element:safe']);
  assert.equal(read.value.elements[0].relationsMalformed, true);
  assert.deepEqual(read.value.coverage.identityRefs, ['element:safe']);
});

test('semantic summaries retain supported shape style and connector geometry', () => {
  const projection = createSemanticSceneProjection({
    pageRef: 'page:one',
    elements: [
      element('shape', 'rectangle', {
        backgroundColor: '#fff',
        strokeColor: '#111',
        strokeWidth: 2,
        strokeStyle: 'dashed',
        fillStyle: 'solid',
        roundness: { type: 3 },
        opacity: 80,
        roughness: 0,
      }),
      element('arrow', 'arrow', {
        x: 0,
        y: 0,
        points: [[0, 0], [20, 10]],
        strokeColor: '#222',
        strokeWidth: 3,
        startArrowhead: 'none',
        endArrowhead: 'triangle',
      }),
    ],
  });
  const read = projection.read({ limit: 10 });
  assert.equal(read.status, 'succeeded');
  const shape = read.value.elements.find((item) => item.ref === 'element:shape');
  const arrow = read.value.elements.find((item) => item.ref === 'element:arrow');
  assert.deepEqual(shape.style, {
    backgroundColor: '#fff', strokeColor: '#111', strokeWidth: 2, strokeStyle: 'dashed',
    fillStyle: 'solid', roundness: 'rounded', opacity: 80, roughness: 0,
  });
  assert.deepEqual(arrow.points, [[0, 0], [20, 10]]);
  assert.deepEqual(arrow.arrowheads, { start: 'none', end: 'triangle' });
  assert.deepEqual(arrow.style, { strokeColor: '#222', strokeWidth: 3 });
});

test('group membership closure uses peer element refs and stays bounded', () => {
  const projection = createSemanticSceneProjection({
    pageRef: 'page:one',
    maxLimit: 2,
    elements: [
      element('a', 'rectangle', { groupIds: ['group-1'] }),
      element('b', 'ellipse', { groupIds: ['group-1'], x: 100 }),
      element('c', 'diamond', { groupIds: ['group-2'], x: 200 }),
    ],
  });
  const first = projection.read({ limit: 1 });
  assert.equal(first.status, 'succeeded');
  assert.equal(first.value.elements[0].relations.groupRefs[0], 'element:b');
  assert.equal(first.value.elements[0].relationsComplete, false);
  const closure = projection.getElements({ snapshotId: first.value.snapshotId, refs: ['element:a'] });
  assert.equal(closure.status, 'succeeded');
  assert.deepEqual(closure.value.elements.map((item) => item.ref).sort(), ['element:a', 'element:b']);
  const oversized = createSemanticSceneProjection({
    pageRef: 'page:one',
    maxLimit: 2,
    elements: [
      element('root', 'rectangle', { boundElements: [
        { id: 'a1', type: 'arrow' }, { id: 'a2', type: 'arrow' }, { id: 'a3', type: 'arrow' },
      ] }),
      element('a1', 'arrow', { startBinding: { elementId: 'root' }, boundElements: null }),
      element('a2', 'arrow', { startBinding: { elementId: 'root' }, boundElements: null }),
      element('a3', 'arrow', { startBinding: { elementId: 'root' }, boundElements: null }),
    ],
  });
  const oversizedRead = oversized.read({ limit: 2 });
  assert.equal(oversizedRead.status, 'rejected');
  assert.equal(oversizedRead.error.code, 'limit_exceeded');
});
