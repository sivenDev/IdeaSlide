import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { indentWithTab, history, undo, undoDepth } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Markdown is a registry-driven editor contribution and not an EditorLayout branch', async () => {
  const registry = await readSource('src/lib/editorRegistry.tsx');
  const layout = await readSource('src/components/EditorLayout.tsx');
  const host = await readSource('src/components/DocumentEditorHost.tsx');
  assert.match(registry, /\["markdown", \{ id: "markdown", component: MarkdownContribution \}\]/);
  assert.match(host, /getEditorContribution\(definition\.editor\)/);
  assert.doesNotMatch(layout, /fileType === "markdown"|model\.type === "markdown"/);
});

test('Markdown uses CodeMirror native history, one source of truth, and safe GFM preview', async () => {
  const editor = await readSource('src/components/MarkdownEditor.tsx');
  const preview = await readSource('src/components/MarkdownPreview.tsx');
  const hook = await readSource('src/hooks/useCodeMirrorEditor.ts');
  assert.match(editor, /useCodeMirrorEditor/);
  assert.match(editor, /MarkdownPreview/);
  assert.match(preview, /ReactMarkdown/);
  assert.match(preview, /remarkGfm/);
  assert.match(preview, /rehypeRaw/);
  assert.match(preview, /rehypeSanitize/);
  assert.match(preview, /stripMarkdownFrontmatter/);
  assert.doesNotMatch(editor, /rehypeRaw|dangerouslySetInnerHTML/);
  assert.match(hook, /history\(\)/);
  assert.match(hook, /historyKeymap/);
  assert.match(hook, /indentWithTab/);
  assert.match(hook, /keymap\.of\(\[\.\.\.defaultKeymap, \.\.\.historyKeymap, \.\.\.searchKeymap, indentWithTab\]\)/);
  assert.match(hook, /undo\(viewRef\.current\)/);
  assert.match(hook, /redo\(viewRef\.current\)/);
  assert.match(hook, /Transaction\.addToHistory\.of\(false\)/);
  assert.match(editor, /resolveMarkdownAgentEdit/);
  assert.match(editor, /changes:\s*\{ from, to, insert: replacement \}/);
});

test('Markdown Tab indentation nests lists, supports selection history, and respects read-only state', () => {
  const apply = (state, command) => {
    let nextState = state;
    const applied = command({
      state,
      dispatch: (transaction) => {
        nextState = state.update(transaction).state;
      },
    });
    return { applied, state: nextState };
  };

  let state = EditorState.create({
    doc: '- parent\n- child\n- sibling',
    extensions: [markdown(), history()],
  });
  state = state.update({ selection: { anchor: 9 } }).state;
  const indented = apply(state, indentWithTab.run);
  assert.equal(indented.applied, true);
  assert.equal(indented.state.doc.toString(), '- parent\n  - child\n- sibling');
  assert.equal(undoDepth(indented.state), 1);

  const outdented = apply(indented.state, indentWithTab.shift);
  assert.equal(outdented.applied, true);
  assert.equal(outdented.state.doc.toString(), state.doc.toString());

  let selected = EditorState.create({
    doc: '- one\n- two',
    extensions: [markdown(), history()],
  });
  selected = selected.update({ selection: { anchor: 0, head: selected.doc.length } }).state;
  const selectedIndent = apply(selected, indentWithTab.run);
  assert.equal(selectedIndent.applied, true);
  assert.equal(selectedIndent.state.doc.toString(), '  - one\n  - two');
  const undone = apply(selectedIndent.state, undo);
  assert.equal(undone.applied, true);
  assert.equal(undone.state.doc.toString(), selected.doc.toString());

  let readOnly = EditorState.create({
    doc: '- parent\n- child',
    extensions: [markdown(), history(), EditorState.readOnly.of(true)],
  });
  readOnly = readOnly.update({ selection: { anchor: 9 } }).state;
  const blocked = apply(readOnly, indentWithTab.run);
  assert.equal(blocked.applied, false);
  assert.equal(blocked.state.doc.toString(), readOnly.doc.toString());
});

test('Markdown exposes Edit, Split, Preview, outline, autosave, and Recovery through shared services', async () => {
  const editor = await readSource('src/components/MarkdownEditor.tsx');
  assert.match(editor, /"edit"/);
  assert.match(editor, /"split"/);
  assert.match(editor, /"preview"/);
  assert.match(editor, /projectHeadings/);
  assert.match(editor, /useAutoSave/);
  assert.match(editor, /onWriteRecovery/);
  assert.match(editor, /Normalize line endings/);
});
