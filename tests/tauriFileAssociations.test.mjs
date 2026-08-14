import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readTauriConfig() {
  return JSON.parse(await readFile(
    new URL('../src-tauri/tauri.conf.json', import.meta.url),
    'utf8',
  ));
}

function associationForExtension(associations, extension) {
  return associations.find((association) => association.ext?.includes(extension));
}

test('the installed application associates both IdeaSketch and Markdown documents', async () => {
  const config = await readTauriConfig();
  const associations = config.bundle?.fileAssociations ?? [];

  const ideaSketch = associationForExtension(associations, 'is');
  assert.deepEqual(ideaSketch, {
    ext: ['is'],
    name: 'IdeaNote IdeaSketch',
    description: 'IdeaNote IdeaSketch file',
    role: 'Editor',
    mimeType: 'application/x-ideaslide',
  });

  const markdown = associationForExtension(associations, 'md');
  assert.deepEqual(markdown, {
    ext: ['md'],
    name: 'IdeaNote Markdown',
    description: 'IdeaNote Markdown file',
    role: 'Editor',
    mimeType: 'text/markdown',
  });
});

test('native system-open routing delegates eligibility to the document format registry', async () => {
  const source = await readFile(
    new URL('../src-tauri/src/lib.rs', import.meta.url),
    'utf8',
  );

  assert.match(source, /document_formats::is_openable_path\(path\)/);
  assert.doesNotMatch(source, /extension\(\).*ext\s*==\s*"is"/s);
  assert.match(source, /fn opened_file_path\(/);
  assert.match(source, /opened_file_path_accepts_registered_document_formats/);
  assert.match(source, /opened_file_path_rejects_unsupported_extensions/);
});
