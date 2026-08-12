import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Agent Tool availability expands to the real catalog and legacy count rows are not empty disclosures', async () => {
  const activity = await readFile(new URL('../src/components/agent/AgentToolActivity.tsx', import.meta.url), 'utf8');
  const native = await readFile(new URL('../src-tauri/src/agent/mod.rs', import.meta.url), 'utf8');

  assert.match(native, /"availableTools": available_tools/);
  assert.match(native, /"source": "editor"/);
  assert.match(native, /"source": "skill"/);
  assert.match(native, /host_tools\.is_empty\(\)/);
  assert.doesNotMatch(native, /editor Tools and \{\} host Tools available/);
  assert.match(activity, /getAvailableTools/);
  assert.match(activity, /aria-label="Available editor Tools"/);
  assert.match(activity, /if \(!hasDetails\)/);
  assert.match(activity, /ideanote-agent-tool-activity__header/);
});
