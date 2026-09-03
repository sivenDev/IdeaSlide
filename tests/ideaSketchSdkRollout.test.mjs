import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdeaSketchRolloutController } from '../src/lib/ideasketch-sdk/rollout.ts';

test('rollout selects one implementation per caller and namespace', () => {
  const rollout = createIdeaSketchRolloutController(() => 100);
  const selected = rollout.select({ callerId: 'trusted-ui:doc-1', namespace: 'scene', sdkAvailable: true, legacyAvailable: true, allowLegacyFallback: true });
  assert.equal(selected.status, 'succeeded');
  assert.equal(selected.value.implementation, 'sdk');
  const repeated = rollout.select({ callerId: 'trusted-ui:doc-1', namespace: 'scene', sdkAvailable: true });
  assert.deepEqual(repeated, selected);
  const mixed = rollout.select({ callerId: 'trusted-ui:doc-1', namespace: 'scene', sdkAvailable: false, legacyAvailable: true, allowLegacyFallback: true });
  assert.equal(mixed.status, 'rejected');
  assert.equal(mixed.error.code, 'editor_busy');
  assert.equal(rollout.diagnostics().at(-1).type, 'mixed-path-rejected');
});

test('legacy fallback is available only before a mutation is scheduled', () => {
  const rollout = createIdeaSketchRolloutController();
  const selected = rollout.select({ callerId: 'legacy:doc-1', namespace: 'pages', sdkAvailable: true, legacyAvailable: true, allowLegacyFallback: true });
  assert.equal(selected.status, 'succeeded');
  const gate = rollout.beginMutation(selected.value);
  assert.equal(gate.status, 'succeeded');
  const scheduled = rollout.markScheduled(gate.value);
  assert.equal(scheduled.status, 'succeeded');
  const denied = rollout.fallback(selected.value, scheduled.value);
  assert.equal(denied.status, 'rejected');
  assert.equal(denied.error.code, 'editor_busy');
  const preCommit = rollout.fallback(selected.value);
  assert.equal(preCommit.status, 'succeeded');
  assert.equal(preCommit.value.implementation, 'legacy');
});
