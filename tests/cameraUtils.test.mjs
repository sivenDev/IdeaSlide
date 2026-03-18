import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getElementsInCamera,
  getSelectedCameraId,
  intersectsRegion,
  moveItemByOffset,
} from '../src/lib/cameraUtils.ts';

function makeElement(overrides = {}) {
  return {
    id: 'element-1',
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    isDeleted: false,
    customData: undefined,
    ...overrides,
  };
}

test('intersectsRegion treats negative element dimensions as real bounds', () => {
  const region = { x: 60, y: 60, width: 20, height: 20 };
  const reverseDrawnElement = makeElement({
    x: 100,
    y: 100,
    width: -50,
    height: -50,
  });

  assert.equal(intersectsRegion(reverseDrawnElement, region), true);
});

test('getElementsInCamera keeps reverse-drawn elements that overlap the camera', () => {
  const camera = {
    id: 'camera-1',
    order: 1,
    bounds: { x: 60, y: 60, width: 20, height: 20 },
  };

  const elements = [
    makeElement({
      id: 'shape-1',
      x: 100,
      y: 100,
      width: -50,
      height: -50,
    }),
    makeElement({
      id: 'camera-element',
      customData: { type: 'camera', order: 1 },
    }),
  ];

  assert.deepEqual(
    getElementsInCamera(elements, camera).map((element) => element.id),
    ['shape-1'],
  );
});

test('getSelectedCameraId returns the selected camera and ignores non-camera selections', () => {
  const cameras = [
    {
      id: 'camera-1',
      order: 1,
      bounds: { x: 0, y: 0, width: 100, height: 100 },
    },
    {
      id: 'camera-2',
      order: 2,
      bounds: { x: 150, y: 0, width: 100, height: 100 },
    },
  ];

  assert.equal(
    getSelectedCameraId(cameras, {
      'shape-1': true,
      'camera-2': true,
    }),
    'camera-2',
  );

  assert.equal(
    getSelectedCameraId(cameras, {
      'shape-1': true,
    }),
    undefined,
  );
});

test('moveItemByOffset moves a camera one slot to the left', () => {
  assert.deepEqual(
    moveItemByOffset(['camera-1', 'camera-2', 'camera-3', 'camera-4'], 2, -1),
    ['camera-1', 'camera-3', 'camera-2', 'camera-4'],
  );
});

test('moveItemByOffset moves a camera one slot to the right', () => {
  assert.deepEqual(
    moveItemByOffset(['camera-1', 'camera-2', 'camera-3', 'camera-4'], 1, 1),
    ['camera-1', 'camera-3', 'camera-2', 'camera-4'],
  );
});

test('moveItemByOffset leaves the list unchanged when the move would go out of bounds', () => {
  assert.deepEqual(
    moveItemByOffset(['camera-a', 'camera-b', 'camera-c'], 0, -1),
    ['camera-a', 'camera-b', 'camera-c'],
  );
  assert.deepEqual(
    moveItemByOffset(['camera-a', 'camera-b', 'camera-c'], 2, 1),
    ['camera-a', 'camera-b', 'camera-c'],
  );
});
