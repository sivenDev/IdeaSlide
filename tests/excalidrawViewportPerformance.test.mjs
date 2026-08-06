import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

async function loadModule() {
  try {
    return await import('../src/lib/editorSession.ts');
  } catch {
    return {};
  }
}

function makeElements(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `element-${index}`,
    version: 1,
    versionNonce: index + 1,
    x: index % 500,
    y: Math.floor(index / 500),
    width: 120,
    height: 60,
  }));
}

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

test('20k viewport-only projection updates stay constant-time and fingerprint-free', async (context) => {
  const { createPersistedDraftProjection, updatePersistedDraftProjection } = await loadModule();

  assert.equal(typeof createPersistedDraftProjection, 'function');
  assert.equal(typeof updatePersistedDraftProjection, 'function');

  for (const count of [5_000, 10_000, 20_000]) {
    const elements = makeElements(count);
    const files = {};
    let projection = createPersistedDraftProjection({ elements, files, appState: {} });
    const timings = [];

    for (let iteration = 0; iteration < 500; iteration += 1) {
      const startedAt = performance.now();
      const result = updatePersistedDraftProjection(projection, {
        elements,
        files,
        appState: {
          scrollX: iteration,
          scrollY: -iteration,
          zoom: { value: 1 + iteration / 10_000 },
          selectedElementIds: iteration % 2 === 0 ? { 'element-0': true } : {},
        },
      });
      timings.push(performance.now() - startedAt);
      assert.equal(result.sceneFingerprintComputed, false);
      assert.equal(result.summary.hasPersistedChange, false);
      projection = result.projection;
    }

    const p95 = percentile(timings.slice(50), 0.95);
    context.diagnostic(`${count} elements viewport-only p95: ${p95.toFixed(3)}ms`);
    assert.ok(p95 < 2, `expected ${count}-element viewport p95 below 2ms, received ${p95}ms`);
  }
});
