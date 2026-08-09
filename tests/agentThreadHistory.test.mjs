import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Thread header and history expose create, resume, rename, archive, permanent delete, pagination, and accessible disclosure state', async () => {
  const header = await readFile(new URL('../src/components/agent/AgentThreadHeader.tsx', import.meta.url), 'utf8');
  const history = await readFile(new URL('../src/components/agent/AgentThreadHistory.tsx', import.meta.url), 'utf8');
  assert.match(header, /Create new Agent Thread/);
  assert.match(header, /aria-expanded=\{historyOpen\}/);
  assert.match(history, /onResume\(thread\.id\)/);
  assert.match(history, /onRename\(editingId, draftTitle\.trim\(\)\)/);
  assert.match(history, /onArchive\(thread\.id\)/);
  assert.match(history, /Delete “\{thread\.title\}” permanently\?/);
  assert.match(history, /role="alertdialog"/);
  assert.match(history, /onDelete\(deleteCandidate\.id\)/);
  assert.match(history, /deleteButtonRefs\.current\.get\(threadId\)\?\.focus\(\)/);
  assert.match(history, /Show archived/);
  assert.match(history, /Load earlier Threads/);
  assert.match(history, /aria-current=\{active \? "page"/);
  assert.match(history, /closeButtonRef\.current\?\.focus\(\)/);
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
  assert.match(source, /saveAgentThread\(persistenceRecord\(replacement/);
  assert.match(source, /deleteAgentThread\(threadId\)/);
  assert.doesNotMatch(source, /workspace|\.ideanote/i);
});
