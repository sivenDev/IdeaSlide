import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Home offers the approved IdeaNote entry points without an Agent placeholder', async () => {
  const source = await readFile(new URL('../src/components/LaunchScreen.tsx', import.meta.url), 'utf8');
  assert.match(source, />IdeaNote</);
  assert.match(source, />New File</);
  assert.match(source, />Open Workspace</);
  assert.match(source, />Open File</);
  assert.doesNotMatch(source, /AI-Powered/);
  assert.doesNotMatch(source, /Agent Panel/);
});
