import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Markdown keeps one CodeMirror host through Preview, Split, and Edit', async () => {
  const editor = await readSource('src/components/MarkdownEditor.tsx');
  assert.equal((editor.match(/ref=\{editor\.hostRef\}/g) ?? []).length, 1);
  assert.match(editor, /viewMode === "preview" \? 0/);
  assert.match(editor, /editor\.requestMeasure\(\)/);
  assert.match(editor, /editor\.focus\(\)/);
  assert.doesNotMatch(editor, /\(viewMode === "edit" \|\| viewMode === "split"\) && \(/);
});

test('Markdown top chrome starts with Outline and keeps history at lower left', async () => {
  const editor = await readSource('src/components/MarkdownEditor.tsx');
  const outline = editor.indexOf('label={showOutline ? "Hide outline" : "Show outline"}');
  const viewMode = editor.indexOf('aria-label="Markdown view mode"');
  assert.ok(outline >= 0 && outline < viewMode);
  assert.match(editor, /ideanote-markdown-toolbar[^"\n]*justify-start/);
  assert.doesNotMatch(editor, /ideanote-markdown-toolbar[^"\n]*justify-between/);
  assert.match(editor, /className="ideanote-markdown-history"/);
  assert.match(editor, /disabled=\{readOnly \|\| !editor\.canUndo\}/);
  assert.match(editor, /disabled=\{readOnly \|\| !editor\.canRedo\}/);
  assert.doesNotMatch(editor, /label="Heading"|label="Bold"|label="Italic"|label="Link"|label="Bullet list"|label="Code block"/);
});

test('Markdown line numbers default off and reconfigure without rebuilding editor state', async () => {
  const settings = await import('../src/lib/settings.ts');
  const editor = await readSource('src/components/MarkdownEditor.tsx');
  const hook = await readSource('src/hooks/useCodeMirrorEditor.ts');
  assert.equal(settings.DEFAULT_SETTINGS.markdown.showLineNumbers, false);
  assert.match(editor, /showLineNumbers: settings\.markdown\.showLineNumbers/);
  assert.match(hook, /lineNumbersCompartment/);
  assert.match(hook, /reconfigure\(showLineNumbers/);
  assert.equal((hook.match(/new EditorView/g) ?? []).length, 1);
});

test('Markdown Outline uses the default-off setting only when document state is absent', async () => {
  const settings = await import('../src/lib/settings.ts');
  const editor = await readSource('src/components/MarkdownEditor.tsx');
  assert.equal(settings.DEFAULT_SETTINGS.markdown.openOutlineByDefault, false);
  assert.match(
    editor,
    /useState\(\s*initialState\?\.showOutline \?\? settings\.markdown\.openOutlineByDefault,?\s*\)/,
  );
  assert.match(editor, /outlineDefaultApplied = useRef\(typeof initialState\?\.showOutline === "boolean"\)/);
  assert.match(editor, /if \(!hydrated \|\| outlineDefaultApplied\.current\) return/);
  assert.match(editor, /setShowOutline\(settings\.markdown\.openOutlineByDefault\)/);
  assert.match(editor, /updateEditorState\(\{ showOutline: !showOutline \}\)/);
  assert.match(editor, /if \(typeof patch\.showOutline === "boolean"\) setShowOutline\(patch\.showOutline\)/);
  assert.doesNotMatch(editor, /updateSettings[\s\S]*showOutline/);
});
