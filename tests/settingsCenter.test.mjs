import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Settings Center is registry-driven and reachable from the persistent workbench', async () => {
  const registry = await readFile(new URL('../src/lib/settingsSectionRegistry.ts', import.meta.url), 'utf8');
  const center = await readFile(new URL('../src/components/SettingsCenter.tsx', import.meta.url), 'utf8');
  const sidebar = await readFile(new URL('../src/components/WorkspaceSidebar.tsx', import.meta.url), 'utf8');
  const editor = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');
  assert.match(registry, /registerSettingsSection/);
  assert.match(registry, /id: "general"/);
  assert.match(registry, /id: "ai-provider"/);
  assert.match(registry, /id: "agent"/);
  assert.match(registry, /id: "ideasketch"/);
  assert.match(center, /getSettingsSections\(\)/);
  assert.match(center, /Configure IdeaNote, AI, and editor extensions/);
  assert.match(sidebar, /onOpenSettings/);
  assert.match(sidebar, />Settings</);
  assert.match(editor, /event\.key === ","/);
});

test('Agent settings explain complete disable semantics in English', async () => {
  const source = await readFile(new URL('../src/components/settings/AgentSettings.tsx', import.meta.url), 'utf8');
  assert.match(source, /Enabled by default/);
  assert.match(source, /does not mount the Agent/);
  assert.match(source, /load Skills or Tools/);
  assert.match(source, /call a model/);
});

test('AI Provider settings expose typed-token visibility and bounded automatic retries', async () => {
  const source = await readFile(new URL('../src/components/settings/AiProviderSettings.tsx', import.meta.url), 'utf8');
  assert.match(source, /Encrypted local credential/);
  assert.match(source, /apiKeyVisible \? "text" : "password"/);
  assert.match(source, /Show API key/);
  assert.match(source, /Hide API key/);
  assert.match(source, /Automatic retry/);
  assert.match(source, /Maximum attempts/);
  assert.match(source, /min=\{1\}/);
  assert.match(source, /max=\{5\}/);
  assert.match(source, /disabled=\{!settings\.ai\.retry\.enabled\}/);
  assert.doesNotMatch(source, /system credential vault|Keychain/i);
});
