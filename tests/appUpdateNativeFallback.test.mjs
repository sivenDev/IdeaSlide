import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, native, workflow] = await Promise.all([
  readFile(new URL('../src/hooks/useAppUpdate.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src-tauri/src/update_fallback.rs', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8'),
]);

test('frontend official fallback uses correlated native updater commands', () => {
  assert.match(source, /checkOfficialUpdate/);
  assert.match(source, /downloadOfficialUpdate/);
  assert.match(source, /installOfficialUpdate/);
  assert.match(source, /closeOfficialUpdate/);
  assert.match(source, /source: "official"/);
});

test('native fallback pins the official endpoint and preserves updater verification', () => {
  assert.match(native, /https:\/\/github\.com\/sivenDev\/IdeaSlide\/releases\/latest\/download\/latest\.json/);
  assert.match(native, /expected_version/);
  assert.match(native, /\.download\(/);
  assert.match(native, /update\.install\(&bytes\.0\)/);
  assert.match(native, /take::<Update>/);
  assert.match(native, /take::<DownloadedBytes>/);
});

test('release workflow derives the proxy manifest only after direct validation', () => {
  const validation = workflow.indexOf('const requiredPlatforms');
  const derivation = workflow.indexOf('const proxyManifest');
  const upload = workflow.indexOf('uploadReleaseAsset');
  assert.ok(validation >= 0 && derivation > validation && upload > derivation);
  assert.match(workflow, /latest-cn\.json/);
});
