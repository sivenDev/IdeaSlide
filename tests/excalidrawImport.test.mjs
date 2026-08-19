import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  return import('../src/lib/excalidrawImport.ts');
}

const validScene = {
  type: 'excalidraw',
  version: 2,
  source: 'https://excalidraw.com',
  elements: [
    { id: 'shape-1', type: 'rectangle', x: 10, y: 20, customField: { keep: true } },
    { id: 'deleted', type: 'ellipse', isDeleted: true },
  ],
  appState: { name: '  Product sketch  ', viewBackgroundColor: '#fff' },
  files: {
    'image-1': {
      id: 'image-1',
      mimeType: 'image/png',
      dataURL: 'data:image/png;base64,cG5n',
      status: 'saved',
    },
  },
};

test('imports a standard scene, removes only explicitly deleted elements, and preserves fields/files', async () => {
  const { parseExcalidrawImport } = await loadModule();
  const input = structuredClone(validScene);
  const imported = parseExcalidrawImport(input, 'source.excalidraw');

  assert.equal(imported.title, 'Product sketch');
  assert.deepEqual(imported.elements, [validScene.elements[0]]);
  assert.deepEqual(imported.elements[0].customField, { keep: true });
  assert.deepEqual(imported.files, validScene.files);
  assert.deepEqual(input, validScene);
});

test('normalizes a minimal scene and derives a sanitized filename title', async () => {
  const { parseExcalidrawImport, createIdeaSketchPageFromImport, createIdeaSketchDocumentFromImport } = await loadModule();
  const imported = parseExcalidrawImport({}, '  roadmap draft.excalidraw.json ');
  assert.equal(imported.title, 'roadmap draft');
  assert.deepEqual(imported.elements, []);
  assert.deepEqual(imported.appState, {});
  assert.deepEqual(imported.files, {});

  const page = createIdeaSketchPageFromImport(imported, { pageId: 'page-imported', now: '2026-08-19T00:00:00Z' });
  assert.equal(page.id, 'page-imported');
  assert.equal(page.title, 'roadmap draft');
  assert.equal(page.elements.length, 0);

  const document = createIdeaSketchDocumentFromImport(imported, { pageId: 'page-imported', now: '2026-08-19T00:00:00Z' });
  assert.equal(document.type, 'ideasketch');
  assert.equal(document.pages.length, 1);
  assert.equal(document.pages[0].id, 'page-imported');
  assert.equal(document.created, '2026-08-19T00:00:00Z');
});

test('uses appState name first, then source filename, then a deterministic fallback', async () => {
  const { parseExcalidrawImport } = await loadModule();
  assert.equal(parseExcalidrawImport({ appState: { name: 'Named' } }, 'file.excalidraw').title, 'Named');
  assert.equal(parseExcalidrawImport({ appState: {} }, 'file.excalidraw').title, 'file');
  assert.equal(parseExcalidrawImport({ appState: {} }, undefined).title, 'Imported Page');
  assert.equal(parseExcalidrawImport({ appState: { name: 'a/b\n c' } }).title, 'a b c');
});

test('rejects malformed JSON shapes and unsupported file types without partial projections', async () => {
  const { parseExcalidrawImport } = await loadModule();
  assert.throws(() => parseExcalidrawImport(null), /object/i);
  assert.throws(() => parseExcalidrawImport({ type: 'drawio' }), /Excalidraw/i);
  assert.throws(() => parseExcalidrawImport({ elements: 'not-an-array' }), /elements/i);
  assert.throws(() => parseExcalidrawImport({ files: [] }), /files/i);
  assert.throws(() => parseExcalidrawImport({ elements: [null] }), /element/i);
});

test('sanitizes empty and unsafe titles while preserving unknown element payloads', async () => {
  const { parseExcalidrawImport, sanitizeImportTitle, deriveImportBaseName } = await loadModule();
  assert.equal(sanitizeImportTitle('  /  '), 'Imported Page');
  assert.equal(sanitizeImportTitle('a\\b\u0000 c'), 'a b c');
  assert.equal(deriveImportBaseName('nested/source.excalidraw.json'), 'source');
  assert.equal(deriveImportBaseName('source.excalidraw'), 'source');
  assert.equal(deriveImportBaseName('source.json'), 'source');
  const imported = parseExcalidrawImport({ elements: [{ id: 'x', unknown: { value: 1 } }] }, 'source.excalidraw');
  assert.deepEqual(imported.elements[0].unknown, { value: 1 });
});
