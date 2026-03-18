import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/lib/cameraThumbnail.ts');
  } catch {
    return {};
  }
}

test('calculateCameraThumbnailViewBox converts scene-space camera bounds into exported SVG space', async () => {
  const { calculateCameraThumbnailViewBox } = await loadModule();

  assert.equal(typeof calculateCameraThumbnailViewBox, 'function');

  const viewBox = calculateCameraThumbnailViewBox({
    cameraBounds: { x: 80, y: 80, width: 500, height: 320 },
    sceneBounds: [120, 120, 500, 360],
    sourceViewBox: { x: 0, y: 0, width: 400, height: 260 },
  });

  assert.deepEqual(viewBox, {
    x: -30,
    y: -30,
    width: 500,
    height: 320,
  });
});

test('formatSvgViewBox serializes the computed camera crop box', async () => {
  const { formatSvgViewBox } = await loadModule();

  assert.equal(typeof formatSvgViewBox, 'function');
  assert.equal(
    formatSvgViewBox({ x: -30, y: -30, width: 500, height: 320 }),
    '-30 -30 500 320',
  );
});


test('getCameraThumbnailRenderableElements keeps slide content and removes camera rectangles', async () => {
  const { getCameraThumbnailRenderableElements } = await loadModule();

  assert.equal(typeof getCameraThumbnailRenderableElements, 'function');

  const elements = [
    {
      id: 'camera-1',
      isDeleted: false,
      customData: { type: 'camera', order: 1 },
    },
    {
      id: 'shape-1',
      isDeleted: false,
      customData: undefined,
    },
    {
      id: 'shape-2',
      isDeleted: true,
      customData: undefined,
    },
  ];

  assert.deepEqual(
    getCameraThumbnailRenderableElements(elements).map((element) => element.id),
    ['shape-1'],
  );
});


test('isCameraThumbnailGenerationEnabled only runs when the cameras panel is visible', async () => {
  const { isCameraThumbnailGenerationEnabled } = await loadModule();

  assert.equal(typeof isCameraThumbnailGenerationEnabled, 'function');
  assert.equal(isCameraThumbnailGenerationEnabled({ showPreview: true, bottomTab: 'cameras' }), true);
  assert.equal(isCameraThumbnailGenerationEnabled({ showPreview: false, bottomTab: 'cameras' }), false);
  assert.equal(isCameraThumbnailGenerationEnabled({ showPreview: true, bottomTab: 'slides' }), false);
});


test('buildCameraSignature stays stable across equivalent camera array instances', async () => {
  const { buildCameraSignature } = await loadModule();

  assert.equal(typeof buildCameraSignature, 'function');

  const first = buildCameraSignature([
    { id: 'camera-1', bounds: { x: 10, y: 20, width: 300, height: 200 } },
    { id: 'camera-2', bounds: { x: 40, y: 60, width: 120, height: 80 } },
  ]);
  const second = buildCameraSignature([
    { id: 'camera-1', bounds: { x: 10, y: 20, width: 300, height: 200 } },
    { id: 'camera-2', bounds: { x: 40, y: 60, width: 120, height: 80 } },
  ]);
  const moved = buildCameraSignature([
    { id: 'camera-1', bounds: { x: 12, y: 20, width: 300, height: 200 } },
    { id: 'camera-2', bounds: { x: 40, y: 60, width: 120, height: 80 } },
  ]);

  assert.equal(first, second);
  assert.notEqual(first, moved);
});

test('buildCameraThumbnailRenderKey combines scene and camera identities into a stable cache key', async () => {
  const { buildCameraThumbnailRenderKey } = await loadModule();

  assert.equal(typeof buildCameraThumbnailRenderKey, 'function');
  assert.equal(
    buildCameraThumbnailRenderKey('scene:a', 'camera:b'),
    'scene:a::camera:b',
  );
});

test('parseSvgMarkup returns the svg root element when the markup is valid', async () => {
  const { parseSvgMarkup } = await loadModule();

  assert.equal(typeof parseSvgMarkup, 'function');

  class FakeParser {
    parseFromString() {
      return {
        querySelector(selector) {
          if (selector !== 'svg') {
            return null;
          }

          return {
            tagName: 'svg',
            getAttribute(name) {
              return name === 'viewBox' ? '0 0 10 10' : null;
            },
          };
        },
      };
    }
  }

  const svg = parseSvgMarkup('<svg viewBox="0 0 10 10"></svg>', () => new FakeParser());

  assert.equal(svg?.tagName, 'svg');
  assert.equal(svg?.getAttribute('viewBox'), '0 0 10 10');
});

test('parseSvgMarkup returns null when no svg element can be parsed', async () => {
  const { parseSvgMarkup } = await loadModule();

  assert.equal(typeof parseSvgMarkup, 'function');

  class FakeParser {
    parseFromString() {
      return {
        querySelector() {
          return null;
        },
      };
    }
  }

  assert.equal(parseSvgMarkup('<div></div>', () => new FakeParser()), null);
});
