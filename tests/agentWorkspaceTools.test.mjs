import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Workspace Agent capabilities stay native, structured, and Standalone-aware', async () => {
  const native = await readFile(new URL('../src-tauri/src/workspace_agent.rs', import.meta.url), 'utf8');
  const agent = await readFile(new URL('../src-tauri/src/agent/mod.rs', import.meta.url), 'utf8');
  const layout = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');
  const bridge = await readFile(new URL('../src/lib/agent/workspaceAgentTools.ts', import.meta.url), 'utf8');
  const tauri = await readFile(new URL('../src/lib/tauriCommands.ts', import.meta.url), 'utf8');

  for (const tool of [
    'list_workspace_files', 'search_workspace_text', 'read_workspace_text',
    'create_workspace_folder', 'apply_workspace_patch', 'get_workspace_change_set',
    'undo_workspace_change_set', 'move_workspace_entry', 'trash_workspace_entry',
  ]) assert.match(native, new RegExp(`"${tool}"`));

  assert.match(native, /Workspace Tools are unavailable in Standalone mode/);
  assert.match(native, /expectedDigest/);
  assert.match(native, /with_expected_writes/);
  assert.match(native, /protected_paths/);
  assert.match(native, /IdeaSketch archives cannot be accessed/);
  assert.match(agent, /await_workspace_approval/);
  assert.match(agent, /stable_tool_signature_with_salt/);
  assert.match(layout, /syncWorkspaceAgentContext/);
  assert.match(layout, /workspaceAgentProtectedPaths/);
  assert.match(layout, /agentAvailable && showAgent && \(/);
  assert.match(layout, /workspace=\{state\.workspace \? \{ name: state\.workspace\.name \} : undefined\}/);
  const panel = await readFile(new URL('../src/components/AgentPanel.tsx', import.meta.url), 'utf8');
  assert.match(panel, /const capturedTools = capturedBinding/);
  assert.match(panel, /tools: \[\.\.\.capturedTools\]/);
  assert.match(panel, /structured Workspace Tools/);
  assert.match(bridge, /syncWorkspaceAgentContextCommand/);
  assert.match(tauri, /sync_workspace_agent_context/);
  assert.doesNotMatch(native, /Command::new|std::process|reqwest|browser/);
});

test('Workspace Tool source and effect metadata are explicit across the boundary', async () => {
  const frontend = await readFile(new URL('../src/lib/agent/types.ts', import.meta.url), 'utf8');
  const native = await readFile(new URL('../src-tauri/src/agent/types.rs', import.meta.url), 'utf8');
  assert.match(frontend, /"editor" \| "workspace" \| "skill"/);
  assert.match(frontend, /"read" \| "write" \| "destructive"/);
  assert.match(native, /enum AgentToolSource/);
  assert.match(native, /Workspace/);
  assert.match(native, /enum AgentToolEffect/);
  assert.match(native, /Destructive/);
});
