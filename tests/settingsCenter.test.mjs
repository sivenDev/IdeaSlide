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
  assert.match(registry, /id: "markdown"/);
  assert.match(registry, /group: "Application"/);
  assert.match(registry, /group: "AI"/);
  assert.match(registry, /group: "Editors"/);
  assert.match(center, /getSettingsSections\(\)/);
  assert.match(center, /groups\.map/);
  assert.match(center, /<MarkdownSettings/);
  assert.match(sidebar, /onOpenSettings/);
  assert.match(sidebar, />Settings</);
  assert.match(editor, /event\.key === ","/);
});

test('Agent settings own the AI feature gate without redundant explanatory copy', async () => {
  const source = await readFile(new URL('../src/components/settings/AgentSettings.tsx', import.meta.url), 'utf8');
  assert.match(source, /<SettingsField title="Enable AI">/);
  assert.match(source, /<SettingsSwitch/);
  assert.doesNotMatch(source, /does not mount the Agent|load Skills or Tools|call a model/);
});

test('AI Provider settings use password, Test, and tested model selection', async () => {
  const source = await readFile(new URL('../src/components/settings/AiProviderSettings.tsx', import.meta.url), 'utf8');
  const commands = await readFile(new URL('../src/lib/tauriCommands.ts', import.meta.url), 'utf8');
  const backend = await readFile(new URL('../src-tauri/src/provider_probe.rs', import.meta.url), 'utf8');
  assert.match(source, /type="password"/);
  assert.doesNotMatch(source, /Show API key|Hide API key|Remove credential/);
  assert.match(source, /probeAiProvider/);
  assert.match(source, /Testing…/);
  assert.match(source, /disabled=\{!testCurrent \|\| !tested\?\.models\.length\}/);
  assert.match(source, /<select[\s\S]*aria-label="AI model"/);
  assert.match(commands, /invoke<ProviderProbeResult>\("probe_ai_provider"/);
  assert.match(backend, /MAX_RESPONSE_BYTES/);
  assert.match(backend, /The provider rejected the token/);
  assert.doesNotMatch(backend, /format!\([^\n]*api_key/);
  assert.match(source, /Automatic retry/);
  assert.match(source, /Maximum attempts/);
  assert.match(source, /min=\{1\}/);
  assert.match(source, /max=\{5\}/);
  assert.match(source, /disabled=\{!settings\.ai\.retry\.enabled\}/);
  assert.doesNotMatch(source, /system credential vault|Keychain/i);
});
