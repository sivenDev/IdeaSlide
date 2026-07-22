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
