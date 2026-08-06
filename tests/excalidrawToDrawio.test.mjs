import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/lib/excalidrawToDrawio.ts');
  } catch {
    return {};
  }
}

const metadata = {
  diagramName: 'Page & 1',
  modifiedAt: '2026-08-06T00:00:00.000Z',
};

test('convertExcalidrawToDrawio maps shapes, bound text, connectors, and filtering', async () => {
  const { convertExcalidrawToDrawio } = await loadModule();

  assert.equal(typeof convertExcalidrawToDrawio, 'function');

  const elements = [
      {
        id: 'rect-1', type: 'rectangle', x: -20, y: -10, width: 100, height: 60,
        strokeColor: '#123456', backgroundColor: '#abcdef', strokeWidth: 5,
        strokeStyle: 'dashed', fillStyle: 'hachure', roughness: 2, opacity: 80,
        roundness: { type: 3 }, angle: Math.PI / 2,
      },
      {
        id: 'label-1', type: 'text', containerId: 'rect-1', x: -10, y: 5,
        width: 80, height: 30, text: 'A < B & C', fontSize: 20, fontFamily: 2,
        textAlign: 'center', verticalAlign: 'middle', strokeColor: '#111111', opacity: 100,
      },
      {
        id: 'ellipse-1', type: 'ellipse', x: 130, y: 20, width: 80, height: 50,
        strokeColor: '#222222', backgroundColor: 'transparent', strokeWidth: 1,
        strokeStyle: 'solid', fillStyle: 'solid', roughness: 0, opacity: 100,
      },
      {
        id: 'diamond-1', type: 'diamond', x: 250, y: 10, width: 70, height: 70,
        strokeColor: '#333333', backgroundColor: '#ffffff', strokeWidth: 1,
        strokeStyle: 'solid', fillStyle: 'solid', roughness: 0, opacity: 100,
      },
      {
        id: 'arrow-1', type: 'arrow', x: 80, y: 20, width: 70, height: 20,
        points: [[0, 0], [35, 20], [70, 0]], strokeColor: '#ff0000', strokeWidth: 4,
        strokeStyle: 'dotted', opacity: 55, startArrowhead: null, endArrowhead: 'arrow',
        startBinding: { elementId: 'rect-1' }, endBinding: { elementId: 'ellipse-1' },
      },
      {
        id: 'text-1', type: 'text', x: 340, y: 20, width: 120, height: 30,
        text: 'Standalone', fontSize: 18, fontFamily: 3, textAlign: 'left',
        verticalAlign: 'top', strokeColor: '#445566', opacity: 40,
      },
      {
        id: 'camera-1', type: 'rectangle', x: 0, y: 0, width: 400, height: 300,
        customData: { type: 'camera' },
      },
      { id: 'camera-preview', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 },
      { id: 'deleted-1', type: 'ellipse', x: 0, y: 0, width: 10, height: 10, isDeleted: true },
      { id: 'frame-1', type: 'frame', x: 0, y: 0, width: 20, height: 20 },
    ];
  const originalElements = structuredClone(elements);
  const result = convertExcalidrawToDrawio({
    elements,
    files: {},
  }, metadata);

  assert.equal(result.summary.exported, 6);
  assert.equal(result.summary.skipped, 1);
  assert.deepEqual(result.summary.skippedTypes, ['frame']);
  assert.match(result.xml, /<mxfile[^>]+modified="2026-08-06T00:00:00\.000Z"/);
  assert.match(result.xml, /<diagram id="page-1" name="Page &amp; 1">/);
  assert.match(result.xml, /shape=rectangle/);
  assert.match(result.xml, /shape=ellipse/);
  assert.match(result.xml, /shape=rhombus/);
  assert.match(result.xml, /strokeColor=#123456;strokeWidth=2;fillColor=#abcdef/);
  assert.match(result.xml, /strokeColor=#ff0000;strokeWidth=2;fillColor=none/);
  assert.equal((result.xml.match(/fontFamily=Helvetica/g) ?? []).length, 2);
  assert.doesNotMatch(result.xml, /rounded=1/);
  assert.doesNotMatch(result.xml, /sketch=1/);
  assert.doesNotMatch(result.xml, /jiggle=/);
  assert.doesNotMatch(result.xml, /dashed=1/);
  assert.doesNotMatch(result.xml, /dashPattern=/);
  assert.doesNotMatch(result.xml, /opacity=/);
  assert.doesNotMatch(result.xml, /fontFamily=(?:Times New Roman|Courier New|Comic Sans MS|Georgia)/);
  assert.match(result.xml, /rotation=90/);
  assert.match(result.xml, /x="0" y="0" width="100" height="60"/);
  assert.match(result.xml, /source="2" target="3"/);
  assert.match(result.xml, /endArrow=block/);
  assert.match(result.xml, /A &amp;lt; B &amp;amp; C/);
  assert.doesNotMatch(result.xml, /camera-preview/);
  assert.deepEqual(elements, originalElements);
});

test('convertExcalidrawToDrawio embeds image and freehand payloads', async () => {
  const { convertExcalidrawToDrawio } = await loadModule();

  assert.equal(typeof convertExcalidrawToDrawio, 'function');

  const result = convertExcalidrawToDrawio({
    elements: [
      {
        id: 'image-1', type: 'image', fileId: 'file-1', x: 10, y: 20, width: 120, height: 80,
        strokeColor: '#000000', backgroundColor: 'transparent', strokeWidth: 1, opacity: 100,
      },
      {
        id: 'free-1', type: 'freedraw', x: 150, y: 50, width: 40, height: 20,
        points: [[0, 0], [10, 10], [40, 5]], strokeColor: '#445566', strokeWidth: 3,
        backgroundColor: 'transparent', opacity: 70,
      },
    ],
    files: {
      'file-1': { dataURL: 'data:image/png;base64,AA==' },
    },
  }, metadata);

  assert.equal(result.summary.exported, 2);
  assert.equal(result.summary.skipped, 0);
  assert.match(result.xml, /image=data:image\/png,AA==/);
  assert.match(result.xml, /image=data:image\/svg\+xml,/);
  assert.match(result.xml, /stroke-opacity/);
});

test('convertExcalidrawToDrawio is deterministic for injected metadata and handles an empty Page', async () => {
  const { convertExcalidrawToDrawio } = await loadModule();

  assert.equal(typeof convertExcalidrawToDrawio, 'function');

  const first = convertExcalidrawToDrawio({ elements: [], files: {} }, metadata);
  const second = convertExcalidrawToDrawio({ elements: [], files: {} }, metadata);

  assert.deepEqual(first, second);
  assert.equal(first.summary.exported, 0);
  assert.equal(first.summary.skipped, 0);
  assert.match(first.xml, /<mxCell id="0"\/>/);
  assert.match(first.xml, /<mxCell id="1" parent="0"\/>/);
  assert.equal((first.xml.match(/vertex="1"/g) ?? []).length, 0);
  assert.equal((first.xml.match(/edge="1"/g) ?? []).length, 0);
});
