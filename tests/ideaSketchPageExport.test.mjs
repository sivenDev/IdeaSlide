import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/lib/ideaSketchPageExport.ts');
  } catch {
    return {};
  }
}

async function loadDocumentModule() {
  return import('../src/lib/ideaSketchDocument.ts');
}

const fullPage = {
  id: 'page-source',
  title: 'Roadmap / Q3',
  elements: [
    { id: 'shape-1', type: 'rectangle', x: 10, y: 20, customField: { keep: true } },
    { id: 'shape-2', type: 'text', text: 'Hello' },
  ],
  appState: { viewBackgroundColor: '#0d0d0d', gridSize: 20, zoom: { value: 1.5 } },
  files: {
    'image-1': {
      id: 'image-1',
      mimeType: 'image/png',
      dataURL: 'data:image/png;base64,cG5n',
      status: 'saved',
    },
  },
};

test('projects a full Page into a standard editable Excalidraw scene envelope', async () => {
  const { projectPageToExcalidrawScene } = await loadModule();
  assert.equal(typeof projectPageToExcalidrawScene, 'function');

  const source = structuredClone(fullPage);
  const scene = projectPageToExcalidrawScene(source);

  assert.equal(scene.type, 'excalidraw');
  assert.equal(scene.version, 2);
  assert.equal(scene.source, 'https://excalidraw.com');
  assert.deepEqual(scene.elements, fullPage.elements);
  assert.deepEqual(scene.elements[0].customField, { keep: true });
  assert.deepEqual(scene.appState, fullPage.appState);
  assert.deepEqual(scene.files, fullPage.files);

  // Mutating the projection must not touch the mounted editor draft.
  scene.elements[0].x = 999;
  scene.appState.zoom.value = 4;
  scene.files['image-1'].dataURL = 'data:image/png;base64,tampered';
  assert.deepEqual(source, fullPage);
});

test('projects a minimal Page into empty collections without inventing data', async () => {
  const { projectPageToExcalidrawScene } = await loadModule();
  const scene = projectPageToExcalidrawScene({
    id: 'blank',
    title: 'Blank',
    elements: [],
    appState: {},
    files: {},
  });
  assert.deepEqual(scene.elements, []);
  assert.deepEqual(scene.appState, {});
  assert.deepEqual(scene.files, {});
});

test('projects a Page into a fresh canonical one-Page IdeaSketch document', async () => {
  const { projectPageToIdeaSketchDocument } = await loadModule();
  assert.equal(typeof projectPageToIdeaSketchDocument, 'function');

  const source = structuredClone(fullPage);
  const document = projectPageToIdeaSketchDocument(source, {
    now: '2026-08-19T00:00:00Z',
    pageId: 'page-source',
  });

  assert.equal(document.type, 'ideasketch');
  assert.equal(document.formatVersion, '1.0');
  assert.equal(document.created, '2026-08-19T00:00:00Z');
  assert.equal(document.modified, '2026-08-19T00:00:00Z');
  assert.equal(document.pages.length, 1);
  assert.equal(document.pages[0].id, 'page-source');
  assert.equal(document.pages[0].title, 'Roadmap / Q3');
  assert.deepEqual(document.pages[0].elements, fullPage.elements);
  assert.deepEqual(document.pages[0].files, fullPage.files);

  // Independent identity: mutating the projection leaves the source untouched.
  document.pages[0].elements.push({ id: 'injected' });
  document.pages[0].files['image-1'].dataURL = 'tampered';
  assert.deepEqual(source, fullPage);
});

test('one-Page projection round-trips through canonical v1 serialization with embedded media', async () => {
  const { projectPageToIdeaSketchDocument } = await loadModule();
  const { serializeIdeaSketchDocument, parseIdeaSketchFile } = await loadDocumentModule();

  const document = projectPageToIdeaSketchDocument(structuredClone(fullPage), {
    now: '2026-08-19T00:00:00Z',
    pageId: 'page-source',
  });
  const serialized = serializeIdeaSketchDocument(document, '2026-08-19T01:00:00Z');

  // No orphan media: files stay embedded in the Page content, media stays empty.
  assert.deepEqual(serialized.media, []);
  assert.equal(
    serialized.slides[0].content.files['image-1'].dataURL,
    'data:image/png;base64,cG5n',
  );

  const reopened = parseIdeaSketchFile(serialized);
  assert.equal(reopened.pages.length, 1);
  assert.equal(reopened.pages[0].title, 'Roadmap / Q3');
  assert.deepEqual(reopened.pages[0].elements, fullPage.elements);
  assert.equal(reopened.pages[0].files['image-1'].dataURL, 'data:image/png;base64,cG5n');
});

test('sanitizes Page titles into safe filenames with a single required extension', async () => {
  const { getExcalidrawExportFileName, getIdeaSketchExportFileName } = await loadModule();

  assert.equal(getExcalidrawExportFileName('Roadmap / Q3:*?'), 'Roadmap - Q3.excalidraw');
  assert.equal(getExcalidrawExportFileName('  Sketch.excalidraw  '), 'Sketch.excalidraw');
  assert.equal(getExcalidrawExportFileName('   '), 'page.excalidraw');
  assert.equal(getExcalidrawExportFileName('...'), 'page.excalidraw');

  assert.equal(getIdeaSketchExportFileName('Roadmap / Q3:*?'), 'Roadmap - Q3.is');
  assert.equal(getIdeaSketchExportFileName('  Notes.is  '), 'Notes.is');
  assert.equal(getIdeaSketchExportFileName(''), 'page.is');
});

test('exportPageAsExcalidraw writes exact UTF-8 JSON bytes to a chosen native path', async () => {
  const { exportPageAsExcalidraw, projectPageToExcalidrawScene } = await loadModule();
  assert.equal(typeof exportPageAsExcalidraw, 'function');

  const requests = [];
  const writes = [];
  const result = await exportPageAsExcalidraw(structuredClone(fullPage), {
    isTauriRuntime: () => true,
    choosePath: async (fileName) => {
      requests.push(fileName);
      return '/tmp/Roadmap - Q3.excalidraw';
    },
    writeBytes: async (path, data) => writes.push({ path, data }),
    download: () => assert.fail('native export must not use browser download'),
  });

  assert.deepEqual(requests, ['Roadmap - Q3.excalidraw']);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, '/tmp/Roadmap - Q3.excalidraw');

  const expectedContents = JSON.stringify(projectPageToExcalidrawScene(fullPage), null, 2);
  assert.deepEqual(writes[0].data, Array.from(new TextEncoder().encode(expectedContents)));

  // The bytes decode back into a scene an editor can reopen.
  const reopened = JSON.parse(new TextDecoder().decode(new Uint8Array(writes[0].data)));
  assert.equal(reopened.type, 'excalidraw');
  assert.deepEqual(reopened.elements, fullPage.elements);

  assert.deepEqual(result, {
    status: 'saved',
    fileName: 'Roadmap - Q3.excalidraw',
    path: '/tmp/Roadmap - Q3.excalidraw',
  });
});

test('exportPageAsExcalidraw cancels without writing and downloads outside Tauri', async () => {
  const { exportPageAsExcalidraw } = await loadModule();

  let writeCount = 0;
  const cancelled = await exportPageAsExcalidraw(structuredClone(fullPage), {
    isTauriRuntime: () => true,
    choosePath: async () => null,
    writeBytes: async () => { writeCount += 1; },
    download: () => assert.fail('cancelled export must not download'),
  });
  assert.deepEqual(cancelled, { status: 'cancelled', fileName: 'Roadmap - Q3.excalidraw' });
  assert.equal(writeCount, 0);

  const downloads = [];
  const downloaded = await exportPageAsExcalidraw(structuredClone(fullPage), {
    isTauriRuntime: () => false,
    choosePath: async () => assert.fail('browser export must not open native dialog'),
    writeBytes: async () => assert.fail('browser export must not invoke native write'),
    download: (fileName, contents) => downloads.push({ fileName, contents }),
  });
  assert.equal(downloaded.status, 'downloaded');
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].fileName, 'Roadmap - Q3.excalidraw');
  assert.equal(JSON.parse(downloads[0].contents).type, 'excalidraw');
});

test('exportPageAsIdeaSketch saves a projected one-Page document through the safe boundary', async () => {
  const { exportPageAsIdeaSketch } = await loadModule();
  assert.equal(typeof exportPageAsIdeaSketch, 'function');

  const requests = [];
  const saved = [];
  const source = structuredClone(fullPage);
  const result = await exportPageAsIdeaSketch(source, {
    choosePath: async (fileName) => {
      requests.push(fileName);
      return '/tmp/Roadmap - Q3.is';
    },
    saveDocument: async (path, model) => saved.push({ path, model }),
    now: () => '2026-08-19T00:00:00Z',
  });

  assert.deepEqual(requests, ['Roadmap - Q3.is']);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].path, '/tmp/Roadmap - Q3.is');
  assert.equal(saved[0].model.type, 'ideasketch');
  assert.equal(saved[0].model.formatVersion, '1.0');
  assert.equal(saved[0].model.pages.length, 1);
  assert.equal(saved[0].model.pages[0].title, 'Roadmap / Q3');
  assert.deepEqual(saved[0].model.pages[0].elements, fullPage.elements);

  // The saved model is independent of the mounted draft.
  saved[0].model.pages[0].elements.push({ id: 'injected' });
  assert.deepEqual(source, fullPage);

  assert.deepEqual(result, {
    status: 'saved',
    fileName: 'Roadmap - Q3.is',
    path: '/tmp/Roadmap - Q3.is',
  });
});

test('exportPageAsIdeaSketch cancels without touching the safe write boundary', async () => {
  const { exportPageAsIdeaSketch } = await loadModule();

  let saveCount = 0;
  const cancelled = await exportPageAsIdeaSketch(structuredClone(fullPage), {
    choosePath: async () => null,
    saveDocument: async () => { saveCount += 1; },
    now: () => '2026-08-19T00:00:00Z',
  });
  assert.deepEqual(cancelled, { status: 'cancelled', fileName: 'Roadmap - Q3.is' });
  assert.equal(saveCount, 0);
});
