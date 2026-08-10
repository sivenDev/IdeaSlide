import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('composer Skill picker keeps the editor Skill mandatory and custom Skills additive', async () => {
  const picker = await readFile(new URL('../src/components/agent/AgentSkillPicker.tsx', import.meta.url), 'utf8');
  const panel = await readFile(new URL('../src/components/AgentPanel.tsx', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../src/lib/agent/agentRuntime.ts', import.meta.url), 'utf8');
  assert.match(picker, /mandatory/);
  assert.match(picker, /origin === "custom"/);
  assert.match(picker, /editorScopes\.includes\(editorSkillId\)/);
  assert.match(picker, /role="listbox"/);
  assert.match(picker, /Search custom Skills/);
  assert.match(picker, /event\.key !== "Escape"/);
  assert.match(picker, /rootRef\.current\?\.contains/);
  assert.match(panel, /selectedSkillIds/);
  assert.match(runtime, /selectedSkillIds: input\.selectedSkillIds/);
});
