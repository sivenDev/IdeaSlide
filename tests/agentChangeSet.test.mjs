import test from 'node:test';
import assert from 'node:assert/strict';
import { markAgentChangeSetApplied, markAgentChangeSetStale, rejectAgentChangeSet } from '../src/lib/agent/changeSet.ts';

const proposal = {
  id: 'change-1', extensionId: 'test', documentId: 'doc', baseRevision: 1,
  sourceFingerprint: 'source', summary: 'Test', operations: [], status: 'proposed',
};

test('Agent change sets have explicit review transitions', () => {
  assert.equal(markAgentChangeSetApplied(proposal).status, 'applied');
  assert.equal(markAgentChangeSetStale(proposal).status, 'stale');
  assert.equal(rejectAgentChangeSet(proposal).status, 'rejected');
  assert.throws(() => markAgentChangeSetApplied({ ...proposal, status: 'applied' }), /Only a proposed/);
});
