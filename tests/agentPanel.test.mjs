import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Agent panel has setup, run, Tool Activity, review, cancel, and no-write boundaries', async () => {
  const source = await readFile(new URL('../src/components/AgentPanel.tsx', import.meta.url), 'utf8');
  assert.match(source, /activationState === "configuration-required"/);
  assert.match(source, /discoverAgentSkills\(\)/);
  assert.match(source, /runAgent\(\{/);
  assert.match(source, /event\.type === "textDelta"/);
  assert.match(source, /messages: previousMessages/);
  assert.match(source, /Mutation Tool produced a proposal; no file was written/);
  assert.match(source, /runGeneration\.current \+= 1/);
  assert.match(source, /cancelAgent\(runId\)/);
  assert.match(source, /IdeaSketchChangeReview/);
  assert.match(source, /useExternalStoreRuntime/);
  assert.match(source, /AssistantRuntimeProvider/);
  assert.match(source, /ThreadPrimitive\.Messages/);
  assert.match(source, /baseDocumentStatus: document\.status/);
  assert.match(source, /baseSourceModified: document\.sourceModified/);
  assert.doesNotMatch(source, /save_file|saveWorkspaceDocument|saveStandaloneDocument/);
});
