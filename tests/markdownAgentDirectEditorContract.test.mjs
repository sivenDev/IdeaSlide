import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Markdown Agent binds through the generic editor contribution', async () => {
  const editor = await readSource('src/components/MarkdownEditor.tsx');
  const registry = await readSource('src/lib/editorRegistry.tsx');
  assert.match(editor, /onAgentBindingChange/);
  assert.match(editor, /createAgentToolHost/);
  assert.match(editor, /markdownAgentExtension/);
  assert.match(registry, /onAgentBindingChange=\{props\.onAgentBindingChange\}/);
});

test('Markdown Agent applies one native CodeMirror transaction with no file or model-first mutation', async () => {
  const editor = await readSource('src/components/MarkdownEditor.tsx');
  const applyBlock = editor.slice(
    editor.indexOf('const handleApplyAgentChangeSet'),
    editor.indexOf('const agentBindingStateRef'),
  );
  assert.match(applyBlock, /resolveMarkdownAgentEdit/);
  assert.equal((applyBlock.match(/view\.dispatch\(/g) ?? []).length, 1);
  assert.match(applyBlock, /changes:\s*\{ from, to, insert: replacement \}/);
  assert.doesNotMatch(applyBlock, /onModelChange|updateMarkdownText|writeDocument|invoke\(/);

  const hook = await readSource('src/hooks/useCodeMirrorEditor.ts');
  assert.match(hook, /update\.docChanged/);
  assert.match(hook, /onChangeRef\.current\(update\.state\.doc\.toString\(\)\)/);
  assert.match(hook, /history\(\)/);
});
