import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(root, 'src');

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  }));
  return nested.flat();
}

function invokeCommands(source) {
  return [...source.matchAll(/\binvoke(?:<[^;()]*>)?\(\s*["']([a-z0-9_]+)["']/g)]
    .map((match) => match[1]);
}

test('production Tauri invokes stay inside typed desktop boundary modules', async () => {
  const allowed = new Set([
    'src/lib/agent/agentClient.ts',
    'src/lib/previewRenderer.ts',
    'src/lib/settings.ts',
    'src/lib/tauriCommands.ts',
  ]);
  const offenders = [];
  for (const file of await sourceFiles(sourceRoot)) {
    const source = await readFile(file, 'utf8');
    if (!/\binvoke(?:<|\()/.test(source)) continue;
    const relative = path.relative(root, file);
    if (!allowed.has(relative)) offenders.push(relative);
  }
  assert.deepEqual(offenders, []);
  await assert.rejects(access(path.join(sourceRoot, 'lib/cameraThumbnailRenderer.ts')));
});

test('every frontend invoke command is registered by the Tauri handler', async () => {
  const boundaries = [
    'src/lib/agent/agentClient.ts',
    'src/lib/previewRenderer.ts',
    'src/lib/settings.ts',
    'src/lib/tauriCommands.ts',
  ];
  const invoked = new Set();
  for (const boundary of boundaries) {
    const source = await readFile(path.join(root, boundary), 'utf8');
    invokeCommands(source).forEach((command) => invoked.add(command));
  }

  const native = await readFile(path.join(root, 'src-tauri/src/lib.rs'), 'utf8');
  const handler = /tauri::generate_handler!\[([\s\S]*?)\]\)/.exec(native)?.[1] ?? '';
  const registered = new Set(
    [...handler.matchAll(/(?:[a-z_][a-z0-9_]*::)*([a-z_][a-z0-9_]*)\s*,/g)]
      .map((match) => match[1]),
  );
  assert.deepEqual(
    [...invoked].filter((command) => !registered.has(command)).sort(),
    [],
  );
});

test('desktop plugins have the least required declared capabilities', async () => {
  const capability = JSON.parse(await readFile(path.join(root, 'src-tauri/capabilities/default.json'), 'utf8'));
  const permissions = new Set(capability.permissions);
  for (const permission of [
    'core:event:default',
    'core:window:allow-set-fullscreen',
    'core:window:allow-start-dragging',
    'dialog:default',
    'opener:default',
    'store:default',
  ]) {
    assert.equal(permissions.has(permission), true, `missing ${permission}`);
  }
  assert.equal(capability.windows.includes('main'), true);
  assert.equal(capability.windows.includes('preview-renderer'), true);
});

test('binary exports use the shared typed wrapper and native atomic writer', async () => {
  const drawio = await readFile(path.join(root, 'src/lib/drawioExport.ts'), 'utf8');
  const blob = await readFile(path.join(root, 'src/lib/tauriBlobDownload.ts'), 'utf8');
  const commands = await readFile(path.join(root, 'src-tauri/src/commands.rs'), 'utf8');
  assert.match(drawio, /import \{ writeFileBytes \} from "\.\/tauriCommands\.ts"/);
  assert.match(blob, /import \{ writeFileBytes \} from "\.\/tauriCommands\.ts"/);
  assert.doesNotMatch(drawio, /invoke\("write_file_bytes"/);
  assert.doesNotMatch(blob, /invoke\("write_file_bytes"/);
  assert.match(commands, /safe_write::write_bytes\([\s\S]*WriteMode::Replace/);
  assert.doesNotMatch(commands, /std::fs::write\(&path, &data\)/);
});
