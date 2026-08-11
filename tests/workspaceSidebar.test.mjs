import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/WorkspaceSidebar.tsx', import.meta.url), 'utf8');

test('Recents are standalone files with Rename, Finder, and Remove actions', () => {
  assert.match(source, /groupRecentFiles\(recents\)/);
  assert.match(source, />Recents</);
  assert.match(source, /beginRename\("recent"/);
  assert.match(source, /Show in Finder/);
  assert.match(source, />Remove</);
  assert.doesNotMatch(source, /Recent Workspaces|Single file now/);
});

test('Workspace and recent menus use maintained focus-dismissable DropdownMenu primitives', () => {
  assert.match(source, /from "\.\/ui\/DropdownMenu"/);
  assert.match(source, /<DropdownMenu>/);
  assert.match(source, /side="right"/);
  assert.match(source, /className="ideanote-compact-menu/);
});
