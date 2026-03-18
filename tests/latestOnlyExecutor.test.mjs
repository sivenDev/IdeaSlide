import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/lib/latestOnlyExecutor.ts');
  } catch {
    return {};
  }
}

test('LatestOnlyExecutor runs the first job immediately and only keeps the newest pending job', async () => {
  const { LatestOnlyExecutor } = await loadModule();

  assert.equal(typeof LatestOnlyExecutor, 'function');

  const started = [];
  const resolvers = [];
  const executor = new LatestOnlyExecutor((value) => {
    started.push(value);
    return new Promise((resolve) => {
      resolvers.push(() => resolve(`done:${value}`));
    });
  });

  const firstPromise = executor.schedule('first');
  const secondPromise = executor.schedule('second');
  const thirdPromise = executor.schedule('third');

  assert.deepEqual(started, ['first']);

  resolvers.shift()();

  assert.deepEqual(await firstPromise, {
    status: 'completed',
    value: 'done:first',
  });
  assert.deepEqual(await secondPromise, {
    status: 'replaced',
  });

  assert.deepEqual(started, ['first', 'third']);

  resolvers.shift()();

  assert.deepEqual(await thirdPromise, {
    status: 'completed',
    value: 'done:third',
  });
});

test('LatestOnlyExecutor runs jobs immediately when idle', async () => {
  const { LatestOnlyExecutor } = await loadModule();

  assert.equal(typeof LatestOnlyExecutor, 'function');

  const executor = new LatestOnlyExecutor(async (value) => value * 2);

  assert.deepEqual(await executor.schedule(4), {
    status: 'completed',
    value: 8,
  });
  assert.deepEqual(await executor.schedule(7), {
    status: 'completed',
    value: 14,
  });
});
