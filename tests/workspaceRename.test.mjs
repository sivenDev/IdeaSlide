import test from 'node:test';
import assert from 'node:assert/strict';
import { getWorkspaceRenameSelectionEnd } from '../src/lib/workspaceRename.ts';

test('Workspace rename initially selects only a conventional file stem', () => {
  assert.equal(getWorkspaceRenameSelectionEnd('drawing.is', 'file'), 'drawing'.length);
  assert.equal(getWorkspaceRenameSelectionEnd('archive.tar.gz', 'file'), 'archive.tar'.length);
});

test('Workspace rename selects the full name when no conventional extension exists', () => {
  assert.equal(getWorkspaceRenameSelectionEnd('README', 'file'), 'README'.length);
  assert.equal(getWorkspaceRenameSelectionEnd('.gitignore', 'file'), '.gitignore'.length);
  assert.equal(getWorkspaceRenameSelectionEnd('.env.local', 'file'), '.env.local'.length);
  assert.equal(getWorkspaceRenameSelectionEnd('trailing.', 'file'), 'trailing.'.length);
});

test('Workspace rename selects complete directory names', () => {
  assert.equal(getWorkspaceRenameSelectionEnd('docs.v2', 'directory'), 'docs.v2'.length);
});
