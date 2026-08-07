import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyIdeaSketchDocument } from '../src/lib/ideaSketchDocument.ts';
import { ideaSketchAgentExtension } from '../src/lib/agent/extensions/ideaSketchAgentExtension.ts';

test('IdeaSketch context is bounded and identifies the active Page', () => {
  const document = createEmptyIdeaSketchDocument({ pageId: 'page-1', now: '2026-08-08T00:00:00Z' });
  document.pages[0].elements = Array.from({ length: 90 }, (_, index) => ({ id: `e-${index}`, type: 'rectangle' }));
  const context = ideaSketchAgentExtension.buildContext(document, 'page-1', 7);
  assert.equal(context.revision, 7);
  assert.equal(context.activePage.id, 'page-1');
  assert.equal(context.activePage.elements.length, 80);
  assert.equal(context.activePage.truncated, true);
});

test('IdeaSketch mutations are proposal-only change sets', () => {
  const document = createEmptyIdeaSketchDocument({ pageId: 'page-1', now: '2026-08-08T00:00:00Z' });
  const response = 'I prepared a page.\n```ideanote-change\n{"kind":"add-page","title":"Architecture","summary":"Add an architecture page","elements":[]}\n```';
  const changeSet = ideaSketchAgentExtension.parseChangeSet(response, 'doc-1', 3, document);
  assert.equal(changeSet.status, 'proposed');
  assert.equal(changeSet.documentId, 'doc-1');
  assert.equal(changeSet.baseRevision, 3);
  assert.equal(changeSet.operations[0].kind, 'add-page');
  assert.equal(document.pages.length, 1);
});

test('malformed or oversized proposals are rejected', () => {
  const document = createEmptyIdeaSketchDocument();
  assert.equal(ideaSketchAgentExtension.parseChangeSet('```ideanote-change\nnot-json\n```', 'doc', 0, document), undefined);
  const elements = Array.from({ length: 501 }, () => ({}));
  const response = `\`\`\`ideanote-change\n${JSON.stringify({ kind: 'add-page', title: 'Too large', elements })}\n\`\`\``;
  assert.equal(ideaSketchAgentExtension.parseChangeSet(response, 'doc', 0, document), undefined);
});

test('IdeaSketch Page delete, reorder, and content proposals remain review-only', () => {
  const document = createEmptyIdeaSketchDocument({ pageId: 'page-1', now: '2026-08-08T00:00:00Z' });
  document.pages.push({ id: 'page-2', title: 'Second', elements: [], appState: {}, files: {} });
  const proposals = [
    { kind: 'delete-page', pageId: 'page-2' },
    { kind: 'reorder-page', pageId: 'page-2', toIndex: 0 },
    { kind: 'replace-page-elements', pageId: 'page-1', elements: [{ id: 'shape', type: 'rectangle' }] },
  ];

  for (const proposal of proposals) {
    const response = `\`\`\`ideanote-change\n${JSON.stringify(proposal)}\n\`\`\``;
    const changeSet = ideaSketchAgentExtension.parseChangeSet(response, 'doc-1', 4, document);
    assert.equal(changeSet.status, 'proposed');
    assert.equal(changeSet.operations[0].kind, proposal.kind);
  }
  assert.deepEqual(document.pages.map((page) => page.id), ['page-1', 'page-2']);
  assert.equal(document.pages[0].elements.length, 0);
});

test('IdeaSketch tool contract covers outline, Page reads, and reviewed mutations', () => {
  assert.deepEqual(ideaSketchAgentExtension.tools.map((tool) => tool.name), [
    'read_document_outline',
    'read_active_page',
    'propose_add_page',
    'propose_delete_page',
    'propose_reorder_page',
    'propose_replace_page_elements',
  ]);
});
