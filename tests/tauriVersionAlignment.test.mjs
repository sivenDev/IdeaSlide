import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const exactVersionPattern = /^=?([0-9]+)\.([0-9]+)\.([0-9]+)$/;

function parseExactVersion(specifier, label) {
  const match = exactVersionPattern.exec(specifier);
  assert.ok(match, `${label} must use an exact major.minor.patch version`);
  return {
    raw: match[0].replace(/^=/, ''),
    major: Number(match[1]),
    minor: Number(match[2]),
  };
}

function assertAligned(versions) {
  const lines = new Set(versions.map(({ major, minor }) => `${major}.${minor}`));
  assert.equal(
    lines.size,
    1,
    `Tauri core packages must share one major/minor line: ${versions
      .map(({ label, raw }) => `${label} ${raw}`)
      .join(', ')}`,
  );
}

function cargoManifestVersion(manifest) {
  const match = /^tauri\s*=\s*\{[^\n]*version\s*=\s*"([^"]+)"[^\n]*\}$/m.exec(manifest);
  assert.ok(match, 'src-tauri/Cargo.toml must declare the tauri dependency inline');
  return match[1];
}

function cargoLockVersion(lockfile) {
  const match = /\[\[package\]\]\nname = "tauri"\nversion = "([^"]+)"/.exec(lockfile);
  assert.ok(match, 'src-tauri/Cargo.lock must contain the tauri package');
  return match[1];
}

test('Tauri core manifests and lockfiles stay on one exact major/minor line', async () => {
  const [packageJsonSource, packageLockSource, cargoManifest, cargoLock] = await Promise.all([
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
    readFile(new URL('../package-lock.json', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/Cargo.toml', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/Cargo.lock', import.meta.url), 'utf8'),
  ]);
  const packageJson = JSON.parse(packageJsonSource);
  const packageLock = JSON.parse(packageLockSource);

  const declaredApi = parseExactVersion(
    packageJson.dependencies['@tauri-apps/api'],
    '@tauri-apps/api',
  );
  const declaredCli = parseExactVersion(
    packageJson.devDependencies['@tauri-apps/cli'],
    '@tauri-apps/cli',
  );
  const declaredRust = parseExactVersion(cargoManifestVersion(cargoManifest), 'tauri');

  const lockedApi = parseExactVersion(
    packageLock.packages['node_modules/@tauri-apps/api'].version,
    'locked @tauri-apps/api',
  );
  const lockedCli = parseExactVersion(
    packageLock.packages['node_modules/@tauri-apps/cli'].version,
    'locked @tauri-apps/cli',
  );
  const lockedRust = parseExactVersion(cargoLockVersion(cargoLock), 'locked tauri');

  assert.equal(lockedApi.raw, declaredApi.raw);
  assert.equal(lockedCli.raw, declaredCli.raw);
  assert.equal(lockedRust.raw, declaredRust.raw);

  assertAligned([
    { label: '@tauri-apps/api', ...lockedApi },
    { label: '@tauri-apps/cli', ...lockedCli },
    { label: 'tauri', ...lockedRust },
  ]);
});

test('the alignment guard rejects cross-manager minor drift', () => {
  assert.throws(
    () => assertAligned([
      { label: '@tauri-apps/api', raw: '2.11.1', major: 2, minor: 11 },
      { label: '@tauri-apps/cli', raw: '2.11.4', major: 2, minor: 11 },
      { label: 'tauri', raw: '2.10.3', major: 2, minor: 10 },
    ]),
    /must share one major\/minor line/,
  );
});
