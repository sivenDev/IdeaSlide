import test from 'node:test';
import assert from 'node:assert/strict';

import { applyIdeaSketchScenePlan } from '../src/lib/ideasketch-sdk/excalidrawSceneAdapter.ts';
import { apply, op, element } from './ideaSketchSdkTestUtils.mjs';

test('Camera append preserves historical gaps while indexed insertion normalizes order', () => {
  const existing = [
    { id: 'c1', type: 'rectangle', x: 0, y: 0, width: 40, height: 40, angle: 0, version: 1, versionNonce: 1, updated: 1, isDeleted: false, locked: false, groupIds: [], frameId: null, boundElements: null, strokeColor: '#1e90ff', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'dashed', roughness: 0, opacity: 60, roundness: null, customData: { type: 'camera', order: 2 } },
  ];
  const appended = apply([op('create-camera', { ref: 'temp:c2', bounds: { x: 100, y: 0, width: 20, height: 20 } })], { elements: existing });
  assert.equal(appended.scene.elements.find((item) => item.id === 'c1').customData.order, 2);
  assert.equal(appended.scene.elements.find((item) => item.id === 'generated-1').customData.order, 3);
  const inserted = apply([op('create-camera', { ref: 'temp:c2', bounds: { x: 100, y: 0, width: 20, height: 20 }, atIndex: 0 })], { elements: existing });
  assert.deepEqual(inserted.scene.elements.filter((item) => item.customData?.type === 'camera').sort((a, b) => a.customData.order - b.customData.order).map((item) => item.customData.order), [1, 2]);
});

test('Camera order accepts an empty list only when no live Cameras exist and rejects out-of-range insertion', () => {
  const empty = apply([op('set-camera-order', { cameraRefs: [] })]);
  assert.equal(empty.operations[0].outcome, 'noop');
  const result = apply([op('create-camera', { ref: 'temp:c', bounds: { x: 0, y: 0, width: 20, height: 20 } })]);
  const invalid = applyIdeaSketchScenePlan({ scene: { elements: result.scene.elements, appState: {}, files: {} }, operations: [op('create-camera', { ref: 'temp:c2', bounds: { x: 0, y: 0, width: 20, height: 20 }, atIndex: 2 })] });
  assert.equal(invalid.error.code, 'invalid_request');
});

test('updating Camera bounds with the same geometry is a noop', () => {
  const existing = [{ id: 'c1', type: 'rectangle', x: 0, y: 0, width: 40, height: 40, angle: 0, version: 3, versionNonce: 7, updated: 9, isDeleted: false, locked: false, groupIds: [], frameId: null, boundElements: null, strokeColor: '#1e90ff', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'dashed', roughness: 0, opacity: 60, roundness: null, customData: { type: 'camera', order: 1 } }];
  const result = apply([op('update-camera-bounds', { cameraRef: 'camera:c1', bounds: { x: 0, y: 0, width: 40, height: 40 } })], { elements: existing });
  assert.equal(result.operations[0].outcome, 'noop');
  assert.deepEqual(result.updatedRefs, []);
  assert.equal(result.scene.elements[0].version, 3);
});

test('Camera deletion only rewrites orders that actually change', () => {
  const existing = [
    { id: 'c1', type: 'rectangle', x: 0, y: 0, width: 40, height: 40, angle: 0, version: 1, versionNonce: 1, updated: 1, isDeleted: false, locked: false, groupIds: [], frameId: null, boundElements: null, strokeColor: '#1e90ff', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'dashed', roughness: 0, opacity: 60, roundness: null, customData: { type: 'camera', order: 1 } },
    { id: 'c2', type: 'rectangle', x: 60, y: 0, width: 40, height: 40, angle: 0, version: 1, versionNonce: 2, updated: 1, isDeleted: false, locked: false, groupIds: [], frameId: null, boundElements: null, strokeColor: '#1e90ff', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'dashed', roughness: 0, opacity: 60, roundness: null, customData: { type: 'camera', order: 2 } },
    { id: 'c4', type: 'rectangle', x: 120, y: 0, width: 40, height: 40, angle: 0, version: 1, versionNonce: 3, updated: 1, isDeleted: false, locked: false, groupIds: [], frameId: null, boundElements: null, strokeColor: '#1e90ff', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'dashed', roughness: 0, opacity: 60, roundness: null, customData: { type: 'camera', order: 4 } },
  ];
  const result = apply([op('delete-camera', { cameraRef: 'camera:c2' })], { elements: existing });
  assert.deepEqual(result.updatedRefs, ['camera:c4']);
  assert.equal(result.scene.elements.find((item) => item.id === 'c1').version, 1);
  assert.equal(result.scene.elements.find((item) => item.id === 'c4').customData.order, 2);
});

test('Camera with an empty boundElements array remains valid', () => {
  const camera = element('camera', 'rectangle', {
    width: 100,
    height: 80,
    boundElements: [],
    customData: { type: 'camera', order: 1 },
    strokeColor: '#1e90ff',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'dashed',
    roughness: 0,
    opacity: 60,
    roundness: null,
  });
  const result = apply([op('update-camera-bounds', { cameraRef: 'camera:camera', bounds: { x: 0, y: 0, width: 120, height: 90 } })], { elements: [camera] });
  assert.equal(result.scene.elements.find((item) => item.id === 'camera').width, 120);
});
