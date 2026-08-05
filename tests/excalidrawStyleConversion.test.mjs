import test from 'node:test';
import assert from 'node:assert/strict';

const {
  buildNewPageStyleConversion,
  buildCurrentPageStyleConversion,
  getStyleConversionAvailability,
  formatStyleConversionSummary,
} = await import('../src/lib/excalidrawStyleConversion.ts');

function element(id, type, overrides = {}) {
  return {
    id,
    type,
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    angle: 0,
    strokeColor: '#1e1e1e',
    backgroundColor: '#a5d8ff',
    fillStyle: 'hachure',
    strokeWidth: 2,
    strokeStyle: 'dashed',
    roughness: 2,
    opacity: 80,
    groupIds: [],
    frameId: null,
    boundElements: null,
    version: 1,
    versionNonce: 10,
    updated: 100,
    isDeleted: false,
    ...overrides,
  };
}

const deterministic = {
  createId: (() => {
    let index = 0;
    return () => `new-${++index}`;
  })(),
  createNonce: (() => {
    let index = 100;
    return () => ++index;
  })(),
  now: () => 500,
};

test('current Page conversion normalizes selected basic elements without mutating scene relationships', () => {
  const scene = [
    element('shape', 'rectangle', {
      groupIds: ['group-a'],
      boundElements: [{ id: 'label', type: 'text' }, { id: 'arrow', type: 'arrow' }],
    }),
    element('label', 'text', {
      groupIds: ['group-a'],
      containerId: 'shape',
      fontFamily: 1,
      text: 'Hello',
      originalText: 'Hello',
    }),
    element('arrow', 'arrow', {
      points: [[0, 0], [100, 0]],
      startBinding: { elementId: 'shape', focus: 0, gap: 1 },
      endBinding: { elementId: 'outside', focus: 0, gap: 1 },
    }),
    element('outside', 'ellipse'),
    element('camera', 'rectangle', { customData: { type: 'camera', order: 1 } }),
  ];
  const original = structuredClone(scene);

  const result = buildCurrentPageStyleConversion(
    scene,
    { shape: true, camera: true },
    deterministic,
  );

  assert.deepEqual(scene, original);
  assert.equal(result.summary.converted, 2);
  assert.equal(result.summary.skipped, 1);
  assert.equal(result.elements[0].roughness, 0);
  assert.equal(result.elements[0].strokeStyle, 'solid');
  assert.equal(result.elements[0].fillStyle, 'solid');
  assert.equal(result.elements[0].strokeWidth, 2);
  assert.equal(result.elements[0].opacity, 100);
  assert.equal(result.elements[0].roundness, null);
  assert.equal(result.elements[0].id, 'shape');
  assert.equal(result.elements[0].version, 2);
  assert.deepEqual(result.elements[0].boundElements, original[0].boundElements);
  assert.equal(result.elements[1].fontFamily, 2);
  assert.equal(result.elements[1].opacity, 100);
  assert.equal(result.elements[1].containerId, 'shape');
  assert.deepEqual(result.convertedElementIds, { shape: true, label: true });
  assert.deepEqual(result.elements[2], original[2]);
  assert.deepEqual(result.elements[4], original[4]);
});

test('new Page conversion remaps internal identities, detaches outside bindings, and projects image files', () => {
  const scene = [
    element('shape', 'diamond', {
      groupIds: ['group-a'],
      boundElements: [{ id: 'label', type: 'text' }, { id: 'arrow', type: 'arrow' }],
    }),
    element('label', 'text', {
      groupIds: ['group-a'],
      containerId: 'shape',
      fontFamily: 1,
      text: 'Decision',
      originalText: 'Decision',
    }),
    element('arrow', 'arrow', {
      points: [[0, 0], [100, 0]],
      startBinding: { elementId: 'shape', focus: 0, gap: 1 },
      endBinding: { elementId: 'outside', focus: 0, gap: 1 },
    }),
    element('image', 'image', { fileId: 'file-1' }),
    element('outside', 'ellipse'),
    element('embed', 'embeddable'),
  ];
  const files = {
    'file-1': { id: 'file-1', dataURL: 'data:image/png;base64,AA==' },
    'file-unused': { id: 'file-unused', dataURL: 'data:image/png;base64,BB==' },
  };
  const originalScene = structuredClone(scene);
  const originalFiles = structuredClone(files);

  const result = buildNewPageStyleConversion(
    scene,
    { shape: true, arrow: true, image: true, embed: true },
    files,
    deterministic,
  );

  assert.deepEqual(scene, originalScene);
  assert.deepEqual(files, originalFiles);
  assert.equal(result.summary.converted, 3);
  assert.equal(result.summary.retained, 1);
  assert.equal(result.summary.skipped, 1);
  assert.equal(result.elements.length, 4);
  assert.deepEqual(Object.keys(result.files), ['file-1']);

  const copiedShape = result.elements.find((item) => item.type === 'diamond');
  const copiedText = result.elements.find((item) => item.type === 'text');
  const copiedArrow = result.elements.find((item) => item.type === 'arrow');
  assert.notEqual(copiedShape.id, 'shape');
  assert.notEqual(copiedText.id, 'label');
  assert.equal(copiedText.containerId, copiedShape.id);
  assert.equal(copiedShape.roundness, null);
  assert.equal(copiedShape.opacity, 100);
  assert.equal(copiedArrow.roundness, null);
  assert.equal(copiedArrow.strokeWidth, 2);
  assert.equal(copiedArrow.opacity, 100);
  assert.equal(copiedArrow.startBinding.elementId, copiedShape.id);
  assert.equal(copiedArrow.endBinding, null);
  assert.equal(copiedShape.groupIds[0], copiedText.groupIds[0]);
  assert.notEqual(copiedShape.groupIds[0], 'group-a');
  assert.deepEqual(
    Object.keys(result.selectedElementIds).sort(),
    result.elements.map((item) => item.id).sort(),
  );
  assert.deepEqual(
    Object.keys(result.convertedElementIds).sort(),
    [copiedShape.id, copiedText.id, copiedArrow.id].sort(),
  );
});

test('conversion availability requires a writable selection with at least one style delta', () => {
  const rough = element('rough', 'rectangle');
  const clean = element('clean', 'rectangle', {
    roughness: 0,
    strokeStyle: 'solid',
    fillStyle: 'solid',
    strokeWidth: 2,
    opacity: 100,
    roundness: null,
  });
  const rounded = element('rounded', 'rectangle', {
    roughness: 0,
    strokeStyle: 'solid',
    fillStyle: 'solid',
    strokeWidth: 2,
    opacity: 100,
    roundness: { type: 3 },
  });
  const camera = element('camera', 'rectangle', { customData: { type: 'camera', order: 1 } });

  assert.equal(getStyleConversionAvailability([rough], { rough: true }), true);
  assert.equal(getStyleConversionAvailability([clean], { clean: true }), false);
  assert.equal(getStyleConversionAvailability([rounded], { rounded: true }), true);
  assert.equal(getStyleConversionAvailability([camera], { camera: true }), false);
  assert.equal(getStyleConversionAvailability([rough], {}), false);
  assert.equal(getStyleConversionAvailability([rough], { rough: true }, true), false);
});

test('mixed selections formalize supported geometry, retain images, and skip freehand or unsupported copies', () => {
  const scene = [
    element('ellipse', 'ellipse', { strokeColor: '#1971c2', opacity: 55 }),
    element('line', 'line', { points: [[0, 0], [80, 20]], backgroundColor: 'transparent' }),
    element('freehand', 'freedraw', { points: [[0, 0], [4, 8]], pressures: [0.5, 0.6] }),
    element('image', 'image', { fileId: 'file-1' }),
    element('camera', 'rectangle', { customData: { type: 'camera', order: 1 } }),
    element('embed', 'embeddable'),
    element('deleted', 'rectangle', { isDeleted: true }),
  ];
  const selected = Object.fromEntries(scene.map((item) => [item.id, true]));

  const current = buildCurrentPageStyleConversion(scene, selected, deterministic);
  assert.deepEqual(current.summary, { converted: 2, retained: 1, skipped: 3 });
  assert.equal(current.elements[0].roughness, 0);
  assert.equal(current.elements[0].fillStyle, 'solid');
  assert.equal(current.elements[0].strokeColor, '#1971c2');
  assert.equal(current.elements[0].opacity, 100);
  assert.equal(current.elements[0].strokeWidth, 2);
  assert.equal(current.elements[0].roundness, null);
  assert.equal(current.elements[1].roughness, 0);
  assert.equal(current.elements[1].strokeStyle, 'solid');
  assert.equal(current.elements[1].fillStyle, 'solid');
  assert.equal(current.elements[1].strokeWidth, 2);
  assert.equal(current.elements[1].opacity, 100);
  assert.equal(current.elements[1].roundness, null);
  assert.equal(current.elements[2], scene[2]);
  assert.equal(current.elements[3], scene[3]);
  assert.equal(current.elements[4], scene[4]);
  assert.equal(current.elements[5], scene[5]);
  assert.equal(current.elements[6], scene[6]);

  const copied = buildNewPageStyleConversion(
    scene,
    selected,
    { 'file-1': { id: 'file-1', dataURL: 'data:image/png;base64,AA==' } },
    deterministic,
  );
  assert.deepEqual(copied.summary, { converted: 2, retained: 1, skipped: 3 });
  assert.deepEqual(copied.elements.map((item) => item.type), ['ellipse', 'line', 'image']);
  assert.deepEqual(Object.keys(copied.files), ['file-1']);
});

test('conversion summary is concise and stable', () => {
  assert.equal(
    formatStyleConversionSummary({ converted: 3, retained: 1, skipped: 2 }),
    'Converted 3 elements. Kept 1 unchanged. Skipped 2 elements that could not be formalized.',
  );
});
