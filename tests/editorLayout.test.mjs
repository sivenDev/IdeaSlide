import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8');

test('Agent panel startup follows Settings while activation and context remain authoritative', () => {
  assert.match(source, /const \{ activationState, hydrated, settings \} = useSettings\(\)/);
  assert.match(source, /useState\(false\)/);
  assert.match(source, /agentDefaultApplied/);
  assert.match(source, /settings\.agent\.openPanelByDefault/);
  assert.match(source, /activationState === "disabled" \|\| !hasAgentContext/);
  assert.match(source, /setShowAgent\(false\)/);
  assert.doesNotMatch(source, /setShowAgent\(true\)/);
  assert.match(source, /onToggleAgent=\{\(\) => setShowAgent\(\(visible\) => !visible\)\}/);
});
