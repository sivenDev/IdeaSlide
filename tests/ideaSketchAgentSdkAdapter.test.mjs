import test from 'node:test';
import assert from 'node:assert/strict';

import { createEmptyIdeaSketchDocument } from '../src/lib/ideaSketchDocument.ts';
import {
  createIdeaSketchHostCaller,
  registerActiveIdeaSketchSdkHostTarget,
} from '../src/lib/ideasketch-sdk/host.ts';
import {
  createIdeaSketchAgentSdkToolExecutor,
} from '../src/lib/agent/extensions/ideaSketchAgentSdkAdapter.ts';
import {
  AGENT_TOOL_PROTOCOL_V1,
  AGENT_TOOL_PROTOCOL_V2,
  getIdeaSketchAgentToolProtocol,
} from '../src/lib/agent/agentToolProtocol.ts';
import { createAgentToolHost } from '../src/lib/agent/agentToolHost.ts';
import { ideaSketchAgentExtension } from '../src/lib/agent/extensions/ideaSketchAgentExtension.ts';

let nextDocumentId = 0;

function mountedTarget(document, { mounted = true, readOnly = false } = {}) {
  const documentId = `agent-adapter-doc-${++nextDocumentId}`;
  const activePage = document.pages[0];
  const target = {
    documentSessionId: documentId,
    documentId,
    activePageId: activePage.id,
    documentStatus: readOnly ? 'read-only' : 'editable',
    revision: 1,
    sourceModified: 'source-a',
    readOnly,
    mountedPageId: mounted ? activePage.id : undefined,
    pageEditVersion: 1,
    nativeInteraction: { epoch: 1, busy: false, reasons: [] },
    document,
    scene: {
      elements: activePage.elements,
      appState: activePage.appState,
      files: activePage.files,
    },
    services: {
      mountedCanvas: mounted,
      scene: mounted,
      operations: mounted,
      pages: true,
      writable: !readOnly,
      methods: { pages: ['list', 'applyPlan'] },
    },
  };
  const sceneCommits = [];
  const documentCommits = [];
  const syncActiveScene = () => {
    const page = target.document.pages.find((candidate) => candidate.id === target.activePageId);
    if (!page) return;
    target.scene = {
      elements: page.elements,
      appState: page.appState,
      files: page.files,
    };
    target.mountedPageId = mounted ? target.activePageId : undefined;
  };
  target.commitScene = (nextScene) => {
    const page = target.document.pages.find((candidate) => candidate.id === target.activePageId);
    if (!page || target.readOnly || target.mountedPageId !== target.activePageId) throw new Error('scene unavailable');
    page.elements = structuredClone(nextScene.elements);
    page.appState = structuredClone(nextScene.appState);
    page.files = structuredClone(nextScene.files);
    target.scene = structuredClone(nextScene);
    target.pageEditVersion += 1;
    target.nativeInteraction = { ...target.nativeInteraction, epoch: target.nativeInteraction.epoch + 1 };
    sceneCommits.push(structuredClone(nextScene));
  };
  target.recordSceneCommit = (record) => sceneCommits.push({ record });
  target.commitDocument = (nextDocument, preferredPageId) => {
    if (target.readOnly) throw new Error('document unavailable');
    target.document = structuredClone(nextDocument);
    target.activePageId = preferredPageId ?? target.activePageId;
    target.pageEditVersion += 1;
    syncActiveScene();
    documentCommits.push(structuredClone(nextDocument));
  };
  target.recordDocumentCommit = (record) => documentCommits.push({ record });
  target.selectPage = (pageId) => {
    target.activePageId = pageId;
    syncActiveScene();
  };
  return { target, sceneCommits, documentCommits };
}

function register(target) {
  return registerActiveIdeaSketchSdkHostTarget(() => target);
}

function executor(protocol, documentId, legacyExecutor) {
  return createIdeaSketchAgentSdkToolExecutor({
    protocol,
    documentId,
    callerId: `adapter-test:${documentId}:${crypto.randomUUID()}`,
    legacyExecutor,
  });
}

test('v2 adapter enforces read-first scene transactions and applies text through the SDK once', async () => {
  const document = createEmptyIdeaSketchDocument({ pageId: 'page-1', now: '2026-09-03T00:00:00Z' });
  const { target, sceneCommits } = mountedTarget(document);
  const unregister = register(target);
  try {
    const toolExecutor = executor(getIdeaSketchAgentToolProtocol(AGENT_TOOL_PROTOCOL_V2), target.documentId);
    const unread = await toolExecutor.execute({
      callId: 'unread',
      name: 'apply_drawing_plan',
      arguments: { pageId: 'page-1', operations: [{ kind: 'create-text', ref: 'label', x: 10, y: 20, originalText: 'Hello' }] },
    });
    assert.equal(unread.kind, 'failure');
    assert.match(unread.summary, /read_active_page/i);

    const read = await toolExecutor.execute({ callId: 'read', name: 'read_active_page', arguments: {} });
    assert.equal(read.kind, 'read');
    assert.equal(read.content.pageRef, 'page:page-1');

    const mutation = await toolExecutor.execute({
      callId: 'text-plan',
      name: 'apply_drawing_plan',
      arguments: {
        pageId: 'page-1',
        operations: [
          { kind: 'create-text', ref: 'label', x: 10, y: 20, originalText: 'Hello', style: { fontSize: 24, color: '#ff0000' }, layout: { autoResize: true } },
          { kind: 'set-text-style', textRef: 'label', fontSize: 30 },
          { kind: 'set-text-layout', textRef: 'label', width: 180 },
        ],
      },
    });
    assert.equal(mutation.kind, 'mutation');
    assert.equal(mutation.appliedByExecutor, true);
    assert.equal(mutation.changeSet.status, 'applied');
    assert.deepEqual(mutation.changeSet.operations.map((operation) => operation.kind), [
      'create-text', 'set-text-style', 'set-text-layout',
    ]);
    assert.equal(sceneCommits.filter((entry) => !entry.record).length, 1);
    assert.equal(target.scene.elements.length, 1);
    assert.equal(target.scene.elements[0].originalText, 'Hello');
    assert.equal(target.scene.elements[0].fontSize, 30);
    assert.equal(target.scene.elements[0].width, 180);

    const secondMutationWithoutRead = await toolExecutor.execute({
      callId: 'stale-read',
      name: 'apply_drawing_plan',
      arguments: { pageId: 'page-1', operations: [{ kind: 'create-text', ref: 'another', x: 0, y: 0, originalText: 'Nope' }] },
    });
    assert.equal(secondMutationWithoutRead.kind, 'failure');
    assert.equal(sceneCommits.filter((entry) => !entry.record).length, 1);
  } finally {
    unregister();
  }
});

test('v2 adapter creates shape-bound text and preserves relation closure', async () => {
  const document = createEmptyIdeaSketchDocument({ pageId: 'page-1', now: '2026-09-03T00:00:00Z' });
  const { target } = mountedTarget(document);
  const unregister = register(target);
  try {
    const toolExecutor = executor(getIdeaSketchAgentToolProtocol(2), target.documentId);
    await toolExecutor.execute({ callId: 'read-bound', name: 'read_active_page', arguments: {} });
    const result = await toolExecutor.execute({
      callId: 'bound-plan',
      name: 'apply_drawing_plan',
      arguments: {
        pageId: 'page-1',
        operations: [
          { kind: 'create-shape', ref: 'box', shape: 'rectangle', x: 0, y: 0, width: 220, height: 120 },
          { kind: 'upsert-bound-text', shapeRef: 'box', createRef: 'label', originalText: 'Inside', style: { fontSize: 18 }, layout: { overflowPolicy: 'grow-container' } },
        ],
      },
    });
    assert.equal(result.kind, 'mutation');
    const shape = target.scene.elements.find((element) => element.type === 'rectangle');
    const text = target.scene.elements.find((element) => element.type === 'text');
    assert.ok(shape);
    assert.ok(text);
    assert.equal(text.containerId, shape.id);
    assert.deepEqual(shape.boundElements, [{ id: text.id, type: 'text' }]);
    assert.equal(text.originalText, 'Inside');
  } finally {
    unregister();
  }
});

test('v2 adapter routes Page mutations through pages.applyPlan and reports truthful history', async () => {
  const document = createEmptyIdeaSketchDocument({ pageId: 'page-1', now: '2026-09-03T00:00:00Z' });
  const { target, documentCommits } = mountedTarget(document);
  const unregister = register(target);
  try {
    const toolExecutor = executor(getIdeaSketchAgentToolProtocol(AGENT_TOOL_PROTOCOL_V2), target.documentId);
    const outline = await toolExecutor.execute({ callId: 'outline', name: 'read_document_outline', arguments: {} });
    assert.equal(outline.kind, 'read');
    const result = await toolExecutor.execute({
      callId: 'add-page',
      name: 'add_page',
      arguments: {
        title: 'Text page',
        initialScene: { operations: [{ kind: 'create-text', ref: 'title', x: 20, y: 20, originalText: 'Page title' }] },
      },
    });
    assert.equal(result.kind, 'mutation');
    assert.equal(result.appliedByExecutor, true);
    assert.equal(result.changeSet.status, 'applied');
    assert.equal(target.document.pages.length, 2);
    assert.equal(result.changeSet.operations[0].kind, 'add-page');
    assert.equal(documentCommits.filter((entry) => !entry.record).length, 1);
    assert.equal(target.document.pages[1].elements[0].originalText, 'Page title');
  } finally {
    unregister();
  }
});

test('v2 adapter fails closed for stale, cancelled, read-only, and legacy Tool calls', async () => {
  const document = createEmptyIdeaSketchDocument({ pageId: 'page-1', now: '2026-09-03T00:00:00Z' });
  const { target, sceneCommits } = mountedTarget(document);
  const unregister = register(target);
  try {
    const legacyCalls = [];
    const legacyExecutor = createAgentToolHost({
      extension: {
        ...ideaSketchAgentExtension,
        tools: ideaSketchAgentExtension.tools,
        executeTool(call) {
          legacyCalls.push(call.name);
          return { kind: 'failure', callId: call.callId, name: call.name, success: false, summary: 'legacy', error: { code: 'toolExecutionFailed', message: 'legacy', diagnosticId: 'legacy', retryable: false }, truncated: false, persistable: true };
        },
      },
      context: {
        documentId: target.documentId,
        revision: target.revision,
        documentStatus: 'editable',
        model: structuredClone(document),
      },
    });
    const toolExecutor = executor(getIdeaSketchAgentToolProtocol(AGENT_TOOL_PROTOCOL_V2), target.documentId, legacyExecutor);
    await toolExecutor.execute({ callId: 'stale-read', name: 'read_active_page', arguments: {} });
    target.pageEditVersion += 1;
    const stale = await toolExecutor.execute({
      callId: 'stale',
      name: 'apply_drawing_plan',
      arguments: { pageId: 'page-1', operations: [{ kind: 'create-text', ref: 'x', x: 0, y: 0, originalText: 'stale' }] },
    });
    assert.equal(stale.kind, 'failure');
    assert.equal(sceneCommits.filter((entry) => !entry.record).length, 0);

    const controller = new AbortController();
    controller.abort();
    const cancelled = await toolExecutor.execute({ callId: 'cancelled', name: 'read_active_page', arguments: {} }, controller.signal);
    assert.equal(cancelled.kind, 'failure');

    const rawV2 = await toolExecutor.execute({ callId: 'raw-v2', name: 'replace_page_elements', arguments: { pageId: 'page-1', elements: [] } });
    assert.equal(rawV2.kind, 'failure');
    assert.equal(legacyCalls.length, 0);
  } finally {
    unregister();
  }

  const readOnlyDocument = createEmptyIdeaSketchDocument({ pageId: 'page-1', now: '2026-09-03T00:00:00Z' });
  const readOnly = mountedTarget(readOnlyDocument, { readOnly: true });
  const unregisterReadOnly = register(readOnly.target);
  try {
    const toolExecutor = executor(getIdeaSketchAgentToolProtocol(2), readOnly.target.documentId);
    await toolExecutor.execute({ callId: 'readonly-read', name: 'read_active_page', arguments: {} });
    const result = await toolExecutor.execute({
      callId: 'readonly-write',
      name: 'apply_drawing_plan',
      arguments: { pageId: 'page-1', operations: [{ kind: 'create-text', ref: 'x', x: 0, y: 0, originalText: 'blocked' }] },
    });
    assert.equal(result.kind, 'failure');
  } finally {
    unregisterReadOnly();
  }
});

test('v1 semantic drawing remains SDK-backed while raw compatibility stays version-pinned', async () => {
  const document = createEmptyIdeaSketchDocument({ pageId: 'page-1', now: '2026-09-03T00:00:00Z' });
  const { target } = mountedTarget(document);
  const unregister = register(target);
  try {
    const legacyCalls = [];
    const legacyExecutor = createAgentToolHost({
      extension: {
        ...ideaSketchAgentExtension,
        executeTool(call) {
          legacyCalls.push(call.name);
          return { kind: 'failure', callId: call.callId, name: call.name, success: false, summary: 'legacy', error: { code: 'toolExecutionFailed', message: 'legacy', diagnosticId: 'legacy', retryable: false }, truncated: false, persistable: true };
        },
      },
      context: { documentId: target.documentId, revision: target.revision, documentStatus: 'editable', model: structuredClone(document) },
    });
    const toolExecutor = executor(getIdeaSketchAgentToolProtocol(AGENT_TOOL_PROTOCOL_V1), target.documentId, legacyExecutor);
    await toolExecutor.execute({ callId: 'v1-read', name: 'read_active_page', arguments: {} });
    const drawing = await toolExecutor.execute({
      callId: 'v1-drawing',
      name: 'apply_drawing_plan',
      arguments: {
        pageId: 'page-1',
        operations: [
          { kind: 'create-shape', ref: 'box', shape: 'rectangle', x: 0, y: 0, width: 100, height: 60 },
          // v1 historically reused the shape style schema for arrows. These
          // shape-only fields remain accepted by the pinned compatibility
          // translator and are ignored by the canonical connector builder.
          {
            kind: 'create-arrow',
            ref: 'arrow',
            start: { x: 0, y: 0 },
            end: { x: 100, y: 60 },
            style: { backgroundColor: '#ffffff', fillStyle: 'hachure', roundness: 'rounded' },
          },
        ],
      },
    });
    assert.equal(drawing.kind, 'mutation');
    assert.deepEqual(legacyCalls, []);

    await toolExecutor.execute({ callId: 'v1-outline', name: 'read_document_outline', arguments: {} });
    const emptyAdd = await toolExecutor.execute({ callId: 'v1-empty-add', name: 'add_page', arguments: { title: 'Canonical page', elements: [] } });
    assert.equal(emptyAdd.kind, 'failure');
    assert.deepEqual(legacyCalls, ['add_page']);

    const rawAdd = await toolExecutor.execute({ callId: 'v1-raw-add', name: 'add_page', arguments: { title: 'Legacy page', elements: [{ id: 'raw', type: 'rectangle' }] } });
    assert.equal(rawAdd.kind, 'failure');
    assert.deepEqual(legacyCalls, ['add_page', 'add_page']);

    await toolExecutor.execute({ callId: 'v1-replace-read', name: 'read_active_page', arguments: {} });
    const rawReplace = await toolExecutor.execute({ callId: 'v1-raw-replace', name: 'replace_page_elements', arguments: { pageId: target.activePageId, elements: [] } });
    assert.equal(rawReplace.kind, 'failure');
    assert.deepEqual(legacyCalls, ['add_page', 'add_page', 'replace_page_elements']);
  } finally {
    unregister();
  }
});

test('v1 read projections retain legacy fields and Page structure writes stay no-read compatible', async () => {
  const document = createEmptyIdeaSketchDocument({ pageId: 'page-1', now: '2026-09-03T00:00:00Z' });
  document.pages[0].title = 'First page';
  const secondPage = structuredClone(document.pages[0]);
  secondPage.id = 'page-2';
  secondPage.title = 'Second page';
  document.pages.push(secondPage);
  const { target } = mountedTarget(document);
  const unregister = register(target);
  try {
    const legacyCalls = [];
    const legacyExecutor = createAgentToolHost({
      extension: {
        ...ideaSketchAgentExtension,
        executeTool(call) {
          legacyCalls.push(call.name);
          return { kind: 'failure', callId: call.callId, name: call.name, success: false, summary: 'legacy', error: { code: 'toolExecutionFailed', message: 'legacy', diagnosticId: 'legacy', retryable: false }, truncated: false, persistable: true };
        },
      },
      context: { documentId: target.documentId, revision: target.revision, documentStatus: 'editable', model: structuredClone(document) },
    });
    const toolExecutor = executor(getIdeaSketchAgentToolProtocol(AGENT_TOOL_PROTOCOL_V1), target.documentId, legacyExecutor);

    const active = await toolExecutor.execute({ callId: 'v1-active', name: 'read_active_page', arguments: {} });
    assert.equal(active.kind, 'read');
    assert.equal(active.persistable, false);
    assert.equal(active.content.id, 'page-1');
    assert.equal(active.content.title, 'First page');
    assert.equal(active.content.elementCount, 0);
    assert.equal(active.content.cameraCount, 0);
    assert.equal(active.content.truncated, false);

    const outline = await toolExecutor.execute({ callId: 'v1-outline', name: 'read_document_outline', arguments: {} });
    assert.equal(outline.kind, 'read');
    assert.equal(outline.persistable, true);
    assert.equal(outline.content.pages[0].id, 'page-1');
    assert.equal(outline.content.pages[0].pageRef, 'page:page-1');
    assert.equal(outline.content.truncated, false);

    const deleted = await toolExecutor.execute({ callId: 'v1-delete', name: 'delete_page', arguments: { pageId: 'page-2' } });
    assert.equal(deleted.kind, 'mutation');
    assert.equal(target.document.pages.length, 1);
    assert.deepEqual(legacyCalls, []);
  } finally {
    unregister();
  }
});

test('SDK-backed Agent executors release their caller-bound session explicitly', async () => {
  const document = createEmptyIdeaSketchDocument({ pageId: 'page-1', now: '2026-09-03T00:00:00Z' });
  const { target } = mountedTarget(document);
  const unregister = register(target);
  try {
    const toolExecutor = executor(getIdeaSketchAgentToolProtocol(2), target.documentId);
    const read = await toolExecutor.execute({ callId: 'dispose-read', name: 'read_active_page', arguments: {} });
    assert.equal(read.kind, 'read');
    await toolExecutor.dispose();
    const afterDispose = await toolExecutor.execute({ callId: 'after-dispose', name: 'read_active_page', arguments: {} });
    assert.equal(afterDispose.kind, 'failure');
    assert.match(afterDispose.error.message, /closed|session/i);
  } finally {
    unregister();
  }
});
