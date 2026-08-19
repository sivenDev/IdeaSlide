import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Workspace import keeps creation menus separate and wires root and nested destinations', async () => {
  const [sidebar, explorer, row, editor, menu] = await Promise.all([
    readSource('src/components/WorkspaceSidebar.tsx'),
    readSource('src/components/WorkspaceExplorer.tsx'),
    readSource('src/components/WorkspaceResourceRow.tsx'),
    readSource('src/components/EditorLayout.tsx'),
    readSource('src/components/ImportMenu.tsx'),
  ]);
  assert.match(sidebar, /<CreateMenu label=\{workspace\.name\}/);
  const createMenu = sidebar.match(/function CreateMenu\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.doesNotMatch(createMenu, /Import Excalidraw|ImportMenu/);
  assert.match(sidebar, /<ImportMenu[\s\S]*?Import into \$\{workspace\.name\}/);
  assert.match(explorer, /onImport: \(parentPath: string\) => void/);
  assert.match(explorer, /onImport=\{\(\) => onImport\(entry\.path\)\}/);
  assert.match(row, /aria-label=\{`Create in \$\{entry\.name\}`\}/);
  assert.match(row, /<ImportMenu[\s\S]*?onImportExcalidraw=\{onImport\}/);
  assert.match(menu, /Import Excalidraw/);
  assert.match(editor, /handleImportInWorkspace/);
  assert.match(editor, /createWorkspaceDocument\(root, parentPath, "ideasketch", name\)/);
  assert.match(editor, /saveWorkspaceDocument\(root, created\.path, model\)/);
  assert.match(editor, /trashWorkspaceEntry\(root, createdPath\)/);
});

test('Page import is relocated below navigation and still creates a new reducer-managed page', async () => {
  const [organizer, navigator, editor] = await Promise.all([
    readSource('src/components/PageOrganizer.tsx'),
    readSource('src/components/IdeaSketchNavigator.tsx'),
    readSource('src/components/IdeaSketchEditor.tsx'),
  ]);
  // The Pages toolbar and navigator no longer own an import affordance.
  assert.doesNotMatch(organizer, /onImport|Import Page|ImportMenu/);
  assert.match(organizer, /aria-label="Add Page"/);
  assert.doesNotMatch(navigator, /onPageImport|onImport=/);
  // Import now lives in the drawer command surface, routed to the same reducer-backed coordinator.
  assert.match(editor, /onImportExcalidraw=\{importPage\}/);
  assert.match(editor, /const importPage = useCallback\(async \(\) =>/);
  assert.match(editor, /chooseExcalidrawFile\(\)/);
  assert.match(editor, /parseExcalidrawImport\(JSON\.parse\(text\)/);
  assert.match(editor, /flushDraft\(\);[\s\S]*?createIdeaSketchPageFromImport/);
  assert.match(editor, /applyAction\(\{ type: "ADD_PAGE", page \}\)/);
});

test('Import coordinator handles cancellation and malformed source without mutating the source file', async () => {
  const editor = await readSource('src/components/IdeaSketchEditor.tsx');
  assert.match(editor, /isDesktopOperationCancelled\(error\)/);
  assert.match(editor, /if \(isDesktopOperationCancelled\(error\)\) return;/);
  assert.match(editor, /JSON\.parse\(text\)/);
  assert.doesNotMatch(editor, /writeImportFile|saveStandaloneDocument\(path/);
});
