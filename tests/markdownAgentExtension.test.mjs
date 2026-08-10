import test from 'node:test';
import assert from 'node:assert/strict';
import { markdownAgentExtension } from '../src/lib/agent/extensions/markdownAgentExtension.ts';
import { createAgentToolHost, createDirectApplyToolExecutor } from '../src/lib/agent/agentToolHost.ts';
import {
  executeMarkdownAgentTool,
  getMarkdownRangeHash,
  resolveMarkdownAgentEdit,
} from '../src/lib/agent/extensions/markdownAgentTools.ts';

function model(text) {
  return {
    type: 'markdown',
    text,
    bom: false,
    lineEnding: 'lf',
    originalText: text,
  };
}

function context(text, overrides = {}) {
  return {
    documentId: 'readme-md',
    revision: 7,
    documentStatus: 'editable',
    sourceModified: 'source-a',
    activeContextId: '2:0-2:4',
    model: model(text),
    ...overrides,
  };
}

test('Markdown extension exposes a lean context and format-specific Tool surface', () => {
  const source = `${Array.from({ length: 45 }, (_, index) => `# Heading ${index + 1}`).join('\n')}\nsecret body`;
  const snapshot = markdownAgentExtension.buildContext(model(source), '3:1-3:4', 7);
  assert.equal(markdownAgentExtension.fileType, 'markdown');
  assert.equal(markdownAgentExtension.skillId, 'markdown');
  assert.deepEqual(markdownAgentExtension.tools.map((tool) => tool.name), [
    'read_markdown_outline',
    'read_markdown_document',
    'read_markdown_range',
    'replace_markdown_range',
  ]);
  assert.equal(snapshot.selection, '3:1-3:4');
  assert.equal(snapshot.headings.length, 40);
  assert.equal(snapshot.headingsTruncated, true);
  assert.equal(snapshot.fullSourceOmitted, true);
  assert.equal(JSON.stringify(snapshot).includes('secret body'), false);
  assert.deepEqual(
    markdownAgentExtension.tools.find((tool) => tool.name === 'replace_markdown_range').requires,
    ['read_markdown_range'],
  );
  assert.equal(markdownAgentExtension.tools.some((tool) => /save|file|shell|network/i.test(tool.name)), false);
});

test('Markdown outline, document, and precise range reads stay bounded', () => {
  const source = '# Intro\nAlpha 😀 beta\n## Details\nLast';
  const outline = executeMarkdownAgentTool(
    { callId: 'outline', name: 'read_markdown_outline', arguments: {} },
    context(source),
  );
  assert.equal(outline.kind, 'read');
  assert.deepEqual(outline.content.headings, [
    { line: 1, level: 1, text: 'Intro' },
    { line: 3, level: 2, text: 'Details' },
  ]);

  const documentRead = executeMarkdownAgentTool(
    { callId: 'document', name: 'read_markdown_document', arguments: {} },
    context(source),
  );
  assert.equal(documentRead.kind, 'read');
  assert.match(documentRead.content.source, /^1: # Intro/m);
  assert.equal(documentRead.persistable, false);

  const rangeRead = executeMarkdownAgentTool(
    {
      callId: 'range',
      name: 'read_markdown_range',
      arguments: { startLine: 2, startColumn: 6, endLine: 2, endColumn: 8 },
    },
    context(source),
  );
  assert.equal(rangeRead.kind, 'read');
  assert.equal(rangeRead.content.source, '2: 😀');
  assert.equal(rangeRead.content.rangeHash, getMarkdownRangeHash('😀'));
  assert.deepEqual(rangeRead.content.from, { line: 2, column: 6 });
  assert.deepEqual(rangeRead.content.to, { line: 2, column: 8 });

  assert.throws(() => executeMarkdownAgentTool(
    { callId: 'large', name: 'read_markdown_document', arguments: {} },
    context('x'.repeat(32_001)),
  ), /use read_markdown_range/);
  assert.throws(() => executeMarkdownAgentTool(
    {
      callId: 'split',
      name: 'read_markdown_range',
      arguments: { startLine: 2, startColumn: 7, endLine: 2, endColumn: 8 },
    },
    context(source),
  ), /surrogate pair/);
});

test('Markdown mutation resolves only an exact live source-bound range', () => {
  const source = '# Intro\nAlpha 😀 beta\nLast';
  const rangeHash = getMarkdownRangeHash('Alpha 😀 beta');
  const mutation = executeMarkdownAgentTool(
    {
      callId: 'replace',
      name: 'replace_markdown_range',
      arguments: {
        startLine: 2,
        startColumn: 0,
        endLine: 2,
        endColumn: 13,
        replacement: 'Changed',
        rangeHash,
      },
    },
    context(source),
  );
  assert.equal(mutation.kind, 'mutation');
  assert.equal(mutation.changeSet.status, 'proposed');

  const resolved = resolveMarkdownAgentEdit(mutation.changeSet, {
    documentId: 'readme-md',
    revision: 7,
    documentStatus: 'editable',
    sourceModified: 'source-a',
    readOnly: false,
    model: model(source),
  });
  assert.deepEqual(resolved, { from: 8, to: 21, replacement: 'Changed' });

  assert.equal(resolveMarkdownAgentEdit(mutation.changeSet, {
    documentId: 'readme-md', revision: 8, documentStatus: 'editable',
    sourceModified: 'source-a', readOnly: false, model: model(source),
  }), undefined);
  assert.equal(resolveMarkdownAgentEdit(mutation.changeSet, {
    documentId: 'readme-md', revision: 7, documentStatus: 'editable',
    sourceModified: 'source-a', readOnly: false, model: model(`${source}!`),
  }), undefined);
  assert.equal(resolveMarkdownAgentEdit(mutation.changeSet, {
    documentId: 'readme-md', revision: 7, documentStatus: 'editable',
    sourceModified: 'source-a', readOnly: true, model: model(source),
  }), undefined);
});

test('generic Tool host applies a production Markdown mutation exactly once', async () => {
  let liveText = '# Intro\nBefore';
  const liveDocument = {
    id: 'readme-md',
    revision: 7,
    status: 'editable',
    sourceModified: 'source-a',
  };
  let applications = 0;
  const baseExecutor = createAgentToolHost({
    extension: markdownAgentExtension,
    context: context(liveText),
  });
  const executor = createDirectApplyToolExecutor({
    executor: baseExecutor,
    capturedTarget: {
      documentId: 'readme-md', extensionId: 'markdown-agent', revision: 7,
      documentStatus: 'editable', sourceModified: 'source-a',
    },
    getActiveBinding: () => ({
      document: liveDocument,
      extensionId: 'markdown-agent',
      readOnly: false,
      applyChangeSet(changeSet) {
        const edit = resolveMarkdownAgentEdit(changeSet, {
          documentId: liveDocument.id,
          revision: liveDocument.revision,
          documentStatus: liveDocument.status,
          sourceModified: liveDocument.sourceModified,
          readOnly: false,
          model: model(liveText),
        });
        if (!edit) return false;
        applications += 1;
        liveText = `${liveText.slice(0, edit.from)}${edit.replacement}${liveText.slice(edit.to)}`;
        return true;
      },
    }),
    isActive: () => true,
  });

  const read = await executor.execute({
    callId: 'read-before',
    name: 'read_markdown_range',
    arguments: { startLine: 2, startColumn: 0, endLine: 2, endColumn: 6 },
  });
  const mutation = await executor.execute({
    callId: 'replace-before',
    name: 'replace_markdown_range',
    arguments: {
      startLine: 2, startColumn: 0, endLine: 2, endColumn: 6,
      replacement: 'After', rangeHash: read.content.rangeHash,
    },
  });
  assert.equal(mutation.kind, 'mutation');
  assert.equal(mutation.changeSet.status, 'applied');
  assert.equal(liveText, '# Intro\nAfter');
  assert.equal(applications, 1);
});
