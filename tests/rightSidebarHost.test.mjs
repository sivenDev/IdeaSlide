import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('one right sidebar switches between Navigator and Agent', async () => {
  const host = await readFile(new URL('../src/components/RightSidebarHost.tsx', import.meta.url), 'utf8');
  const editor = await readFile(new URL('../src/components/IdeaSketchEditor.tsx', import.meta.url), 'utf8');
  assert.match(host, /RightSidebarSurface = "navigator" \| "agent"/);
  assert.match(host, /activeSurface === "agent" \? agent : navigator/);
  assert.match(editor, /<RightSidebarHost/);
  assert.equal((editor.match(/<ResizableDivider\s+[\s\S]*?side="right"/g) ?? []).length, 1);
  assert.equal((editor.match(/<IdeaSketchNavigator\n/g) ?? []).length, 1);
  assert.equal((editor.match(/<AgentPanel/g) ?? []).length, 1);
  assert.match(editor, /MIN_RIGHT_SIDEBAR_WIDTH/);
  assert.match(editor, /onResize=\{/);
});

test('disabled AI does not mount Agent UI', async () => {
  const editor = await readFile(new URL('../src/components/IdeaSketchEditor.tsx', import.meta.url), 'utf8');
  assert.match(editor, /agentAvailable = activationState === "ready" \|\| activationState === "configuration-required"/);
  assert.match(editor, /agent=\{agentAvailable \? \(/);
});
