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
  assert.match(manager, /origin === "bundled"/);
  assert.match(manager, /custom\.map[\s\S]*?<SettingsSwitch/);
  assert.equal((manager.match(/<SettingsSwitch/g) ?? []).length, 1);
  assert.equal((manager.match(/<SettingsCheckbox/g) ?? []).length, 3);
  assert.doesNotMatch(manager, /type="checkbox"/);
  assert.match(settings, /<AgentSkillManager/);
});

test('Settings switches and checkboxes use maintained Radix primitives', async () => {
  const settingsSwitch = await readFile(new URL('../src/components/settings/SettingsSwitch.tsx', import.meta.url), 'utf8');
  const settingsCheckbox = await readFile(new URL('../src/components/settings/SettingsCheckbox.tsx', import.meta.url), 'utf8');
  assert.match(settingsSwitch, /@radix-ui\/react-switch/);
  assert.match(settingsSwitch, /<Switch\.Root/);
  assert.match(settingsCheckbox, /@radix-ui\/react-checkbox/);
  assert.match(settingsCheckbox, /<Checkbox\.Root/);
});
