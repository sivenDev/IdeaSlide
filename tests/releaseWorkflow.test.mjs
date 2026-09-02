import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

test('release packaging uses the canonical npm toolchain end to end', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/release.yml', import.meta.url),
    'utf8',
  );

  assert.equal(existsSync(`${repositoryRoot}package-lock.json`), true);
  assert.equal(
    existsSync(`${repositoryRoot}pnpm-lock.yaml`),
    false,
    'a pnpm lockfile makes tauri-action select pnpm instead of npm',
  );
  assert.match(workflow, /run: npm ci/);

  const tauriActionBlocks = workflow.match(
    /uses: tauri-apps\/tauri-action@v0[\s\S]*?(?=\n      - name:|$)/g,
  );

  assert.equal(tauriActionBlocks?.length, 2);
  for (const block of tauriActionBlocks ?? []) {
    assert.match(block, /tauriScript: npm run tauri/);
  }
});

test('stable tag releases publish only after every signed updater target is complete', async () => {
  const [workflow, packageJson, cargoToml, tauriConfig, updaterCapability, tauriLib] = await Promise.all([
    readFile(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/Cargo.toml', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/capabilities/updater.json', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8'),
  ]);

  const parsedPackage = JSON.parse(packageJson);
  const parsedConfig = JSON.parse(tauriConfig);
  const parsedCapability = JSON.parse(updaterCapability);

  assert.ok(parsedPackage.dependencies['@tauri-apps/plugin-updater']);
  assert.equal(parsedPackage.dependencies['@tauri-apps/plugin-process'], undefined);
  assert.match(cargoToml, /tauri-plugin-updater/);
  assert.doesNotMatch(cargoToml, /tauri-plugin-process/);
  assert.match(tauriLib, /tauri_plugin_updater/);
  assert.match(tauriLib, /update_relaunch::relaunch_after_update/);
  assert.doesNotMatch(tauriLib, /tauri_plugin_process/);
  assert.equal(parsedConfig.bundle.createUpdaterArtifacts, true);
  assert.match(parsedConfig.plugins.updater.pubkey, /^[A-Za-z0-9+/=]+$/);
  assert.deepEqual(parsedConfig.plugins.updater.endpoints, [
    'https://gh-proxy.com/https://github.com/sivenDev/IdeaSlide/releases/latest/download/latest-cn.json',
    'https://github.com/sivenDev/IdeaSlide/releases/latest/download/latest.json',
  ]);
  assert.deepEqual(parsedCapability.windows, ['main']);
  assert.ok(parsedCapability.permissions.includes('updater:default'));
  assert.equal(parsedCapability.permissions.includes('process:allow-restart'), false);

  assert.match(workflow, /concurrency:[\s\S]*?cancel-in-progress:\s*false/);
  assert.match(workflow, /const semver = \/\^v/);
  assert.doesNotMatch(workflow, /identifier =/);
  assert.match(workflow, /max-parallel:\s*1/);
  assert.match(workflow, /TAURI_SIGNING_PRIVATE_KEY:\s*\$\{\{ secrets\.TAURI_SIGNING_PRIVATE_KEY \}\}/);
  assert.match(workflow, /TAURI_SIGNING_PRIVATE_KEY_PASSWORD:\s*\$\{\{ secrets\.TAURI_SIGNING_PRIVATE_KEY_PASSWORD \}\}/);
  assert.match(workflow, /darwin-aarch64/);
  assert.match(workflow, /darwin-x86_64/);
  assert.match(workflow, /windows-x86_64/);
  assert.match(workflow, /latest\.json/);
  assert.match(workflow, /latest-cn\.json/);
  assert.match(workflow, /https:\/\/gh-proxy\.com\/\$\{directUrl\}/);
  assert.match(workflow, /uploadReleaseAsset/);
  assert.match(workflow, /draft:\s*false/);
  assert.match(workflow, /needs:\s*\[create-release, build\]/);
  assert.match(workflow, /assetNames\.has\(updaterAssetName\)/);
  assert.match(workflow, /assetNames\.has\(`\$\{updaterAssetName\}\.sig`\)/);
  assert.doesNotMatch(workflow, /TAURI_SIGNING_PRIVATE_KEY:\s*["']?[A-Za-z0-9+/=]{80,}/);
});
