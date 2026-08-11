import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('composer omits Skill controls while the native runtime keeps mandatory and implicit Skill activation', async () => {
  const composer = await readFile(new URL('../src/components/agent/AgentComposer.tsx', import.meta.url), 'utf8');
  const panel = await readFile(new URL('../src/components/AgentPanel.tsx', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../src/lib/agent/agentRuntime.ts', import.meta.url), 'utf8');
  const native = await readFile(new URL('../src-tauri/src/agent/mod.rs', import.meta.url), 'utf8');
  assert.doesNotMatch(composer, /Skill|Automatic|Incremental/);
  assert.doesNotMatch(panel, /AgentSkillPicker|selectedSkillIds.*useState/);
  assert.match(panel, /selectedSkillIds: \[\]/);
  assert.match(runtime, /selectedSkillIds: input\.selectedSkillIds/);
  assert.match(native, /SkillTurnState::capture/);
  assert.match(native, /request\.selected_skill_ids/);
  assert.match(native, /captured_skills\.activated_instructions/);
});
