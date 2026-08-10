import test from 'node:test';
import assert from 'node:assert/strict';

async function loadRegistry() {
  await import('../src/lib/fileTypeRegistry.ts');
  return import('../src/lib/agent/agentExtensionRegistry.ts');
}

test('IdeaSketch and Markdown register Agent extensions without coupling the generic runtime to either format', async () => {
  const { getAgentExtension, getAgentExtensionForFileType } = await loadRegistry();
  const ideaSketch = getAgentExtension('ideasketch-agent');
  const markdown = getAgentExtension('markdown-agent');
  assert.equal(ideaSketch.fileType, 'ideasketch');
  assert.equal(ideaSketch.skillId, 'ideasketch');
  assert.equal(markdown.fileType, 'markdown');
  assert.equal(markdown.skillId, 'markdown');
  assert.equal(getAgentExtensionForFileType('ideasketch'), ideaSketch);
  assert.equal(getAgentExtensionForFileType('markdown'), markdown);
});

test('a synthetic future editor can register different Skills and Tools', async () => {
  const { getAgentExtension, registerAgentExtension } = await loadRegistry();
  const unregister = registerAgentExtension({
    id: 'synthetic-plaintext',
    fileType: 'plaintext',
    skillId: 'plaintext',
    tools: [{ name: 'read_markdown', description: 'Read Markdown', inputSchema: { type: 'object' } }],
    buildContext: () => ({ documentType: 'markdown' }),
    executeTool: () => ({
      kind: 'read', callId: 'read', name: 'read_markdown', success: true,
      summary: 'Read Markdown', content: {}, truncated: false, persistable: true,
    }),
    describeChangeSet: () => [],
  });
  assert.equal(getAgentExtension('synthetic-plaintext').skillId, 'plaintext');
  unregister();
  assert.equal(getAgentExtension('synthetic-plaintext'), undefined);
});
