import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Settings exposes complete custom Skill CRUD and safety controls', async () => {
  const manager = await readFile(new URL('../src/components/settings/AgentSkillManager.tsx', import.meta.url), 'utf8');
  const settings = await readFile(new URL('../src/components/settings/SkillSettings.tsx', import.meta.url), 'utf8');
  assert.match(manager, /Import Skill folder/);
  assert.match(manager, /Refresh/);
  assert.match(manager, /Remove/);
  assert.match(manager, /implicitInvocation/);
  assert.match(manager, /editorScopes/);
  assert.match(manager, /validationMessage/);
  assert.match(manager, /AI is disabled/);
  assert.match(manager, /All editors/);
  assert.match(manager, /origin === "bundled"/);
  assert.match(manager, /bundled\.map[\s\S]*?skill-always-on/);
  assert.match(manager, /custom\.map[\s\S]*?<SettingsSwitch/);
  assert.match(manager, /ideanote-skill-row/);
  assert.match(manager, /ideanote-skill-source/);
  assert.match(manager, /aria-label=\{`Scope for \$\{skill\.name\}`\}/);
  assert.equal((manager.match(/<SettingsSwitch/g) ?? []).length, 1);
  assert.equal((manager.match(/<SettingsCheckbox/g) ?? []).length, 0);
  assert.doesNotMatch(manager, /type="checkbox"/);
  assert.doesNotMatch(manager, /Bundled editor Skills|Managed Skills|Compatible editor Skills/);
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
