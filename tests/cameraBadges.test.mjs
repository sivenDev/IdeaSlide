import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCameraBadgeSignature,
  getCameraBadges,
} from '../src/lib/cameraBadges.ts';

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

test('getCameraBadges projects normalized camera bounds into viewport coordinates', () => {
  const badges = getCameraBadges(
    [
      makeElement({
        id: 'camera-3',
        x: 100,
        y: 80,
        width: -40,
        height: 20,
        strokeColor: '#1e90ff',
        customData: { type: 'camera', order: 3 },
      }),
      makeElement({
        id: 'shape-1',
      }),
    ],
    {
      scrollX: 10,
      scrollY: -20,
      zoom: { value: 2 },
      offsetLeft: 24,
      offsetTop: 16,
    },
    {
      left: 20,
      top: 10,
    },
  );

  assert.deepEqual(badges, [
    {
      id: 'camera-3',
      order: 3,
      left: 144,
      top: 126,
      strokeColor: '#1e90ff',
    },
  ]);
});

test('buildCameraBadgeSignature ignores selection churn but reacts to order and viewport changes', () => {
  const elements = [
    makeElement({
      id: 'camera-1',
      x: 40,
      y: 50,
      width: 120,
      height: 90,
      customData: { type: 'camera', order: 1 },
    }),
  ];

  const baseline = buildCameraBadgeSignature(elements, {
    scrollX: 0,
    scrollY: 0,
    zoom: { value: 1 },
    selectedElementIds: { 'camera-1': true },
  }, {
    left: 12,
    top: 8,
  });

  assert.equal(
    buildCameraBadgeSignature(elements, {
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 },
      selectedElementIds: {},
    }, {
      left: 12,
      top: 8,
    }),
    baseline,
  );

  assert.notEqual(
    buildCameraBadgeSignature(
      [
        makeElement({
          id: 'camera-1',
          x: 40,
          y: 50,
          width: 120,
          height: 90,
          customData: { type: 'camera', order: 2 },
        }),
      ],
      {
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 },
      },
      {
        left: 12,
        top: 8,
      },
    ),
    baseline,
  );

  assert.notEqual(
    buildCameraBadgeSignature(
      [
        makeElement({
          id: 'camera-1',
          x: 40,
          y: 50,
          width: 120,
          height: 90,
          strokeColor: '#ff006e',
          customData: { type: 'camera', order: 1 },
        }),
      ],
      {
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 },
      },
      {
        left: 12,
        top: 8,
      },
    ),
    baseline,
  );

  assert.notEqual(
    buildCameraBadgeSignature(elements, {
      scrollX: 10,
      scrollY: 0,
      zoom: { value: 1 },
    }, {
      left: 12,
      top: 8,
    }),
    baseline,
  );

  assert.notEqual(
    buildCameraBadgeSignature(elements, {
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 },
    }, {
      left: 20,
      top: 8,
    }),
    baseline,
  );
});
