import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Workspace Loom exposes persistent left rail, authoritative editor, and independent Agent rail', async () => {
  const layout = await readSource('src/components/EditorLayout.tsx');
  const styles = await readSource('src/index.css');

  assert.match(layout, /COLLAPSED_PANEL_RAIL_WIDTH = 48/);
  assert.match(layout, /workspaceRegionWidth = COLLAPSED_PANEL_RAIL_WIDTH/);
  assert.match(layout, /agentRegionWidth = showAgent \? renderedAgentWidth : COLLAPSED_PANEL_RAIL_WIDTH/);
  assert.match(layout, /ideanote-agent-restore-rail/);
  assert.match(styles, /--ideanote-rail:\s*#101a2b/);
  assert.match(styles, /--ideanote-editor-bg:\s*#fbfcfe/);
  assert.match(styles, /--ideanote-agent-bg:\s*#f3f7f7/);
  assert.match(styles, /--ideanote-teal:\s*#2b8b7d/);
});

test('responsive buckets compact Workspace before Agent and collapse both at the native minimum', async () => {
  const layout = await readSource('src/components/EditorLayout.tsx');

  assert.match(layout, /if \(width < 960\) return "narrow"/);
  assert.match(layout, /if \(width < 1180\) return "compact"/);
  assert.match(layout, /Math\.min\(agentPanelWidth, 330\)/);
  assert.match(layout, /setShowWorkspace\(nextBucket === "wide"\)/);
  assert.match(layout, /setShowAgent\(nextBucket !== "narrow"/);
});

test('Agent context is presentation-only and populated by editor-owned labels', async () => {
  const types = await readSource('src/lib/agent/types.ts');
  const panel = await readSource('src/components/AgentPanel.tsx');
  const ideaSketch = await readSource('src/components/IdeaSketchEditor.tsx');
  const markdown = await readSource('src/components/MarkdownEditor.tsx');

  assert.match(types, /contextPresentation/);
  assert.match(panel, /Working context/);
  assert.match(panel, /Local file/);
  assert.match(ideaSketch, /Page ·/);
  assert.match(markdown, /markdownSelectionLabel/);
  assert.doesNotMatch(panel, /createToolExecutor\s*:/);
});
