import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/lib/ideaSketchDocument.ts');
  } catch {
    return {};
  }
}

test('empty IdeaSketch documents use v1 and one titled Page', async () => {
  const { createEmptyIdeaSketchDocument } = await loadModule();
  assert.equal(typeof createEmptyIdeaSketchDocument, 'function');

  const document = createEmptyIdeaSketchDocument({
    now: '2026-08-03T00:00:00Z',
    pageId: 'page-1',
  });

  assert.equal(document.type, 'ideasketch');
  assert.equal(document.formatVersion, '1.0');
  assert.equal(document.pages.length, 1);
  assert.equal(document.pages[0].title, 'Untitled page');
  assert.deepEqual(document.pages[0].elements, []);
});

test('v1 parse and serialize preserve Page order, titles, and scene data', async () => {
  const { parseIdeaSketchFile, serializeIdeaSketchDocument } = await loadModule();
  assert.equal(typeof parseIdeaSketchFile, 'function');
  assert.equal(typeof serializeIdeaSketchDocument, 'function');

  const parsed = parseIdeaSketchFile({
    manifest: {
      version: '1.0', created: 'c', modified: 'm',
      slides: [
        { id: 'page-b', title: 'B' },
        { id: 'page-a', title: 'A' },
      ],
    },
    slides: [
      { id: 'page-b', content: { type: 'excalidraw', version: 2, elements: [{ id: 'b' }], appState: { zoom: 2 }, files: {} } },
      { id: 'page-a', content: { type: 'excalidraw', version: 2, elements: [{ id: 'a' }], appState: {}, files: {} } },
    ],
    media: [],
  });

  assert.deepEqual(parsed.pages.map((page) => page.id), ['page-b', 'page-a']);
  assert.equal(parsed.pages[0].title, 'B');
  assert.deepEqual(parsed.pages[0].appState, { zoom: 2 });

  const serialized = serializeIdeaSketchDocument(parsed, 'later');
  assert.equal(serialized.manifest.version, '1.0');
  assert.equal(serialized.manifest.modified, 'later');
  assert.deepEqual(serialized.manifest.slides.map((entry) => entry.id), ['page-b', 'page-a']);
  assert.deepEqual(serialized.slides[1].content.elements, [{ id: 'a' }]);
});

test('v1 parsing rejects duplicate ids and protects legacy v2', async () => {
  const { parseIdeaSketchFile } = await loadModule();
  assert.equal(typeof parseIdeaSketchFile, 'function');

  assert.throws(() => parseIdeaSketchFile({
    manifest: {
      version: '1.0', created: 'c', modified: 'm',
      slides: [{ id: 'same', title: 'One' }, { id: 'same', title: 'Two' }],
    },
    slides: [{ id: 'same', content: {} }],
  }), /duplicate.*same/i);

  assert.throws(() => parseIdeaSketchFile({
    manifest: { version: '2.0', created: 'c', modified: 'm', resources: [] },
    contents: [],
  }), (error) => error?.kind === 'legacy-protected' && error?.version === '2.0');
});

test('legacy media entries reconstruct image data without requiring media on the next save', async () => {
  const { parseIdeaSketchFile, serializeIdeaSketchDocument } = await loadModule();
  const parsed = parseIdeaSketchFile({
    manifest: {
      version: '1.0', created: 'c', modified: 'm',
      slides: [{ id: 'page-1', title: 'Image' }],
    },
    slides: [{
      id: 'page-1',
      content: {
        type: 'excalidraw', version: 2,
        elements: [{ type: 'image', fileId: 'img-1' }],
        appState: {},
        files: { 'img-1': { id: 'img-1', mimeType: 'image/png' } },
      },
    }],
    media: [{ id: 'img-1', mimeType: 'image/png', ext: 'png', bytesBase64: 'cG5n' }],
  });

  assert.equal(parsed.pages[0].files['img-1'].dataURL, 'data:image/png;base64,cG5n');
  const serialized = serializeIdeaSketchDocument(parsed, 'later');
  assert.equal(serialized.media.length, 0);
  assert.equal(serialized.slides[0].content.files['img-1'].dataURL, 'data:image/png;base64,cG5n');
});
