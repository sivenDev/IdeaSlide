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
  assert.match(registry, /id: "skills"/);
  assert.match(registry, /id: "ideasketch"/);
  assert.match(registry, /id: "markdown"/);
  assert.match(registry, /group: "Application"/);
  assert.match(registry, /group: "AI"/);
  assert.match(registry, /group: "Editors"/);
  for (const icon of ['settings', 'bot', 'sparkles', 'blocks', 'shapes', 'file-text']) {
    assert.match(registry, new RegExp(`icon: "${icon}"`));
  }
  assert.match(center, /getSettingsSections\(\)/);
  assert.match(center, /groups\.map/);
  assert.match(center, /sectionIcon/);
  assert.match(center, /activeDefinition\.description/);
  assert.match(center, /ideanote-settings-page-header/);
  assert.match(center, /<MarkdownSettings/);
  assert.match(center, /<SkillSettings/);
  assert.doesNotMatch(center, /Save changes|saveDraft|discardDraft|dirty/);
  assert.match(center, /status === "saving"[\s\S]*Saving/);
  assert.match(center, /status === "saved"[\s\S]*Saved/);
  assert.match(center, /status === "error"[\s\S]*Retry/);
  assert.match(center, /void flush\(\)/);
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

test('Appearance choices use their visual previews without redundant icons', async () => {
  const source = await readFile(new URL('../src/components/settings/GeneralSettings.tsx', import.meta.url), 'utf8');
  assert.match(source, /data-theme-option=\{value\}/);
  assert.match(source, /ideanote-theme-preview/);
  assert.match(source, /<strong>\{label\}<\/strong>/);
  assert.doesNotMatch(source, /lucide-react|\bSun\b|\bMoon\b|\bMonitor\b|<Icon/);
});

test('AI Provider settings use a configured password mask and keep model selection in Agent', async () => {
  const source = await readFile(new URL('../src/components/settings/AiProviderSettings.tsx', import.meta.url), 'utf8');
  const registry = await readFile(new URL('../src/lib/settingsSectionRegistry.ts', import.meta.url), 'utf8');
  const modelSelector = await readFile(new URL('../src/components/agent/AgentModelSelector.tsx', import.meta.url), 'utf8');
  const commands = await readFile(new URL('../src/lib/tauriCommands.ts', import.meta.url), 'utf8');
  const backend = await readFile(new URL('../src-tauri/src/provider_probe.rs', import.meta.url), 'utf8');
  assert.match(source, /type="password"/);
  assert.match(source, /const CONFIGURED_TOKEN_MASK = "[^"\r\n]+"/);
  assert.match(source, /const \[replacingCredential, setReplacingCredential\] = useState\(false\)/);
  assert.match(source, /value=\{credentialConfigured && !replacingCredential && !apiKey \? CONFIGURED_TOKEN_MASK : apiKey\}/);
  assert.match(source, /onFocus=\{\(\) => \{ if \(credentialConfigured && !apiKey\) setReplacingCredential\(true\); \}\}/);
  assert.match(source, /onBlur=\{\(\) => \{ if \(credentialConfigured && !apiKey\) setReplacingCredential\(false\); \}\}/);
  assert.match(source, /setApiKey\(""\);[\s\S]*setReplacingCredential\(false\)/);
  assert.doesNotMatch(source, /Show API key|Hide API key|Remove credential/);
  assert.match(source, /probeAiProvider/);
  assert.match(source, /await storeCredential\(apiKey\.trim\(\)\)/);
  assert.match(source, /await updateSettings/);
  assert.match(source, /availableModels: result\.models/);
  assert.match(source, /model: result\.models\.includes\(current\.ai\.model\)/);
  assert.match(source, /apiKey\.trim\(\) \? "__configured__" : credentialFingerprint/);
  assert.doesNotMatch(source, /saveDraft/);
  assert.match(source, /Testing…/);
  assert.doesNotMatch(source, /<SettingsField title="Model">|aria-label="AI model"|<select/);
  assert.doesNotMatch(registry, /Connection, credentials, and model selection/);
  assert.match(registry, /description: "Connection, credentials, and retry policy"/);
  assert.match(modelSelector, /models\.map/);
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

test('Settings pages rely on the registry header and mark continuous fields as debounced', async () => {
  const paths = [
    'src/components/settings/GeneralSettings.tsx',
    'src/components/settings/AiProviderSettings.tsx',
    'src/components/settings/AgentSettings.tsx',
    'src/components/settings/SkillSettings.tsx',
    'src/components/settings/IdeaSketchSettings.tsx',
    'src/components/settings/MarkdownSettings.tsx',
  ];
  const sources = await Promise.all(paths.map((path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')));
  for (const page of sources) assert.doesNotMatch(page, /ideanote-settings-title|<h2/);
  assert.match(sources[1], /persistence:\s*"debounced"/);
  assert.match(sources[1], /onBlur=\{\(\) => \{ void flush\(\)\.catch/);
  assert.match(sources[2], /persistence:\s*"debounced"/);
  assert.match(sources[2], /onBlur=\{\(\) => \{ void flush\(\)\.catch/);
});
