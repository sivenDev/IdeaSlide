import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('reviewed Agent crown and selector expose concise real conversation actions through maintained primitives', async () => {
  const header = await readFile(new URL('../src/components/agent/AgentThreadHeader.tsx', import.meta.url), 'utf8');
  const selector = await readFile(new URL('../src/components/agent/AgentConversationSelector.tsx', import.meta.url), 'utf8');
  assert.match(header, /aria-label="New conversation"/);
  assert.match(header, /aria-label="Runtime Inspector"/);
  assert.match(header, /aria-label="Hide Agent"/);
  assert.match(selector, /@radix-ui\/react-popover/);
  assert.match(selector, /DropdownMenuContent/);
  assert.match(selector, /onResume\(threadId\)/);
  assert.match(selector, /onRename\(candidate\.id, candidate\.value\.trim\(\)\)/);
  assert.match(selector, /onDelete\(candidate\.id\)/);
  assert.match(selector, /Rename conversation/);
  assert.match(selector, /Delete conversation\?/);
  assert.match(selector, /AlertDialog\.Root/);
  assert.match(selector, /Load earlier/);
  assert.match(selector, /aria-current=\{active \? "page"/);
  assert.doesNotMatch(selector, /archive|conversations label|history button/i);
});

test('Thread hook resumes the latest local Thread and keeps AI-disabled history independent of Workspaces', async () => {
  const source = await readFile(new URL('../src/hooks/useAgentThread.ts', import.meta.url), 'utf8');
  assert.match(source, /listAgentThreads\(\)/);
  assert.match(source, /getAgentThread\(latest\.id\)/);
  assert.match(source, /saveAgentThread\(persistenceRecord/);
  assert.match(source, /createThread/);
  assert.match(source, /resumeThread/);
  assert.match(source, /renameThread/);
  assert.match(source, /archiveThread/);
  assert.match(source, /deleteThread/);
  assert.match(source, /deletedThreadIdsRef\.current\.has\(state\.thread\.id\)/);
  assert.match(source, /Stop the running Turn before deleting its Thread/);
  assert.match(source, /saveAgentThread\(persistenceRecord\(\s*replacement,/);
  assert.match(source, /policy\.compatibilityReplayMessageLimit/);
  assert.match(source, /deleteAgentThread\(threadId\)/);
  assert.doesNotMatch(source, /workspace|\.ideanote/i);
});
