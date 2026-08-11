import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function collectSource(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const chunks = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) chunks.push(await collectSource(entryPath));
    else if (/\.(?:ts|tsx|css)$/.test(entry.name)) chunks.push(await readFile(entryPath, 'utf8'));
  }
  return chunks.join('\n');
}

test('production contains one direct workbench shell with no review-demo leakage', async () => {
  const app = await readFile(path.join(root, 'src/App.tsx'), 'utf8');
  const editor = await readFile(path.join(root, 'src/components/EditorLayout.tsx'), 'utf8');
  const source = await collectSource(path.join(root, 'src'));
  assert.match(app, /<EditorLayout/);
  assert.match(editor, /<WorkspaceSidebar/);
  assert.match(editor, /<DocumentEditorHost/);
  assert.match(editor, /<RightSidebarHost/);
  assert.doesNotMatch(source, /MockDesktopApi|Review Scenarios|failure injection|mock platform|Back to Home|GO_HOME/);
  assert.doesNotMatch(source, /from ["'][^"']*\.temp|f041-native-workbench-review/);
  await assert.rejects(access(path.join(root, 'src/components/LaunchScreen.tsx')));
  await assert.rejects(access(path.join(root, 'src/components/Toolbar.tsx')));
});

test('reviewed crown and Agent composition keep redundant chrome out of production', async () => {
  const crown = await readFile(path.join(root, 'src/components/WorkbenchCrown.tsx'), 'utf8');
  const composer = await readFile(path.join(root, 'src/components/agent/AgentComposer.tsx'), 'utf8');
  const panel = await readFile(path.join(root, 'src/components/AgentPanel.tsx'), 'utf8');
  assert.match(crown, /ideanote-document-status-close/);
  assert.doesNotMatch(crown, /aria-label="Save"|revision/);
  assert.doesNotMatch(composer, /Automatic Skill|Incremental/);
  assert.doesNotMatch(panel, /Conversation history|Archive conversation|Automatic Skill|Incremental/);
});

test('production IdeaSketch stylesheet and presentation capture contract remain unchanged', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const source = await collectSource(path.join(root, 'src'));
  const presentation = await readFile(path.join(root, 'src/components/PresentationMode.tsx'), 'utf8');
  assert.match(html, /href="\/excalidraw\.css"/);
  assert.doesNotMatch(source, /import ["'][^"']*excalidraw\.css["']/);
  assert.match(presentation, /document\.addEventListener\(['"]keydown['"], handleKeyDown, true\)/);
});
