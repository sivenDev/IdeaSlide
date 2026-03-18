import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/lib/domTargets.ts');
  } catch {
    return {};
  }
}

test('isTargetWithinNode returns true when the event target is inside the root subtree', async () => {
  const { isTargetWithinNode } = await loadModule();

  assert.equal(typeof isTargetWithinNode, 'function');

  const root = { parentNode: null };
  const child = { parentNode: root };
  const nested = { parentNode: child };

  assert.equal(isTargetWithinNode(root, nested), true);
});

test('isTargetWithinNode returns false when the event target is outside the root subtree', async () => {
  const { isTargetWithinNode } = await loadModule();

  assert.equal(typeof isTargetWithinNode, 'function');

  const root = { parentNode: null };
  const siblingRoot = { parentNode: null };
  const siblingChild = { parentNode: siblingRoot };

  assert.equal(isTargetWithinNode(root, siblingChild), false);
});

test('isTargetWithinNode returns false for null targets', async () => {
  const { isTargetWithinNode } = await loadModule();

  assert.equal(typeof isTargetWithinNode, 'function');

  const root = { parentNode: null };

  assert.equal(isTargetWithinNode(root, null), false);
});
