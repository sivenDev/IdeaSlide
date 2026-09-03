import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdeaSketchPresentationService } from '../src/lib/ideasketch-sdk/presentationService.ts';

function target() {
  return {
    activePageId: 'page-1',
    documentStatus: 'editable',
    documentId: 'doc-1',
    documentSessionId: 'session-1',
    revision: 1,
    readOnly: false,
    pageEditVersion: 1,
    nativeInteraction: { epoch: 1, busy: false, reasons: [] },
    document: { id: 'doc-1', type: 'ideasketch', formatVersion: '1.0', revision: 1, pages: [], isDirty: false },
    scene: {
      elements: [
        { id: 'camera-a', type: 'rectangle', x: 0, y: 0, width: 400, height: 300, isDeleted: false, customData: { type: 'camera', order: 1 } },
        { id: 'camera-b', type: 'rectangle', x: 500, y: 0, width: 400, height: 300, isDeleted: false, customData: { type: 'camera', order: 2 } },
      ],
      appState: {},
      files: {},
    },
    services: { presentation: true, mountedCanvas: true, writable: true },
    flushDraft() {},
    updateViewport(viewport) { this.viewport = viewport; },
  };
}

test('Presentation service binds to the active Page and navigates bounded Cameras', async () => {
  const hostTarget = target();
  const events = [];
  const service = createIdeaSketchPresentationService({
    getTarget: () => hostTarget,
    getScopes: () => ['presentation.control'],
    isActive: () => true,
    isMethodAvailable: () => true,
    onStateChange: (state) => events.push(state),
  });
  const started = await service.start({ mode: 'preview', pageRef: 'page:page-1' });
  assert.equal(started.status, 'succeeded');
  assert.equal(started.value.cameraCount, 2);
  const next = await service.next({ presentationSessionId: started.value.presentationSessionId });
  assert.equal(next.status, 'succeeded');
  assert.equal(next.value.cameraIndex, 0);
  const foreign = await service.stop({ presentationSessionId: 'presentation-session:foreign' });
  assert.equal(foreign.status, 'rejected');
  assert.equal(foreign.error.code, 'presentation_session_not_found');
  const stopped = await service.stop({ presentationSessionId: started.value.presentationSessionId });
  assert.equal(stopped.status, 'succeeded');
  assert.equal(events.at(-1).running, false);
});

test('Presentation service rejects cross-Page starts and preserves stopped-session idempotency', async () => {
  const hostTarget = target();
  const service = createIdeaSketchPresentationService({
    getTarget: () => hostTarget,
    getScopes: () => ['presentation.control'],
    isActive: () => true,
    isMethodAvailable: () => true,
  });
  const crossPage = await service.start({ mode: 'fullscreen', pageRef: 'page:other' });
  assert.equal(crossPage.status, 'rejected');
  assert.equal(crossPage.error.code, 'cross_page_target');
  const started = await service.start({ mode: 'fullscreen', pageRef: 'page:page-1' });
  assert.equal(started.status, 'succeeded');
  const stopped = await service.stop({ presentationSessionId: started.value.presentationSessionId });
  assert.equal(stopped.status, 'succeeded');
  const repeated = await service.stop({ presentationSessionId: started.value.presentationSessionId });
  assert.deepEqual(repeated, { status: 'succeeded', value: { outcome: 'noop' } });
});
