import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdeaSketchIoService } from '../src/lib/ideasketch-sdk/ioService.ts';
import { createRequestLedger } from '../src/lib/ideasketch-sdk/requestLedger.ts';
import { sdkSucceeded } from '../src/lib/ideasketch-sdk/types.ts';

function createTarget() {
  return {
    activePageId: 'page-1',
    documentStatus: 'editable',
    documentId: 'doc-1',
    documentSessionId: 'session-1',
    revision: 1,
    readOnly: false,
    pageEditVersion: 1,
    nativeInteraction: { epoch: 1, busy: false, reasons: [] },
    document: {
      id: 'doc-1', type: 'ideasketch', formatVersion: '1.0', revision: 1, isDirty: false,
      pages: [{ id: 'page-1', title: 'Demo', elements: [{ id: 'shape-1', type: 'rectangle', x: 0, y: 0, width: 100, height: 80, isDeleted: false }], appState: {}, files: {} }],
    },
    scene: { elements: [], appState: {}, files: {} },
    services: { io: true, mountedCanvas: true, desktop: false, writable: true },
    flushDraft() {},
  };
}

test('IO serialization returns private bytes without writing files', async () => {
  const target = createTarget();
  const service = createIdeaSketchIoService({
    getTarget: () => target,
    getScopes: () => ['io.serialize'],
    isActive: () => true,
    isMethodAvailable: () => true,
  });
  const result = await service.serializeActivePageAsExcalidraw();
  assert.equal(result.status, 'succeeded');
  assert.equal(result.value.format, 'excalidraw');
  assert.ok(result.value.bytes.length > 0);
  assert.match(result.value.text, /shape-1/);
});

test('IO picker composite distinguishes unavailable desktop and missing authorization', async () => {
  const target = createTarget();
  const unavailable = createIdeaSketchIoService({
    getTarget: () => target,
    getScopes: () => ['user-mediated-io'],
    isActive: () => true,
    isMethodAvailable: () => true,
  });
  const result = await unavailable.pickExcalidrawAndAddPage({ requestId: 'import-1' });
  assert.equal(result.status, 'rejected');
  assert.equal(result.error.code, 'desktop_unavailable');
  const denied = createIdeaSketchIoService({
    getTarget: () => target,
    getScopes: () => [],
    isActive: () => true,
    isMethodAvailable: () => true,
  });
  const deniedResult = await denied.serializeActivePageAsExcalidraw();
  assert.equal(deniedResult.error.code, 'capability_denied');
});

test('IO picker reserves one outer ledger request and joins duplicate callers', async () => {
  const target = createTarget();
  target.services.desktop = true;
  let releasePicker;
  let chooseCalls = 0;
  let receivedHandle;
  const picker = new Promise((resolve) => { releasePicker = resolve; });
  const ledger = createRequestLedger({ sessionId: 'session-1', capacity: 4 });
  const mutation = {
    changeSetId: 'change:import-1',
    requestId: 'import-1',
    outcome: 'applied',
    beforeDigest: 'before',
    afterDigest: 'after',
    beforeEditVersion: 1,
    afterEditVersion: 2,
    createdRefs: {},
    updatedRefs: [],
    deletedRefs: [],
    cascadedRefs: [],
    operations: [],
    diagnostics: [],
    history: { nativeCanvas: 'none', document: 'unavailable', agentCustom: 'not-supported' },
  };
  const service = createIdeaSketchIoService({
    getTarget: () => target,
    getScopes: () => ['user-mediated-io'],
    isActive: () => true,
    isMethodAvailable: () => true,
    ledger,
    chooseImport: async () => {
      chooseCalls += 1;
      return picker;
    },
    parseExcalidraw: async () => sdkSucceeded('parsed:draft'),
    applyImport: async ({ requestId, reservedRequestHandle }) => {
      receivedHandle = reservedRequestHandle;
      ledger.consumeCompositeReservation(reservedRequestHandle, { requestId });
      ledger.complete(reservedRequestHandle, sdkSucceeded(mutation));
      return sdkSucceeded(mutation);
    },
  });

  const first = service.pickExcalidrawAndAddPage({ requestId: 'import-1' });
  const second = service.pickExcalidrawAndAddPage({ requestId: 'import-1' });
  releasePicker({ path: '/tmp/demo.excalidraw', text: '{}' });
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(chooseCalls, 1);
  assert.ok(receivedHandle);
  assert.deepEqual(firstResult, sdkSucceeded(mutation));
  assert.deepEqual(secondResult, sdkSucceeded(mutation));
  assert.deepEqual(ledger.getMutationResult('import-1'), sdkSucceeded(mutation));
});
