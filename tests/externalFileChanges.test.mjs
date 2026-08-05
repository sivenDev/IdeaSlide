import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyWorkspaceTreeEvent,
  classifyExternalDocumentChange,
  classifyInspectedDocument,
  isApplicationOwnedStandaloneInspection,
} from '../src/lib/externalFileChanges.ts';

const document = (overrides = {}) => ({
  id: 'doc-1',
  mode: 'workspace',
  filePath: 'folder/drawing.is',
  fileType: 'ideasketch',
  status: 'editable',
  isDirty: false,
  revision: 0,
  sourceModified: 'before',
  ...overrides,
});

const entry = (path, kind = 'file') => ({
  path,
  name: path.split('/').pop(),
  kind,
  readOnly: false,
  fileType: kind === 'file' ? 'ideasketch' : null,
  children: [],
});

test('external modify distinguishes clean reload from dirty conflict', () => {
  const event = { kind: 'modify', path: 'folder/drawing.is', entry: { ...entry('folder/drawing.is'), modified: 'after' } };
  assert.equal(classifyExternalDocumentChange(document(), event).status, 'external-change');
  assert.equal(classifyExternalDocumentChange(document({ isDirty: true }), event).status, 'conflict');
});

test('duplicate watcher events matching the persisted baseline are ignored', () => {
  const event = { kind: 'modify', path: 'folder/drawing.is', entry: { ...entry('folder/drawing.is'), modified: 'before' } };
  assert.equal(classifyExternalDocumentChange(document({ isDirty: true }), event).kind, 'none');
});

test('a missing file that reappears is never hidden by baseline timestamp dedupe', () => {
  const event = { kind: 'create', path: 'folder/drawing.is', entry: { ...entry('folder/drawing.is'), modified: 'before' } };
  assert.equal(classifyExternalDocumentChange(document({ status: 'missing' }), event).status, 'external-change');
  assert.equal(classifyExternalDocumentChange(document({ status: 'missing', isDirty: true }), event).status, 'conflict');
});

test('watcher clears read-only status when the same file becomes writable', () => {
  const event = { kind: 'modify', path: 'folder/drawing.is', entry: { ...entry('folder/drawing.is'), modified: 'before' } };
  assert.equal(classifyExternalDocumentChange(document({ status: 'read-only', readOnly: true }), event).kind, 'writable');
});

test('external remove retains the session model and rename remaps descendants', () => {
  assert.equal(classifyExternalDocumentChange(document(), { kind: 'remove', path: 'folder' }).kind, 'missing');
  assert.deepEqual(
    classifyExternalDocumentChange(document(), { kind: 'rename', oldPath: 'folder', newPath: 'renamed' }),
    { kind: 'relocated', fromPath: 'folder/drawing.is', toPath: 'renamed/drawing.is' },
  );
  assert.equal(classifyExternalDocumentChange(document(), { kind: 'rootMissing' }).kind, 'root-missing');
});

test('save-time and standalone inspections block missing, read-only, and changed targets', () => {
  assert.equal(classifyInspectedDocument(document({ mode: 'standalone' }), { exists: false, readOnly: false }).kind, 'missing');
  assert.equal(classifyInspectedDocument(document(), { exists: true, readOnly: true, modified: 'before' }).kind, 'read-only');
  assert.equal(classifyInspectedDocument(document({ status: 'missing', isDirty: true }), { exists: true, readOnly: false, modified: 'before' }).status, 'conflict');
  assert.equal(classifyInspectedDocument(document(), { exists: true, readOnly: false, modified: 'after' }).status, 'external-change');
  assert.equal(classifyInspectedDocument(document({ isDirty: true }), { exists: true, readOnly: false, modified: 'after' }).status, 'conflict');
  assert.equal(classifyInspectedDocument(document(), { exists: true, readOnly: false, modified: 'before' }).kind, 'none');
});

test('standalone polling ignores only the application-owned write operation and result', () => {
  const inspection = { exists: true, readOnly: false, modified: 'saved-by-app' };

  assert.equal(isApplicationOwnedStandaloneInspection(inspection, {
    observedGeneration: 2,
    currentGeneration: 2,
    writeInProgress: true,
    expectedModified: undefined,
  }), true);
  assert.equal(isApplicationOwnedStandaloneInspection(inspection, {
    observedGeneration: 1,
    currentGeneration: 2,
    writeInProgress: false,
    expectedModified: undefined,
  }), true);
  assert.equal(isApplicationOwnedStandaloneInspection(inspection, {
    observedGeneration: 2,
    currentGeneration: 2,
    writeInProgress: false,
    expectedModified: 'saved-by-app',
  }), true);
  assert.equal(isApplicationOwnedStandaloneInspection({ ...inspection, modified: 'changed-externally' }, {
    observedGeneration: 2,
    currentGeneration: 2,
    writeInProgress: false,
    expectedModified: 'saved-by-app',
  }), false);
  assert.equal(isApplicationOwnedStandaloneInspection({ ...inspection, readOnly: true }, {
    observedGeneration: 2,
    currentGeneration: 2,
    writeInProgress: false,
    expectedModified: 'saved-by-app',
  }), false);
  assert.equal(isApplicationOwnedStandaloneInspection({ exists: false, readOnly: false }, {
    observedGeneration: 2,
    currentGeneration: 2,
    writeInProgress: false,
    expectedModified: 'saved-by-app',
  }), false);
});

test('incremental tree events insert, replace, rename, and remove without rescanning bodies', () => {
  const initial = [{ ...entry('folder', 'directory'), children: [entry('folder/a.is')] }];
  const created = applyWorkspaceTreeEvent(initial, { kind: 'create', path: 'folder/b.is', entry: entry('folder/b.is') });
  assert.deepEqual(created[0].children.map((item) => item.path), ['folder/a.is', 'folder/b.is']);
  const renamed = applyWorkspaceTreeEvent(created, { kind: 'rename', oldPath: 'folder/a.is', newPath: 'folder/c.is', entry: entry('folder/c.is') });
  assert.deepEqual(renamed[0].children.map((item) => item.path), ['folder/b.is', 'folder/c.is']);
  const removed = applyWorkspaceTreeEvent(renamed, { kind: 'remove', path: 'folder/b.is' });
  assert.deepEqual(removed[0].children.map((item) => item.path), ['folder/c.is']);
});

test('incremental tree events retain custom sibling order and append new entries', () => {
  const initial = [{ ...entry('folder', 'directory'), children: [entry('folder/b.is'), entry('folder/a.is')] }];
  const created = applyWorkspaceTreeEvent(
    initial,
    { kind: 'create', path: 'folder/c.is', entry: entry('folder/c.is') },
    ['folder', 'folder/b.is', 'folder/a.is'],
  );
  assert.deepEqual(created[0].children.map((item) => item.path), ['folder/b.is', 'folder/a.is', 'folder/c.is']);
});
