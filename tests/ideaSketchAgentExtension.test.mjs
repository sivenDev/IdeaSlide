import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createEmptyIdeaSketchDocument } from '../src/lib/ideaSketchDocument.ts';
import { createAgentToolHost } from '../src/lib/agent/agentToolHost.ts';
import {
  buildIdeaSketchDrawingPlanScene,
  buildIdeaSketchLayoutPlanScene,
  ideaSketchAgentExtension,
} from '../src/lib/agent/extensions/ideaSketchAgentExtension.ts';

function host(document, revision = 3, activeContextId = 'page-1') {
  return createAgentToolHost({
    extension: ideaSketchAgentExtension,
    context: {
      documentId: 'doc-1',
      revision,
      documentStatus: 'editable',
      sourceModified: 'source-a',
      activeContextId,
      model: structuredClone(document),
    },
  });
}

test('IdeaSketch context and read Tools are bounded and identify the active Page', async () => {
  const document = createEmptyIdeaSketchDocument({ pageId: 'page-1', now: '2026-08-08T00:00:00Z' });
  document.pages[0].elements = Array.from({ length: 90 }, (_, index) => ({
    id: `e-${index}`,
    type: index === 0 ? 'text' : 'rectangle',
    x: index,
    y: index * 2,
    width: 100,
    height: 60,
    text: index === 0 ? 'Semantic label' : undefined,
    groupIds: index === 1 ? ['group-a'] : [],
  }));
  const context = ideaSketchAgentExtension.buildContext(document, 'page-1', 7);
  assert.equal(context.revision, 7);
  assert.equal(context.activePage.id, 'page-1');
  assert.equal(context.activePage.elementCount, 90);
  assert.equal(context.activePage.cameraCount, 0);
  assert.equal('elements' in context.activePage, false);
  assert.equal('truncated' in context.activePage, false);

  const result = await host(document, 7).execute({ callId: 'read-1', name: 'read_active_page', arguments: {} });
  assert.equal(result.kind, 'read');
  assert.equal(result.content.elements.length, 80);
  assert.deepEqual(result.content.elements[0], {
    ref: 'element:e-0',
    id: 'e-0',
    type: 'text',
    bounds: { x: 0, y: 0, width: 100, height: 60 },
    text: 'Semantic label',
    zIndex: 0,
  });
  assert.deepEqual(result.content.elements[1].groupIds, ['group-a']);
  assert.equal(result.content.elementLimit, 80);
  assert.equal(result.content.returnedElementCount, 80);
  assert.equal(result.truncated, true);
  assert.equal(result.persistable, false);
});

test('semantic drawing plans create stable shapes, arrows, and bindings without replacing unrelated elements', async () => {
  const document = createEmptyIdeaSketchDocument({ pageId: 'page-1', now: '2026-08-08T00:00:00Z' });
  document.pages[0].elements = [{
    id: 'existing', type: 'rectangle', x: 0, y: 0, width: 120, height: 80,
    boundElements: null, version: 1, versionNonce: 10, updated: 100,
  }];
  const call = {
    callId: 'draw-1',
    name: 'apply_drawing_plan',
    arguments: {
      pageId: 'page-1',
      operations: [
        {
          kind: 'create-shape', ref: 'next-box', shape: 'rectangle',
          x: 260, y: 20, width: 140, height: 90,
          style: { backgroundColor: '#e5dbff', strokeColor: '#5f3dc4', roundness: 'rounded' },
        },
        {
          kind: 'create-arrow', ref: 'connector',
          start: { x: 120, y: 40 }, end: { x: 260, y: 65 },
        },
        {
          kind: 'bind-arrow', arrowRef: 'connector',
          startElementRef: 'element:existing', endElementRef: 'next-box',
        },
      ],
    },
  };

  const result = await host(document).execute(call);
  assert.equal(result.kind, 'mutation');
  assert.equal(result.changeSet.operations.length, 3);
  assert.deepEqual(result.changeSet.operations.map((operation) => operation.kind), [
    'create-shape',
    'create-arrow',
    'bind-arrow',
  ]);
  assert.match(result.summary, /1 shape, 1 arrow, and 2 bindings/);
  const repeated = await host(document).execute(structuredClone(call));
  assert.equal(repeated.kind, 'mutation');
  assert.equal(
    repeated.changeSet.operations[0].elementId,
    result.changeSet.operations[0].elementId,
  );

  let nonce = 100;
  const scene = buildIdeaSketchDrawingPlanScene(
    document.pages[0].elements,
    result.changeSet.operations,
    { createNonce: () => ++nonce, now: () => 500 },
  );
  assert.equal(scene.length, 3);
  assert.equal(scene[0].id, 'existing');
  const shape = scene.find((element) => element.type === 'rectangle' && element.id !== 'existing');
  const arrow = scene.find((element) => element.type === 'arrow');
  assert.equal(shape.backgroundColor, '#e5dbff');
  assert.deepEqual(arrow.startBinding, { elementId: 'existing', focus: 0, gap: 6 });
  assert.deepEqual(arrow.endBinding, { elementId: shape.id, focus: 0, gap: 6 });
  assert.deepEqual(scene[0].boundElements, [{ id: arrow.id, type: 'arrow' }]);
  assert.deepEqual(shape.boundElements, [{ id: arrow.id, type: 'arrow' }]);

  const semanticDocument = structuredClone(document);
  semanticDocument.pages[0].elements = scene;
  const read = await host(semanticDocument).execute({
    callId: 'read-bindings', name: 'read_active_page', arguments: {},
  });
  assert.equal(read.kind, 'read');
  assert.deepEqual(read.content.elements[0].boundElementRefs, [`element:${arrow.id}`]);
});

test('semantic drawing plans reject malformed, oversized, forward, and cross-Page references', async () => {
  const document = createEmptyIdeaSketchDocument({ pageId: 'page-1', now: '2026-08-08T00:00:00Z' });
  document.pages.push({ id: 'page-2', title: 'Second', elements: [], appState: {}, files: {} });
  const executor = host(document);
  const invalidCalls = [
    {
      callId: 'cross-page', name: 'apply_drawing_plan',
      arguments: {
        pageId: 'page-2',
        operations: [{ kind: 'create-shape', ref: 'box', shape: 'rectangle', x: 0, y: 0, width: 100, height: 60 }],
      },
    },
    {
      callId: 'forward-ref', name: 'apply_drawing_plan',
      arguments: {
        pageId: 'page-1',
        operations: [{ kind: 'bind-arrow', arrowRef: 'later', endElementRef: 'missing' }],
      },
    },
    {
      callId: 'oversized', name: 'apply_drawing_plan',
      arguments: {
        pageId: 'page-1',
        operations: Array.from({ length: 41 }, (_, index) => ({
          kind: 'create-shape', ref: `box-${index}`, shape: 'rectangle',
          x: index * 10, y: 0, width: 100, height: 60,
        })),
      },
    },
  ];

  for (const call of invalidCalls) {
    const result = await executor.execute(call);
    assert.equal(result.kind, 'failure', call.callId);
    assert.equal(result.error.code, 'toolExecutionFailed', call.callId);
  }
});

test('semantic layout plans move bound text, resize nodes, and preserve arrow bindings', async () => {
  const document = createEmptyIdeaSketchDocument({ pageId: 'page-1', now: '2026-08-08T00:00:00Z' });
  document.pages[0].elements = [
    {
      id: 'box', type: 'rectangle', x: 10, y: 20, width: 120, height: 80,
      boundElements: [{ id: 'label', type: 'text' }, { id: 'label-2', type: 'text' }, { id: 'arrow', type: 'arrow' }], version: 2,
    },
    { id: 'label', type: 'text', x: 30, y: 40, width: 60, height: 20, containerId: 'box', version: 1 },
    { id: 'label-2', type: 'text', x: 35, y: 45, width: 60, height: 20, version: 1 },
    {
      id: 'arrow', type: 'arrow', x: 130, y: 50, width: 100, height: 0,
      points: [[0, 0], [100, 0]], startBinding: { elementId: 'box', focus: 0, gap: 6 },
      endBinding: null, version: 1,
    },
    { id: 'untouched', type: 'ellipse', x: 500, y: 500, width: 40, height: 40, version: 1 },
  ];
  const call = {
    callId: 'layout-1', name: 'apply_layout_plan', arguments: {
      pageId: 'page-1', operations: [
        { kind: 'move-element', elementRef: 'element:box', dx: 80, dy: -10 },
        { kind: 'resize-element', elementRef: 'element:box', width: 240, height: 120 },
      ],
    },
  };
  const result = await host(document).execute(call);
  assert.equal(result.kind, 'mutation');
  assert.deepEqual(result.changeSet.operations.map((operation) => operation.kind), ['move-element', 'resize-element']);
  assert.match(result.summary, /1 move and 1 resize/);

  const scene = buildIdeaSketchLayoutPlanScene(document.pages[0].elements, result.changeSet.operations, {
    createNonce: () => 99, now: () => 500,
  });
  const box = scene.find((element) => element.id === 'box');
  const label = scene.find((element) => element.id === 'label');
  const label2 = scene.find((element) => element.id === 'label-2');
  const arrow = scene.find((element) => element.id === 'arrow');
  assert.deepEqual({ x: box.x, y: box.y, width: box.width, height: box.height }, { x: 90, y: 10, width: 240, height: 120 });
  assert.deepEqual({ x: label.x, y: label.y }, { x: 110, y: 30 });
  assert.deepEqual({ x: label2.x, y: label2.y }, { x: 115, y: 35 });
  assert.deepEqual(arrow.startBinding, { elementId: 'box', focus: 0, gap: 6 });
  assert.deepEqual(scene.find((element) => element.id === 'untouched'), document.pages[0].elements[4]);
});

test('semantic layout plans reject unread, malformed, oversized, and cross-Page targets', async () => {
  const document = createEmptyIdeaSketchDocument({ pageId: 'page-1', now: '2026-08-08T00:00:00Z' });
  document.pages[0].elements = [{ id: 'box', type: 'rectangle', x: 0, y: 0, width: 100, height: 60 }];
  document.pages.push({ id: 'page-2', title: 'Second', elements: [], appState: {}, files: {} });
  const executor = host(document);
  const invalidCalls = [
    { callId: 'cross-page-layout', name: 'apply_layout_plan', arguments: { pageId: 'page-2', operations: [{ kind: 'move-element', elementRef: 'element:box', dx: 1, dy: 1 }] } },
    { callId: 'unread-layout', name: 'apply_layout_plan', arguments: { pageId: 'page-1', operations: [{ kind: 'move-element', elementRef: 'element:missing', dx: 1, dy: 1 }] } },
    { callId: 'bad-layout', name: 'apply_layout_plan', arguments: { pageId: 'page-1', operations: [{ kind: 'resize-element', elementRef: 'element:box', width: 1, height: 1 }] } },
    { callId: 'oversized-layout', name: 'apply_layout_plan', arguments: { pageId: 'page-1', operations: Array.from({ length: 41 }, () => ({ kind: 'move-element', elementRef: 'element:box', dx: 1, dy: 1 })) } },
  ];
  for (const call of invalidCalls) {
    const result = await executor.execute(call);
    assert.equal(result.kind, 'failure', call.callId);
    assert.equal(result.error.code, 'toolExecutionFailed', call.callId);
  }
});

test('IdeaSketch mutations are direct-action transactions routed through the Tool host', async () => {
  const document = createEmptyIdeaSketchDocument({ pageId: 'page-1', now: '2026-08-08T00:00:00Z' });
  const result = await host(document).execute({
    callId: 'add-1',
    name: 'add_page',
    arguments: { title: 'Architecture', elements: [] },
  });
  assert.equal(result.kind, 'mutation');
  assert.equal(result.changeSet.status, 'proposed');
  assert.equal(result.changeSet.documentId, 'doc-1');
  assert.equal(result.changeSet.baseRevision, 3);
  assert.equal(result.changeSet.baseDocumentStatus, 'editable');
  assert.equal(result.changeSet.operations[0].kind, 'add-page');
  assert.equal(document.pages.length, 1);
});

test('Rust rejects malformed and oversized Tool input while the editor extension rejects invalid mutations', async () => {
  const document = createEmptyIdeaSketchDocument();
  const executor = host(document, 0, document.pages[0].id);
  const broker = await readFile(new URL('../src-tauri/src/agent/tool_broker.rs', import.meta.url), 'utf8');
  assert.match(broker, /validator\.validate\(&call\.arguments\)/);

  const addPage = ideaSketchAgentExtension.tools.find((tool) => tool.name === 'add_page');
  assert.equal(addPage.inputSchema.properties.elements.maxItems, 500);
  const drawingPlan = ideaSketchAgentExtension.tools.find((tool) => tool.name === 'apply_drawing_plan');
  assert.equal(drawingPlan.inputSchema.properties.operations.maxItems, 40);
  assert.equal(drawingPlan.inputSchema.additionalProperties, false);

  const missingPage = await executor.execute({
    callId: 'bad-3',
    name: 'delete_page',
    arguments: { pageId: 'missing' },
  });
  assert.equal(missingPage.kind, 'failure');
  assert.equal(missingPage.error.code, 'toolExecutionFailed');
});

test('IdeaSketch Page delete, reorder, and content Tools produce bounded direct transactions', async () => {
  const document = createEmptyIdeaSketchDocument({ pageId: 'page-1', now: '2026-08-08T00:00:00Z' });
  document.pages.push({ id: 'page-2', title: 'Second', elements: [], appState: {}, files: {} });
  const executor = host(document);
  const calls = [
    { callId: 'delete', name: 'delete_page', arguments: { pageId: 'page-2' } },
    { callId: 'reorder', name: 'reorder_page', arguments: { pageId: 'page-2', toIndex: 0 } },
    { callId: 'replace', name: 'replace_page_elements', arguments: { pageId: 'page-1', elements: [{ id: 'shape', type: 'rectangle' }] } },
  ];

  for (const call of calls) {
    const result = await executor.execute(call);
    assert.equal(result.kind, 'mutation');
    assert.equal(result.changeSet.operations[0].kind, call.name.replaceAll('_', '-'));
  }
  assert.deepEqual(document.pages.map((page) => page.id), ['page-1', 'page-2']);
  assert.equal(document.pages[0].elements.length, 0);
});

test('IdeaSketch Tool contract covers outline, Page reads, and direct mutations', () => {
  assert.deepEqual(ideaSketchAgentExtension.tools.map((tool) => tool.name), [
    'read_document_outline',
    'read_active_page',
    'add_page',
    'delete_page',
    'reorder_page',
    'replace_page_elements',
    'apply_drawing_plan',
    'apply_layout_plan',
  ]);
  const replace = ideaSketchAgentExtension.tools.find((tool) => tool.name === 'replace_page_elements');
  assert.match(replace.description, /active Page/);
  assert.deepEqual(replace.requires, ['read_active_page']);
  const drawingPlan = ideaSketchAgentExtension.tools.find((tool) => tool.name === 'apply_drawing_plan');
  assert.match(drawingPlan.description, /ordered semantic/);
  assert.deepEqual(drawingPlan.requires, ['read_active_page']);
  const layoutPlan = ideaSketchAgentExtension.tools.find((tool) => tool.name === 'apply_layout_plan');
  assert.match(layoutPlan.description, /stable element references/);
  assert.deepEqual(layoutPlan.requires, ['read_active_page']);
});
