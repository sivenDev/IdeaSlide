import test from 'node:test';
import assert from 'node:assert/strict';

test('Workspace panel sizing uses the approved default and hard bounds', async () => {
  const sizing = await import('../src/lib/panelSizing.ts');

  assert.equal(sizing.WORKSPACE_PANEL_DEFAULT_WIDTH, 240);
  assert.equal(sizing.WORKSPACE_PANEL_MIN_WIDTH, 180);
  assert.equal(sizing.WORKSPACE_PANEL_MAX_WIDTH, 420);
  assert.equal(sizing.clampWorkspacePanelWidth(120), 180);
  assert.equal(sizing.clampWorkspacePanelWidth(300), 300);
  assert.equal(sizing.clampWorkspacePanelWidth(560), 420);
  assert.equal(sizing.clampWorkspacePanelWidth(Number.NaN), 240);
});
