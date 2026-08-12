import test from 'node:test';
import assert from 'node:assert/strict';

const { createLatestSettingsWriter } = await import('../src/lib/settingsAutoPersist.ts');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

test('latest settings writer serializes persistence and coalesces pending snapshots', async () => {
  const calls = [];
  const completions = [];
  const first = deferred();
  const writer = createLatestSettingsWriter({
    persist: async (settings) => {
      calls.push(settings.value);
      if (settings.value === 1) await first.promise;
      return settings;
    },
    onPersisted: (entry) => completions.push(entry.version),
    onError: () => assert.fail('unexpected persistence error'),
  });

  writer.submit({ version: 1, settings: { value: 1 } });
  const flushing = writer.flush();
  writer.submit({ version: 2, settings: { value: 2 } });
  writer.submit({ version: 3, settings: { value: 3 } });
  first.resolve();
  await flushing;

  assert.deepEqual(calls, [1, 3]);
  assert.deepEqual(completions, [1, 3]);
});

test('latest settings writer stops on failure and retries the newest snapshot', async () => {
  const calls = [];
  const failures = [];
  let fail = true;
  const writer = createLatestSettingsWriter({
    persist: async (settings) => {
      calls.push(settings.value);
      if (fail) throw new Error('disk unavailable');
      return settings;
    },
    onPersisted: () => undefined,
    onError: (entry, cause) => failures.push([entry.version, cause.message]),
  });

  writer.submit({ version: 1, settings: { value: 1 } });
  await assert.rejects(writer.flush(), /disk unavailable/);
  assert.deepEqual(failures, [[1, 'disk unavailable']]);

  fail = false;
  writer.submit({ version: 2, settings: { value: 2 } });
  await writer.flush();
  assert.deepEqual(calls, [1, 2]);
});

test('latest settings writer retains the failed snapshot for a direct retry', async () => {
  const calls = [];
  let fail = true;
  const writer = createLatestSettingsWriter({
    persist: async (settings) => {
      calls.push(settings.value);
      if (fail) throw new Error('disk unavailable');
      return settings;
    },
    onPersisted: () => undefined,
    onError: () => undefined,
  });

  writer.submit({ version: 7, settings: { value: 7 } });
  await assert.rejects(writer.flush(), /disk unavailable/);
  fail = false;
  await writer.flush();

  assert.deepEqual(calls, [7, 7]);
});
