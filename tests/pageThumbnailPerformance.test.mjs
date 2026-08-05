import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function loadSchedulerModule() {
  const source = await fs.readFile(
    new URL('../src/lib/pageThumbnailScheduler.ts', import.meta.url),
    'utf8',
  );
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript,${encodeURIComponent(transpiled)}`);
}

test('100 Pages schedule only the visible plus overscan working set', async () => {
  const { buildPageThumbnailDemands, PageThumbnailScheduler } = await loadSchedulerModule();
  const pageIds = Array.from({ length: 100 }, (_, index) => `page-${index}`);
  const demands = buildPageThumbnailDemands(
    pageIds,
    Array.from({ length: 13 }, (_, index) => index + 40),
    { startIndex: 44, endIndex: 48 },
    'page-46',
  );
  let exportCount = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  const scheduler = new PageThumbnailScheduler({
    yieldToMain: async () => {},
    onResult: () => {},
  });

  scheduler.replace(demands.map((demand) => ({
    ...demand,
    run: async () => {
      exportCount += 1;
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return new Blob(['thumbnail']);
    },
  })));
  await scheduler.waitForIdle();

  assert.equal(exportCount, 13);
  assert.equal(maxInFlight, 1);
  assert.ok(exportCount < pageIds.length);
});
