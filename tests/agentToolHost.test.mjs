import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentToolHost } from '../src/lib/agent/agentToolHost.ts';

function extension(overrides = {}) {
  let executions = 0;
  const value = {
    id: 'markdown-agent',
    fileType: 'markdown',
    skillId: 'markdown',
    tools: [{
      name: 'propose_replace_heading',
      description: 'Propose a heading replacement.',
      inputSchema: {
        type: 'object',
        properties: { heading: { type: 'string', minLength: 1 } },
        required: ['heading'],
        additionalProperties: false,
      },
    }],
    buildContext: () => ({}),
    executeTool(call, context) {
      executions += 1;
      return {
        kind: 'proposal',
        callId: call.callId,
        name: call.name,
        success: true,
        summary: `Replace heading with ${call.arguments.heading}`,
        changeSet: {
          id: `change-${call.callId}`,
          extensionId: 'markdown-agent',
          documentId: context.documentId,
          baseRevision: context.revision,
          sourceFingerprint: 'fingerprint',
          summary: 'Replace heading',
          operations: [{ kind: 'replace-heading', heading: call.arguments.heading }],
          status: 'proposed',
        },
        truncated: false,
        persistable: true,
      };
    },
    describeChangeSet: () => ['Replace heading'],
    ...overrides,
  };
  return { value, executions: () => executions };
}

function host(extensionValue) {
  return createAgentToolHost({
    extension: extensionValue,
    context: {
      documentId: 'md-1',
      revision: 4,
      documentStatus: 'editable',
      activeContextId: 'heading-1',
      model: { text: '# Before' },
    },
  });
}

test('trusted Tool host validates schemas and keeps proposal results review-only', async () => {
  const { value } = extension();
  const executor = host(value);
  const invalid = await executor.execute({ callId: 'invalid', name: 'propose_replace_heading', arguments: {} });
  assert.equal(invalid.kind, 'failure');
  assert.equal(invalid.error.code, 'toolValidationFailed');

  const proposal = await executor.execute({
    callId: 'valid',
    name: 'propose_replace_heading',
    arguments: { heading: 'After' },
  });
  assert.equal(proposal.kind, 'proposal');
  assert.equal(proposal.changeSet.status, 'proposed');
  assert.equal(proposal.changeSet.documentId, 'md-1');
  assert.equal(proposal.changeSet.baseRevision, 4);
  assert.equal('apply' in proposal, false);
});

test('stable call ids are idempotent and cannot be replayed with changed arguments', async () => {
  const synthetic = extension();
  const executor = host(synthetic.value);
  const call = { callId: 'stable', name: 'propose_replace_heading', arguments: { heading: 'One' } };
  const first = await executor.execute(call);
  const duplicate = await executor.execute(structuredClone(call));
  assert.deepEqual(duplicate, first);
  assert.equal(synthetic.executions(), 1);

  const collision = await executor.execute({ ...call, arguments: { heading: 'Two' } });
  assert.equal(collision.kind, 'failure');
  assert.equal(collision.error.code, 'toolValidationFailed');
  assert.equal(synthetic.executions(), 1);
});

test('cancelled, unknown, and retargeted Tool results fail closed', async () => {
  const executor = host(extension().value);
  executor.cancel('cancelled');
  const cancelled = await executor.execute({
    callId: 'cancelled',
    name: 'propose_replace_heading',
    arguments: { heading: 'After' },
  });
  assert.equal(cancelled.kind, 'failure');

  const unknown = await executor.execute({ callId: 'unknown', name: 'write_file', arguments: {} });
  assert.equal(unknown.kind, 'failure');

  const retargeting = extension({
    executeTool(call) {
      return {
        kind: 'proposal', callId: call.callId, name: call.name, success: true, summary: 'Unsafe',
        changeSet: {
          id: 'unsafe', extensionId: 'markdown-agent', documentId: 'other', baseRevision: 4,
          sourceFingerprint: 'x', summary: 'Unsafe', operations: [], status: 'proposed',
        },
        truncated: false, persistable: true,
      };
    },
  });
  const unsafe = await host(retargeting.value).execute({
    callId: 'unsafe', name: 'propose_replace_heading', arguments: { heading: 'After' },
  });
  assert.equal(unsafe.kind, 'failure');
  assert.equal(unsafe.error.code, 'toolExecutionFailed');
});

test('read results are bounded and preserve explicit persistence policy', async () => {
  const readExtension = extension({
    tools: [{
      name: 'read_document',
      description: 'Read a bounded document.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    }],
    executeTool(call) {
      return {
        kind: 'read', callId: call.callId, name: call.name, success: true, summary: 'Read document',
        content: { text: 'x'.repeat(80_000) }, truncated: false, persistable: false,
      };
    },
  });
  const result = await host(readExtension.value).execute({ callId: 'read', name: 'read_document', arguments: {} });
  assert.equal(result.kind, 'read');
  assert.equal(result.truncated, true);
  assert.equal(result.persistable, false);
});
