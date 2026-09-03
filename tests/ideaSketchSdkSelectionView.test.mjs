import test from 'node:test';
import assert from 'node:assert/strict';

import { createIdeaSketchSelectionViewService } from '../src/lib/ideasketch-sdk/selectionViewService.ts';

const pageRef = 'page:page-1';
const snapshotId = 'scene-snapshot:one';

function element(ref, type, bounds, extra = {}) {
  return {
    pageRef,
    ref,
    type,
    bounds,
    angle: 0,
    locked: false,
    deleted: false,
    isCamera: type === 'camera',
    relations: { boundTextRefs: [], arrowRefs: [], groupRefs: [] },
    relationsMalformed: false,
    relationsComplete: true,
    ...extra,
  };
}

function createFixture() {
  const target = {
    activePageId: 'page-1',
    mountedPageId: 'page-1',
    nativeInteraction: { busy: false },
    scene: {
      elements: [
        { id: 'shape', type: 'rectangle', x: 100, y: 100, width: 100, height: 80, isDeleted: false, customData: {} },
        { id: 'camera', type: 'rectangle', x: 400, y: 300, width: 200, height: 100, isDeleted: false, customData: { type: 'camera', order: 1 } },
      ],
      appState: {
        selectedElementIds: { shape: true },
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 },
        width: 800,
        height: 600,
      },
      files: {},
    },
  };
  const scene = {
    status: 'succeeded',
    value: {
      snapshotId,
      pageRef,
      complete: true,
      coverage: {
        identityRefs: ['element:shape', 'camera:camera'],
        mutationReadyRefs: ['element:shape', 'camera:camera'],
      },
      elements: [
        element('element:shape', 'rectangle', { x: 100, y: 100, width: 100, height: 80 }),
        element('camera:camera', 'camera', { x: 400, y: 300, width: 200, height: 100 }),
      ],
    },
  };
  const selectionWrites = [];
  const viewportWrites = [];
  const service = createIdeaSketchSelectionViewService({
    getTarget: () => target,
    getScopes: () => ['selection.control', 'view.read', 'view.control'],
    isActive: () => true,
    isMethodAvailable: () => true,
    readScene: async (options) => options.snapshotId === snapshotId ? scene : { status: 'rejected', error: { code: 'snapshot_required', message: 'missing', retryable: false } },
    updateSelection: async (refs) => {
      selectionWrites.push([...refs]);
      target.scene.appState.selectedElementIds = Object.fromEntries(refs.map((ref) => [ref.split(':')[1], true]));
    },
    updateViewport: async (viewport) => {
      viewportWrites.push({ ...viewport });
      target.scene.appState.scrollX = viewport.scrollX;
      target.scene.appState.scrollY = viewport.scrollY;
      target.scene.appState.zoom = { value: viewport.zoom };
    },
  });
  return { service, target, scene, selectionWrites, viewportWrites };
}

test('selection get/set/clear returns identity refs and never exposes AppState', async () => {
  const { service, selectionWrites } = createFixture();
  const initial = await service.selection.get({ snapshotId });
  assert.equal(initial.status, 'succeeded');
  assert.deepEqual(initial.value.refs, ['element:shape']);
  assert.equal(initial.value.pageRef, pageRef);
  assert.equal('selectedElementIds' in initial.value, false);

  const selected = await service.selection.set({ snapshotId, refs: ['camera:camera'] });
  assert.equal(selected.status, 'succeeded');
  assert.deepEqual(selectionWrites, [['camera:camera']]);
  assert.deepEqual(selected.value.refs, ['camera:camera']);
  assert.ok(selected.value.selectionVersion > initial.value.selectionVersion);

  const cleared = await service.selection.clear({ snapshotId });
  assert.equal(cleared.status, 'succeeded');
  assert.deepEqual(selectionWrites, [['camera:camera'], []]);
  assert.deepEqual(cleared.value.refs, []);
});

test('selection and view fail closed for malformed, stale, foreign, or uncovered refs', async () => {
  const { service } = createFixture();
  assert.equal((await service.selection.set({ snapshotId, refs: ['camera:nope'] })).error.code, 'incomplete_read');
  assert.equal((await service.selection.set({ snapshotId, refs: ['element:shape', 'element:shape'] })).error.code, 'invalid_request');
  assert.equal((await service.selection.get({ snapshotId: 'scene-snapshot:stale' })).error.code, 'snapshot_required');
  assert.equal((await service.view.getViewport({ snapshotId: 'scene-snapshot:stale' })).error.code, 'snapshot_required');
  assert.equal((await service.view.focusElements({ snapshotId, refs: [] })).error.code, 'invalid_request');
  assert.equal((await service.view.focusElements({ snapshotId, refs: ['element:nope'] })).error.code, 'incomplete_read');
});

test('viewport reads visible semantic refs and focus writes a non-persistent viewport patch', async () => {
  const { service, target, viewportWrites } = createFixture();
  const viewport = await service.view.getViewport({ snapshotId });
  assert.equal(viewport.status, 'succeeded');
  assert.deepEqual(viewport.value.visibleRefs, ['element:shape', 'camera:camera']);
  assert.deepEqual(viewport.value.bounds, { x: 0, y: 0, width: 800, height: 600 });

  const focused = await service.view.focusElements({ snapshotId, refs: ['element:shape'], fit: true, animate: true, durationMs: 120 });
  assert.equal(focused.status, 'succeeded');
  assert.equal(viewportWrites.length, 1);
  assert.equal(focused.value.refs[0], 'element:shape');
  assert.equal(focused.value.viewport.pageRef, pageRef);
  assert.notEqual(target.scene.appState.scrollX, 0);
  assert.equal('appState' in focused.value, false);
});

test('Camera select composes selection and focus without a second public mutation path', async () => {
  const { service, selectionWrites, viewportWrites } = createFixture();
  const selected = await service.cameras.select({ snapshotId, cameraRef: 'camera:camera' });
  assert.deepEqual(selected, { status: 'succeeded', value: { cameraRef: 'camera:camera', selected: true, focused: true } });
  assert.deepEqual(selectionWrites, [['camera:camera']]);
  assert.equal(viewportWrites.length, 1);
});
