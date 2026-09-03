import test from 'node:test';
import assert from 'node:assert/strict';

import { createIdeaSketchTransformsService } from '../src/lib/ideasketch-sdk/transformsService.ts';

const snapshotId = 'scene-snapshot:one';
const documentSnapshotId = 'document-snapshot:one';
const sceneRead = {
  status: 'succeeded',
  value: {
    snapshotId,
    pageRef: 'page:page-1',
    complete: true,
    coverage: {
      identityRefs: ['element:shape', 'element:text'],
      mutationReadyRefs: ['element:shape', 'element:text'],
    },
    elements: [
      {
        pageRef: 'page:page-1', ref: 'element:shape', type: 'rectangle',
        bounds: { x: 0, y: 0, width: 100, height: 80 }, angle: 0,
        locked: false, deleted: false, isCamera: false,
        relations: { boundTextRefs: [], arrowRefs: [], groupRefs: [] },
        relationsMalformed: false, relationsComplete: true,
      },
      {
        pageRef: 'page:page-1', ref: 'element:text', type: 'text',
        bounds: { x: 10, y: 10, width: 30, height: 20 }, angle: 0,
        locked: false, deleted: false, isCamera: false,
        relations: { boundTextRefs: [], arrowRefs: [], groupRefs: [] },
        relationsMalformed: false, relationsComplete: true,
      },
    ],
  },
};

function createFixture(overrides = {}) {
  const scenePlans = [];
  const pagePlans = [];
  const service = createIdeaSketchTransformsService({
    isActive: () => true,
    getScopes: () => ['scene.write', 'document.structure.write'],
    isMethodAvailable: (namespace, method) => namespace === 'transforms' && method === 'convertSelectionStyle' || namespace === 'pages' && method === 'applyPlan',
    scene: {
      getElements: async () => overrides.sceneRead ?? sceneRead,
      applyPlan: async (plan) => { scenePlans.push(plan); return { status: 'succeeded', value: { requestId: plan.requestId, outcome: 'applied' } }; },
    },
    pages: {
      applyPlan: async (plan) => { pagePlans.push(plan); return { status: 'succeeded', value: { requestId: plan.requestId, outcome: 'applied' } }; },
    },
  });
  return { service, scenePlans, pagePlans };
}

test('current-page style conversion supplements the explicit selection and uses scene.applyPlan once', async () => {
  const { service, scenePlans, pagePlans } = createFixture();
  const result = await service.convertSelectionStyle({
    requestId: 'transform-1',
    snapshotId,
    selectedRefs: ['element:shape'],
    target: 'current-page',
    preset: 'formal',
  });
  assert.equal(result.status, 'succeeded');
  assert.equal(scenePlans.length, 1);
  assert.equal(pagePlans.length, 0);
  assert.equal(scenePlans[0].operations[0].kind, 'apply-style-preset');
  assert.deepEqual(scenePlans[0].operations[0].selectedRefs, ['element:shape']);
});

test('new-page conversion uses document snapshot and canonical pages.applyPlan', async () => {
  const { service, scenePlans, pagePlans } = createFixture();
  const result = await service.convertSelectionStyle({
    requestId: 'transform-2',
    snapshotId,
    documentSnapshotId,
    selectedRefs: ['element:shape', 'element:text'],
    target: 'new-page',
    preset: 'formal',
  });
  assert.equal(result.status, 'succeeded');
  assert.equal(scenePlans.length, 0);
  assert.equal(pagePlans.length, 1);
  assert.equal(pagePlans[0].documentSnapshotId, documentSnapshotId);
  assert.equal(pagePlans[0].sceneSnapshotId, snapshotId);
  assert.equal(pagePlans[0].operations[0].kind, 'create-page-from-selection');
  assert.match(pagePlans[0].operations[0].ref, /^temp:transform-transform-2$/);
});

test('transform rejects malformed target, Camera selection, duplicate refs, and incomplete mutation coverage', async () => {
  const { service } = createFixture();
  assert.equal((await service.convertSelectionStyle({ requestId: 'x', snapshotId, selectedRefs: [], target: 'current-page', preset: 'formal' })).error.code, 'invalid_request');
  assert.equal((await service.convertSelectionStyle({ requestId: 'x', snapshotId, selectedRefs: ['element:shape'], target: 'new-page', preset: 'formal' })).error.code, 'invalid_request');
  assert.equal((await service.convertSelectionStyle({ requestId: 'x', snapshotId, selectedRefs: ['camera:camera'], target: 'current-page', preset: 'formal' })).error.code, 'invalid_request');
  assert.equal((await service.convertSelectionStyle({ requestId: 'x', snapshotId, selectedRefs: ['element:shape', 'element:shape'], target: 'current-page', preset: 'formal' })).error.code, 'invalid_request');

  const incomplete = createFixture({ sceneRead: { ...sceneRead, value: { ...sceneRead.value, coverage: { ...sceneRead.value.coverage, mutationReadyRefs: [] } } } });
  assert.equal((await incomplete.service.convertSelectionStyle({ requestId: 'x', snapshotId, selectedRefs: ['element:shape'], target: 'current-page', preset: 'formal' })).error.code, 'incomplete_read');
});

test('transform propagates scene stale/busy/cancelled outcomes without attempting a plan', async () => {
  const stale = createFixture({ sceneRead: { status: 'rejected', error: { code: 'snapshot_stale', message: 'stale', retryable: true } } });
  const result = await stale.service.convertSelectionStyle({ requestId: 'x', snapshotId, selectedRefs: ['element:shape'], target: 'current-page', preset: 'formal' });
  assert.equal(result.error.code, 'snapshot_stale');
  assert.equal(stale.scenePlans.length, 0);
});
