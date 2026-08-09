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

test('settings normalization is versioned and bounds Agent steps and Provider retries', async () => {
  const { SETTINGS_SCHEMA_VERSION, normalizeSettings } = await loadSettingsModule();
  assert.equal(SETTINGS_SCHEMA_VERSION, 2);
  const normalized = normalizeSettings({
    schemaVersion: 999,
    ai: {
      enabled: false,
      baseUrl: 'https://example.test/v1/',
      retry: { enabled: false, maxAttempts: 100 },
    },
    agent: { maxSteps: 100 },
  });
  assert.equal(normalized.schemaVersion, SETTINGS_SCHEMA_VERSION);
  assert.equal(normalized.ai.enabled, false);
  assert.equal(normalized.ai.baseUrl, 'https://example.test/v1');
  assert.deepEqual(normalized.ai.retry, { enabled: false, maxAttempts: 5 });
  assert.equal(normalized.agent.maxSteps, 20);

  const migrated = normalizeSettings({
    schemaVersion: 1,
    ai: { enabled: true, baseUrl: 'https://example.test/v1' },
  });
  assert.deepEqual(migrated.ai.retry, { enabled: true, maxAttempts: 3 });
  assert.equal(normalizeSettings({ ai: { retry: { maxAttempts: 0 } } }).ai.retry.maxAttempts, 1);
});

test('credentials use native commands and are not part of persisted settings', async () => {
  const frontend = await readFile(new URL('../src/lib/settings.ts', import.meta.url), 'utf8');
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
});

test('Agent settings explain automatic Codex selection and Compatibility fallback', async () => {
  const agentSettings = await readFile(
    new URL('../src/components/settings/AgentSettings.tsx', import.meta.url),
    'utf8',
  );
  assert.match(agentSettings, /title="Runtime selection"/);
  assert.match(agentSettings, /automatically uses the pinned Codex app-server/);
  assert.match(agentSettings, /falls back to the configured OpenAI-compatible provider/);
  assert.match(agentSettings, /listAgentRuntimes\(\)/);
  assert.match(agentSettings, /selectAgentRuntime\(runtimes/);
});
