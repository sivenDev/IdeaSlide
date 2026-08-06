import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/lib/drawioExport.ts');
  } catch {
    return {};
  }
}

test('getDrawioFileName sanitizes Page titles and keeps one extension', async () => {
  const { getDrawioFileName } = await loadModule();

  assert.equal(typeof getDrawioFileName, 'function');
  assert.equal(getDrawioFileName('Roadmap / Q3:*?'), 'Roadmap - Q3.drawio');
  assert.equal(getDrawioFileName('  Architecture.drawio  '), 'Architecture.drawio');
  assert.equal(getDrawioFileName('...'), 'diagram.drawio');
});

test('exportExcalidrawToDrawio writes exact UTF-8 XML bytes to a selected native path', async () => {
  const { exportExcalidrawToDrawio } = await loadModule();

  assert.equal(typeof exportExcalidrawToDrawio, 'function');

  const requests = [];
  const writes = [];
  const conversion = {
    xml: '<mxfile>你好</mxfile>',
    summary: { exported: 2, skipped: 1, skippedTypes: ['frame'] },
  };
  const result = await exportExcalidrawToDrawio(
    { pageTitle: 'Roadmap / Q3', elements: [{ id: 'live' }], files: { image: {} } },
    {
      convert: (scene, options) => {
        assert.deepEqual(scene, { elements: [{ id: 'live' }], files: { image: {} } });
        assert.equal(options.diagramName, 'Roadmap / Q3');
        return conversion;
      },
      isTauriRuntime: () => true,
      choosePath: async (fileName) => {
        requests.push(fileName);
        return '/tmp/Roadmap - Q3.drawio';
      },
      writeBytes: async (path, data) => writes.push({ path, data }),
      download: () => assert.fail('native export must not use browser download'),
    },
  );

  assert.deepEqual(requests, ['Roadmap - Q3.drawio']);
  assert.deepEqual(writes, [{
    path: '/tmp/Roadmap - Q3.drawio',
    data: Array.from(new TextEncoder().encode(conversion.xml)),
  }]);
  assert.deepEqual(result, {
    status: 'saved',
    fileName: 'Roadmap - Q3.drawio',
    path: '/tmp/Roadmap - Q3.drawio',
    summary: conversion.summary,
  });
});

test('exportExcalidrawToDrawio cancels without writing and uses browser download outside Tauri', async () => {
  const { exportExcalidrawToDrawio } = await loadModule();
  const conversion = {
    xml: '<mxfile/>',
    summary: { exported: 0, skipped: 0, skippedTypes: [] },
  };
  let writeCount = 0;

  const cancelled = await exportExcalidrawToDrawio(
    { pageTitle: 'Page 1', elements: [], files: {} },
    {
      convert: () => conversion,
      isTauriRuntime: () => true,
      choosePath: async () => null,
      writeBytes: async () => { writeCount += 1; },
      download: () => assert.fail('cancelled native export must not download'),
    },
  );
  assert.deepEqual(cancelled, {
    status: 'cancelled',
    fileName: 'Page 1.drawio',
    summary: conversion.summary,
  });
  assert.equal(writeCount, 0);

  const downloads = [];
  const downloaded = await exportExcalidrawToDrawio(
    { pageTitle: 'Page 1', elements: [], files: {} },
    {
      convert: () => conversion,
      isTauriRuntime: () => false,
      choosePath: async () => assert.fail('browser export must not open native dialog'),
      writeBytes: async () => assert.fail('browser export must not invoke native write'),
      download: (fileName, xml) => downloads.push({ fileName, xml }),
    },
  );
  assert.deepEqual(downloads, [{ fileName: 'Page 1.drawio', xml: conversion.xml }]);
  assert.equal(downloaded.status, 'downloaded');
});

test('exportExcalidrawToDrawio propagates conversion failures for visible UI reporting', async () => {
  const { exportExcalidrawToDrawio } = await loadModule();

  assert.equal(typeof exportExcalidrawToDrawio, 'function');
  await assert.rejects(
    exportExcalidrawToDrawio(
      { pageTitle: 'Broken', elements: [], files: {} },
      {
        convert: () => { throw new Error('conversion failed'); },
        isTauriRuntime: () => true,
        choosePath: async () => '/tmp/Broken.drawio',
        writeBytes: async () => {},
        download: () => {},
      },
    ),
    /conversion failed/,
  );
});
