import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/lib/fileTypeRegistry.ts');
  } catch {
    return {};
  }
}

test('file type registry resolves IdeaSketch and Markdown case-insensitively', async () => {
  const { getFileTypeDefinitionByPath } = await loadModule();
  assert.equal(typeof getFileTypeDefinitionByPath, 'function');
  assert.equal(getFileTypeDefinitionByPath('/workspace/DRAWING.IS').type, 'ideasketch');
  assert.equal(getFileTypeDefinitionByPath('/workspace/readme.md').type, 'markdown');
});

test('IdeaSketch and Markdown are currently creatable and openable', async () => {
  const { getCreatableFileTypeDefinitions, getOpenableFileTypeDefinitions } = await loadModule();
  assert.deepEqual(getCreatableFileTypeDefinitions().map((item) => item.type), ['ideasketch', 'markdown']);
  assert.deepEqual(getOpenableFileTypeDefinitions().map((item) => item.extensions), [['is'], ['md']]);
});

test('Markdown registry preserves source policy through its adapter', async () => {
  const { getFileTypeDefinition } = await loadModule();
  const definition = getFileTypeDefinition('markdown');
  const parsed = await definition.parse({ text: '# Title\r\n', bom: true, lineEnding: 'crlf' });
  assert.equal(parsed.text, '# Title\n');
  assert.equal(parsed.bom, true);
  assert.equal(parsed.lineEnding, 'crlf');
  assert.deepEqual(await definition.serialize(parsed), {
    text: '# Title\r\n',
    bom: true,
    lineEnding: 'crlf',
  });
});

test('IdeaSketch registry operations share the canonical v1 adapter', async () => {
  const { getFileTypeDefinition } = await loadModule();
  const definition = getFileTypeDefinition('ideasketch');
  assert.equal(definition.displayName, 'IdeaSketch');

  const document = await definition.createEmpty({
    now: '2026-08-03T00:00:00Z',
    pageId: 'page-1',
  });
  const serialized = await definition.serialize(document, '2026-08-03T01:00:00Z');
  const parsed = await definition.parse(serialized);

  assert.equal(serialized.manifest.version, '1.0');
  assert.equal(parsed.pages[0].id, 'page-1');
});
