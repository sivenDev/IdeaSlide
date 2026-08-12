import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function loadSettingsModule() {
  try {
    return await import('../src/lib/settings.ts');
  } catch {
    return {};
  }
}

test('AI defaults to enabled and requires configuration before runtime activation', async () => {
  const { DEFAULT_SETTINGS, getAgentActivationState, normalizeSettings } = await loadSettingsModule();
  assert.equal(DEFAULT_SETTINGS.ai.enabled, true);
  assert.deepEqual(DEFAULT_SETTINGS.ai.retry, { enabled: true, maxAttempts: 3 });
  assert.equal(normalizeSettings(undefined).ai.enabled, true);
  assert.equal(getAgentActivationState(false, DEFAULT_SETTINGS, false), 'loading');
  assert.equal(getAgentActivationState(true, DEFAULT_SETTINGS, false), 'configuration-required');
  assert.equal(getAgentActivationState(true, DEFAULT_SETTINGS, true), 'ready');
  assert.equal(getAgentActivationState(true, {
    ...DEFAULT_SETTINGS,
    ai: { ...DEFAULT_SETTINGS.ai, enabled: false },
  }, true), 'disabled');
});

test('settings normalization is versioned and bounds Agent policy and Provider retries', async () => {
  const { SETTINGS_SCHEMA_VERSION, normalizeSettings } = await loadSettingsModule();
  assert.equal(SETTINGS_SCHEMA_VERSION, 5);
  const normalized = normalizeSettings({
    schemaVersion: 999,
    ai: {
      enabled: false,
      baseUrl: 'https://example.test/v1/',
      model: 'model-b',
      availableModels: [' model-a ', 'model-b', 'model-a', '', 42],
      retry: { enabled: false, maxAttempts: 100 },
    },
    agent: {
      maxSteps: 100,
      contextWarningPercent: 99,
      newThreadPercent: 40,
      diagnosticRetention: 999,
      compatibilityReplayMessageLimit: 2,
      showDeliveryTelemetry: false,
    },
  });
  assert.equal(normalized.schemaVersion, SETTINGS_SCHEMA_VERSION);
  assert.equal(normalized.ai.enabled, false);
  assert.equal(normalized.ai.baseUrl, 'https://example.test/v1');
  assert.deepEqual(normalized.ai.retry, { enabled: false, maxAttempts: 5 });
  assert.deepEqual(normalized.ai.availableModels, ['model-a', 'model-b']);
  assert.equal(normalized.agent.maxSteps, 20);
  assert.equal(normalized.agent.contextWarningPercent, 90);
  assert.equal(normalized.agent.newThreadPercent, 91);
  assert.equal(normalized.agent.diagnosticRetention, 100);
  assert.equal(normalized.agent.compatibilityReplayMessageLimit, 10);
  assert.equal(normalized.agent.showDeliveryTelemetry, false);
  assert.equal(normalized.markdown.showLineNumbers, false);

  const migrated = normalizeSettings({
    schemaVersion: 1,
    ai: { enabled: true, baseUrl: 'https://example.test/v1' },
  });
  assert.deepEqual(migrated.ai.retry, { enabled: true, maxAttempts: 3 });
  assert.deepEqual(migrated.ai.availableModels, ['gpt-5-mini']);
  assert.deepEqual(migrated.markdown, { showLineNumbers: false });
  assert.equal(normalizeSettings({ markdown: { showLineNumbers: true } }).markdown.showLineNumbers, true);
  assert.equal(normalizeSettings({ ai: { retry: { maxAttempts: 0 } } }).ai.retry.maxAttempts, 1);
  assert.deepEqual(normalizeSettings(undefined).agent, {
    maxSteps: 8,
    showToolActivity: true,
    contextWarningPercent: 75,
    newThreadPercent: 90,
    diagnosticRetention: 20,
    compatibilityReplayMessageLimit: 60,
    showDeliveryTelemetry: true,
  });
});

test('credentials use native commands and are not part of persisted settings', async () => {
  const frontend = await readFile(new URL('../src/lib/settings.ts', import.meta.url), 'utf8');
  const providerSettings = await readFile(new URL('../src/components/settings/AiProviderSettings.tsx', import.meta.url), 'utf8');
  const backend = await readFile(new URL('../src-tauri/src/settings.rs', import.meta.url), 'utf8');
  const cargo = await readFile(new URL('../src-tauri/Cargo.toml', import.meta.url), 'utf8');
  assert.match(frontend, /invoke<CredentialStatus>\("set_ai_credential"/);
  assert.match(frontend, /invoke<CredentialStatus>\("delete_ai_credential"/);
  assert.doesNotMatch(frontend, /apiKey:\s*string;[\s\S]*interface AppSettings/);
  assert.match(backend, /CredentialRepository/);
  assert.match(backend, /Aes256Gcm/);
  assert.match(backend, /app_config_dir/);
  assert.match(backend, /read_provider_api_key/);
  assert.doesNotMatch(backend, /\bkeyring\b|Keychain/i);
  assert.doesNotMatch(backend, /println!\([^\n]*api_key/);
  assert.match(cargo, /aes-gcm\s*=\s*"0\.10"/);
  assert.match(cargo, /zeroize\s*=\s*"1"/);
  assert.doesNotMatch(cargo, /\bkeyring\s*=/);
  assert.match(providerSettings, /CONFIGURED_TOKEN_MASK/);
  assert.doesNotMatch(providerSettings, /setApiKey\(CONFIGURED_TOKEN_MASK\)|probeAiProvider\([^\n]*CONFIGURED_TOKEN_MASK|storeCredential\(CONFIGURED_TOKEN_MASK/);
  assert.doesNotMatch(providerSettings, /aria-label=\{CONFIGURED_TOKEN_MASK\}|placeholder=\{CONFIGURED_TOKEN_MASK\}/);
});

test('Agent settings keep automatic runtime selection concise and move the AI gate here', async () => {
  const agentSettings = await readFile(
    new URL('../src/components/settings/AgentSettings.tsx', import.meta.url),
    'utf8',
  );
  assert.match(agentSettings, /title="Runtime selection"/);
  assert.doesNotMatch(agentSettings, /Codex when compatible, otherwise the configured provider/);
  assert.match(agentSettings, /title="Enable AI"/);
  assert.match(agentSettings, /checked=\{settings\.ai\.enabled\}/);
  assert.match(agentSettings, /listAgentRuntimes\(\)/);
  assert.match(agentSettings, /selectAgentRuntime\(runtimes/);
  assert.match(agentSettings, /title="Context warning"/);
  assert.match(agentSettings, /title="New thread recommendation"/);
  assert.match(agentSettings, /title="Runtime diagnostics retained"/);
  assert.match(agentSettings, /title="Compatibility replay messages"/);
  assert.match(agentSettings, /title="Show source delivery"/);
});
