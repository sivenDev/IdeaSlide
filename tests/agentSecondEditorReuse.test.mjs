import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAgentToolHost } from '../src/lib/agent/agentToolHost.ts';
import {
  getAgentExtension,
  registerAgentExtension,
} from '../src/lib/agent/agentExtensionRegistry.ts';

await import('../src/lib/fileTypeRegistry.ts');

test('the production Markdown extension reuses the generic registry and Tool host', async () => {
  const extension = getAgentExtension('markdown-agent');
  const source = '# Intro\nBody';
  const executor = createAgentToolHost({
    extension,
    context: {
      documentId: 'readme-md', revision: 2, documentStatus: 'editable',
      model: { type: 'markdown', text: source, bom: false, lineEnding: 'lf', originalText: source },
    },
  });
  const read = await executor.execute({ callId: 'outline', name: 'read_markdown_outline', arguments: {} });
  assert.equal(read.kind, 'read');
  assert.equal(read.content.headings[0].text, 'Intro');
});

test('a Markdown-like extension reuses the generic registry and Tool host without runtime or UI changes', async () => {
  const markdownExtension = {
    id: 'synthetic-markdown-agent',
    fileType: 'synthetic-markdown',
    skillId: 'synthetic-markdown',
    tools: [
      {
        name: 'read_headings',
        description: 'Read Markdown headings.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'append_section',
        description: 'Append a section through the active editor.',
        inputSchema: {
          type: 'object',
          properties: { heading: { type: 'string' }, body: { type: 'string' } },
          required: ['heading', 'body'],
          additionalProperties: false,
        },
      },
    ],
    buildContext(model, activeHeadingId, revision) {
      return { revision, activeHeadingId, headings: model.headings.slice(0, 50) };
    },
    executeTool(call, context) {
      if (call.name === 'read_headings') {
        return {
          kind: 'read', callId: call.callId, name: call.name, success: true,
          summary: `Read ${context.model.headings.length} headings`,
          content: context.model.headings, truncated: false, persistable: true,
        };
      }
      return {
        kind: 'mutation', callId: call.callId, name: call.name, success: true,
        summary: `Append ${call.arguments.heading}`,
        changeSet: {
          id: `md-${call.callId}`,
          extensionId: 'synthetic-markdown-agent',
          documentId: context.documentId,
          baseRevision: context.revision,
          sourceFingerprint: 'markdown-fingerprint',
          summary: `Append section ${call.arguments.heading}`,
          operations: [{ kind: 'append-section', ...call.arguments }],
          status: 'proposed',
        },
        truncated: false,
        persistable: true,
      };
    },
    describeChangeSet(changeSet) {
      return changeSet.operations.map((operation) => `Append Markdown section · ${operation.heading}`);
    },
  };

  const unregister = registerAgentExtension(markdownExtension);
  try {
    assert.equal(getAgentExtension('synthetic-markdown-agent'), markdownExtension);
    const model = { text: '# Intro', headings: [{ id: 'intro', text: 'Intro' }] };
    assert.deepEqual(markdownExtension.buildContext(model, 'intro', 2), {
      revision: 2,
      activeHeadingId: 'intro',
      headings: [{ id: 'intro', text: 'Intro' }],
    });
    const executor = createAgentToolHost({
      extension: markdownExtension,
      context: {
        documentId: 'readme-md', revision: 2, documentStatus: 'editable', activeContextId: 'intro', model,
      },
    });
    const read = await executor.execute({ callId: 'read', name: 'read_headings', arguments: {} });
    const mutation = await executor.execute({
      callId: 'mutation', name: 'append_section', arguments: { heading: 'API', body: 'Details' },
    });
    assert.equal(read.kind, 'read');
    assert.equal(mutation.kind, 'mutation');
    assert.equal(mutation.changeSet.extensionId, 'synthetic-markdown-agent');
    assert.deepEqual(markdownExtension.describeChangeSet(mutation.changeSet), ['Append Markdown section · API']);
  } finally {
    unregister();
  }
});

test('managed Skill runtime and UI remain free of editor-format branches', async () => {
  const sources = await Promise.all([
    '../src-tauri/src/agent/mod.rs',
    '../src/lib/agent/agentRuntime.ts',
    '../src/lib/agent/agentStore.ts',
    '../src/components/AgentPanel.tsx',
    '../src/components/agent/AgentComposer.tsx',
    '../src/components/settings/AgentSkillManager.tsx',
  ].map((path) => readFile(new URL(path, import.meta.url), 'utf8')));
  for (const source of sources) {
    assert.doesNotMatch(source, /\bideasketch\b|\.is\b|markdownAgentExtension|\.md\b/i);
  }
});
