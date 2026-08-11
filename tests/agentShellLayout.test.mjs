import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Agent is an app-level right column outside the active editor', async () => {
  const shell = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');
  const editor = await readFile(new URL('../src/components/IdeaSketchEditor.tsx', import.meta.url), 'utf8');
  const registry = await readFile(new URL('../src/lib/editorRegistry.tsx', import.meta.url), 'utf8');
  const host = await readFile(new URL('../src/components/RightSidebarHost.tsx', import.meta.url), 'utf8');

  assert.match(shell, /<RightSidebarHost/);
  assert.match(shell, /<DocumentEditorHost/);
  assert.match(shell, /onAgentBindingChange: handleAgentBindingChange/);
  assert.match(registry, /onAgentBindingChange=\{props\.onAgentBindingChange\}/);
  assert.match(shell, /activeDocument && agentAvailable && showAgent[\s\S]*?side="right"/);
  assert.match(editor, /onAgentBindingChange/);
  assert.match(editor, /const agentBindingStateRef = useRef/);
  assert.match(editor, /\}\), \[document\.id\]\);/);
  assert.match(editor, /<IdeaSketchNavigator/);
  assert.doesNotMatch(editor, /<AgentPanel|<RightSidebarHost|rightSidebarSurface|RightSidebarSurface/);
  assert.doesNotMatch(host, /navigator|onSurfaceChange|RightSidebarSurface/);
});

test('Workspace, editor, and Agent own independent shell regions', async () => {
  const shell = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');

  assert.match(shell, /<WorkspaceExplorer/);
  assert.match(shell, /<main className="flex min-w-0 flex-1 flex-col overflow-hidden">/);
  assert.match(shell, /const \[showAgent, setShowAgent\]/);
  assert.match(shell, /const \[agentPanelWidth, setAgentPanelWidth\]/);
  assert.match(shell, /activationState === "disabled"/);
  assert.match(shell, /if \(activationState === "disabled"\) return undefined/);
});
