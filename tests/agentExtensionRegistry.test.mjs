import test from 'node:test';
import assert from 'node:assert/strict';

async function loadRegistry() {
  await import('../src/lib/fileTypeRegistry.ts');
  return import('../src/lib/agent/agentExtensionRegistry.ts');
}

test('IdeaSketch registers an Agent extension without coupling the generic runtime to the format', async () => {
  const { getAgentExtension, getAgentExtensionForFileType } = await loadRegistry();
  const extension = getAgentExtension('ideasketch-agent');
  assert.equal(extension.fileType, 'ideasketch');
  assert.equal(extension.skillId, 'ideasketch');
  assert.equal(getAgentExtensionForFileType('ideasketch'), extension);
  assert.equal(getAgentExtensionForFileType('markdown'), undefined);
});

test('a synthetic future editor can register different Skills and Tools', async () => {
  const { getAgentExtension, registerAgentExtension } = await loadRegistry();
  const unregister = registerAgentExtension({
    id: 'synthetic-markdown',
    fileType: 'markdown',
    skillId: 'markdown',
    tools: [{ name: 'read_markdown', description: 'Read Markdown', inputSchema: { type: 'object' } }],
    buildContext: () => ({ documentType: 'markdown' }),
    parseChangeSet: () => undefined,
  });
  assert.equal(getAgentExtension('synthetic-markdown').skillId, 'markdown');
  unregister();
  assert.equal(getAgentExtension('synthetic-markdown'), undefined);
});
