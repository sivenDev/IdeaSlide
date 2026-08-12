import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('the updater routes relaunch through one application-owned native command', async () => {
  const [hook, desktopBoundary, native, capability, packageJson, cargoToml] = await Promise.all([
    source('src/hooks/useAppUpdate.ts'),
    source('src/lib/tauriCommands.ts'),
    source('src-tauri/src/lib.rs'),
    source('src-tauri/capabilities/updater.json'),
    source('package.json'),
    source('src-tauri/Cargo.toml'),
  ]);

  assert.match(hook, /relaunch:\s*relaunchAfterUpdate/);
  assert.match(desktopBoundary, /invoke\("relaunch_after_update"\)/);
  assert.doesNotMatch(hook, /@tauri-apps\/plugin-process|\brelaunch\b\s+from/);
  assert.match(native, /mod update_relaunch;/);
  assert.match(native, /update_relaunch::relaunch_after_update/);
  assert.doesNotMatch(native, /tauri_plugin_process::init/);
  assert.doesNotMatch(capability, /process:allow-restart/);
  assert.doesNotMatch(packageJson, /@tauri-apps\/plugin-process/);
  assert.doesNotMatch(cargoToml, /tauri-plugin-process/);
});

test('the native update relaunch boundary is fixed to LaunchServices and current bundle identity', async () => {
  const sourceText = await source('src-tauri/src/update_relaunch.rs');

  assert.match(sourceText, /const MACOS_OPEN_COMMAND: &str = "\/usr\/bin\/open"/);
  assert.match(sourceText, /OsStr::new\("-n"\)/);
  assert.match(sourceText, /tauri::process::current_binary/);
  assert.match(sourceText, /resolve_macos_bundle/);
  assert.match(sourceText, /app_handle\.exit\(0\)/);
  assert.match(sourceText, /app_handle\.request_restart\(\)/);
  assert.doesNotMatch(sourceText, /url:|path: String|command: String|args: Vec/);
});
