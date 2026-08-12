import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('production shell preserves reviewed geometry while F047 owns semantic theme aliases', async () => {
  const css = await source('src/index.css');
  for (const token of [
    '--paper: var(--surface-primary)',
    '--workspace: var(--surface-secondary)',
    '--agent: var(--surface-tertiary)',
    '--frost: var(--surface-inset)',
    '--graphite: var(--text-primary)',
    '--steel: var(--text-secondary)',
    '--muted: var(--text-tertiary)',
    '--line: var(--border-subtle)',
    '--line-strong: var(--border-default)',
    '--selection: var(--selection-bg)',
    '--cobalt: var(--accent-document)',
    '--danger: var(--status-danger)',
  ]) assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(css, /:root\[data-theme="dark"\][\s\S]*--surface-primary:\s*#[0-9a-f]{6}/i);
});

test('reviewed workbench geometry and document identity are executable contracts', async () => {
  const [css, crown, welcome] = await Promise.all([
    source('src/index.css'),
    source('src/components/WorkbenchCrown.tsx'),
    source('src/components/WorkbenchWelcome.tsx'),
  ]);
  assert.match(css, /\.ideanote-workbench-crown\s*\{[^}]*flex:\s*0 0 45px/s);
  assert.match(css, /\.ideanote-agent-thread-header\s*\{[^}]*min-height:\s*45px[^}]*flex:\s*0 0 45px/s);
  assert.match(css, /\.idea-slide-resize-rail\s*\{[^}]*width:\s*7px/s);
  assert.match(css, /\.idea-slide-resize-rail\s*\{[^}]*margin:\s*0 -3px/s);
  assert.match(css, /\.idea-slide-resize-rail__line\s*\{[^}]*width:\s*1px/s);
  assert.match(crown, /documentPath/);
  assert.match(crown, /ideanote-document-identity__copy/);
  assert.match(crown, /ideanote-document-identity is-welcome/);
  assert.doesNotMatch(welcome, /Open Workspace|Settings/);
  assert.match(welcome, /Open most recent/);
  assert.match(welcome, /Open File/);
  assert.match(welcome, /New File/);
});

test('Settings keeps the compact dialog while F048 owns navigation and automatic persistence', async () => {
  const [css, center, general, settingsHook, skills] = await Promise.all([
    source('src/index.css'),
    source('src/components/SettingsCenter.tsx'),
    source('src/components/settings/GeneralSettings.tsx'),
    source('src/hooks/useSettings.tsx'),
    source('src/components/settings/AgentSkillManager.tsx'),
  ]);
  assert.match(css, /\.ideanote-settings-dialog\s*\{[^}]*width:\s*min\(760px,[^}]*height:\s*min\(560px,[^}]*border-radius:\s*8px/s);
  assert.match(css, /\.ideanote-settings-header\s*\{[^}]*flex:\s*0 0 54px/s);
  assert.match(css, /\.ideanote-settings-nav\s*\{[^}]*flex:\s*0 0 190px/s);
  assert.match(css, /\.ideanote-settings-field\s*\{[^}]*min-height:\s*52px/s);
  assert.match(css, /\.ideanote-settings-toggle\s*\{[^}]*width:\s*32px[^}]*height:\s*18px/s);
  assert.doesNotMatch(center, /Save changes|saveDraft|discardDraft/);
  assert.match(center, /SettingsEditProvider/);
  assert.match(center, /sectionIcon/);
  assert.match(center, /activeDefinition\.description/);
  assert.match(center, /<Dialog\.Description className="sr-only">Application settings<\/Dialog\.Description>/);
  assert.doesNotMatch(center, /aria-describedby="settings-description"|id="settings-description"/);
  assert.doesNotMatch(settingsHook, /discardDraft|saveDraft|dirty:/);
  assert.match(settingsHook, /AUTO_SAVE_DEBOUNCE_MS\s*=\s*350/);
  assert.match(settingsHook, /createLatestSettingsWriter/);
  assert.match(settingsHook, /const flush = useCallback/);
  assert.match(settingsHook, /const retry = useCallback/);
  assert.match(general, /ideanote-theme-options/);
  assert.match(css, /\.ideanote-skills-list\s*\{[^}]*border-top:\s*1px solid var\(--line\)/s);
  assert.match(css, /\.ideanote-skill-row\s*\{[^}]*min-height:\s*52px[^}]*grid-template-columns:\s*48px minmax\(0,\s*1fr\) 93px 64px 27px/s);
  assert.match(skills, /skill\.origin === "custom"[\s\S]*?<SettingsSwitch/);
  assert.match(skills, /skill-always-on[\s\S]*?Always on/);
  assert.doesNotMatch(center, /Review Scenarios|Search settings/);
});

test('Agent crown, history overlays, and composer match the concise reviewed contract', async () => {
  const [header, selector, css] = await Promise.all([
    source('src/components/agent/AgentThreadHeader.tsx'),
    source('src/components/agent/AgentConversationSelector.tsx'),
    source('src/index.css'),
  ]);
  assert.match(header, /aria-label="New conversation"/);
  assert.match(header, /aria-label="Runtime Inspector"/);
  assert.match(header, /aria-label="Hide Agent"/);
  assert.doesNotMatch(header, /settings|Settings2/i);
  assert.doesNotMatch(selector, /statusLabel/);
  assert.match(selector, /side="right"/);
  assert.match(selector, /align="start"/);
  assert.match(selector, /collisionPadding=\{8\}/);
  assert.match(selector, /<Dialog\.Description className="sr-only">Enter a new name for this conversation\.<\/Dialog\.Description>/);
  assert.doesNotMatch(selector, /aria-describedby="delete-conversation-description"|id="delete-conversation-description"/);
  assert.match(css, /\.ideanote-agent-conversation-menu\s*\{[^}]*z-index:\s*3600/s);
  assert.match(css, /\.ideanote-agent-conversation-trigger > svg:first-child\s*\{\s*color:\s*var\(--graphite\)/);
  assert.match(css, /\.ideanote-agent-composer\s*\{[^}]*margin:\s*10px[^}]*border-radius:\s*6px/s);
});
