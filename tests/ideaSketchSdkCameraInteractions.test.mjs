import test from 'node:test';
import assert from 'node:assert/strict';

import { createIdeaSketchCameraService } from '../src/lib/ideasketch-sdk/cameraService.ts';

function createFixture(beginCreate) {
  return createIdeaSketchCameraService({
    getTarget: () => ({}),
    getScopes: () => ['host.interaction', 'scene.read'],
    isActive: () => true,
    isMethodAvailable: (method) => method === 'beginCreate',
    listCameras: async () => ({ status: 'succeeded', value: { snapshotId: 'scene-snapshot:x', pageRef: 'page:page-1', cameras: [], complete: true, coverage: { identityRefs: [], mutationReadyRefs: [] } } }),
    beginCreate,
  });
}

test('Camera beginCreate validates the outer request before entering host interaction', async () => {
  const calls = [];
  const service = createFixture(async (options) => { calls.push(options); return { status: 'succeeded', value: { requestId: options.requestId } }; });
  assert.equal((await service.beginCreate(null)).error.code, 'invalid_request');
  assert.equal((await service.beginCreate({ requestId: '', snapshotId: 'scene-snapshot:x' })).error.code, 'invalid_request');
  assert.equal((await service.beginCreate({ requestId: 'x', snapshotId: 'scene-snapshot:x', atIndex: -1 })).error.code, 'invalid_request');
  assert.equal((await service.beginCreate({ requestId: 'x', snapshotId: 'scene-snapshot:x', extra: true })).error.code, 'invalid_request');
  assert.equal(calls.length, 0);
});

test('Camera beginCreate delegates one trusted preview composite and preserves terminal result', async () => {
  const calls = [];
  const service = createFixture(async (options) => { calls.push(options); return { status: 'succeeded', value: { requestId: options.requestId, outcome: 'applied' } }; });
  const result = await service.beginCreate({ requestId: 'camera-1', snapshotId: 'scene-snapshot:x', atIndex: 0 });
  assert.equal(result.status, 'succeeded');
  assert.deepEqual(calls, [{ requestId: 'camera-1', snapshotId: 'scene-snapshot:x', atIndex: 0 }]);
});

