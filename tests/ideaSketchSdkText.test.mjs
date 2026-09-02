import test from 'node:test';
import assert from 'node:assert/strict';

import { apply, element, op, rejectedApply } from './ideaSketchSdkTestUtils.mjs';
import { applyIdeaSketchScenePlan } from '../src/lib/ideasketch-sdk/excalidrawSceneAdapter.ts';

test('standalone text preserves bounded width and supports content/style/layout updates', () => {
  const created = apply([op('create-text', { ref: 'temp:t', x: 10, y: 20, text: 'abcdefghij', layout: { autoResize: false, width: 200 }, style: { fontFamily: 'code', fontSize: 18 } })]);
  const text = created.scene.elements[0];
  assert.equal(text.type, 'text');
  assert.equal(text.width, 200);
  assert.equal(text.fontFamily, 3);
  const updated = apply([op('set-text', { textRef: created.createdRefs['temp:t'], text: 'updated' }), op('set-text-style', { textRef: created.createdRefs['temp:t'], style: { fontSize: 24 } })], { elements: created.scene.elements });
  assert.equal(updated.scene.elements[0].originalText, 'updated');
  assert.equal(updated.scene.elements[0].fontSize, 24);
  assert.equal(updated.scene.elements[0].width, 200);
});

test('standalone text width-only layout patches switch to bounded wrapping', () => {
  const created = apply([op('create-text', { ref: 'temp:t', x: 0, y: 0, text: 'a long standalone label' })]);
  const updated = apply([op('set-text-layout', { textRef: created.createdRefs['temp:t'], width: 40 })], { elements: created.scene.elements });
  const text = updated.scene.elements[0];
  assert.equal(text.autoResize, false);
  assert.equal(text.width, 40);
  assert.match(text.text, /\n/);
});

test('fallback text measurement wraps CJK and emoji at grapheme boundaries', () => {
  const created = apply([op('create-text', { ref: 'temp:t', x: 0, y: 0, text: '你好世界🙂🙂', layout: { width: 40 } })]);
  const text = created.scene.elements[0];
  assert.equal(text.autoResize, false);
  assert.equal(text.width, 40);
  assert.equal(text.text, '你好\n世界\n🙂🙂');
  assert.equal([...text.text].filter((character) => character === '�').length, 0);
});

test('mounted adapter accepts the host native text metric contract', () => {
  let measurements = 0;
  const result = applyIdeaSketchScenePlan({
    scene: { elements: [], appState: {}, files: {} },
    operations: [op('create-text', { ref: 'temp:t', x: 0, y: 0, text: 'native metrics' })],
    runtime: {
      createId: () => 'native-text',
      createNonce: () => 1,
      now: () => 1,
      measureText: (text, _font, _lineHeight) => {
        measurements += 1;
        return { width: text.length * 11, height: 24 };
      },
      wrapText: (text, _font, maxWidth) => text.length * 11 <= maxWidth ? text : `${text.slice(0, Math.max(1, Math.floor(maxWidth / 11)))}\n${text.slice(Math.max(1, Math.floor(maxWidth / 11)))}`,
    },
  });
  assert.equal(result.status, 'succeeded');
  assert.ok(measurements > 0);
  assert.equal(result.value.scene.elements[0].width, 154);
  assert.equal(result.value.scene.elements[0].height, 25);
});

test('bounded text wraps long unbroken tokens instead of exceeding the width', () => {
  const created = apply([op('create-text', { ref: 'temp:t', x: 0, y: 0, text: 'abcdefghij', layout: { width: 20 } })]);
  const text = created.scene.elements[0];
  assert.equal(text.width, 20);
  assert.match(text.text, /\n/);
  assert.equal(text.text.split('\n').every((line) => line.length <= 3), true);
});

test('set-text-layout width alone deterministically switches standalone text to bounded layout', () => {
  const created = apply([op('create-text', { ref: 'temp:t', x: 10, y: 20, text: 'abcdefghij' })]);
  const textRef = created.createdRefs['temp:t'];
  const updated = apply([op('set-text-layout', { textRef, width: 80 })], { elements: created.scene.elements });
  const text = updated.scene.elements.find((item) => item.id === textRef.split(':')[1]);
  assert.equal(text.autoResize, false);
  assert.equal(text.width, 80);
});

test('shape-bound text aligns, grows its container, and is kept adjacent', () => {
  const result = apply([op('create-shape', { ref: 'temp:s', shape: 'rectangle', bounds: { x: 100, y: 100, width: 200, height: 20 } }), op('upsert-bound-text', { shapeRef: 'temp:s', createRef: 'temp:t', text: 'center label', style: { textAlign: 'center', verticalAlign: 'middle', fontSize: 20 } })]);
  const shapeIndex = result.scene.elements.findIndex((item) => item.id === result.createdRefs['temp:s'].split(':')[1]);
  const textIndex = result.scene.elements.findIndex((item) => item.id === result.createdRefs['temp:t'].split(':')[1]);
  const shape = result.scene.elements[shapeIndex];
  const text = result.scene.elements[textIndex];
  assert.equal(text.containerId, shape.id);
  assert.equal(textIndex, shapeIndex + 1);
  assert.ok(shape.height > 20);
  assert.ok(text.x > shape.x + 8);
});

test('bound-text operation results report the container and created text refs', () => {
  const result = apply([op('create-shape', {
    ref: 'temp:s',
    shape: 'rectangle',
    bounds: { x: 0, y: 0, width: 80, height: 40 },
    boundText: { ref: 'temp:t', text: 'label' },
  })]);
  const shapeRef = result.createdRefs['temp:s'];
  const textRef = result.createdRefs['temp:t'];
  assert.deepEqual([...result.operations[0].affectedRefs].sort(), [shapeRef, textRef].sort());
  assert.equal(result.operations[0].bounds.x, 0);
  assert.equal(result.operations[0].bounds.y, 0);
  assert.equal(result.operations[0].bounds.width, 80);
  assert.ok(result.operations[0].bounds.height >= 40);
});

test('ellipse and diamond bound text use shape-specific geometry and grow safely', () => {
  for (const shapeType of ['ellipse', 'diamond']) {
    const result = apply([
      op('create-shape', { ref: 'temp:s', shape: shapeType, bounds: { x: 100, y: 100, width: 40, height: 24 } }),
      op('upsert-bound-text', { shapeRef: 'temp:s', createRef: 'temp:t', text: 'a longer bound label', style: { fontSize: 18 } }),
    ]);
    const shape = result.scene.elements.find((item) => item.id === result.createdRefs['temp:s'].split(':')[1]);
    const text = result.scene.elements.find((item) => item.id === result.createdRefs['temp:t'].split(':')[1]);
    assert.equal(text.containerId, shape.id);
    assert.ok(shape.width >= 40);
    assert.ok(shape.height >= 24);
    assert.ok(text.x >= shape.x);
    assert.ok(text.y >= shape.y);
    assert.ok(text.x + text.width <= shape.x + shape.width + 1);
    assert.ok(text.y + text.height <= shape.y + shape.height + 1);
  }
});

test('unbind-text remeasures as standalone text and strips SDK-only layout fields', () => {
  const created = apply([op('create-shape', { ref: 'temp:s', shape: 'rectangle', bounds: { x: 0, y: 0, width: 120, height: 60 } }), op('upsert-bound-text', { shapeRef: 'temp:s', createRef: 'temp:t', text: 'bound text' })]);
  const textId = created.createdRefs['temp:t'];
  const detached = apply([op('unbind-text', { textRef: textId })], { elements: created.scene.elements });
  const text = detached.scene.elements.find((item) => item.id === textId.split(':')[1]);
  assert.equal(text.containerId, null);
  assert.equal(text.autoResize, true);
  assert.equal('overflowPolicy' in text, false);
});

test('resize-element keepAspect preserves the existing shape ratio', () => {
  const created = apply([op('create-shape', { ref: 'temp:s', shape: 'rectangle', bounds: { x: 0, y: 0, width: 100, height: 50 } })]);
  const resized = apply([op('resize-element', { elementRef: created.createdRefs['temp:s'], width: 200, height: 200, keepAspect: true })], { elements: created.scene.elements });
  const shape = resized.scene.elements.find((item) => item.id === created.createdRefs['temp:s'].split(':')[1]);
  assert.equal(shape.width, 200);
  assert.equal(shape.height, 100);
});

test('bound text measurement clamps tiny container widths to a valid positive width', () => {
  const created = apply([
    op('create-shape', { ref: 'temp:s', shape: 'rectangle', bounds: { x: 0, y: 0, width: 8, height: 20 } }),
    op('upsert-bound-text', { shapeRef: 'temp:s', createRef: 'temp:t', text: 'label' }),
  ]);
  const updated = apply([
    op('set-text', { textRef: created.createdRefs['temp:t'], text: 'a longer label' }),
  ], { elements: created.scene.elements });
  const text = updated.scene.elements.find((item) => item.id === created.createdRefs['temp:t'].split(':')[1]);
  assert.ok(text.width >= 1);
  assert.ok(Number.isFinite(text.width));
});

test('text mutation rejects a malformed Camera text container', () => {
  const scene = [
    element('camera', 'rectangle', {
      customData: { type: 'camera', order: 1 },
      strokeColor: '#1e90ff',
      backgroundColor: 'transparent',
      strokeWidth: 2,
      strokeStyle: 'dashed',
      roughness: 0,
      opacity: 60,
      boundElements: [{ id: 'label', type: 'text' }],
    }),
    element('label', 'text', { containerId: 'camera', originalText: 'label', text: 'label' }),
  ];
  const result = rejectedApply([op('set-text', { textRef: 'element:label', text: 'updated' })], { elements: scene });
  assert.equal(result.status, 'rejected');
  assert.equal(result.error.code, 'unsupported_operation');
});
