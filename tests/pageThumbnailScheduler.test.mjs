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

function deferred() {
  let resolve;
  const promise = new Promise((next) => { resolve = next; });
  return { promise, resolve };
}

test('virtual demand includes only mounted indexes and prioritizes the active visible Page', async () => {
  const { buildPageThumbnailDemands } = await loadSchedulerModule();
  const pageIds = Array.from({ length: 100 }, (_, index) => `page-${index}`);
  const demands = buildPageThumbnailDemands(
    pageIds,
    [46, 47, 48, 49, 50, 51, 52, 53, 54],
    { startIndex: 48, endIndex: 52 },
    'page-50',
  );

  assert.equal(demands.length, 9);
  assert.deepEqual(demands.map(({ pageId }) => pageId), [
    'page-50',
    'page-48',
    'page-49',
    'page-51',
    'page-52',
    'page-46',
    'page-47',
    'page-53',
    'page-54',
  ]);
  assert.deepEqual(demands.map(({ priority }) => priority), [
    'active-visible',
    'visible',
    'visible',
    'visible',
    'visible',
    'overscan',
    'overscan',
    'overscan',
    'overscan',
  ]);
});

test('scheduler runs exactly one export at a time in demand priority order', async () => {
  const { PageThumbnailScheduler } = await loadSchedulerModule();
  const completed = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const scheduler = new PageThumbnailScheduler({
    yieldToMain: async () => {},
    onResult: (job) => completed.push(job.pageId),
  });
  const job = (pageId, priority) => ({
    pageId,
    priority,
    run: async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return pageId;
    },
  });

  scheduler.replace([
    job('overscan', 'overscan'),
    job('visible', 'visible'),
    job('active', 'active-visible'),
  ]);
  await scheduler.waitForIdle();

  assert.deepEqual(completed, ['active', 'visible', 'overscan']);
  assert.equal(maxInFlight, 1);
});

test('scheduler pauses queued work and ignores stale in-flight completion', async () => {
  const { PageThumbnailScheduler } = await loadSchedulerModule();
  const oldExport = deferred();
  const oldStarted = deferred();
  const completed = [];
  const scheduler = new PageThumbnailScheduler({
    yieldToMain: async () => {},
    onResult: (job) => completed.push(job.pageId),
  });

  scheduler.replace([{
    pageId: 'old-page',
    priority: 'active-visible',
    run: async () => {
      oldStarted.resolve();
      await oldExport.promise;
      return 'old';
    },
  }]);
  await oldStarted.promise;

  scheduler.setPaused(true);
  scheduler.replace([{
    pageId: 'new-page',
    priority: 'active-visible',
    run: async () => 'new',
  }]);
  oldExport.resolve();
  await Promise.resolve();
  assert.deepEqual(completed, []);

  scheduler.setPaused(false);
  await scheduler.waitForIdle();
  assert.deepEqual(completed, ['new-page']);
});

test('scheduler remains reusable after lifecycle cleanup', async () => {
  const { PageThumbnailScheduler } = await loadSchedulerModule();
  const completed = [];
  const scheduler = new PageThumbnailScheduler({
    yieldToMain: async () => {},
    onResult: (job) => completed.push(job.pageId),
  });

  scheduler.clear();
  scheduler.replace([{
    pageId: 'strict-mode-remount',
    priority: 'visible',
    run: async () => 'thumbnail',
  }]);
  await scheduler.waitForIdle();

  assert.deepEqual(completed, ['strict-mode-remount']);
});
