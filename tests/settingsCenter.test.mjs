import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Settings Center is registry-driven and reachable from Home and editor chrome', async () => {
  const registry = await readFile(new URL('../src/lib/settingsSectionRegistry.ts', import.meta.url), 'utf8');
  const center = await readFile(new URL('../src/components/SettingsCenter.tsx', import.meta.url), 'utf8');
  const home = await readFile(new URL('../src/components/LaunchScreen.tsx', import.meta.url), 'utf8');
  const toolbar = await readFile(new URL('../src/components/Toolbar.tsx', import.meta.url), 'utf8');
  assert.match(registry, /registerSettingsSection/);
  assert.match(registry, /id: "general"/);
  assert.match(registry, /id: "ai-provider"/);
  assert.match(registry, /id: "agent"/);
  assert.match(registry, /id: "ideasketch"/);
  assert.match(center, /getSettingsSections\(\)/);
  assert.match(center, /Configure IdeaNote, AI, and editor extensions/);
  assert.match(home, /onOpenSettings/);
  assert.match(toolbar, /tooltip="Settings"/);
});

test('Agent settings explain complete disable semantics in English', async () => {
  const source = await readFile(new URL('../src/components/settings/AgentSettings.tsx', import.meta.url), 'utf8');
  assert.match(source, /Enabled by default/);
  assert.match(source, /does not mount the Agent/);
  assert.match(source, /load Skills or Tools/);
  assert.match(source, /call a model/);
});
