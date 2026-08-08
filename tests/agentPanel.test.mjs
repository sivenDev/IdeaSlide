import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Agent panel uses the normalized runtime/store, captured editor binding, review, cancel, and no-write boundaries', async () => {
  const source = await readFile(new URL('../src/components/AgentPanel.tsx', import.meta.url), 'utf8');
  assert.match(source, /activationState === "configuration-required"/);
  assert.match(source, /discoverAgentSkills\(\)/);
  assert.match(source, /createCompatibilityAgentRuntime\(\)/);
  assert.match(source, /useAgentThread\(\{/);
  assert.match(source, /runtime\.startTurn\(\{/);
  assert.match(source, /retryOfTurnId/);
  assert.match(source, /const capturedBinding = binding/);
  assert.match(source, /capturedBinding\.parseChangeSet/);
  assert.match(source, /runGeneration\.current \+= 1/);
  assert.match(source, /runtime\.cancelTurn\(turnId\)/);
  assert.match(source, /IdeaSketchChangeReview/);
  assert.match(source, /useExternalStoreRuntime/);
  assert.match(source, /AssistantRuntimeProvider/);
  assert.match(source, /<AgentTranscript/);
  assert.match(source, /<AgentThreadHeader/);
  assert.match(source, /baseDocumentStatus: capturedBinding\.document\.status/);
  assert.match(source, /baseSourceModified: capturedBinding\.document\.sourceModified/);
  assert.match(source, /turn\?\.binding\.documentId === binding\.document\.id/);
  assert.doesNotMatch(source, /ThreadPrimitive\.Messages/);
  assert.doesNotMatch(source, /save_file|saveWorkspaceDocument|saveStandaloneDocument/);
});
