import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  AGENT_TOOL_PROTOCOL_V1,
  AGENT_TOOL_PROTOCOL_V2,
  AGENT_TOOL_SCHEMA_DIGESTS,
  getIdeaSketchAgentToolCatalog,
  getIdeaSketchAgentToolProtocol,
  negotiateIdeaSketchAgentToolProtocol,
} from '../src/lib/agent/agentToolProtocol.ts';
import { createIdeaSketchAgentSdkToolExecutor } from '../src/lib/agent/extensions/ideaSketchAgentSdkAdapter.ts';
import { registerActiveIdeaSketchSdkHostTarget } from '../src/lib/ideasketch-sdk/host.ts';

const v1Names = [
  'read_document_outline',
  'read_active_page',
  'add_page',
  'delete_page',
  'reorder_page',
  'replace_page_elements',
  'apply_drawing_plan',
  'apply_layout_plan',
];

const v2Names = [
  'read_document_outline',
  'read_active_page',
  'add_page',
  'delete_page',
  'reorder_page',
  'apply_drawing_plan',
  'apply_layout_plan',
];

function tool(catalog, name) {
  const descriptor = catalog.find((candidate) => candidate.name === name);
  assert.ok(descriptor, `missing Tool: ${name}`);
  return descriptor;
}

test('IdeaSketch Agent protocol catalogs are exact and version-pinned', () => {
  const v1 = getIdeaSketchAgentToolProtocol(AGENT_TOOL_PROTOCOL_V1);
  const v2 = getIdeaSketchAgentToolProtocol(AGENT_TOOL_PROTOCOL_V2);

  assert.deepEqual(v1.version, { major: 1, minor: 0 });
  assert.deepEqual(v2.version, { major: 2, minor: 0 });
  assert.equal(v1.schemaDigest, AGENT_TOOL_SCHEMA_DIGESTS[1]);
  assert.equal(v2.schemaDigest, AGENT_TOOL_SCHEMA_DIGESTS[2]);
  assert.deepEqual(v1.tools.map((candidate) => candidate.name), v1Names);
  assert.deepEqual(v2.tools.map((candidate) => candidate.name), v2Names);

  const legacyAddPage = tool(v1.tools, 'add_page');
  const semanticAddPage = tool(v2.tools, 'add_page');
  assert.ok('elements' in legacyAddPage.inputSchema.properties);
  assert.equal('elements' in semanticAddPage.inputSchema.properties, false);
  assert.ok('initialScene' in semanticAddPage.inputSchema.properties);
  const outline = tool(v2.tools, 'read_document_outline');
  const activePage = tool(v2.tools, 'read_active_page');
  assert.deepEqual(Object.keys(outline.inputSchema.properties), ['cursor', 'limit']);
  assert.deepEqual(Object.keys(activePage.inputSchema.properties), ['snapshotId', 'cursor', 'limit']);
  assert.deepEqual(semanticAddPage.requires, ['read_document_outline']);
  assert.deepEqual(
    semanticAddPage.inputSchema.properties.initialScene.properties.operations.items.oneOf
      .map((candidate) => candidate.properties.kind.const),
    ['create-shape', 'create-arrow', 'bind-arrow', 'create-text', 'bind-text'],
  );
  assert.deepEqual(tool(v2.tools, 'apply_drawing_plan').requires, ['read_active_page']);
  assert.deepEqual(tool(v2.tools, 'apply_layout_plan').requires, ['read_active_page']);
});

test('semantic v2 text content schemas require exactly one alias', () => {
  const drawingItems = tool(getIdeaSketchAgentToolCatalog({ major: 2, minor: 0 }), 'apply_drawing_plan')
    .inputSchema.properties.operations.items.oneOf;
  for (const kind of ['create-text', 'upsert-bound-text', 'set-text']) {
    const schema = drawingItems.find((candidate) => candidate.properties?.kind?.const === kind);
    assert.ok(schema, `missing text operation schema: ${kind}`);
    assert.deepEqual(schema.oneOf, [{ required: ['text'] }, { required: ['originalText'] }]);
  }
});

test('semantic v2 text style and layout schemas reject mixed patch forms', () => {
  const drawingItems = tool(getIdeaSketchAgentToolCatalog(2), 'apply_drawing_plan')
    .inputSchema.properties.operations.items.oneOf;
  const style = drawingItems.find((candidate) => candidate.properties?.kind?.const === 'set-text-style');
  const layout = drawingItems.find((candidate) => candidate.properties?.kind?.const === 'set-text-layout');
  assert.ok(style);
  assert.ok(layout);
  assert.equal(style.oneOf.length, 2);
  assert.equal(layout.oneOf.length, 2);
  assert.deepEqual(style.oneOf[0].required, ['style']);
  assert.deepEqual(layout.oneOf[0].required, ['layout']);
  assert.deepEqual(style.oneOf[1].anyOf.map((candidate) => candidate.required[0]), [
    'fontFamily', 'fontSize', 'color', 'textAlign', 'verticalAlign', 'opacity', 'lineHeight',
  ]);
  assert.deepEqual(layout.oneOf[1].anyOf.map((candidate) => candidate.required[0]), ['autoResize', 'width']);
});

test('semantic v2 connector schema excludes shape-only style fields', () => {
  const drawingItems = tool(getIdeaSketchAgentToolCatalog(2), 'apply_drawing_plan')
    .inputSchema.properties.operations.items.oneOf;
  const shape = drawingItems.find((candidate) => candidate.properties?.kind?.const === 'create-shape');
  const arrow = drawingItems.find((candidate) => candidate.properties?.kind?.const === 'create-arrow');
  assert.ok(shape);
  assert.ok(arrow);
  assert.ok('backgroundColor' in shape.properties.style.properties);
  assert.equal('backgroundColor' in arrow.properties.style.properties, false);
  assert.equal('fillStyle' in arrow.properties.style.properties, false);
  assert.equal('roundness' in arrow.properties.style.properties, false);
});

test('catalog and protocol access reject malformed versions instead of silently downgrading', () => {
  assert.deepEqual(getIdeaSketchAgentToolCatalog({ major: 1, minor: 0 }).map((candidate) => candidate.name), v1Names);
  assert.deepEqual(getIdeaSketchAgentToolCatalog({ major: 2, minor: 0 }).map((candidate) => candidate.name), v2Names);
  assert.throws(() => getIdeaSketchAgentToolCatalog({ major: 3, minor: 0 }), /major/i);
  assert.throws(() => getIdeaSketchAgentToolCatalog({ major: 1, minor: 1 }), /minor/i);
  assert.throws(() => getIdeaSketchAgentToolCatalog({ major: 1 }), /minor/i);
  assert.throws(() => getIdeaSketchAgentToolCatalog({ major: 1, minor: 0, extra: true }), /unknown/i);
  assert.throws(() => getIdeaSketchAgentToolProtocol(3), /major/i);
  assert.throws(() => getIdeaSketchAgentToolProtocol({ major: 2, minor: 1 }), /minor/i);
  assert.throws(() => negotiateIdeaSketchAgentToolProtocol({ requested: { major: 2, minor: 0, profile: 'agent-v2' }, expectedSchemaDigest: AGENT_TOOL_SCHEMA_DIGESTS[2] }), /unknown/i);
  const symbol = Symbol('unexpected');
  const versionWithSymbol = { major: 2, minor: 0, [symbol]: true };
  assert.throws(() => negotiateIdeaSketchAgentToolProtocol({ requested: versionWithSymbol, expectedSchemaDigest: AGENT_TOOL_SCHEMA_DIGESTS[2] }), /unknown/i);
});

test('negotiation requires an exact digest and never falls back to another major', () => {
  assert.equal(
    negotiateIdeaSketchAgentToolProtocol({
      requested: { major: 1, minor: 0 },
      expectedSchemaDigest: AGENT_TOOL_SCHEMA_DIGESTS[1],
    }).schemaDigest,
    AGENT_TOOL_SCHEMA_DIGESTS[1],
  );
  assert.equal(
    negotiateIdeaSketchAgentToolProtocol({
      requested: { major: 2, minor: 0 },
      expectedSchemaDigest: AGENT_TOOL_SCHEMA_DIGESTS[2],
    }).schemaDigest,
    AGENT_TOOL_SCHEMA_DIGESTS[2],
  );
  assert.throws(
    () => negotiateIdeaSketchAgentToolProtocol({ requested: { major: 2, minor: 0 }, expectedSchemaDigest: AGENT_TOOL_SCHEMA_DIGESTS[1] }),
    /digest/i,
  );
  assert.throws(
    () => negotiateIdeaSketchAgentToolProtocol({ requested: { major: 3, minor: 0 }, expectedSchemaDigest: AGENT_TOOL_SCHEMA_DIGESTS[2] }),
    /major/i,
  );
  assert.throws(
    () => negotiateIdeaSketchAgentToolProtocol({ requested: { major: 2, minor: 0 } }),
    /digest/i,
  );
});

test('negotiated catalog is immutable for the lifetime of a Turn', () => {
  const binding = getIdeaSketchAgentToolProtocol({ major: 2, minor: 0 });
  assert.ok(Object.isFrozen(binding));
  assert.ok(Object.isFrozen(binding.version));
  assert.ok(Object.isFrozen(binding.tools));
  assert.ok(Object.isFrozen(binding.tools[0]));
  assert.ok(Object.isFrozen(binding.tools[0].inputSchema));
  assert.throws(() => { binding.tools.push({}); }, TypeError);
  assert.throws(() => { binding.tools[0].name = 'replace_page_elements'; }, TypeError);
  assert.throws(() => { binding.version.major = 1; }, TypeError);
  assert.equal(getIdeaSketchAgentToolProtocol({ major: 2, minor: 0 }).tools.includes(binding.tools[0]), true);
});

test('v2 catalog does not expose legacy raw or ungranted capabilities', () => {
  const names = getIdeaSketchAgentToolCatalog(2).map((candidate) => candidate.name);
  assert.equal(names.includes('replace_page_elements'), false);
  assert.equal(names.includes('clear_scene'), false);
  assert.equal(names.includes('serialize_page'), false);
  assert.equal(names.includes('read_selection'), false);
});

test('IdeaSketch Skill guidance matches the captured catalog and read coverage contract', async () => {
  const skill = await readFile(new URL('../src-tauri/agent-skills/ideasketch/SKILL.md', import.meta.url), 'utf8');
  assert.match(skill, /default semantic catalog is protocol v2/);
  assert.match(skill, /explicitly pins its version and schema digest/);
  assert.match(skill, /dedicated selection, Camera-control, IO, and Presentation Tools are unavailable/);
  assert.match(skill, /`complete`, `nextCursor`, and `coverage` as authoritative/);
  assert.match(skill, /mutation-ready/);
  assert.match(skill, /Page-structure mutations do not advertise canvas Undo/);
  assert.match(skill, /Do not call an unlisted Tool/);
});

test('v2 Agent read Tools expose cursors for bounded document and scene pagination', async () => {
  const page = (id, title, elements) => ({ id, title, elements, appState: {}, files: {} });
  const pageOneElements = Array.from({ length: 150 }, (_, index) => ({
    id: `element-${index}`,
    type: 'rectangle',
    x: index,
    y: 0,
    width: 40,
    height: 30,
    isDeleted: false,
    locked: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    version: 1,
    versionNonce: index + 1,
    updated: 1,
  }));
  const target = {
    documentSessionId: 'agent-protocol-test-session',
    documentId: 'agent-protocol-test-document',
    activePageId: 'page-1',
    documentStatus: 'editable',
    revision: 1,
    sourceModified: 'source-1',
    readOnly: false,
    mountedPageId: 'page-1',
    pageEditVersion: 1,
    nativeInteraction: { epoch: 0, busy: false, reasons: [] },
    document: {
      type: 'ideasketch',
      formatVersion: '1.0',
      created: '2026-09-03',
      modified: '2026-09-03',
      pages: [page('page-1', 'One', pageOneElements), page('page-2', 'Two', [])],
    },
    scene: { elements: pageOneElements, appState: {}, files: {} },
    services: { pages: true, scene: true, writable: true },
  };
  const unregister = registerActiveIdeaSketchSdkHostTarget(() => target);
  const executor = createIdeaSketchAgentSdkToolExecutor({
    protocol: getIdeaSketchAgentToolProtocol(2),
    documentId: target.documentId,
    callerId: 'agent-protocol-pagination-test',
  });
  try {
    const firstOutline = await executor.execute({
      callId: 'outline-first',
      name: 'read_document_outline',
      arguments: { limit: 1 },
    });
    assert.equal(firstOutline.kind, 'read');
    assert.equal(firstOutline.content.complete, false);
    assert.ok(firstOutline.content.nextCursor);
    const secondOutline = await executor.execute({
      callId: 'outline-second',
      name: 'read_document_outline',
      arguments: { cursor: firstOutline.content.nextCursor, limit: 100 },
    });
    assert.equal(secondOutline.kind, 'read');
    assert.equal(secondOutline.content.complete, true);
    assert.equal(secondOutline.content.documentSnapshotId, firstOutline.content.documentSnapshotId);

    const firstScene = await executor.execute({
      callId: 'scene-first',
      name: 'read_active_page',
      arguments: { limit: 1 },
    });
    assert.equal(firstScene.kind, 'read');
    assert.equal(firstScene.content.complete, false);
    assert.ok(firstScene.content.nextCursor);
    const secondScene = await executor.execute({
      callId: 'scene-second',
      name: 'read_active_page',
      arguments: {
        snapshotId: firstScene.content.snapshotId,
        cursor: firstScene.content.nextCursor,
        limit: 100,
      },
    });
    assert.equal(secondScene.kind, 'read');
    assert.equal(secondScene.content.complete, false);
    assert.equal(secondScene.content.snapshotId, firstScene.content.snapshotId);
    assert.equal(secondScene.content.elements.length, 100);
    const thirdScene = await executor.execute({
      callId: 'scene-third',
      name: 'read_active_page',
      arguments: {
        snapshotId: secondScene.content.snapshotId,
        cursor: secondScene.content.nextCursor,
        limit: 100,
      },
    });
    assert.equal(thirdScene.kind, 'read');
    assert.equal(thirdScene.content.complete, true);
    assert.equal(thirdScene.content.snapshotId, firstScene.content.snapshotId);
    assert.equal(thirdScene.content.elements.length, 49);
  } finally {
    unregister();
  }
});
