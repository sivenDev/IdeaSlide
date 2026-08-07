import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('right sidebar is an Agent-only application surface', async () => {
  const host = await readFile(new URL('../src/components/RightSidebarHost.tsx', import.meta.url), 'utf8');
  const shell = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');
  const editor = await readFile(new URL('../src/components/IdeaSketchEditor.tsx', import.meta.url), 'utf8');

  assert.match(host, /aria-label="AI Agent"/);
  assert.doesNotMatch(host, /Navigator|navigator|onSurfaceChange/);
  assert.match(shell, /<RightSidebarHost/);
  assert.doesNotMatch(editor, /<RightSidebarHost|<AgentPanel/);
  assert.equal((editor.match(/<ResizableDivider\s+[\s\S]*?side="right"/g) ?? []).length, 1);
  assert.equal((editor.match(/<IdeaSketchNavigator\n/g) ?? []).length, 1);
  assert.match(editor, /MIN_RIGHT_SIDEBAR_WIDTH/);
  assert.match(editor, /onResize=\{/);
});

test('disabled AI does not mount Agent UI', async () => {
  const shell = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');
  assert.match(shell, /activationState === "ready" \|\| activationState === "configuration-required"/);
  assert.match(shell, /agentAvailable && \(/);
});
