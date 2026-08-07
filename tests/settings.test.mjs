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
  assert.equal(normalizeSettings(undefined).ai.enabled, true);
  assert.equal(getAgentActivationState(false, DEFAULT_SETTINGS, false), 'loading');
  assert.equal(getAgentActivationState(true, DEFAULT_SETTINGS, false), 'configuration-required');
  assert.equal(getAgentActivationState(true, DEFAULT_SETTINGS, true), 'ready');
  assert.equal(getAgentActivationState(true, {
    ...DEFAULT_SETTINGS,
    ai: { ...DEFAULT_SETTINGS.ai, enabled: false },
  }, true), 'disabled');
});

test('settings normalization is versioned and bounds Agent steps', async () => {
  const { SETTINGS_SCHEMA_VERSION, normalizeSettings } = await loadSettingsModule();
  const normalized = normalizeSettings({
    schemaVersion: 999,
    ai: { enabled: false, baseUrl: 'https://example.test/v1/' },
    agent: { maxSteps: 100 },
  });
  assert.equal(normalized.schemaVersion, SETTINGS_SCHEMA_VERSION);
  assert.equal(normalized.ai.enabled, false);
  assert.equal(normalized.ai.baseUrl, 'https://example.test/v1');
  assert.equal(normalized.agent.maxSteps, 20);
});

test('credentials use native commands and are not part of persisted settings', async () => {
  const frontend = await readFile(new URL('../src/lib/settings.ts', import.meta.url), 'utf8');
  const backend = await readFile(new URL('../src-tauri/src/settings.rs', import.meta.url), 'utf8');
  assert.match(frontend, /invoke<CredentialStatus>\("set_ai_credential"/);
  assert.match(frontend, /invoke<CredentialStatus>\("delete_ai_credential"/);
  assert.doesNotMatch(frontend, /apiKey:\s*string;[\s\S]*interface AppSettings/);
  assert.match(backend, /keyring::\{Entry/);
  assert.match(backend, /read_provider_api_key/);
  assert.doesNotMatch(backend, /println!\([^\n]*api_key/);
});
