import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyIdeaSketchDocument } from '../src/lib/ideaSketchDocument.ts';
import { createAgentToolHost } from '../src/lib/agent/agentToolHost.ts';
import { ideaSketchAgentExtension } from '../src/lib/agent/extensions/ideaSketchAgentExtension.ts';

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
  document.pages[0].elements = Array.from({ length: 90 }, (_, index) => ({ id: `e-${index}`, type: 'rectangle' }));
  const context = ideaSketchAgentExtension.buildContext(document, 'page-1', 7);
  assert.equal(context.revision, 7);
  assert.equal(context.activePage.id, 'page-1');
  assert.equal(context.activePage.elements.length, 80);
  assert.equal(context.activePage.truncated, true);

  const result = await host(document, 7).execute({ callId: 'read-1', name: 'read_active_page', arguments: {} });
  assert.equal(result.kind, 'read');
  assert.equal(result.content.elements.length, 80);
  assert.equal(result.truncated, true);
  assert.equal(result.persistable, false);
});

test('IdeaSketch mutations are proposal-only Change Sets routed through the Tool host', async () => {
  const document = createEmptyIdeaSketchDocument({ pageId: 'page-1', now: '2026-08-08T00:00:00Z' });
  const result = await host(document).execute({
    callId: 'add-1',
    name: 'propose_add_page',
    arguments: { title: 'Architecture', elements: [] },
  });
  assert.equal(result.kind, 'proposal');
  assert.equal(result.changeSet.status, 'proposed');
  assert.equal(result.changeSet.documentId, 'doc-1');
  assert.equal(result.changeSet.baseRevision, 3);
  assert.equal(result.changeSet.baseDocumentStatus, 'editable');
  assert.equal(result.changeSet.operations[0].kind, 'add-page');
  assert.equal(document.pages.length, 1);
});

test('malformed, oversized, and semantically stale proposals are rejected', async () => {
  const document = createEmptyIdeaSketchDocument();
  const executor = host(document, 0, document.pages[0].id);
  const missingTitle = await executor.execute({
    callId: 'bad-1',
    name: 'propose_add_page',
    arguments: { elements: [] },
  });
  assert.equal(missingTitle.kind, 'failure');
  assert.equal(missingTitle.error.code, 'toolValidationFailed');

  const oversized = await executor.execute({
    callId: 'bad-2',
    name: 'propose_add_page',
    arguments: { title: 'Too large', elements: Array.from({ length: 501 }, () => ({})) },
  });
  assert.equal(oversized.kind, 'failure');

  const missingPage = await executor.execute({
    callId: 'bad-3',
    name: 'propose_delete_page',
    arguments: { pageId: 'missing' },
  });
  assert.equal(missingPage.kind, 'failure');
  assert.equal(missingPage.error.code, 'toolExecutionFailed');
});

test('IdeaSketch Page delete, reorder, and content Tools remain review-only', async () => {
  const document = createEmptyIdeaSketchDocument({ pageId: 'page-1', now: '2026-08-08T00:00:00Z' });
  document.pages.push({ id: 'page-2', title: 'Second', elements: [], appState: {}, files: {} });
  const executor = host(document);
  const calls = [
    { callId: 'delete', name: 'propose_delete_page', arguments: { pageId: 'page-2' } },
    { callId: 'reorder', name: 'propose_reorder_page', arguments: { pageId: 'page-2', toIndex: 0 } },
    { callId: 'replace', name: 'propose_replace_page_elements', arguments: { pageId: 'page-1', elements: [{ id: 'shape', type: 'rectangle' }] } },
  ];

  for (const call of calls) {
    const result = await executor.execute(call);
    assert.equal(result.kind, 'proposal');
    assert.equal(result.changeSet.operations[0].kind, call.name.replace('propose_', '').replaceAll('_', '-'));
  }
  assert.deepEqual(document.pages.map((page) => page.id), ['page-1', 'page-2']);
  assert.equal(document.pages[0].elements.length, 0);
});

test('IdeaSketch Tool contract covers outline, Page reads, and reviewed mutations', () => {
  assert.deepEqual(ideaSketchAgentExtension.tools.map((tool) => tool.name), [
    'read_document_outline',
    'read_active_page',
    'propose_add_page',
    'propose_delete_page',
    'propose_reorder_page',
    'propose_replace_page_elements',
  ]);
});
