import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('workspace explorer uses an unlabeled compact registry-driven action bar', async () => {
  const source = await readSource('src/components/WorkspaceExplorer.tsx');
  assert.match(source, /getCreatableResourceTypeDefinitions/);
  assert.match(source, /idea-slide-side-panel/);
  assert.match(source, /idea-slide-side-panel__header/);
  assert.match(source, /idea-slide-panel-icon-button/);
  assert.match(source, /aria-label="New resource"/);
  assert.match(source, /aria-label="New folder"/);
  assert.match(source, /aria-label="Collapse all"/);
  assert.match(source, /setExpandedIds\(new Set\(\)\)/);
  assert.doesNotMatch(source, />Workspace</);
  assert.doesNotMatch(source, /Folder and Canvas/);
  assert.match(source, /onRename/);
  assert.match(source, /onMove/);
  assert.match(source, /overflow-y-auto/);
  assert.doesNotMatch(source, /thumbnail/i);
});

test('workspace rows use the shared neutral and violet editor-shell states', async () => {
  const source = await readSource('src/components/WorkspaceResourceRow.tsx');

  assert.match(source, /idea-slide-resource-row/);
  assert.match(source, /is-active/);
  assert.match(source, /idea-slide-resource-icon/);
  assert.doesNotMatch(source, /amber-/);
});

test('new resources enter inline rename and rows accept an external rename request', async () => {
  const explorer = await readSource('src/components/WorkspaceExplorer.tsx');
  const source = await readSource('src/components/WorkspaceResourceRow.tsx');

  assert.match(explorer, /const createdResourceId = onAdd/);
  assert.match(explorer, /renameResourceId/);
  assert.match(source, /startRenaming/);
  assert.match(source, /onRenameStarted/);
  assert.match(explorer, /setRenameResourceId\(undefined\)/);
  assert.match(source, /setIsRenaming\(true\)/);
  assert.match(source, /F2/);
  assert.match(source, /Enter/);
  assert.match(source, /Escape/);
  assert.match(source, /draggable/);
});

test('resource registry exposes ordered file types for the New resource menu', async () => {
  const registry = await readSource('src/lib/resourceTypeRegistry.ts');

  assert.match(registry, /createInResourceMenu/);
  assert.match(registry, /getCreatableResourceTypeDefinitions/);
  assert.match(registry, /filter/);
});
