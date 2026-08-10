import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Settings exposes complete custom Skill CRUD and safety controls', async () => {
  const manager = await readFile(new URL('../src/components/settings/AgentSkillManager.tsx', import.meta.url), 'utf8');
  const settings = await readFile(new URL('../src/components/settings/AgentSettings.tsx', import.meta.url), 'utf8');
  assert.match(manager, /Import folder/);
  assert.match(manager, /Refresh/);
  assert.match(manager, /Remove/);
  assert.match(manager, /implicitInvocation/);
  assert.match(manager, /editorScopes/);
  assert.match(manager, /validationMessage/);
  assert.match(manager, /AI is disabled/);
  assert.match(manager, /skill\.editorScopes\.length === 1/);
  assert.match(manager, /All supported editors/);
  assert.match(settings, /<AgentSkillManager/);
});
