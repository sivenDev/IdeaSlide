import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function loadCacheModule() {
  let source = await fs.readFile(
    new URL('../src/lib/pageThumbnailCache.ts', import.meta.url),
    'utf8',
  );
  source = source.replace(
    'from "lru-cache"',
    `from ${JSON.stringify(import.meta.resolve('lru-cache'))}`,
  );
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript,${encodeURIComponent(transpiled)}`);
}

function createHarness(options = {}) {
  const created = [];
  const revoked = [];
  let nextUrl = 1;
  return {
    created,
    revoked,
    options: {
      maxEntries: 2,
      maxBytes: 8,
      createObjectURL: (blob) => {
        const url = `blob:test-${nextUrl++}`;
        created.push({ url, size: blob.size });
        return url;
      },
      revokeObjectURL: (url) => revoked.push(url),
      ...options,
    },
  };
}

test('stable cache enforces entry and byte bounds and revokes evicted URLs', async () => {
  const { PageThumbnailCache } = await loadCacheModule();
  const harness = createHarness();
  const cache = new PageThumbnailCache(harness.options);

  const first = cache.setStable('page-1', 'key-1', new Blob(['1234']));
  const second = cache.setStable('page-2', 'key-2', new Blob(['1234']));
  const third = cache.setStable('page-3', 'key-3', new Blob(['1234']));

  assert.equal(cache.entryCount, 2);
  assert.equal(cache.byteSize, 8);
  assert.equal(cache.getStable('page-1', 'key-1'), undefined);
  assert.equal(cache.getStable('page-2', 'key-2')?.url, second.url);
  assert.equal(cache.getStable('page-3', 'key-3')?.url, third.url);
  assert.deepEqual(harness.revoked, [first.url]);
});

test('active draft uses one replace-in-place transient slot', async () => {
  const { PageThumbnailCache } = await loadCacheModule();
  const harness = createHarness();
  const cache = new PageThumbnailCache(harness.options);

  const first = cache.setTransient('page-1', 'draft-1', new Blob(['12']));
  const second = cache.setTransient('page-1', 'draft-2', new Blob(['123']));

  assert.equal(cache.transientEntry?.url, second.url);
  assert.equal(cache.getTransient('page-1', 'draft-1'), undefined);
  assert.equal(cache.getTransient('page-1', 'draft-2')?.url, second.url);
  assert.deepEqual(harness.revoked, [first.url]);

  cache.clear();
  assert.deepEqual(harness.revoked, [first.url, second.url]);
});

test('Page deletion and document cleanup revoke owned Blob URLs', async () => {
  const { PageThumbnailCache } = await loadCacheModule();
  const harness = createHarness({ maxEntries: 8, maxBytes: 64 });
  const cache = new PageThumbnailCache(harness.options);
  const first = cache.setStable('page-1', 'key-1', new Blob(['1']));
  const second = cache.setStable('page-2', 'key-2', new Blob(['2']));
  const draft = cache.setTransient('page-2', 'draft-2', new Blob(['3']));

  cache.retainPages(new Set(['page-2']));
  assert.deepEqual(harness.revoked, [first.url]);
  cache.clear();
  assert.deepEqual(new Set(harness.revoked), new Set([first.url, second.url, draft.url]));
});
