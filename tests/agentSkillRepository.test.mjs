import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('managed Skill repository validates and atomically copies instruction-only folders', async () => {
  const registry = await readFile(new URL('../src-tauri/src/agent/skill_registry.rs', import.meta.url), 'utf8');
  const cargo = await readFile(new URL('../src-tauri/Cargo.toml', import.meta.url), 'utf8');
  const commands = await readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8');
  assert.match(cargo, /serde_yaml_ng/);
  assert.match(cargo, /sha2/);
  assert.match(registry, /canonicalize\(\)/);
  assert.match(registry, /file_type\.is_symlink\(\)/);
  assert.match(registry, /Skill scripts and dependency manifests are not supported/);
  assert.match(registry, /fs::rename\(&staging, target\)/);
  assert.match(registry, /content_digest\(&staging, files\)/);
  assert.match(registry, /manifest id does not match its directory/);
  assert.match(registry, /MAX_TOTAL_BYTES/);
  assert.match(registry, /MAX_CATALOG_CHARS/);
  assert.match(registry, /custom:/);
  assert.match(commands, /agent::import_agent_skill/);
  assert.match(commands, /agent::update_agent_skill/);
  assert.match(commands, /agent::remove_agent_skill/);
});

test('Skill host Tools expose opaque bounded references without widening editor capabilities', async () => {
  const registry = await readFile(new URL('../src-tauri/src/agent/skill_registry.rs', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../src-tauri/src/agent/mod.rs', import.meta.url), 'utf8');
  assert.match(registry, /name: "activate_skill"/);
  assert.match(registry, /name: "read_skill_reference"/);
  assert.match(registry, /Custom Skills cannot declare Tools, scripts, dependencies, or MCP/);
  assert.match(registry, /"persistable": false/);
  assert.match(runtime, /EPHEMERAL HOST TOOL RESULTS FOR THIS TURN ONLY/);
  assert.match(runtime, /compatibility_host_rounds > 3/);
  assert.match(runtime, /execute_host_tool/);
  assert.match(runtime, /skillActivated/);
});
