import test from 'node:test';
import assert from 'node:assert/strict';

const { groupRecentFiles } = await import('../src/lib/recentFiles.ts');

const day = 24 * 60 * 60 * 1000;
const reference = new Date('2026-08-11T12:00:00+08:00').getTime();

test('Recents sort by opened time descending and group on a visible timeline', () => {
  const groups = groupRecentFiles([
    { path: '/older.md', name: 'older.md', modified: '', opened_at: new Date(reference - 9 * day).toISOString() },
    { path: '/today-a.md', name: 'today-a.md', modified: '', opened_at: new Date(reference - 3_000).toISOString() },
    { path: '/yesterday.md', name: 'yesterday.md', modified: '', opened_at: new Date(reference - day).toISOString() },
    { path: '/today-b.md', name: 'today-b.md', modified: '', opened_at: new Date(reference - 1_000).toISOString() },
  ], reference);
  assert.deepEqual(groups.map((group) => group.label), ['Today', 'Yesterday', 'Older']);
  assert.deepEqual(groups[0].items.map((item) => item.name), ['today-b.md', 'today-a.md']);
});

test('invalid timestamps remain visible in Older', () => {
  const groups = groupRecentFiles([
    { path: '/unknown.md', name: 'unknown.md', modified: '', opened_at: '' },
  ], reference);
  assert.equal(groups[0].id, 'older');
  assert.equal(groups[0].items[0].name, 'unknown.md');
});
