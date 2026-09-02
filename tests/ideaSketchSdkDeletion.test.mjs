import test from 'node:test';
import assert from 'node:assert/strict';

import { applyIdeaSketchScenePlan } from '../src/lib/ideasketch-sdk/excalidrawSceneAdapter.ts';
import { apply, element, op } from './ideaSketchSdkTestUtils.mjs';

test('deleting a shape cascades bound text, unbinds arrows, tombstones, and clears selection', () => {
  const scene = [
    element('shape', 'rectangle', { boundElements: [{ id: 'text', type: 'text' }, { id: 'arrow', type: 'arrow' }] }),
    element('text', 'text', { originalText: 'label', text: 'label', containerId: 'shape' }),
    element('arrow', 'arrow', { points: [[0, 0], [100, 0]], startBinding: { elementId: 'shape', focus: 0, gap: 6 }, endBinding: null }),
  ];
  scene[2].boundElements = null;
  const result = apply([op('delete-element', { elementRef: 'element:shape' })], { elements: scene, appState: { selectedElementIds: { shape: true, arrow: true } } });
  assert.equal(result.scene.elements.find((item) => item.id === 'shape').isDeleted, true);
  assert.equal(result.scene.elements.find((item) => item.id === 'text').isDeleted, true);
  assert.equal(result.scene.elements.find((item) => item.id === 'arrow').startBinding, null);
  assert.deepEqual(result.scene.appState.selectedElementIds, { arrow: true });
  assert.ok(result.deletedRefs.includes('element:shape'));
  assert.ok(result.deletedRefs.includes('element:text'));
  assert.ok(result.cascadedRefs.includes('element:text'));
});

test('deleting into locked bound text fails without mutating the input scene', () => {
  const scene = [element('shape', 'rectangle', { boundElements: [{ id: 'text', type: 'text' }] }), element('text', 'text', { originalText: 'locked', text: 'locked', containerId: 'shape', locked: true })];
  const before = structuredClone(scene);
  const result = applyIdeaSketchScenePlan({ scene: { elements: scene, appState: {}, files: {} }, operations: [op('delete-element', { elementRef: 'element:shape' })] });
  assert.equal(result.error.code, 'locked_target');
  assert.deepEqual(scene, before);
});

test('deleting bound text refuses to modify a locked or imported container', () => {
  for (const containerOverrides of [{ locked: true }, { customData: { imported: true } }]) {
    const scene = [
      element('shape', 'rectangle', { boundElements: [{ id: 'text', type: 'text' }], ...containerOverrides }),
      element('text', 'text', { originalText: 'label', text: 'label', containerId: 'shape' }),
    ];
    const before = structuredClone(scene);
    const result = applyIdeaSketchScenePlan({ scene: { elements: scene, appState: {}, files: {} }, operations: [op('delete-element', { elementRef: 'element:text' })] });
    assert.equal(result.status, 'rejected');
    assert.ok(['locked_target', 'unsupported_operation'].includes(result.error.code));
    assert.deepEqual(scene, before);
  }
});

test('deleting a bound arrow refuses to modify a locked endpoint target', () => {
  const scene = [
    element('shape', 'rectangle', { boundElements: [{ id: 'arrow', type: 'arrow' }], locked: true }),
    element('arrow', 'arrow', { points: [[0, 0], [100, 0]], startBinding: { elementId: 'shape', focus: 0, gap: 6 }, endBinding: null }),
  ];
  const before = structuredClone(scene);
  const result = applyIdeaSketchScenePlan({ scene: { elements: scene, appState: {}, files: {} }, operations: [op('delete-element', { elementRef: 'element:arrow' })] });
  assert.equal(result.status, 'rejected');
  assert.equal(result.error.code, 'locked_target');
  assert.deepEqual(scene, before);
});
