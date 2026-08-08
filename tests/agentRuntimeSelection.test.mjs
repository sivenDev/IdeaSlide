import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { selectAgentRuntime } from '../src/lib/agent/runtimeSelection.ts';

const capabilities = (editorTools) => ({
  textStreaming: true,
  reasoningSummary: true,
  plans: true,
  toolEvents: true,
  approvals: true,
  cancellation: true,
  steering: true,
  retry: true,
  persistence: true,
  editorTools,
});

const compatibility = {
  kind: 'compatibility',
  label: 'OpenAI-compatible',
  installed: true,
  compatible: true,
  experimental: false,
  capabilities: capabilities(true),
};

test('compatibility remains the default until rich runtimes are explicitly enabled', () => {
  const codex = {
    ...compatibility,
    kind: 'codexAppServer',
    label: 'Codex app-server',
    experimental: true,
  };
  assert.equal(selectAgentRuntime([compatibility, codex], {
    experimentalEnabled: false,
    requiresEditorTools: true,
  }).descriptor?.kind, 'compatibility');
  assert.equal(selectAgentRuntime([compatibility, codex], {
    experimentalEnabled: true,
    requiresEditorTools: true,
  }).descriptor?.kind, 'codexAppServer');
});

test('Grok degrades to compatibility when the editor Tool gate is required', () => {
  const grok = {
    ...compatibility,
    kind: 'grokAcp',
    label: 'Grok Build ACP',
    experimental: true,
    capabilities: capabilities(false),
  };
  assert.equal(selectAgentRuntime([compatibility, grok], {
    experimentalEnabled: true,
    requiresEditorTools: true,
  }).descriptor?.kind, 'compatibility');
  assert.equal(selectAgentRuntime([compatibility, grok], {
    experimentalEnabled: true,
    requiresEditorTools: false,
  }).descriptor?.kind, 'grokAcp');
});

test('runtime discovery remains native-owned and transport brands stay out of the public protocol', async () => {
  const client = await readFile(new URL('../src/lib/agent/agentClient.ts', import.meta.url), 'utf8');
  const protocol = await readFile(new URL('../src/lib/agent/protocol.ts', import.meta.url), 'utf8');
  assert.match(client, /invoke<AgentRuntimeDescriptor\[\]>\("list_agent_runtimes"\)/);
  assert.doesNotMatch(protocol, /\bCodex\b|\bGrok\b|\bACP\b|app-server/);
});
