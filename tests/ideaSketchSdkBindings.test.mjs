import test from 'node:test';
import assert from 'node:assert/strict';

import { apply, element, op, rejectedApply } from './ideaSketchSdkTestUtils.mjs';
import { applyIdeaSketchScenePlan } from '../src/lib/ideasketch-sdk/excalidrawSceneAdapter.ts';
import { validateIdeaSketchScenePostconditions } from '../src/lib/ideasketch-sdk/scenePostconditions.ts';

test('arrow binding maintains symmetric records and same-target rebind is a noop', () => {
  const created = apply([op('create-shape', { ref: 'temp:s', shape: 'rectangle', bounds: { x: 0, y: 0, width: 80, height: 60 } }), op('create-arrow', { ref: 'temp:a', points: [[-20, 20], [150, 20]] }), op('bind-arrow', { arrowRef: 'temp:a', start: { endpoint: 'start', targetRef: 'temp:s' } })]);
  const arrow = created.scene.elements.find((item) => item.type === 'arrow');
  const shape = created.scene.elements.find((item) => item.type === 'rectangle');
  assert.equal(arrow.startBinding.elementId, shape.id);
  assert.ok(Array.isArray(arrow.startBinding.fixedPoint));
  assert.equal(arrow.startBinding.fixedPoint.length, 2);
  assert.ok(shape.boundElements.some((item) => item.id === arrow.id && item.type === 'arrow'));
  assert.deepEqual([...created.operations[2].affectedRefs].sort(), [`element:${arrow.id}`, `element:${shape.id}`].sort());
  const noop = apply([op('bind-arrow', { arrowRef: `element:${arrow.id}`, start: { endpoint: 'start', targetRef: `element:${shape.id}` } })], { elements: created.scene.elements });
  assert.equal(noop.operations[0].outcome, 'noop');
});

test('moving a shape updates both arrow endpoints when both bind to that shape', () => {
  const created = apply([
    op('create-shape', { ref: 'temp:s', shape: 'rectangle', bounds: { x: 40, y: 40, width: 80, height: 60 } }),
    op('create-arrow', { ref: 'temp:a', points: [[40, 50], [120, 90]] }),
    op('bind-arrow', { arrowRef: 'temp:a', start: { endpoint: 'start', targetRef: 'temp:s' }, end: { endpoint: 'end', targetRef: 'temp:s' } }),
  ]);
  const arrow = created.scene.elements.find((item) => item.type === 'arrow');
  const moved = apply([op('move-element', { elementRef: created.createdRefs['temp:s'], dx: 10, dy: 20 })], { elements: created.scene.elements });
  const nextArrow = moved.scene.elements.find((item) => item.id === arrow.id);
  const before = arrow.points.map((point) => [point[0] + arrow.x, point[1] + arrow.y]);
  const after = nextArrow.points.map((point) => [point[0] + nextArrow.x, point[1] + nextArrow.y]);
  assert.deepEqual(after, before.map(([x, y]) => [x + 10, y + 20]));
});

test('mounted adapter accepts host-native arrow binding geometry', () => {
  let calls = 0;
  const result = applyIdeaSketchScenePlan({
    scene: { elements: [], appState: {}, files: {} },
    operations: [
      op('create-shape', { ref: 'temp:s', shape: 'rectangle', bounds: { x: 0, y: 0, width: 80, height: 60 } }),
      op('create-arrow', { ref: 'temp:a', points: [[-20, 20], [150, 20]] }),
      op('bind-arrow', { arrowRef: 'temp:a', start: { endpoint: 'start', targetRef: 'temp:s' } }),
    ],
    runtime: {
      createId: (() => { let id = 0; return () => `native-${++id}`; })(),
      createNonce: () => 1,
      now: () => 1,
      calculateArrowBinding: ({ target }) => {
        calls += 1;
        return { focus: 0.25, gap: 3, fixedPoint: [0.5, 0.25], point: [40, 15] };
      },
    },
    maxCameraCount: 200,
    cameraMinWidth: 16,
    cameraMinHeight: 16,
  });
  assert.equal(result.status, 'succeeded');
  assert.equal(calls, 1);
  const arrow = result.value.scene.elements.find((item) => item.type === 'arrow');
  assert.deepEqual(arrow.startBinding, { elementId: 'native-1', focus: 0.25, gap: 3, fixedPoint: [0.5, 0.25] });
});

test('unbind-arrow preserves endpoint world coordinates and removes reverse relation', () => {
  const created = apply([op('create-shape', { ref: 'temp:s', shape: 'rectangle', bounds: { x: 0, y: 0, width: 80, height: 60 } }), op('create-arrow', { ref: 'temp:a', points: [[-10, 20], [100, 20]] }), op('bind-arrow', { arrowRef: 'temp:a', start: { endpoint: 'start', targetRef: 'temp:s' } })]);
  const arrow = created.scene.elements.find((item) => item.type === 'arrow');
  const shape = created.scene.elements.find((item) => item.type === 'rectangle');
  const before = arrow.points.map((point) => [point[0] + arrow.x, point[1] + arrow.y]);
  const unbound = apply([op('unbind-arrow', { arrowRef: `element:${arrow.id}`, endpoint: 'start' })], { elements: created.scene.elements });
  const next = unbound.scene.elements.find((item) => item.id === arrow.id);
  assert.equal(next.startBinding, null);
  assert.deepEqual(next.points.map((point) => [point[0] + next.x, point[1] + next.y]), before);
  assert.equal(unbound.scene.elements.find((item) => item.id === shape.id).boundElements, null);
});

test('unbind-arrow keeps a shared reverse relation while the other endpoint remains bound', () => {
  const created = apply([
    op('create-shape', { ref: 'temp:s', shape: 'rectangle', bounds: { x: 0, y: 0, width: 80, height: 60 } }),
    op('create-arrow', { ref: 'temp:a', points: [[-20, 20], [120, 20]] }),
    op('bind-arrow', {
      arrowRef: 'temp:a',
      start: { endpoint: 'start', targetRef: 'temp:s' },
      end: { endpoint: 'end', targetRef: 'temp:s' },
    }),
  ]);
  const arrowRef = created.createdRefs['temp:a'];
  const shapeRef = created.createdRefs['temp:s'];
  const unbound = apply([op('unbind-arrow', { arrowRef, endpoint: 'start' })], { elements: created.scene.elements });
  const arrow = unbound.scene.elements.find((item) => item.id === arrowRef.split(':')[1]);
  const shape = unbound.scene.elements.find((item) => item.id === shapeRef.split(':')[1]);
  assert.equal(arrow.startBinding, null);
  assert.equal(arrow.endBinding.elementId, shape.id);
  assert.ok(shape.boundElements.some((item) => item.id === arrow.id && item.type === 'arrow'));
});

test('connector geometry remeasures imported arrow labels at the path midpoint', () => {
  const scene = [
    element('arrow', 'arrow', { x: 0, y: 0, width: 100, height: 0, points: [[0, 0], [100, 0]], boundElements: [{ id: 'label', type: 'text' }] }),
    element('label', 'text', { x: 0, y: 0, width: 40, height: 20, text: 'imported', originalText: 'imported', containerId: 'arrow', customData: { imported: true } }),
  ];
  const updated = apply([op('set-connector-points', { arrowRef: 'element:arrow', points: [[0, 0], [200, 0]] })], { elements: scene });
  const label = updated.scene.elements.find((item) => item.id === 'label');
  assert.equal(label.containerId, 'arrow');
  assert.equal(label.x + label.width / 2, 100);
  assert.ok(updated.updatedRefs.includes('element:label'));
});

test('unbind-text rejects malformed Camera text containers', () => {
  const scene = [
    {
      ...element('camera', 'rectangle', {
        customData: { type: 'camera', order: 1 },
        strokeColor: '#1e90ff',
        backgroundColor: 'transparent',
        strokeWidth: 2,
        strokeStyle: 'dashed',
        roughness: 0,
        opacity: 60,
        boundElements: [{ id: 'label', type: 'text' }],
      }),
    },
    element('label', 'text', { containerId: 'camera', originalText: 'label', text: 'label' }),
  ];
  const result = rejectedApply([op('unbind-text', { textRef: 'element:label' })], { elements: scene });
  assert.equal(result.status, 'rejected');
  assert.equal(result.error.code, 'relation_conflict');
});

test('unrelated mutations preserve valid arrow relations to locked shapes', () => {
  const scene = [
    element('shape', 'rectangle', { boundElements: [{ id: 'arrow', type: 'arrow' }], locked: true }),
    element('arrow', 'arrow', { points: [[0, 0], [100, 0]], startBinding: { elementId: 'shape', focus: 0, gap: 1 }, endBinding: null }),
  ];
  const result = apply([op('create-text', { ref: 'temp:text', x: 20, y: 30, text: 'unrelated' })], { elements: scene });
  assert.equal(result.scene.elements.find((item) => item.id === 'arrow').startBinding.elementId, 'shape');
  assert.equal(result.scene.elements.find((item) => item.id === 'shape').locked, true);
});

test('scene postconditions reject malformed live geometry and arrow points', () => {
  assert.equal(validateIdeaSketchScenePostconditions({ elements: [element('shape', 'rectangle', { x: Number.POSITIVE_INFINITY })] }).status, 'rejected');
  assert.equal(validateIdeaSketchScenePostconditions({ elements: [element('shape', 'rectangle', { width: 0 })] }).status, 'rejected');
  assert.equal(validateIdeaSketchScenePostconditions({ elements: [element('arrow', 'arrow', { points: 'bad' })] }).status, 'rejected');
});
