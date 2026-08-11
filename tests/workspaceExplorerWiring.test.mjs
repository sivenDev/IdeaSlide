import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Workspace navigation keeps creation on roots/directories and actions in compact Radix menus', async () => {
  const sidebar = await readSource('src/components/WorkspaceSidebar.tsx');
  const explorer = await readSource('src/components/WorkspaceExplorer.tsx');
  const row = await readSource('src/components/WorkspaceResourceRow.tsx');
  assert.match(sidebar, />Workspaces</);
  assert.doesNotMatch(sidebar, /Search/);
  assert.match(sidebar, /CreateMenu/);
  assert.match(sidebar, /Actions for \$\{workspace\.name\}/);
  assert.match(sidebar, /Remove from Workspaces/);
  assert.match(sidebar, /Show in Finder/);
  assert.match(row, /entry\.kind === "directory"/);
  assert.match(row, /aria-label=\{`Create in \$\{entry\.name\}`\}/);
  assert.match(row, /aria-label=\{`Actions for \$\{entry\.name\}`\}/);
  assert.match(row, /Move to Trash/);
  assert.match(row, /DropdownMenuContent/);
  assert.match(explorer, /WorkspaceRootDropZone/);
  assert.doesNotMatch(explorer, /WorkspaceActionBar|tooltip="New File"|Workspace Tree Actions/);
});

test('Workspace dragging remains dnd-kit based and commits only inside valid directories or root', async () => {
  const explorer = await readSource('src/components/WorkspaceExplorer.tsx');
  const row = await readSource('src/components/WorkspaceResourceRow.tsx');
  assert.match(explorer, /<DndContext/);
  assert.match(explorer, /pointerWithin/);
  assert.match(explorer, /workspaceParentPath/);
  assert.match(explorer, /target\?\.position !== "inside"/);
  assert.match(explorer, /data-workspace-root="true"/);
  assert.match(row, /useDraggable/);
  assert.match(row, /useDroppable/);
  assert.match(row, /targetPath: entry\.path, position: "inside"/);
  assert.doesNotMatch(row, /dataTransfer|onDragStart|onDrop/);
});

test('Workspace rows retain inline stem rename, safe symlinks, document state, and menus', async () => {
  const row = await readSource('src/components/WorkspaceResourceRow.tsx');
  assert.match(row, /entry\.kind === "symlink"/);
  assert.match(row, /Unsupported/);
  assert.match(row, /getWorkspaceRenameSelectionEnd/);
  assert.match(row, /setSelectionRange\(0, getWorkspaceRenameSelectionEnd\(entry\.name, entry\.kind\)\)/);
  assert.match(row, /F2/);
  assert.match(row, /isDocumentActive/);
  assert.match(row, /documentStatusClassName/);
  assert.match(row, /MoreHorizontal/);
  assert.match(row, /Pencil/);
  assert.match(row, /Trash2/);
});

test('Editor shell keeps Workspaces available in empty, Workspace, and standalone modes', async () => {
  const source = await readSource('src/components/EditorLayout.tsx');
  assert.match(source, /<WorkspaceSidebar/);
  assert.doesNotMatch(source, /\{state\.workspace && \([\s\S]*?<WorkspaceSidebar/);
  assert.match(source, /WORKSPACE_PANEL_MIN_WIDTH/);
  assert.match(source, /clampWorkspacePanelWidth/);
  assert.match(source, /PANEL_STATE_KEY/);
});
