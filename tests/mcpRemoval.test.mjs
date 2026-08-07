import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function exists(relativePath) {
  try {
    await access(new URL(relativePath, root));
    return true;
  } catch {
    return false;
  }
}

test('legacy MCP runtime and renderer are removed while preview renderer remains', async () => {
  assert.equal(await exists('src-tauri/src/mcp/'), false);
  assert.equal(await exists('src/lib/mcpRenderer.ts'), false);
  assert.equal(await exists('src/lib/previewRenderer.ts'), true);

  const rust = await readFile(new URL('src-tauri/src/lib.rs', root), 'utf8');
  const app = await readFile(new URL('src/App.tsx', root), 'utf8');
  const cargo = await readFile(new URL('src-tauri/Cargo.toml', root), 'utf8');
  const capability = await readFile(new URL('src-tauri/capabilities/default.json', root), 'utf8');

  for (const source of [rust, app, cargo, capability]) {
    assert.doesNotMatch(source, /mcp-renderer|is_mcp_visible|mcp_renderer_ready|mod mcp|rmcp/);
  }
  assert.doesNotMatch(rust, /"--mcp"|"--visible"|start_server/);
  assert.match(rust, /"preview-renderer"/);
  assert.match(app, /initPreviewRenderer/);
  assert.match(capability, /preview-renderer/);
});
